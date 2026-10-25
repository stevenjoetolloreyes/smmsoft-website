<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/semaphore.php';
if (current_user()) { header('Location: dashboard.php'); exit; }
$price = (float)setting_get('price_per_credit', '0.65');
$cR = (int)setting_get('cost_regular', '1'); $cP = (int)setting_get('cost_priority', '2'); $cO = (int)setting_get('cost_otp', '2');
$sender = sender_default();
$payNote = trim((string)setting_get('payment_instructions', ''));
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SMMSOFT — SMS for Philippine Businesses</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="landing">
  <header class="land-nav">
    <div class="brand"><i class="fa-solid fa-tower-broadcast"></i> SMMSOFT</div>
    <div class="rowflex">
      <a class="btn ghost small" href="login.php">Login</a>
      <a class="btn small" href="register.php">Create account</a>
    </div>
  </header>

  <section class="hero">
    <h1>Send SMS to any Philippine number —<br>from one simple dashboard.</h1>
    <p>Bulk messages, priority delivery, and OTP — with a developer API your apps can call.
       Sender name: <b><?= e($sender) ?></b> by default — or pick another from the approved pool each time you send. Credits never complicated: 1 regular SMS = <?= $cR ?> credit<?= $cR > 1 ? 's' : '' ?> per recipient.</p>
    <div class="rowflex mt">
      <a class="btn" href="register.php"><i class="fa-solid fa-rocket"></i> Start sending</a>
      <a class="btn ghost" href="login.php">I already have an account</a>
    </div>
    <p class="s" style="margin-top:14px">Globe · Smart · TNT · DITO · Sun supported &nbsp;·&nbsp; No setup fee &nbsp;·&nbsp; No monthly fee</p>
  </section>

  <section class="cards">
    <div class="card"><div class="k"><i class="fa-solid fa-paper-plane"></i> Web Sender</div>
      <div class="s" style="font-size:14px;margin-top:8px">Send from the dashboard to one number or thousands at once. Live credit counter while you type.</div></div>
    <div class="card"><div class="k"><i class="fa-solid fa-bolt"></i> Priority &amp; OTP</div>
      <div class="s" style="font-size:14px;margin-top:8px">Time-sensitive messages skip the queue (<?= $cP ?> credits). Dedicated OTP route with auto-generated codes (<?= $cO ?> credits).</div></div>
    <div class="card"><div class="k"><i class="fa-solid fa-code"></i> Developer API</div>
      <div class="s" style="font-size:14px;margin-top:8px">One POST request sends an SMS. Your API key, your balance, full message history and delivery statuses.</div></div>
    <div class="card"><div class="k"><i class="fa-solid fa-coins"></i> Simple pricing</div>
      <div class="v" style="font-size:24px">₱<?= e(number_format($price, 2)) ?><span style="font-size:14px;color:var(--mut)"> / credit</span></div>
      <div class="s">One flat rate per credit. Buy only what you need, use credits for any message type.</div></div>
  </section>

  <section class="sect">
    <h2>What each message costs</h2>
    <p class="secsub">Credits are the only currency inside SMMSOFT. Every send is charged per recipient, at the rates below — shown before you send, never after.</p>
    <table class="mtable">
      <tr><th>Message type</th><th>Credits</th><th>Cost at ₱<?= e(number_format($price, 2)) ?>/credit</th><th>Best for</th></tr>
      <tr><td><b>Regular</b></td><td><?= $cR ?></td><td>₱<?= e(number_format($price * $cR, 2)) ?></td><td>Announcements, reminders, promos</td></tr>
      <tr><td><b>Priority</b></td><td><?= $cP ?></td><td>₱<?= e(number_format($price * $cP, 2)) ?></td><td>Urgent alerts that skip the queue</td></tr>
      <tr><td><b>OTP</b></td><td><?= $cO ?></td><td>₱<?= e(number_format($price * $cO, 2)) ?></td><td>Verification codes for logins and sign-ups</td></tr>
    </table>
  </section>

  <section class="sect">
    <h2>How it works</h2>
    <div class="steps">
      <div class="step"><div class="n">1</div><h3>Create your account</h3>
        <p>Register with your name and email. Your account, API key, and wallet are created instantly — no approval wait to look around.</p></div>
      <div class="step"><div class="n">2</div><h3>Top up credits</h3>
        <p>Choose how many credits you need on the Credits page, pay using the payment instructions shown there, and submit your payment reference. Credits are added to your balance once your payment is verified.</p></div>
      <div class="step"><div class="n">3</div><h3>Send your first SMS</h3>
        <p>Type a message in the dashboard, paste numbers or upload a CSV, and send. Track every message and its status in Messages.</p></div>
    </div>
  </section>

  <section class="sect">
    <h2>Everything in your account</h2>
    <div class="cards">
      <div class="card"><div class="k"><i class="fa-solid fa-file-csv"></i> Bulk via CSV</div>
        <div class="s" style="font-size:14px;margin-top:8px">Upload a spreadsheet of numbers and send to a whole list in one go — with personalization per row.</div></div>
      <div class="card"><div class="k"><i class="fa-solid fa-address-book"></i> Contacts &amp; groups</div>
        <div class="s" style="font-size:14px;margin-top:8px">Save the numbers you message often and organize them into groups, so regular broadcasts take seconds.</div></div>
      <div class="card"><div class="k"><i class="fa-solid fa-clock-rotate-left"></i> Message history</div>
        <div class="s" style="font-size:14px;margin-top:8px">Every send is recorded with its recipient, cost, and delivery status. Your credit ledger shows each top-up and deduction.</div></div>
      <div class="card"><div class="k"><i class="fa-solid fa-key"></i> Your own API key</div>
        <div class="s" style="font-size:14px;margin-top:8px">Connect your own apps and systems. Send SMS and check your balance programmatically, anytime.</div></div>
      <div class="card"><div class="k"><i class="fa-solid fa-wallet"></i> One wallet for all</div>
        <div class="s" style="font-size:14px;margin-top:8px">Dashboard sends, bulk uploads, and API calls all draw from the same credit balance. One top-up covers everything.</div></div>
      <div class="card"><div class="k"><i class="fa-solid fa-signature"></i> Sender name pool</div>
        <div class="s" style="font-size:14px;margin-top:8px">Recipients see a name they can recognize, not a random mobile number — you pick it from the <b>approved pool</b> every time you send, on the web or through the API.</div></div>
    </div>
  </section>

  <section class="sect">
    <h2>For developers</h2>
    <p class="secsub">Send an SMS with a single request. Your API key is in your account under API Access.</p>
    <div class="codepanel">
      <div class="cp-head"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>&nbsp; POST /api/send.php</div>
      <pre>$ curl -X POST https://your-smmssoft-domain/api/send.php \
  -d "apikey=YOUR_API_KEY" \
  -d "number=09171234567" \
  -d "message=Your order has been shipped." \
  -d "kind=regular"

{ "ok": true, "sent": 1, "cost": <?= $cR ?>, "balance": 848 }</pre>
    </div>
    <p class="s" style="margin-top:10px">Full endpoint reference, parameters, and error codes: <a href="api.php" style="color:var(--acc2)">API Access page</a> after you sign in.</p>
  </section>

  <section class="sect">
    <h2>Built for Philippine teams</h2>
    <p class="secsub">Barangay and LGU announcements · class suspensions and school notices · order and delivery updates for online sellers ·
       appointment reminders for clinics · promos and restock alerts for retail · dispatch and tracking notices for logistics.</p>
  </section>

  <section class="sect">
    <h2>Common questions</h2>
    <div class="faq"><h3>What name will recipients see as the sender?</h3>
      <p>You pick the sender name for every send from the platform's approved pool — the default is <b><?= e($sender) ?></b> — so recipients always see a consistent, recognizable name on your announcements, alerts, and codes, never a random number.</p></div>
    <div class="faq"><h3>How do I get credits?</h3>
      <p>Register, open the Credits page, and choose an amount. Pay using the payment instructions shown there<?php if ($payNote !== ''): ?> (currently: <?= e($payNote) ?>)<?php endif; ?>, then submit your payment reference. Your credits are added once the payment is verified.</p></div>
    <div class="faq"><h3>Which networks can I send to?</h3>
      <p>Globe, Smart, TNT, DITO, and Sun numbers across the Philippines.</p></div>
    <div class="faq"><h3>How is a send charged?</h3>
      <p>Per recipient, by message type: Regular <?= $cR ?> credit<?= $cR > 1 ? 's' : '' ?>, Priority <?= $cP ?> credits, OTP <?= $cO ?> credits. The composer and the API both show the exact cost and your remaining balance before and after every send.</p></div>
    <div class="faq"><h3>Do I need to be a developer to use SMMSOFT?</h3>
      <p>No. The dashboard covers sending, bulk uploads, contacts, and history. The API is there only if you want to connect your own system.</p></div>
  </section>

  <section class="ctaband">
    <h2>Ready to send your first message?</h2>
    <p>Create a free account and be sending within minutes.</p>
    <a class="btn" href="register.php"><i class="fa-solid fa-rocket"></i> Create account</a>
    <a class="btn ghost" href="login.php">Login</a>
  </section>

  <footer class="land-foot">SMMSOFT · SMS services for PH businesses · Globe · Smart · TNT · DITO · Sun supported</footer>
</div>
</body>
</html>
