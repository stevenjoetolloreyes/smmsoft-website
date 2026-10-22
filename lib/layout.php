<?php
require_once __DIR__ . '/auth.php';

function layout_head($title, $active) {
    $u = current_user();
    $credits = $u ? user_credits((int)$u['id']) : 0;
    $nav = function($href, $key, $icon, $label) use ($active) {
        $on = $active === $key ? 'on' : '';
        return '<a href="' . $href . '" class="' . $on . '"><i class="fa-solid ' . $icon . '"></i> ' . $label . '</a>';
    };
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($title) ?> · SMMSOFT</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="shell">
  <aside class="sidebar" id="sidebar">
    <div class="brand"><i class="fa-solid fa-tower-broadcast"></i> SMMSOFT</div>
    <nav>
      <div class="nav-label">Messaging</div>
      <?= $nav('dashboard.php', 'dashboard', 'fa-gauge-high', 'Dashboard') ?>
      <?= $nav('send.php', 'send', 'fa-paper-plane', 'Send SMS') ?>
      <?= $nav('bulk.php', 'bulk', 'fa-file-csv', 'Bulk via CSV') ?>
      <?= $nav('messages.php', 'messages', 'fa-envelope-open-text', 'Messages') ?>
      <?= $nav('contacts.php', 'contacts', 'fa-address-book', 'Contacts') ?>
      <div class="nav-label">Account</div>
      <?= $nav('credits.php', 'credits', 'fa-wallet', 'Credits') ?>
      <?= $nav('api.php', 'api', 'fa-code', 'API Access') ?>
      <?= $nav('settings.php', 'settings', 'fa-gear', 'Settings') ?>
      <?php if (!empty($u['is_admin'])): ?>
      <div class="nav-label">Platform</div>
      <?= $nav('admin.php', 'admin', 'fa-user-shield', 'Admin Panel') ?>
      <?php endif; ?>
    </nav>
    <div class="side-user">
      <div class="su-name"><?= e($u['name'] ?? '') ?></div>
      <div class="su-mail"><?= e($u['email'] ?? '') ?></div>
      <a class="su-out" href="logout.php"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>
    </div>
  </aside>
  <div class="backdrop" id="backdrop"></div>
  <main class="main">
    <div class="topbar">
      <button class="icon-btn" id="navToggle" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
      <h1><?= e($title) ?></h1>
      <div class="top-right">
        <a class="bal-pill" href="credits.php"><i class="fa-solid fa-coins"></i> Credits&nbsp;<b><?= e(number_format($credits)) ?></b></a>
        <span class="user-chip"><i class="fa-solid fa-circle-user"></i> <?= e($u['name'] ?? '') ?></span>
      </div>
    </div>
<?php
}
function layout_foot() {
    ?>
  </main>
</div>
<script src="assets/app.js"></script>
</body>
</html>
<?php
}
function flash($kind, $msg) {
    echo '<div class="flash ' . e($kind) . '">' . e($msg) . '</div>';
}
function status_pill($status) {
    $map = ['Sent'=>'ok','Queued'=>'warn','Pending'=>'warn','Failed'=>'bad','Refunded'=>'mute',
            'pending'=>'warn','approved'=>'ok','rejected'=>'bad','active'=>'ok','suspended'=>'bad'];
    $c = $map[$status] ?? 'mute';
    return '<span class="pill ' . $c . '">' . e($status) . '</span>';
}
