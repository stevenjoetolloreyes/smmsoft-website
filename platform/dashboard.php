<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/semaphore.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];
$credits = user_credits($uid);

$st = db()->prepare("SELECT COUNT(*) AS total, SUM(status='Sent') AS sent, SUM(status IN ('Queued','Pending')) AS inflight, SUM(status='Failed') AS failed, SUM(DATE(logged_at) = CURDATE()) AS today FROM sms_messages WHERE user_id = ?");
$st->execute([$uid]); $stats = $st->fetch();
$st = db()->prepare("SELECT SUM(status='Sent') AS sent_month, COALESCE(SUM(credits_charged),0) AS used_month FROM sms_messages WHERE user_id = ? AND MONTH(logged_at) = MONTH(CURDATE()) AND YEAR(logged_at) = YEAR(CURDATE())");
$st->execute([$uid]); $month = $st->fetch();
$st = db()->prepare('SELECT COUNT(*) AS c FROM sms_contacts WHERE user_id = ?');
$st->execute([$uid]); $contactsCount = (int)$st->fetch()['c'];
$st = db()->prepare('SELECT * FROM sms_messages WHERE user_id = ? ORDER BY id DESC LIMIT 10');
$st->execute([$uid]); $recent = $st->fetchAll();
$price = (float)setting_get('price_per_credit', '0.65');
$monthName = date('F Y');

layout_head('Dashboard', 'dashboard');
?>
<p class="page-sub">Your balance, usage this month and quick links.</p>

<div class="quicklinks">
  <a class="btn" href="send.php"><i class="fa-solid fa-paper-plane"></i> Send SMS</a>
  <a class="btn ghost" href="api.php"><i class="fa-solid fa-key"></i> API key</a>
  <a class="btn ghost" href="credits.php"><i class="fa-solid fa-wallet"></i> Buy credits</a>
</div>

<div class="banner" id="senderBanner">
  <i class="fa-solid fa-id-badge"></i>
  <span>Your messages go out under the sender name <b><?= e(upstream_sender()) ?></b>, on Globe, Smart, DITO, Sun, TNT and TM.</span>
  <button type="button" class="banner-x" onclick="document.getElementById('senderBanner').style.display='none'" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
</div>

<div class="cards">
  <div class="card"><div class="k"><i class="fa-solid fa-coins"></i> Credits Balance</div>
    <div class="v"><?= e(number_format($credits)) ?></div>
    <div class="s">≈ ₱<?= e(number_format($credits * $price, 2)) ?> worth of SMS</div>
    <a class="card-link" href="credits.php">Buy credits <i class="fa-solid fa-arrow-right"></i></a></div>
  <div class="card"><div class="k"><i class="fa-solid fa-envelope"></i> Sent This Month</div>
    <div class="v"><?= e(number_format((int)$month['sent_month'])) ?></div>
    <div class="s"><?= e(number_format((int)$stats['today'])) ?> sent today · <?= e(number_format((int)$stats['total'])) ?> all time</div>
    <a class="card-link" href="messages.php">Messages <i class="fa-solid fa-arrow-right"></i></a></div>
  <div class="card"><div class="k"><i class="fa-solid fa-chart-simple"></i> Credits Used This Month</div>
    <div class="v"><?= e(number_format((int)$month['used_month'])) ?></div>
    <div class="s"><?= e(number_format((int)$stats['inflight'])) ?> queued / in flight · <?= e(number_format((int)$stats['failed'])) ?> failed</div>
    <a class="card-link" href="credits.php">Credit history <i class="fa-solid fa-arrow-right"></i></a></div>
  <div class="card"><div class="k"><i class="fa-solid fa-address-book"></i> Contacts</div>
    <div class="v"><?= e(number_format($contactsCount)) ?></div>
    <div class="s">saved numbers and groups</div>
    <a class="card-link" href="contacts.php">Contacts <i class="fa-solid fa-arrow-right"></i></a></div>
</div>

<div class="grid2">
  <div class="panel">
    <h2><i class="fa-solid fa-cart-plus"></i> Top Up Credits</h2>
    <p class="hint">Credits are added once your GCash payment is verified. Top-ups are confirmed by the admin — no card needed.</p>
    <label>Credits amount</label>
    <input type="text" id="dashCredits" inputmode="numeric" placeholder="500" value="500">
    <ul class="breakdown">
      <li><span>Credits</span><b id="bdCredits">500</b></li>
      <li><span>Price per credit</span><b>₱<?= e(number_format($price, 2)) ?></b></li>
      <li><span>Total to pay</span><b id="bdTotal">₱325.00</b></li>
      <li><span>Balance after approval</span><b id="bdAfter"><?= e(number_format($credits + 500)) ?></b></li>
    </ul>
    <div class="mt"><a class="btn" id="dashTopupBtn" href="credits.php?credits=500"><i class="fa-solid fa-wallet"></i> Continue to top up</a></div>
  </div>
  <div class="panel">
    <h2><i class="fa-solid fa-chart-line"></i> SMS &amp; Credits · <?= e($monthName) ?></h2>
    <ul class="breakdown">
      <li><span>Sent this month</span><b><?= e(number_format((int)$month['sent_month'])) ?></b></li>
      <li><span>Credits used this month</span><b><?= e(number_format((int)$month['used_month'])) ?></b></li>
      <li><span>Failed (all time)</span><b><?= e(number_format((int)$stats['failed'])) ?></b></li>
      <li><span>Queued / in flight</span><b><?= e(number_format((int)$stats['inflight'])) ?></b></li>
    </ul>
    <p class="hint">Failed messages are refunded to your balance when the network reports them as failed.</p>
    <div class="mt"><a class="btn ghost" href="messages.php"><i class="fa-solid fa-envelope-open-text"></i> Open message history</a></div>
  </div>
</div>

<div class="panel">
  <h2><i class="fa-solid fa-clock-rotate-left"></i> Recent Messages</h2>
  <?php if (!$recent): ?>
    <p class="hint">No messages yet. Send your first one from <a href="send.php">Send SMS</a>.</p>
  <?php else: ?>
  <div style="overflow-x:auto"><table>
    <tr><th>Recipient</th><th>Message</th><th>Network</th><th>Status</th><th>Credits</th><th>When</th></tr>
    <?php foreach ($recent as $m): ?>
    <tr>
      <td><?= e($m['recipient']) ?></td>
      <td><?= e(mb_strimwidth((string)$m['message'], 0, 60, '…')) ?></td>
      <td><?= e($m['network'] ?: '—') ?></td>
      <td><?= status_pill($m['status']) ?></td>
      <td><?= e((int)$m['credits_charged']) ?></td>
      <td><?= e($m['created_at'] ?: $m['logged_at']) ?></td>
    </tr>
    <?php endforeach; ?>
  </table></div>
  <?php endif; ?>
</div>
<script>
var dc = document.getElementById('dashCredits'), PRICE = <?= json_encode($price) ?>, BAL = <?= (int)$credits ?>;
function dashCalc(){
  var n = parseInt((dc.value || '0').replace(/[^\d]/g, ''), 10) || 0;
  document.getElementById('bdCredits').textContent = n.toLocaleString();
  document.getElementById('bdTotal').textContent = '₱' + (n * PRICE).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  document.getElementById('bdAfter').textContent = (BAL + n).toLocaleString();
  document.getElementById('dashTopupBtn').href = 'credits.php?credits=' + n;
}
if (dc) { dc.addEventListener('input', dashCalc); dashCalc(); }
</script>
<?php layout_foot(); ?>
