<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];

$msg = ''; $error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check()) {
    $act = $_POST['act'] ?? '';
    if ($act === 'name') {
        $name = trim((string)$_POST['name']);
        if ($name !== '') {
            db()->prepare('UPDATE users SET name = ? WHERE id = ?')->execute([$name, $uid]);
            $_SESSION['smm_user']['name'] = $name;
            $msg = 'Name saved.';
        }
    } elseif ($act === 'password') {
        $row = user_row($uid);
        if (!password_verify((string)$_POST['current'], $row['password_hash'])) $error = 'Current password is wrong.';
        elseif (strlen((string)$_POST['new']) < 8) $error = 'New password must be at least 8 characters.';
        elseif ($_POST['new'] !== $_POST['new2']) $error = 'New passwords do not match.';
        else {
            db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                ->execute([password_hash((string)$_POST['new'], PASSWORD_DEFAULT), $uid]);
            $msg = 'Password changed.';
        }
    }
}
$row = user_row($uid);

layout_head('Settings', 'settings');
if ($msg) flash('ok', $msg);
if ($error) flash('err', $error);
?>
<div class="panel">
  <h2><i class="fa-solid fa-user"></i> Profile</h2>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="name">
    <label>Name / Business name</label>
    <input type="text" name="name" value="<?= e($row['name']) ?>" required>
    <label>Email (login)</label>
    <input type="text" value="<?= e($row['email']) ?>" disabled>
    <div class="mt"><button class="btn" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button></div>
  </form>
</div>
<div class="panel">
  <h2><i class="fa-solid fa-lock"></i> Change Password</h2>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="password">
    <label>Current password</label><input type="password" name="current" required>
    <label>New password (min 8 characters)</label><input type="password" name="new" required>
    <label>Repeat new password</label><input type="password" name="new2" required>
    <div class="mt"><button class="btn" type="submit"><i class="fa-solid fa-floppy-disk"></i> Change password</button></div>
  </form>
</div>
<?php layout_foot(); ?>
