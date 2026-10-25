<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/semaphore.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];

$result = null; $error = '';
$prefill = '';
if (!empty($_GET['group'])) {
    $st = db()->prepare('SELECT number FROM sms_contacts WHERE user_id = ? AND group_name = ? ORDER BY name');
    $st->execute([$uid, $_GET['group']]);
    $prefill = implode("\n", array_column($st->fetchAll(), 'number'));
}
if (!empty($_GET['to'])) $prefill = (string)$_GET['to'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { $error = 'Session expired. Please try again.'; }
    else {
        $valid = []; $invalid = [];
        foreach (preg_split('/[\n,]+/', (string)($_POST['recipients'] ?? '')) as $r) {
            $r = trim($r); if ($r === '') continue;
            $n = ph_normalize($r);
            if ($n) $valid[] = $n; else $invalid[] = $r;
        }
        $message = trim((string)($_POST['message'] ?? ''));
        $kindRaw = $_POST['kind'] ?? 'regular';
        $kind = in_array($kindRaw, ['regular','priority','otp'], true) ? $kindRaw : 'regular';
        $code = trim((string)($_POST['otp_code'] ?? ''));
        if (!$valid) $error = 'No valid PH mobile numbers. Use 09xxxxxxxxx format.';
        elseif ($message === '') $error = 'Message is empty.';
        elseif (stripos($message, 'TEST') === 0) $error = 'Messages starting with the word TEST are silently ignored by the network. Please change the first word.';
        else {
            $res = smmsoft_send($uid, $valid, $message, $kind, $kind === 'otp' ? $code : null, 'web', trim((string)($_POST['sender'] ?? '')));
            if (!empty($res['error'])) $error = $res['error'];
            else {
                $result = 'Sent/queued ' . $res['sent'] . ' message(s) · ' . $res['cost'] . ' credit(s) charged. New balance: ' . number_format(user_credits($uid)) . '.';
                if ($invalid) $result .= ' Skipped invalid: ' . implode(', ', $invalid);
            }
        }
    }
}

layout_head('Send SMS', 'send');
if ($result) flash('ok', $result);
if ($error) flash('err', $error);
?>
<p class="page-sub">Send an SMS to one or many mobile numbers.</p>

<div class="tabs">
  <a href="send.php" class="on">Single message</a>
  <a href="bulk.php">Bulk via CSV</a>
</div>

<div class="send-grid">
  <div class="panel">
    <h2><i class="fa-solid fa-pen-to-square"></i> Message Details</h2>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
      <label>Sender name — pick from the approved pool</label>
      <?php $poolSenders = senders_pool(); $selSender = sender_pool_name($_POST['sender'] ?? '') ?: sender_default(); ?>
      <select name="sender">
        <?php foreach ($poolSenders as $sn): ?>
        <option value="<?= e($sn) ?>" <?= $sn === $selSender ? 'selected' : '' ?>><?= e($sn) ?><?= $sn === sender_default() ? ' (default)' : '' ?></option>
        <?php endforeach; ?>
      </select>
      <p class="hint">Recipients see this name as the sender — never a random number.</p>
      <label>Recipients — one per line, or separated by commas (PH numbers, 09xxxxxxxxx)</label>
      <textarea id="recipients" name="recipients" rows="4" placeholder="09171234567&#10;09981234567"><?= e($_POST['recipients'] ?? $prefill) ?></textarea>
      <label>Message type</label>
      <select id="kindSel" name="kind">
        <option value="regular" <?= (($_POST['kind'] ?? '')==='regular')?'selected':'' ?>>Regular — <?= (int)setting_get('cost_regular','1') ?> credit per SMS part</option>
        <option value="priority" <?= (($_POST['kind'] ?? '')==='priority')?'selected':'' ?>>Priority — <?= (int)setting_get('cost_priority','2') ?> credits, skips the queue</option>
        <option value="otp" <?= (($_POST['kind'] ?? '')==='otp')?'selected':'' ?>>OTP — <?= (int)setting_get('cost_otp','2') ?> credits, dedicated OTP route (use {otp} in the message)</option>
      </select>
      <div id="otpCodeRow" style="display:<?= (($_POST['kind'] ?? '')==='otp')?'block':'none' ?>">
        <label>Your own OTP code (optional — leave blank and one is generated for you; the code replaces {otp} in the message)</label>
        <input type="text" name="otp_code" maxlength="10" value="<?= e($_POST['otp_code'] ?? '') ?>">
      </div>
      <label>Message</label>
      <textarea id="msgBox" name="message" rows="5" placeholder="Type your message here"><?= e($_POST['message'] ?? '') ?></textarea>
      <div class="counters">
        <span>CHARACTERS <b id="charCount">0 / 670</b></span>
        <span>CREDITS NEEDED <b id="credCount">0</b></span>
        <span class="count" id="msgCount" style="margin:0"></span>
      </div>
      <div class="mt"><button class="btn" type="submit"><i class="fa-solid fa-paper-plane"></i> Send message</button></div>
      <p class="hint">Your balance: <b><?= e(number_format(user_credits($uid))) ?> credits</b>. Credits are charged only for messages the network accepts.</p>
    </form>
  </div>
  <div class="send-side">
    <div class="panel">
      <h2><i class="fa-solid fa-layer-group"></i> Message Types</h2>
      <ul class="type-list">
        <li><b>Regular</b><span><?= (int)setting_get('cost_regular','1') ?> credit per part — everyday announcements and updates.</span></li>
        <li><b>Priority</b><span><?= (int)setting_get('cost_priority','2') ?> credits per part — skips the regular queue for urgent alerts.</span></li>
        <li><b>OTP</b><span><?= (int)setting_get('cost_otp','2') ?> credits per part — dedicated route for codes. Write {otp} where the code goes.</span></li>
      </ul>
      <p class="hint">One part is 160 characters; longer messages continue at 153 characters per part.</p>
    </div>
    <div class="panel">
      <h2><i class="fa-solid fa-shield-halved"></i> Tips for Clean Delivery</h2>
      <ul class="tips">
        <li>Write clearly, like a message from your business — proper words, normal capitalization.</li>
        <li>Avoid ALL-CAPS text and long strings of symbols; networks read them as spam.</li>
        <li>Say who you are in the message when it matters ("This is Ana from…").</li>
        <li>Send promos only to customers who agreed to receive them.</li>
        <li>Keep it under 160 characters when you can — one part, one credit.</li>
      </ul>
    </div>
  </div>
</div>
<script>
var ks = document.getElementById('kindSel'), row = document.getElementById('otpCodeRow');
ks.addEventListener('change', function(){ row.style.display = ks.value === 'otp' ? 'block' : 'none'; });
</script>
<?php layout_foot(); ?>
