<?php
require_once __DIR__ . '/db.php';

function auth_start() {
    if (session_status() === PHP_SESSION_NONE) session_start();
}
function current_user() {
    auth_start();
    return $_SESSION['smm_user'] ?? null;
}
function require_login() {
    if (!current_user()) { header('Location: login.php'); exit; }
}
function require_admin() {
    require_login();
    if (empty(current_user()['is_admin'])) { header('Location: dashboard.php'); exit; }
}
function user_row($id) {
    $st = db()->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([(int)$id]);
    return $st->fetch() ?: null;
}
function attempt_login($email, $password) {
    $st = db()->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([trim($email)]);
    $u = $st->fetch();
    if ($u && $u['status'] === 'active' && password_verify($password, $u['password_hash'])) {
        auth_start();
        session_regenerate_id(true);
        $_SESSION['smm_user'] = ['id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name'], 'is_admin' => (int)$u['is_admin']];
        return true;
    }
    return false;
}
function logout_user() {
    auth_start();
    $_SESSION = [];
    session_destroy();
}
function csrf_token() {
    auth_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}
function csrf_check() {
    auth_start();
    return isset($_POST['csrf']) && hash_equals($_SESSION['csrf'] ?? '', (string)$_POST['csrf']);
}
