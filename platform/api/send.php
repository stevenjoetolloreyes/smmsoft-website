<?php
// SMMSOFT Customer API — send SMS with a per-user API key.
//
// POST /api/send.php
// Fields (form-encoded or JSON):
//   apikey   (or header X-Api-Key)  — the user's key from API Access page
//   number   — one PH number or many, comma-separated (max 1,000 per call)
//   message  — text; long messages split into parts, each part costs credits
//   kind     — regular | priority | otp   (optional)
//   otp_code — for kind=otp; replaces {otp}. Omit to auto-generate upstream.
//
// Success: {"ok":true,"sent":N,"cost":C,"balance":B,"message_ids":[...]}
// Error:   {"ok":false,"error":"..."} with HTTP 4xx/5xx.

require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/semaphore.php';

header('Content-Type: application/json');
function api_out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }

$in = $_POST;
if (!$in) {
    $raw = json_decode((string)file_get_contents('php://input'), true);
    if (is_array($raw)) $in = $raw;
}
$key = (string)($_SERVER['HTTP_X_API_KEY'] ?? ($in['apikey'] ?? ''));
if ($key === '') api_out(401, ['ok' => false, 'error' => 'Missing apikey.']);
$st = db()->prepare('SELECT * FROM users WHERE api_key = ?');
$st->execute([$key]);
$user = $st->fetch();
if (!$user) api_out(401, ['ok' => false, 'error' => 'Invalid apikey.']);
if ($user['status'] !== 'active') api_out(403, ['ok' => false, 'error' => 'Account is suspended.']);

$message = trim((string)($in['message'] ?? ''));
$kindRaw = $in['kind'] ?? 'regular';
$kind = in_array($kindRaw, ['regular', 'priority', 'otp'], true) ? $kindRaw : 'regular';
$nums = [];
foreach (preg_split('/[\n,]+/', (string)($in['number'] ?? '')) as $r) {
    $n = ph_normalize(trim($r));
    if ($n) $nums[] = $n;
}
if (!$nums) api_out(422, ['ok' => false, 'error' => 'No valid PH numbers (09xxxxxxxxx).']);
if ($message === '') api_out(422, ['ok' => false, 'error' => 'Message is empty.']);
if (stripos($message, 'TEST') === 0) api_out(422, ['ok' => false, 'error' => 'Messages starting with TEST are ignored by the network.']);

$res = smmsoft_send((int)$user['id'], $nums, $message, $kind, $kind === 'otp' ? ($in['otp_code'] ?? null) : null, 'api');
if (!empty($res['error'])) {
    $code = strpos($res['error'], 'Insufficient') === 0 ? 402 : 502;
    api_out($code, ['ok' => false, 'error' => $res['error']]);
}
api_out(200, [
    'ok' => true,
    'sent' => $res['sent'],
    'cost' => $res['cost'],
    'balance' => user_credits((int)$user['id']),
    'message_ids' => $res['message_ids'],
]);
