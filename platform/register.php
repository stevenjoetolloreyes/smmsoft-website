<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
if (current_user()) { header('Location: dashboard.php'); exit; }
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim((string)($_POST['name'] ?? ''));
    $email = trim((string)($_POST['email'] ?? ''));
    $pass = (string)($_POST['password'] ?? '');
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $err = 'Please enter your name and a valid email.';
    elseif (strlen($pass) < 8) $err = 'Password must be at least 8 characters.';
    else {
        $st = db()->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([$email]);
        if ($st->fetch()) $err = 'That email is already registered. Please log in.';
        else {
            $welcome = max(0, (int)setting_get('welcome_credits', '0'));
            db()->prepare('INSERT INTO users (name, email, password_hash, api_key, credits) VALUES (?, ?, ?, ?, ?)')
                ->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), bin2hex(random_bytes(20)), $welcome]);
            $uid = (int)db()->lastInsertId();
            if ($welcome > 0) {
                db()->prepare('INSERT INTO credit_transactions (user_id, type, amount, balance_after, note) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$uid, 'adjust', $welcome, $welcome, 'Welcome credits']);
            }
            if (attempt_login($email, $pass)) { header('Location: dashboard.php'); exit; }
            header('Location: login.php'); exit;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Create account · SMMSOFT</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="login-wrap">
  <form class="login-box" method="post">
    <div class="brand"><i class="fa-solid fa-tower-broadcast"></i> SMMSOFT</div>
    <h1>Create your account</h1>
    <p class="hint">Send SMS from the web or through the API.</p>
    <?php if ($err): ?><div class="flash err"><?= e($err) ?></div><?php endif; ?>
    <label>Full name / Business name</label>
    <input type="text" name="name" required value="<?= e($_POST['name'] ?? '') ?>">
    <label>Email</label>
    <input type="email" name="email" required value="<?= e($_POST['email'] ?? '') ?>">
    <label>Password (min 8 characters)</label>
    <input type="password" name="password" required>
    <div class="mt"><button class="btn" type="submit" style="width:100%;justify-content:center"><i class="fa-solid fa-user-plus"></i> Create account</button></div>
    <p class="hint">Already registered? <a href="login.php">Log in</a></p>
  </form>
</div>
</body>
</html>
