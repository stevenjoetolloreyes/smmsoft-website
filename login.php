<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
if (current_user()) { header('Location: dashboard.php'); exit; }
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (attempt_login($_POST['email'] ?? '', $_POST['password'] ?? '')) {
        header('Location: dashboard.php'); exit;
    }
    $err = 'Wrong email or password — or the account is suspended.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login · SMMSOFT</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="login-wrap">
  <form class="login-box" method="post">
    <div class="brand"><i class="fa-solid fa-tower-broadcast"></i> SMMSOFT</div>
    <h1>Login</h1>
    <p class="hint">Welcome back to SMMSOFT.</p>
    <?php if ($err): ?><div class="flash err"><?= e($err) ?></div><?php endif; ?>
    <label>Email</label>
    <input type="email" name="email" required autofocus>
    <label>Password</label>
    <input type="password" name="password" required>
    <div class="mt"><button class="btn" type="submit" style="width:100%;justify-content:center"><i class="fa-solid fa-right-to-bracket"></i> Login</button></div>
    <p class="hint">No account yet? <a href="register.php">Create one</a></p>
  </form>
</div>
</body>
</html>
