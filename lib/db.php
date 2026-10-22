<?php
// Database + helpers + credit wallet
require_once __DIR__ . '/../config.php';

function db() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

function setting_get($k, $default = '') {
    try {
        $st = db()->prepare('SELECT v FROM sms_settings WHERE k = ?');
        $st->execute([$k]);
        $row = $st->fetch();
        return $row === false || $row['v'] === null ? $default : $row['v'];
    } catch (Throwable $e) { return $default; }
}

function setting_set($k, $v) {
    $st = db()->prepare('INSERT INTO sms_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)');
    $st->execute([$k, $v]);
}

function e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function ph_normalize($raw) {
    $n = preg_replace('/[^0-9+]/', '', (string)$raw);
    if (strpos($n, '+63') === 0) $n = '0' . substr($n, 3);
    elseif (strpos($n, '63') === 0 && strlen($n) === 12) $n = '0' . substr($n, 2);
    if (preg_match('/^09\d{9}$/', $n)) return $n;
    return null;
}

function sms_segments($message) {
    $len = mb_strlen((string)$message);
    if ($len === 0) return 0;
    if ($len <= 160) return 1;
    return (int)ceil($len / 153);
}

// Credit cost of one send: segments x recipients x per-kind credit cost.
function send_cost($message, $recipientCount, $kind) {
    $per = (int)setting_get('cost_' . $kind, $kind === 'regular' ? '1' : '2');
    return sms_segments($message) * max(0, (int)$recipientCount) * $per;
}

function user_credits($userId) {
    $st = db()->prepare('SELECT credits FROM users WHERE id = ?');
    $st->execute([(int)$userId]);
    $r = $st->fetch();
    return $r ? (int)$r['credits'] : 0;
}

// Apply a signed credit change + write the ledger row. Returns new balance, or false if it would go negative on a debit.
function wallet_apply($userId, $delta, $type, $note = '') {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT credits FROM users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$userId]);
        $row = $st->fetch();
        if (!$row) { $pdo->rollBack(); return false; }
        $new = (int)$row['credits'] + (int)$delta;
        if ($new < 0) { $pdo->rollBack(); return false; }
        $pdo->prepare('UPDATE users SET credits = ? WHERE id = ?')->execute([$new, (int)$userId]);
        $pdo->prepare('INSERT INTO credit_transactions (user_id, type, amount, balance_after, note) VALUES (?, ?, ?, ?, ?)')
            ->execute([(int)$userId, $type, (int)$delta, $new, $note]);
        $pdo->commit();
        return $new;
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $ex;
    }
}
