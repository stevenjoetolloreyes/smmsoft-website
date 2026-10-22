// Mobile sidebar
var sb = document.getElementById('sidebar'), bd = document.getElementById('backdrop'), tg = document.getElementById('navToggle');
if (tg) tg.addEventListener('click', function(){ sb.classList.add('open'); bd.classList.add('on'); });
if (bd) bd.addEventListener('click', function(){ sb.classList.remove('open'); bd.classList.remove('on'); });

// SMS character / segment / credit counter
function smsCount(text) {
  var len = text.length;
  if (len === 0) return { len: 0, seg: 0 };
  return { len: len, seg: len <= 160 ? 1 : Math.ceil(len / 153) };
}
var msgBox = document.getElementById('msgBox'), msgCount = document.getElementById('msgCount'),
    recBox = document.getElementById('recipients'), kindSel = document.getElementById('kindSel');
function recCount() {
  if (!recBox) return 0;
  return recBox.value.split(/[\n,]+/).map(function(s){ return s.trim(); }).filter(Boolean).length;
}
function updateCount() {
  if (!msgBox || !msgCount) return;
  var c = smsCount(msgBox.value), r = recCount();
  var per = (kindSel && kindSel.value !== 'regular') ? 2 : 1;
  var credits = c.seg * Math.max(r, 1) * per;
  msgCount.textContent = c.len + ' characters · ' + c.seg + ' SMS part(s)' +
    (r ? ' · ' + r + ' recipient(s)' : '') +
    (c.seg && r ? ' · approx. ' + credits + ' credit(s)' : '');
}
[msgBox, recBox, kindSel].forEach(function(el){ if (el) { el.addEventListener('input', updateCount); el.addEventListener('change', updateCount); } });
updateCount();

// Send page counters strip (characters / credits needed)
var charEl = document.getElementById('charCount'), credEl = document.getElementById('credCount');
function updateStrip() {
  if (!charEl || !msgBox) return;
  var c = smsCount(msgBox.value), r = recCount();
  var per = (kindSel && kindSel.value !== 'regular') ? 2 : 1;
  charEl.textContent = c.len + ' / 670';
  if (credEl) credEl.textContent = c.seg ? (c.seg * Math.max(r, 1) * per) : 0;
}
[msgBox, recBox, kindSel].forEach(function(el){ if (el) { el.addEventListener('input', updateStrip); el.addEventListener('change', updateStrip); } });
updateStrip();
