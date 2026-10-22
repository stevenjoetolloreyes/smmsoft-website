<?php
// SMMSOFT Customer API — account info.
// GET /api/account.php?apikey=YOUR_KEY  (or header X-Api-Key)
require_once __DIR__ . '/../lib/db.php';

header('Content-Type: application/json');
$key = (string)($_SERVER['HTTP_X_API_KEY'] ?? ($_GET['apikey'] ?? ''));
if ($key === '') { http_response_code(401); echo json_encode(['ok' => false, 'error' => 'Missing apikey.']); exit; }
$st = db()->prepare('SELECT id, name, email, credits, status FROM users WHERE api_key = ?');
$st->execute([$key]);
$user = $st->fetch();
if (!$user) { http_response_code(401); echo json_encode(['ok' => false, 'error' => 'Invalid apikey.']); exit; }
echo json_encode([
    'ok' => true,
    'account_name' => $user['name'],
    'email' => $user['email'],
    'status' => $user['status'],
    'credit_balance' => (int)$user['credits'],
]);
