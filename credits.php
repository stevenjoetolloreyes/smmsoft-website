<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];
$price = (float)setting_get('price_per_credit', '0.65');

$msg = ''; $error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check()) {
    $credits = (int)($_POST['credits'] ?? 0);
    $ref = trim((string)($_POST['pay_ref'] ?? ''));
    if ($credits < 10) $error = 'Minimum top-up is 10 credits.';
    elseif ($ref === '') $error = 'Please enter your payment reference number so the admin can verify it.';
    else {
        db()->prepare('INSERT INTO topups (user_id, credits_wanted, amount_peso, pay_ref) VALUES (?, ?, ?, ?)')
            ->execute([$uid, $credits, $credits * $price, $ref]);
        $msg = 'Top-up request submitted. Credits will appear once the admin verifies your payment.';
    }
}
$st = db()->prepare('SELECT * FROM topups WHERE user_id = ? ORDER BY id DESC LIMIT 10'); $st->execute([$uid]);
$myTopups = $st->fetchAll();
$st = db()->prepare('SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 30'); $st->execute([$uid]);
$txns = $st->fetchAll();
$balance = user_credits($uid);

layout_head('Credits', 'credits');
if ($msg) flash('ok', $msg);
if ($error) flash('err', $error);
?>
<div class="cards">
  <div class="card"><div class="k"><i class="fa-solid fa-coins"></i> Balance</div>
    <div class="v"><?= e(number_format($balance)) ?> credits</div>
    <div class="s">₱<?= e(number_format($price, 2)) ?> per credit</div></div>
  <div class="card"><div class="k"><i class="fa-solid fa-paper-plane"></i> Regular SMS</div>
    <div class="v"><?= (int)setting_get('cost_regular','1') ?> credit</div>
    <div class="s">per 160-char part, per recipient</div></div>
  <div class="card"><div class="k"><i class="fa-solid fa-bolt"></i> Priority</div>
    <div class="v"><?= (int)setting_get('cost_priority','2') ?> credits</div>
    <div class="s">per part, skips the queue</div></div>
  <div class="card"><div class="k"><i class="fa-solid fa-key"></i> OTP</div>
    <div class="v"><?= (int)setting_get('cost_otp','2') ?> credits</div>
    <div class="s">per part, dedicated route</div></div>
</div>

<div class="grid2">
  <div class="panel">
    <h2><i class="fa-solid fa-cart-plus"></i> Buy Credits</h2>
    <p class="hint"><?= nl2br(e(setting_get('payment_instructions', ''))) ?></p>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
      <label>Credits wanted (min 10)</label>
      <input type="text" name="credits" id="buyCredits" inputmode="numeric" placeholder="100" value="<?= e($_GET['credits'] ?? '') ?>">
      <ul class="breakdown">
        <li><span>Credits</span><b id="bdCredits2">0</b></li>
        <li><span>Price per credit</span><b>₱<?= e(number_format($price, 2)) ?></b></li>
        <li><span>Total to pay</span><b id="buyPeso">₱0.00</b></li>
        <li><span>Balance after approval</span><b id="bdAfter2"><?= e(number_format($balance)) ?></b></li>
      </ul>
      <label>Payment reference number</label>
      <input type="text" name="pay_ref" placeholder="e.g. GCash ref no.">
      <div class="mt"><button class="btn" type="submit"><i class="fa-solid fa-paper-plane"></i> Submit top-up request</button></div>
    </form>
    <?php if ($myTopups): ?>
    <h2 class="mt"><i class="fa-solid fa-clock-rotate-left"></i> My Requests</h2>
    <table>
      <tr><th>Credits</th><th>Amount</th><th>Status</th><th>When</th></tr>
      <?php foreach ($myTopups as $t): ?>
      <tr><td><?= e(number_format((int)$t['credits_wanted'])) ?></td><td>₱<?= e(number_format((float)$t['amount_peso'], 2)) ?></td><td><?= status_pill($t['status']) ?></td><td><?= e($t['created_at']) ?></td></tr>
      <?php endforeach; ?>
    </table>
    <?php endif; ?>
  </div>
  <div class="panel">
    <h2><i class="fa-solid fa-receipt"></i> Credit History</h2>
    <?php if (!$txns): ?><p class="hint">No transactions yet.</p><?php else: ?>
    <div style="overflow-x:auto"><table>
      <tr><th>Type</th><th>Amount</th><th>Balance</th><th>Note</th><th>When</th></tr>
      <?php foreach ($txns as $t): ?>
      <tr>
        <td><?= e(ucfirst($t['type'])) ?></td>
        <td><?= $t['amount'] >= 0 ? '+' : '' ?><?= e((int)$t['amount']) ?></td>
        <td><?= e(number_format((int)$t['balance_after'])) ?></td>
        <td><?= e($t['note'] ?? '') ?></td>
        <td><?= e($t['created_at']) ?></td>
      </tr>
      <?php endforeach; ?>
    </table></div>
    <?php endif; ?>
  </div>
</div>
<script>
var bc = document.getElementById('buyCredits'), bp = document.getElementById('buyPeso'),
    b2 = document.getElementById('bdCredits2'), ba = document.getElementById('bdAfter2'),
    PRICE = <?= json_encode($price) ?>, BAL = <?= (int)$balance ?>;
function buyCalc(){
  var n = parseInt((bc.value || '0').replace(/[^\d]/g, ''), 10) || 0;
  if (b2) b2.textContent = n.toLocaleString();
  bp.textContent = '₱' + (n * PRICE).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  if (ba) ba.textContent = (BAL + n).toLocaleString();
}
if (bc) { bc.addEventListener('input', buyCalc); buyCalc(); }
</script>
<?php layout_foot(); ?>
