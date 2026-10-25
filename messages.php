<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/semaphore.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];

$note = '';
if (isset($_GET['refresh'])) {
    $st = db()->prepare("SELECT semaphore_id FROM sms_messages WHERE user_id = ? AND semaphore_id IS NOT NULL AND status IN ('Queued','Pending') ORDER BY id DESC LIMIT 25");
    $st->execute([$uid]);
    $upd = db()->prepare('UPDATE sms_messages SET status = ?, network = ?, updated_at = ? WHERE semaphore_id = ? AND user_id = ?');
    $c = 0;
    foreach ($st->fetchAll() as $r) {
        $m = upstream_message((int)$r['semaphore_id']);
        if (is_array($m) && !isset($m['error'])) {
            $one = isset($m['message_id']) ? $m : ($m[0] ?? null);
            if ($one && isset($one['status'])) {
                $upd->execute([(string)$one['status'], (string)($one['network'] ?? ''), (string)($one['updated_at'] ?? date('Y-m-d H:i:s')), (int)$r['semaphore_id'], $uid]);
                $c++;
            }
        }
    }
    $note = 'Refreshed ' . $c . ' message status(es).';
}

$status = $_GET['status'] ?? '';
$q = trim($_GET['q'] ?? '');
$page = max(1, (int)($_GET['page'] ?? 1));
$per = 25; $off = ($page - 1) * $per;
$where = 'user_id = ?'; $args = [$uid];
if ($status !== '') { $where .= ' AND status = ?'; $args[] = $status; }
if ($q !== '') { $where .= ' AND (recipient LIKE ? OR message LIKE ?)'; $args[] = '%' . $q . '%'; $args[] = '%' . $q . '%'; }
$st = db()->prepare("SELECT COUNT(*) c FROM sms_messages WHERE $where"); $st->execute($args);
$total = (int)$st->fetch()['c'];
$st = db()->prepare("SELECT * FROM sms_messages WHERE $where ORDER BY id DESC LIMIT $per OFFSET $off"); $st->execute($args);
$rows = $st->fetchAll();
$pages = max(1, (int)ceil($total / $per));

layout_head('Messages', 'messages');
if ($note) flash('info', $note);
?>
<div class="panel">
  <form method="get" class="rowflex">
    <select name="status" style="width:auto">
      <option value="">All statuses</option>
      <?php foreach (['Queued','Pending','Sent','Failed','Refunded'] as $s): ?>
      <option value="<?= $s ?>" <?= $status===$s?'selected':'' ?>><?= $s ?></option>
      <?php endforeach; ?>
    </select>
    <input type="text" name="q" placeholder="Search number or message" value="<?= e($q) ?>" style="width:220px">
    <button class="btn small" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Filter</button>
    <a class="btn ghost small" href="messages.php?refresh=1"><i class="fa-solid fa-rotate"></i> Refresh statuses</a>
  </form>
  <div style="overflow-x:auto" class="mt"><table>
    <tr><th>ID</th><th>Recipient</th><th>Sender</th><th>Message</th><th>Network</th><th>Status</th><th>Credits</th><th>Via</th><th>When</th></tr>
    <?php if (!$rows): ?><tr><td colspan="8" class="hint">No messages found.</td></tr><?php endif; ?>
    <?php foreach ($rows as $m): ?>
    <tr>
      <td><?= e($m['semaphore_id'] ?? '—') ?></td>
      <td><?= e($m['recipient']) ?></td>
      <td><?= e($m['sender_name'] ?: '—') ?></td>
      <td><?= e(mb_strimwidth((string)$m['message'], 0, 70, '…')) ?></td>
      <td><?= e($m['network'] ?: '—') ?></td>
      <td><?= status_pill($m['status']) ?></td>
      <td><?= e((int)$m['credits_charged']) ?></td>
      <td><?= e($m['source']) ?></td>
      <td><?= e($m['created_at'] ?: $m['logged_at']) ?></td>
    </tr>
    <?php endforeach; ?>
  </table></div>
  <div class="rowflex mt">
    <?php if ($page > 1): ?><a class="btn ghost small" href="?page=<?= $page-1 ?>&status=<?= e(urlencode($status)) ?>&q=<?= e(urlencode($q)) ?>">Prev</a><?php endif; ?>
    <span class="hint">Page <?= $page ?> of <?= $pages ?> · <?= e(number_format($total)) ?> message(s)</span>
    <?php if ($page < $pages): ?><a class="btn ghost small" href="?page=<?= $page+1 ?>&status=<?= e(urlencode($status)) ?>&q=<?= e(urlencode($q)) ?>">Next</a><?php endif; ?>
  </div>
</div>
<?php layout_foot(); ?>
