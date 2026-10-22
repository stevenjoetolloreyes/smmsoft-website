<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/semaphore.php';
require_once __DIR__ . '/lib/layout.php';
require_admin();

$tab = $_GET['tab'] ?? 'overview';
$msg = ''; $error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check()) {
    $act = $_POST['act'] ?? '';
    if ($act === 'adjust') {
        $uid2 = (int)$_POST['user_id']; $amt = (int)$_POST['amount'];
        if ($amt === 0) $error = 'Enter a non-zero amount.';
        else {
            $r = wallet_apply($uid2, $amt, 'adjust', 'Admin adjustment');
            if ($r === false) $error = 'Adjustment failed (would make the balance negative).';
            else $msg = 'Balance updated: ' . number_format($r) . ' credits.';
        }
    } elseif ($act === 'status') {
        db()->prepare('UPDATE users SET status = ? WHERE id = ? AND is_admin = 0')
            ->execute([$_POST['status'] === 'suspended' ? 'suspended' : 'active', (int)$_POST['user_id']]);
        $msg = 'User status updated.';
    } elseif ($act === 'topup') {
        $tid = (int)$_POST['topup_id'];
        $st = db()->prepare('SELECT * FROM topups WHERE id = ? AND status = "pending"');
        $st->execute([$tid]); $t = $st->fetch();
        if (!$t) $error = 'Top-up not found or already decided.';
        elseif ($_POST['decision'] === 'approve') {
            wallet_apply((int)$t['user_id'], (int)$t['credits_wanted'], 'purchase', 'Top-up #' . $tid . ' approved');
            db()->prepare('UPDATE topups SET status = "approved", decided_at = NOW() WHERE id = ?')->execute([$tid]);
            $msg = 'Top-up approved and credits added.';
        } else {
            db()->prepare('UPDATE topups SET status = "rejected", decided_at = NOW() WHERE id = ?')->execute([$tid]);
            $msg = 'Top-up rejected.';
        }
    } elseif ($act === 'settings') {
        foreach (['upstream_api_key','default_sender','price_per_credit','cost_regular','cost_priority','cost_otp','welcome_credits','payment_instructions'] as $k) {
            if (isset($_POST[$k])) setting_set($k, trim((string)$_POST[$k]));
        }
        setting_set('balance_cached_at', '0');
        $msg = 'Platform settings saved.';
    }
}

layout_head('Admin Panel', 'admin');
if ($msg) flash('ok', $msg);
if ($error) flash('err', $error);
?>
<div class="rowflex" style="margin-bottom:14px">
  <?php foreach (['overview'=>'Overview','users'=>'Users','topups'=>'Top-ups','messages'=>'All Messages','settings'=>'Platform Settings'] as $k=>$lbl): ?>
  <a class="btn <?= $tab===$k?'':'ghost' ?> small" href="admin.php?tab=<?= $k ?>"><?= $lbl ?></a>
  <?php endforeach; ?>
</div>

<?php if ($tab === 'overview'):
    $agg = db()->query("SELECT (SELECT COUNT(*) FROM users WHERE is_admin = 0) AS users,
        (SELECT COUNT(*) FROM sms_messages) AS msgs,
        (SELECT COUNT(*) FROM sms_messages WHERE status='Sent') AS sent,
        (SELECT COALESCE(SUM(-amount),0) FROM credit_transactions WHERE type='send') AS credits_sold_used,
        (SELECT COUNT(*) FROM topups WHERE status='pending') AS pending_topups")->fetch();
    $upBal = upstream_key() !== '' ? upstream_balance() : null;
?>
<div class="cards">
  <div class="card"><div class="k"><i class="fa-solid fa-users"></i> Customers</div><div class="v"><?= e(number_format((int)$agg['users'])) ?></div><div class="s"><?= e((int)$agg['pending_topups']) ?> top-up(s) waiting</div></div>
  <div class="card"><div class="k"><i class="fa-solid fa-envelope"></i> Messages (all)</div><div class="v"><?= e(number_format((int)$agg['msgs'])) ?></div><div class="s"><?= e(number_format((int)$agg['sent'])) ?> sent</div></div>
  <div class="card"><div class="k"><i class="fa-solid fa-coins"></i> Credits consumed</div><div class="v"><?= e(number_format((int)$agg['credits_sold_used'])) ?></div><div class="s">across all customers</div></div>
  <div class="card"><div class="k"><i class="fa-solid fa-tower-broadcast"></i> Upstream balance</div><div class="v"><?= $upBal === null ? '—' : e(number_format($upBal)) ?></div><div class="s">your wholesale Semaphore credits</div></div>
</div>
<?php endif; ?>

<?php if ($tab === 'users'):
    $users = db()->query('SELECT * FROM users ORDER BY is_admin DESC, id')->fetchAll();
?>
<div class="panel"><h2><i class="fa-solid fa-users"></i> Users</h2>
<div style="overflow-x:auto"><table>
  <tr><th>ID</th><th>Name</th><th>Email</th><th>Credits</th><th>Status</th><th>Adjust credits</th><th></th></tr>
  <?php foreach ($users as $x): ?>
  <tr>
    <td><?= (int)$x['id'] ?></td><td><?= e($x['name']) ?><?= $x['is_admin'] ? ' (admin)' : '' ?></td><td><?= e($x['email']) ?></td>
    <td><?= e(number_format((int)$x['credits'])) ?></td><td><?= status_pill($x['status']) ?></td>
    <td>
      <form method="post" class="rowflex">
        <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="adjust">
        <input type="hidden" name="user_id" value="<?= (int)$x['id'] ?>">
        <input type="text" name="amount" placeholder="+100 / -50" style="width:100px">
        <button class="btn small" type="submit">Apply</button>
      </form>
    </td>
    <td>
      <?php if (!$x['is_admin']): ?>
      <form method="post">
        <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="status">
        <input type="hidden" name="user_id" value="<?= (int)$x['id'] ?>">
        <input type="hidden" name="status" value="<?= $x['status'] === 'active' ? 'suspended' : 'active' ?>">
        <button class="btn <?= $x['status'] === 'active' ? 'danger' : 'ghost' ?> small" type="submit"><?= $x['status'] === 'active' ? 'Suspend' : 'Activate' ?></button>
      </form>
      <?php endif; ?>
    </td>
  </tr>
  <?php endforeach; ?>
</table></div></div>
<?php endif; ?>

<?php if ($tab === 'topups'):
    $tops = db()->query('SELECT t.*, u.name, u.email FROM topups t JOIN users u ON u.id = t.user_id ORDER BY (t.status = "pending") DESC, t.id DESC LIMIT 50')->fetchAll();
?>
<div class="panel"><h2><i class="fa-solid fa-money-bill-wave"></i> Top-up Requests</h2>
<div style="overflow-x:auto"><table>
  <tr><th>ID</th><th>User</th><th>Credits</th><th>Amount</th><th>Payment ref</th><th>Status</th><th>When</th><th></th></tr>
  <?php foreach ($tops as $t): ?>
  <tr>
    <td><?= (int)$t['id'] ?></td><td><?= e($t['name']) ?><br><span class="hint"><?= e($t['email']) ?></span></td>
    <td><?= e(number_format((int)$t['credits_wanted'])) ?></td><td>₱<?= e(number_format((float)$t['amount_peso'], 2)) ?></td>
    <td class="mono"><?= e($t['pay_ref'] ?? '') ?></td><td><?= status_pill($t['status']) ?></td><td><?= e($t['created_at']) ?></td>
    <td><?php if ($t['status'] === 'pending'): ?>
      <form method="post" class="rowflex">
        <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="topup">
        <input type="hidden" name="topup_id" value="<?= (int)$t['id'] ?>">
        <button class="btn small" type="submit" name="decision" value="approve">Approve</button>
        <button class="btn danger small" type="submit" name="decision" value="reject">Reject</button>
      </form><?php endif; ?>
    </td>
  </tr>
  <?php endforeach; ?>
</table></div></div>
<?php endif; ?>

<?php if ($tab === 'messages'):
    $all = db()->query('SELECT m.*, u.email FROM sms_messages m JOIN users u ON u.id = m.user_id ORDER BY m.id DESC LIMIT 100')->fetchAll();
?>
<div class="panel"><h2><i class="fa-solid fa-envelope-open-text"></i> Latest 100 messages (all users)</h2>
<div style="overflow-x:auto"><table>
  <tr><th>User</th><th>Recipient</th><th>Message</th><th>Status</th><th>Credits</th><th>When</th></tr>
  <?php foreach ($all as $m): ?>
  <tr><td><?= e($m['email']) ?></td><td><?= e($m['recipient']) ?></td><td><?= e(mb_strimwidth((string)$m['message'], 0, 50, '…')) ?></td>
  <td><?= status_pill($m['status']) ?></td><td><?= e((int)$m['credits_charged']) ?></td><td><?= e($m['created_at'] ?: $m['logged_at']) ?></td></tr>
  <?php endforeach; ?>
</table></div></div>
<?php endif; ?>

<?php if ($tab === 'settings'): ?>
<div class="panel">
  <h2><i class="fa-solid fa-sliders"></i> Platform Settings</h2>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="settings">
    <label>Upstream (Semaphore) API key — leave as-is to keep the saved one</label>
    <input type="text" name="upstream_api_key" value="<?= e(setting_get('upstream_api_key', '')) ?>" autocomplete="off">
    <p class="hint">Currently: <?= upstream_key() === '' ? 'NOT SET' : 'set' ?> (config.php value wins if filled). Your customers never see this key.</p>
    <label>Sender name (approved on the upstream account, max 11 chars)</label>
    <input type="text" name="default_sender" value="<?= e(setting_get('default_sender', 'SMMSOFT')) ?>" maxlength="11">
    <div class="grid2">
      <div><label>Price per credit (₱) — what customers pay</label>
      <input type="text" name="price_per_credit" value="<?= e(setting_get('price_per_credit', '0.65')) ?>"></div>
      <div><label>Welcome credits for new accounts</label>
      <input type="text" name="welcome_credits" value="<?= e(setting_get('welcome_credits', '0')) ?>"></div>
      <div><label>Cost: regular (credits per part)</label>
      <input type="text" name="cost_regular" value="<?= e(setting_get('cost_regular', '1')) ?>"></div>
      <div><label>Cost: priority (credits per part)</label>
      <input type="text" name="cost_priority" value="<?= e(setting_get('cost_priority', '2')) ?>"></div>
      <div><label>Cost: OTP (credits per part)</label>
      <input type="text" name="cost_otp" value="<?= e(setting_get('cost_otp', '2')) ?>"></div>
    </div>
    <label>Payment instructions shown to customers on the Buy Credits page</label>
    <textarea name="payment_instructions" rows="3"><?= e(setting_get('payment_instructions', '')) ?></textarea>
    <div class="mt"><button class="btn" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save settings</button></div>
  </form>
</div>
<?php endif; ?>

<?php layout_foot(); ?>
