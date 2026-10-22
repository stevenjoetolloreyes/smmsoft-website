<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];

$msg = ''; $error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check()) {
    $act = $_POST['act'] ?? '';
    if ($act === 'add') {
        $n = ph_normalize($_POST['number'] ?? '');
        if (!$n) $error = 'Invalid number. Use 09xxxxxxxxx.';
        elseif (trim($_POST['name'] ?? '') === '') $error = 'Name is required.';
        else {
            db()->prepare('INSERT INTO sms_contacts (user_id, name, number, group_name) VALUES (?, ?, ?, ?)')
                ->execute([$uid, trim($_POST['name']), $n, trim($_POST['group_name'] ?? '') ?: 'General']);
            $msg = 'Contact added.';
        }
    } elseif ($act === 'del') {
        db()->prepare('DELETE FROM sms_contacts WHERE id = ? AND user_id = ?')->execute([(int)$_POST['id'], $uid]);
        $msg = 'Contact deleted.';
    }
}
$st = db()->prepare('SELECT * FROM sms_contacts WHERE user_id = ? ORDER BY group_name, name'); $st->execute([$uid]);
$contacts = $st->fetchAll();
$st = db()->prepare('SELECT group_name, COUNT(*) c FROM sms_contacts WHERE user_id = ? GROUP BY group_name ORDER BY group_name'); $st->execute([$uid]);
$groups = $st->fetchAll();

layout_head('Contacts', 'contacts');
if ($msg) flash('ok', $msg);
if ($error) flash('err', $error);
?>
<div class="grid2">
  <div class="panel">
    <h2><i class="fa-solid fa-user-plus"></i> Add Contact</h2>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="act" value="add">
      <label>Name</label><input type="text" name="name" required>
      <label>Mobile number</label><input type="text" name="number" placeholder="09xxxxxxxxx" required>
      <label>Group</label><input type="text" name="group_name" placeholder="General" list="grouplist">
      <datalist id="grouplist"><?php foreach ($groups as $g): ?><option value="<?= e($g['group_name']) ?>"><?php endforeach; ?></datalist>
      <div class="mt"><button class="btn" type="submit"><i class="fa-solid fa-plus"></i> Add</button></div>
    </form>
  </div>
  <div class="panel">
    <h2><i class="fa-solid fa-layer-group"></i> Groups</h2>
    <?php if (!$groups): ?><p class="hint">No groups yet.</p><?php endif; ?>
    <?php foreach ($groups as $g): ?>
      <div class="rowflex" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0">
        <span><?= e($g['group_name']) ?> <span class="hint">(<?= e($g['c']) ?>)</span></span>
        <a class="btn ghost small" href="send.php?group=<?= e(urlencode($g['group_name'])) ?>"><i class="fa-solid fa-paper-plane"></i> Send to group</a>
      </div>
    <?php endforeach; ?>
  </div>
</div>
<div class="panel">
  <h2><i class="fa-solid fa-address-book"></i> All Contacts (<?= count($contacts) ?>)</h2>
  <div style="overflow-x:auto"><table>
    <tr><th>Name</th><th>Number</th><th>Group</th><th></th></tr>
    <?php foreach ($contacts as $c): ?>
    <tr>
      <td><?= e($c['name']) ?></td><td><?= e($c['number']) ?></td><td><?= e($c['group_name']) ?></td>
      <td class="rowflex">
        <a class="btn ghost small" href="send.php?to=<?= e(urlencode($c['number'])) ?>"><i class="fa-solid fa-paper-plane"></i> Text</a>
        <form method="post" onsubmit="return confirm('Delete this contact?')">
          <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
          <input type="hidden" name="act" value="del"><input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
          <button class="btn danger small" type="submit"><i class="fa-solid fa-trash"></i></button>
        </form>
      </td>
    </tr>
    <?php endforeach; ?>
  </table></div>
</div>
<?php layout_foot(); ?>
