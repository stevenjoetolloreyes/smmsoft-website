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

function upstream_send(array $numbers, $message, $kind = 'regular', $code = null) {
    $path = 'messages';
    if ($kind === 'priority') $path = 'priority';
    if ($kind === 'otp') $path = 'otp';
    $params = ['number' => implode(',', $numbers), 'message' => $message];
    $sender = upstream_sender();
    if ($sender !== '') $params['sendername'] = $sender;
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
function smmsoft_send($userId, array $numbers, $message, $kind = 'regular', $code = null, $source = 'web') {
    $numbers = array_values(array_unique(array_filter($numbers)));
    if (!$numbers) return ['error' => 'No valid recipients.'];
    $segments = sms_segments($message);
    $per = (int)setting_get('cost_' . $kind, $kind === 'regular' ? '1' : '2');
    $perRecipient = $segments * $per;
    $total = $perRecipient * count($numbers);
    if (user_credits($userId) < $total) {
        return ['error' => 'Insufficient credits. This send needs ' . $total . ' credit(s); your balance is ' . user_credits($userId) . '.'];
    }
    $sentIds = [];
    foreach (array_chunk($numbers, 1000) as $chunk) {
        $res = upstream_send($chunk, $message, $kind, $code);
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
    return ['ok' => true, 'sent' => count($sentIds), 'cost' => $total, 'message_ids' => $sentIds];
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
