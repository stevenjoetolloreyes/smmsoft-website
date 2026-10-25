/* Smmsoft TSX port — end-to-end verification against the LOCAL MOCK upstream.
   Run: MOCK_UPSTREAM=1 dev server on PORT 3101, then:
   NODE_PATH=~/workspace/smtp-test/node_modules node verify-flows.cjs
   Prints PASS/FAIL per flow. Exits non-zero if any flow fails. */
const { chromium } = require('playwright-core');

const BASE = 'http://localhost:3101';
const USER = { name: 'Port Tester', email: 'porter@test.local', pass: 'test1234' };
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
async function flashText(page) {
  try {
    await page.locator('.flash').first().waitFor({ timeout: 8000 });
    return (await page.locator('.flash').first().innerText()).trim();
  } catch { return '(no flash)'; }
}
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
}
async function login(page, email, pass) {
  await page.goto(BASE + '/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(pass);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}
async function logout(page) {
  await page.goto(BASE + '/logout');
  await page.waitForURL(/\/login/, { timeout: 15000 });
}
async function balPill(page) {
  const t = await page.locator('.bal-pill').first().innerText().catch(() => '');
  const m = t.match(/([\d,]+)\s*$/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)));

  // 1. Register
  await page.goto(BASE + '/register');
  await settle(page);
  await page.locator('input[name="name"]').fill(USER.name);
  await page.locator('input[name="email"]').fill(USER.email);
  await page.locator('input[name="password"]').fill(USER.pass);
  await page.locator('input[name="confirm"]').fill(USER.pass);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  check('register → dashboard', page.url().includes('/dashboard'), page.url());
  check('fresh balance is 0', (await balPill(page)) === 0, 'pill=' + (await balPill(page)));

  // 2. Top-up request (100 credits)
  await page.goto(BASE + '/credits');
  await settle(page);
  await page.locator('input[name="credits"]').first().fill('100');
  await page.locator('input[name="pay_ref"]').fill('GCASH123');
  await page.locator('form button[type="submit"]').first().click();
  const topFlash = await flashText(page);
  check('top-up request submitted', /top-up|request|pending/i.test(topFlash), topFlash);
  await page.goto(BASE + '/credits');
  await settle(page);
  const pendingVisible = (await page.content()).includes('GCASH123');
  check('top-up row shows pay_ref', pendingVisible);

  // 3. Admin approves + adds sender MYSHOP
  await logout(page);
  await login(page, 'admin@smmsoft.local', 'admin123');
  await page.goto(BASE + '/admin?tab=topups');
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await page.waitForTimeout(2500);
  await page.goto(BASE + '/admin?tab=topups');
  const stillPending = (await page.content()).includes('GCASH123') && (await page.content()).includes('Approve');
  check('admin approves top-up (row leaves pending list)', !stillPending);
  await page.goto(BASE + '/admin?tab=senders');
  await page.locator('input[name="name"]').first().fill('MYSHOP');
  await page.getByRole('button', { name: 'Add to pool' }).click();
  const senderFlash = await flashText(page);
  check('admin adds sender MYSHOP', /added|pool/i.test(senderFlash), senderFlash);

  // 4. User balance is now 100; web send default sender
  await logout(page);
  await login(page, USER.email, USER.pass);
  check('balance after approval is 100', (await balPill(page)) === 100, 'pill=' + (await balPill(page)));
  await page.goto(BASE + '/send');
  await page.locator('textarea[name="recipients"]').fill('09171234567');
  await page.locator('textarea[name="message"]').fill('Hello from port test');
  await page.locator('form button[type="submit"]').first().click();
  const sendFlash = await flashText(page);
  check('web send (default sender)', /sent/i.test(sendFlash), sendFlash);
  check('balance 100 → 99 after 1-credit send', (await balPill(page)) === 99, 'pill=' + (await balPill(page)));

  // 5. Web send with chosen pool sender MYSHOP
  await page.goto(BASE + '/send');
  await page.locator('select[name="sender"]').selectOption({ label: 'MYSHOP' }).catch(async () => {
    await page.locator('select[name="sender"]').selectOption('MYSHOP');
  });
  await page.locator('textarea[name="recipients"]').fill('09181234567');
  await page.locator('textarea[name="message"]').fill('Hello via MYSHOP');
  await page.locator('form button[type="submit"]').first().click();
  const send2Flash = await flashText(page);
  check('web send (chosen pool sender MYSHOP)', /sent/i.test(send2Flash), send2Flash);

  // 6. Web send with unapproved sender → 422, no deduction
  const beforeBad = await balPill(page);
  await page.goto(BASE + '/send');
  await page.locator('textarea[name="recipients"]').fill('09191234567');
  await page.locator('textarea[name="message"]').fill('Hello bad sender');
  const senderSel = page.locator('select[name="sender"]');
  // The dropdown only offers pool senders; force an unpooled value via JS then submit.
  await senderSel.evaluate((el) => {
    const opt = document.createElement('option');
    opt.value = 'NOTINPOOL'; opt.text = 'NOTINPOOL'; el.appendChild(opt); el.value = 'NOTINPOOL';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('form button[type="submit"]').first().click();
  const badFlash = await flashText(page);
  const afterBad = await balPill(page);
  check('unapproved sender rejected (422 wording)', /not in the approved sender pool/i.test(badFlash), badFlash);
  check('unapproved sender deducted nothing', beforeBad === afterBad, `${beforeBad} → ${afterBad}`);

  // 7. Messages page shows the sends
  await page.goto(BASE + '/messages');
  const msgBody = await page.content();
  check('messages history lists sends', msgBody.includes('09171234567') && msgBody.includes('09181234567'));

  // 8. Contacts + group send
  await page.goto(BASE + '/contacts');
  await page.locator('form input[name="name"]').first().fill('Juan Test');
  await page.locator('form input[name="number"]').first().fill('09192223333');
  await page.locator('form input[name="group_name"]').first().fill('Friends');
  await page.locator('form button[type="submit"]').first().click();
  const cFlash = await flashText(page);
  check('contact added', /added|saved|contact/i.test(cFlash), cFlash);
  // Group send form: select group + message + submit (second form on page with name="group")
  const balBeforeGroup = await balPill(page);
  const groupForms = page.locator('form:has(select[name="group"])');
  await groupForms.first().locator('select[name="group"]').selectOption('Friends');
  await groupForms.first().locator('textarea[name="message"]').fill('Hello Friends group');
  await groupForms.first().locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
  const balAfterGroup = await balPill(page);
  check('group send (balance drops by 1)', balAfterGroup === balBeforeGroup - 1, `${balBeforeGroup} → ${balAfterGroup}`);

  // 9. Bulk CSV
  const fs = require('fs');
  fs.writeFileSync('/tmp/bulk-test.csv', 'name,number,message\nAna,09193334444,Hi Ana\nBob,09194445555,Hi Bob\n');
  await page.goto(BASE + '/bulk');
  await page.locator('input[name="csv"]').setInputFiles('/tmp/bulk-test.csv');
  await page.locator('form button[type="submit"]').first().click();
  const bFlash = await flashText(page);
  check('bulk CSV send', /2 message\(s\) queued/i.test(bFlash), bFlash);

  await browser.close();

  // 10. API send + 402 via curl (needs the user's API key from local.db)
  const { execSync } = require('child_process');
  const key = execSync(
    `node -e "const {createClient}=require('/home/hatch/workspace/smmsoft-tsx/node_modules/@libsql/client');(async()=>{const c=createClient({url:'file:/home/hatch/workspace/smmsoft-tsx/local.db'});const r=await c.execute({sql:'SELECT api_key FROM users WHERE email=?',args:['${USER.email}']});console.log(r.rows[0].api_key);c.close();})();"`,
    { encoding: 'utf8' },
  ).trim();
  check('api key readable from local db', key.length >= 20, 'len=' + key.length);
  const apiOk = execSync(
    `curl -s -X POST ${BASE}/api/send -H 'Content-Type: application/json' -d '{"apikey":"${key}","number":"09195556666","message":"API hello"}'`,
    { encoding: 'utf8' },
  );
  const apiJson = JSON.parse(apiOk);
  check('API send ok', apiJson.ok === true && apiJson.sent === 1 && apiJson.cost === 1, apiOk.slice(0, 200));
  const longMsg = 'x'.repeat(20000);
  const api402 = execSync(
    `curl -s -w '\n%{http_code}' -X POST ${BASE}/api/send -H 'Content-Type: application/json' -d '{"apikey":"${key}","number":"09196667777","message":"${longMsg}"}'`,
    { encoding: 'utf8' },
  );
  check('API insufficient balance → 402', api402.trim().endsWith('402') && /Insufficient/i.test(api402), api402.slice(0, 160));
  const apiBadKey = execSync(
    `curl -s -w '\n%{http_code}' -X POST ${BASE}/api/send -H 'Content-Type: application/json' -d '{"apikey":"nope","number":"09197778888","message":"hi"}'`,
    { encoding: 'utf8' },
  );
  check('API bad key → 401', apiBadKey.trim().endsWith('401'), apiBadKey.slice(0, 120));
  const apiAcct = execSync(
    `curl -s '${BASE}/api/account?apikey=${key}'`,
    { encoding: 'utf8' },
  );
  const acctJson = JSON.parse(apiAcct);
  check('API account shape', acctJson.ok === true && acctJson.account_name === USER.name && Array.isArray(acctJson.senders) && acctJson.senders.includes('SMMSOFT') && acctJson.default_sender === 'SMMSOFT', apiAcct.slice(0, 220));
  const apiTest = execSync(
    `curl -s -w '\n%{http_code}' -X POST ${BASE}/api/send -H 'Content-Type: application/json' -d '{"apikey":"${key}","number":"09198889999","message":"TEST should be blocked"}'`,
    { encoding: 'utf8' },
  );
  check('API TEST-blocked message → 422', apiTest.trim().endsWith('422'), apiTest.slice(0, 140));

  // 11. Admin adjust + suspend (browser again)
  const browser2 = await chromium.launch({
    executablePath: process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox'],
  });
  const apage = await browser2.newPage();
  await login(apage, 'admin@smmsoft.local', 'admin123');
  await apage.goto(BASE + '/admin?tab=users');
  // Adjust form for the test user row: find row containing porter@test.local, fill amount 50
  const userRow = apage.locator('tr:has-text("porter@test.local")').first();
  await userRow.locator('input[name="amount"]').fill('50');
  await userRow.locator('button:has-text("Apply")').click();
  await apage.waitForTimeout(2000);
  const adjFlash = await flashText(apage);
  check('admin adjust +50', /adjust|credit/i.test(adjFlash), adjFlash);
  await userRow.locator('button:has-text("Suspend")').click();
  await apage.waitForTimeout(2500);
  const susRow = await apage.locator('tr:has-text("porter@test.local")').first().innerText();
  check('admin suspends user (row shows Activate + suspended)', /Activate/i.test(susRow) && /suspended/i.test(susRow), susRow.slice(0, 120));
  await logout(apage);
  await apage.goto(BASE + '/login');
  await apage.locator('input[name="email"]').fill(USER.email);
  await apage.locator('input[name="password"]').fill(USER.pass);
  await apage.locator('form button[type="submit"]').first().click();
  await apage.waitForTimeout(3000);
  const stillLogin = apage.url().includes('/login');
  const loginFlash = await flashText(apage);
  check('suspended user cannot log in', stillLogin && /invalid|password|suspend/i.test(loginFlash), loginFlash + ' url=' + apage.url());
  // Reactivate for a clean end state
  await login(apage, 'admin@smmsoft.local', 'admin123');
  await apage.goto(BASE + '/admin?tab=users');
  const userRow2 = apage.locator('tr:has-text("porter@test.local")').first();
  await userRow2.locator('button:has-text("Activate")').click();
  await apage.waitForTimeout(2500);
  const actRow = await apage.locator('tr:has-text("porter@test.local")').first().innerText();
  check('admin reactivates user (row shows Suspend + active)', /Suspend/i.test(actRow) && /active/i.test(actRow), actRow.slice(0, 120));
  await browser2.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} flows passed.`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR:', e);
  process.exit(2);
});
