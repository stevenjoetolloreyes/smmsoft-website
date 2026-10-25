<?php
// Upstream client (Semaphore v4 API) — SMMSOFT's sending engine.
// Customers never interact with this; it is the platform's wholesale route.

function upstream_key() {
    $k = trim((string)UPSTREAM_API_KEY);
    if ($k !== '') return $k;
    return trim(setting_get('upstream_api_key', ''));
}

function upstream_sender() {
    $s = trim(setting_get('default_sender', ''));
    if ($s !== '') return $s;
    return trim((string)UPSTREAM_SENDER);
}

// ---- Sender name pool -------------------------------------------------
// Admin curates a pool of sender names (Admin > Sender Names). Every user
// picks from the pool when sending — web and API alike. A name only works
// once it is approved on the upstream (Semaphore) account; the pool is the
// platform-side list of those approved names.

function senders_ensure() {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("CREATE TABLE IF NOT EXISTS sms_senders (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(11) NOT NULL UNIQUE,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");
    $n = (int)db()->query('SELECT COUNT(*) FROM sms_senders')->fetchColumn();
    if ($n === 0) {
        $seed = upstream_sender();
        if ($seed === '') $seed = 'SMMSOFT';
        db()->prepare('INSERT IGNORE INTO sms_senders (name, is_default) VALUES (?, 1)')
            ->execute([mb_substr($seed, 0, 11)]);
    }
}

// Pool names, default first, then A–Z.
function senders_pool() {
    senders_ensure();
    return db()->query('SELECT name FROM sms_senders ORDER BY is_default DESC, name ASC')->fetchAll(PDO::FETCH_COLUMN);
}

function sender_default() {
    senders_ensure();
    $d = db()->query('SELECT name FROM sms_senders WHERE is_default = 1 ORDER BY id LIMIT 1')->fetchColumn();
    if ($d) return (string)$d;
    $p = senders_pool();
    return $p ? (string)$p[0] : upstream_sender();
}

// The pool's canonical spelling of a requested name, or null if not pooled.
function sender_pool_name($name) {
    $name = trim((string)$name);
    if ($name === '') return null;
    foreach (senders_pool() as $s) if (strcasecmp($s, $name) === 0) return $s;
    return null;
}

function upstream_call($method, $path, $params = []) {
    $key = upstream_key();
    if ($key === '') return ['error' => 'Upstream API key is not set (Admin > Settings).'];
    $params['apikey'] = $key;
    $url = rtrim(SEMAPHORE_BASE, '/') . '/' . ltrim($path, '/');
    $ch = curl_init();
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    } else {
        $url .= '?' . http_build_query($params);
    }
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($raw === false || $err) return ['error' => 'Upstream connection error: ' . $err];
    $data = json_decode($raw, true);
    if (!is_array($data)) return ['error' => 'Unexpected upstream response (HTTP ' . $code . ')'];
    if ($code >= 400) {
        $msg = $data['message'] ?? ($data['error'] ?? ('HTTP ' . $code));
        return ['error' => is_string($msg) ? $msg : 'HTTP ' . $code, 'raw' => $data];
    }
    return $data;
}

function upstream_send(array $numbers, $message, $kind = 'regular', $code = null, $sender = null) {
    $path = 'messages';
    if ($kind === 'priority') $path = 'priority';
    if ($kind === 'otp') $path = 'otp';
    $params = ['number' => implode(',', $numbers), 'message' => $message];
    $senderName = ($sender !== null && trim((string)$sender) !== '') ? trim((string)$sender) : upstream_sender();
    if ($senderName !== '') $params['sendername'] = $senderName;
    if ($kind === 'otp' && $code !== null && $code !== '') $params['code'] = $code;
    return upstream_call('POST', $path, $params);
}

function upstream_account() { return upstream_call('GET', 'account'); }
function upstream_message($id) { return upstream_call('GET', 'messages/' . (int)$id); }

// Store upstream result rows for a user. $creditsPerRecipient = credits charged per recipient (already segment-adjusted by caller per message part is NOT tracked per part — charged flat per recipient at send time).
function upstream_store_results($results, $userId, $fallbackMessage, $kind, $creditsPerRecipient, $source = 'web') {
    if (!is_array($results) || isset($results['error'])) return 0;
    $n = 0;
    $ins = db()->prepare('INSERT INTO sms_messages (user_id, semaphore_id, recipient, message, sender_name, network, status, msg_type, kind, credits_charged, source, created_at, updated_at)
                          VALUES (:uid, :sid, :rec, :msg, :snd, :net, :sta, :typ, :kind, :cred, :src, :cat, :uat)');
    foreach ($results as $m) {
        if (!is_array($m) || empty($m['message_id'])) continue;
        $ins->execute([
            'uid' => (int)$userId,
            'sid' => (int)$m['message_id'],
            'rec' => (string)($m['recipient'] ?? ''),
            'msg' => (string)($m['message'] ?? $fallbackMessage),
            'snd' => (string)($m['sender_name'] ?? ''),
            'net' => (string)($m['network'] ?? ''),
            'sta' => (string)($m['status'] ?? 'Queued'),
            'typ' => (string)($m['type'] ?? 'Single'),
            'kind' => $kind,
            'cred' => (int)$creditsPerRecipient,
            'src' => $source,
            'cat' => (string)($m['created_at'] ?? date('Y-m-d H:i:s')),
            'uat' => (string)($m['updated_at'] ?? date('Y-m-d H:i:s')),
        ]);
        $n++;
    }
    return $n;
}

// The core send operation used by BOTH the web UI and the customer API.
// Checks balance, sends via upstream, deducts credits, stores messages.
// Returns ['ok'=>true,'sent'=>N,'cost'=>C] or ['error'=> '...'].
function smmsoft_send($userId, array $numbers, $message, $kind = 'regular', $code = null, $source = 'web', $sender = null) {
    $numbers = array_values(array_unique(array_filter($numbers)));
    if (!$numbers) return ['error' => 'No valid recipients.'];
    // Resolve the sender from the pool: explicit choice must be pooled,
    // otherwise the pool default applies.
    if ($sender === null || trim((string)$sender) === '') {
        $useSender = sender_default();
    } else {
        $useSender = sender_pool_name($sender);
        if ($useSender === null) return ['error' => 'Sender name "' . trim((string)$sender) . '" is not in the approved sender pool.'];
    }
    $segments = sms_segments($message);
    $per = (int)setting_get('cost_' . $kind, $kind === 'regular' ? '1' : '2');
    $perRecipient = $segments * $per;
    $total = $perRecipient * count($numbers);
    if (user_credits($userId) < $total) {
        return ['error' => 'Insufficient credits. This send needs ' . $total . ' credit(s); your balance is ' . user_credits($userId) . '.'];
    }
    $sentIds = [];
    foreach (array_chunk($numbers, 1000) as $chunk) {
        $res = upstream_send($chunk, $message, $kind, $code, $useSender);
        if (isset($res['error'])) {
            // Refund anything already sent in earlier chunks stays charged; unsent chunks are not charged.
            return ['error' => 'Upstream error: ' . $res['error'], 'partial_sent' => count($sentIds)];
        }
        $stored = upstream_store_results($res, $userId, $message, $kind, $perRecipient, $source);
        $charge = $perRecipient * $stored;
        if ($charge > 0) {
            wallet_apply($userId, -$charge, 'send', ucfirst($kind) . ' SMS x' . $stored);
        }
        foreach ($res as $m) if (is_array($m) && isset($m['message_id'])) $sentIds[] = (int)$m['message_id'];
    }
    return ['ok' => true, 'sent' => count($sentIds), 'cost' => $total, 'message_ids' => $sentIds, 'sender' => $useSender];
}

// Upstream (Semaphore) balance, cached 2 min — informational for the admin.
function upstream_balance($force = false) {
    $cachedAt = (int)setting_get('balance_cached_at', '0');
    if (!$force && time() - $cachedAt < 120) {
        $c = setting_get('balance_cache', '');
        return $c === '' ? null : (float)$c;
    }
    $acc = upstream_account();
    if (isset($acc['credit_balance'])) {
        setting_set('balance_cache', (string)$acc['credit_balance']);
        setting_set('balance_cached_at', (string)time());
        return (float)$acc['credit_balance'];
    }
    $c = setting_get('balance_cache', '');
    return $c === '' ? null : (float)$c;
}
