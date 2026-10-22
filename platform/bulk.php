<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/semaphore.php';
require_once __DIR__ . '/lib/layout.php';
require_login();
$u = current_user(); $uid = (int)$u['id'];

if (isset($_GET['template'])) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="smmsoft-bulk-template.csv"');
    echo "number,message\n09171234567,Hello Juan, your order is ready for pickup.\n09981234567,Hello Maria, your order is ready for pickup.\n";
    exit;
}

$result = null; $error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_FILES['csv']['tmp_name'])) {
    if (!csrf_check()) { $error = 'Session expired. Please try again.'; }
    else {
        $fh = fopen($_FILES['csv']['tmp_name'], 'r');
        $rows = []; $skipped = 0; $first = true;
        while (($line = fgetcsv($fh)) !== false) {
            if ($first) { $first = false; if (strtolower(trim($line[0] ?? '')) === 'number') continue; }
            if (count($line) < 2) { $skipped++; continue; }
            $n = ph_normalize($line[0]);
            $msg = trim(implode(',', array_slice($line, 1)));
            if (!$n || $msg === '' || stripos($msg, 'TEST') === 0) { $skipped++; continue; }
            $rows[] = [$n, $msg];
        }
        fclose($fh);
        if (!$rows) $error = 'No valid rows found. Format: number,message (one per line).';
        else {
            $ok = 0; $stopErr = '';
            foreach ($rows as $r) {
                $res = smmsoft_send($uid, [$r[0]], $r[1], 'regular', null, 'web');
                if (!empty($res['error'])) { $stopErr = $res['error']; break; }
                $ok += $res['sent'];
            }
            if ($stopErr) $error = 'Stopped after ' . $ok . ' message(s): ' . $stopErr;
            else {
                $result = 'Bulk send finished: ' . $ok . ' message(s) queued. New balance: ' . number_format(user_credits($uid)) . ' credits.';
                if ($skipped) $result .= ' Skipped ' . $skipped . ' invalid row(s).';
            }
        }
    }
}

layout_head('Bulk via CSV', 'bulk');
?>
<div class="tabs">
  <a href="send.php">Single message</a>
  <a href="bulk.php" class="on">Bulk via CSV</a>
</div>
<?php
if ($result) flash('ok', $result);
if ($error) flash('err', $error);
?>
<div class="panel">
  <h2><i class="fa-solid fa-file-csv"></i> Personalized bulk sending</h2>
  <p class="hint">Upload a CSV where every row has its own message — best for names, amounts, or codes that differ per person.
  For ONE message to many people, use <a href="send.php">Send SMS</a> instead.</p>
  <p class="mt"><a class="btn ghost small" href="bulk.php?template=1"><i class="fa-solid fa-download"></i> Download CSV template</a></p>
  <form method="post" enctype="multipart/form-data">
    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
    <label>CSV file (columns: number, message)</label>
    <input type="file" name="csv" accept=".csv,text/csv" required>
    <div class="mt"><button class="btn" type="submit"><i class="fa-solid fa-upload"></i> Upload &amp; Send</button></div>
    <p class="hint">Each row costs credits like a regular send. Sending stops automatically if your balance runs out.</p>
  </form>
</div>
<?php layout_foot(); ?>
