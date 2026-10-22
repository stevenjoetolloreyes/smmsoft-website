<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
if (current_user()) { header('Location: dashboard.php'); exit; }
$price = (float)setting_get('price_per_credit', '0.65');
$cR = (int)setting_get('cost_regular', '1'); $cP = (int)setting_get('cost_priority', '2'); $cO = (int)setting_get('cost_otp', '2');
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
       Sender name: <b>SMMSOFT</b>. Credits never complicated: 1 SMS part = <?= $cR ?> credit.</p>
    <div class="rowflex mt">
      <a class="btn" href="register.php"><i class="fa-solid fa-rocket"></i> Start sending</a>
      <a class="btn ghost" href="login.php">I already have an account</a>
    </div>
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
      <div class="s">Failed messages are refunded back to your balance automatically by the network report.</div></div>
  </section>
  <footer class="land-foot">SMMSOFT · SMS services for PH businesses · Globe · Smart · DITO supported</footer>
</div>
</body>
</html>
