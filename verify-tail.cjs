/* Targeted re-check: credits top-up row + admin topups page state. */
const { chromium } = require('playwright-core');
const BASE = 'http://localhost:3101';
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  async function login(email, pass) {
    await page.goto(BASE + '/login');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(pass);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  }
  await login('porter@test.local', 'test1234');
  await page.goto(BASE + '/credits');
  const creditsText = await page.content();
  console.log('credits page has GCASH123 row:', creditsText.includes('GCASH123'));
  console.log('credits page has approved top-up:', /GCASH123[\s\S]{0,200}approved/i.test(creditsText));
  await page.goto(BASE + '/logout');
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await login('admin@smmsoft.local', 'admin123');
  await page.goto(BASE + '/admin?tab=topups');
  const topText = await page.innerText('body');
  console.log('topups page has GCASH123:', topText.includes('GCASH123'));
  console.log('topups page has Approve button:', /Approve/.test(topText));
  console.log('topups page GCASH123 context:', (topText.match(/GCASH123[\s\S]{0,120}/) || ['(absent)'])[0].replace(/\s+/g, ' '));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(2); });
