<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check()) {
    db()->prepare('UPDATE users SET api_key = ? WHERE id = ?')->execute([bin2hex(random_bytes(20)), $uid]);
    $msg = 'New API key generated. The old key stops working immediately.';
}
$row = user_row($uid);
$base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/');

layout_head('API Access', 'api');
if ($msg) flash('ok', $msg);
?>
<div class="panel">
  <h2><i class="fa-solid fa-key"></i> Your API Key</h2>
  <div style="overflow-x:auto"><table>
    <tr><th>Name</th><th>API Key</th><th>Created</th><th>Actions</th></tr>
    <tr>
      <td>Default key</td>
      <td class="mono"><span id="keyMasked"><?= e(substr($row['api_key'], 0, 8)) ?>••••••••••••••••••••••••</span><span id="keyFull" class="mono" style="display:none"><?= e($row['api_key']) ?></span></td>
      <td><?= e($row['created_at'] ?? '—') ?></td>
      <td>
        <div class="rowflex">
          <button class="btn small ghost" type="button" id="keyToggle"><i class="fa-solid fa-eye"></i> Show</button>
          <button class="btn small ghost" type="button" id="keyCopy"><i class="fa-solid fa-copy"></i> Copy</button>
          <form method="post" onsubmit="return confirm('Generate a new key? The old one stops working immediately.')" style="display:inline">
            <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
            <button class="btn small danger" type="submit"><i class="fa-solid fa-rotate"></i> Regenerate</button>
          </form>
        </div>
      </td>
    </tr>
  </table></div>
  <p class="hint">Keep this key secret — anyone with it can send SMS using your credits.</p>
</div>
<script>
var kt = document.getElementById('keyToggle'), km = document.getElementById('keyMasked'), kf = document.getElementById('keyFull');
if (kt) kt.addEventListener('click', function(){
  var shown = kf.style.display !== 'none';
  kf.style.display = shown ? 'none' : 'inline';
  km.style.display = shown ? 'inline' : 'none';
  kt.innerHTML = shown ? '<i class="fa-solid fa-eye"></i> Show' : '<i class="fa-solid fa-eye-slash"></i> Hide';
});
var kc = document.getElementById('keyCopy');
if (kc) kc.addEventListener('click', function(){
  var done = function(){ kc.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; setTimeout(function(){ kc.innerHTML = '<i class="fa-solid fa-copy"></i> Copy'; }, 1600); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(kf.textContent).then(done, done);
  else { var ta = document.createElement('textarea'); ta.value = kf.textContent; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); done(); }
});
</script>

<div class="panel">
  <h2><i class="fa-solid fa-paper-plane"></i> Send an SMS</h2>
  <p class="hint">POST to <span class="mono"><?= e($base) ?>/api/send.php</span> with these fields (form-encoded or JSON):</p>
  <table>
    <tr><th>Field</th><th>Required</th><th>Notes</th></tr>
    <tr><td class="mono">apikey</td><td>Yes</td><td>Your API key above (or send header <span class="mono">X-Api-Key</span>)</td></tr>
    <tr><td class="mono">number</td><td>Yes</td><td>One PH number, or many separated by commas (max 1,000 per call)</td></tr>
    <tr><td class="mono">message</td><td>Yes</td><td>Your text. Long messages are split into parts; each part costs credits.</td></tr>
    <tr><td class="mono">kind</td><td>No</td><td><span class="mono">regular</span> (default), <span class="mono">priority</span>, or <span class="mono">otp</span></td></tr>
    <tr><td class="mono">otp_code</td><td>No</td><td>For kind=otp: your own code; replaces {otp} in the message. Omit to auto-generate.</td></tr>
  </table>
  <label>Example (cURL)</label>
  <textarea rows="6" readonly class="mono">curl -X POST <?= e($base) ?>/api/send.php \
  -d "apikey=<?= e($row['api_key']) ?>" \
  -d "number=09171234567" \
  -d "message=Hello from SMMSOFT API"</textarea>
  <label>Success response</label>
  <textarea rows="4" readonly class="mono">{"ok":true,"sent":1,"cost":1,"balance":99,"message_ids":[12345]}</textarea>
  <label>Check your balance</label>
  <textarea rows="2" readonly class="mono">GET <?= e($base) ?>/api/account.php?apikey=YOUR_KEY</textarea>
  <p class="hint">Errors return JSON like <span class="mono">{"ok":false,"error":"Insufficient credits..."}</span> with an HTTP status code.</p>
</div>
<?php layout_foot(); ?>
