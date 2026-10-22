// SMMSOFT website — mobile nav + SMS cost calculator
document.addEventListener('DOMContentLoaded', function () {
  var t = document.getElementById('navToggle'), n = document.getElementById('navLinks');
  if (t && n) t.addEventListener('click', function () { n.classList.toggle('open'); });

  // Cost calculator (pricing page)
  var msg = document.getElementById('calcMsg'), rec = document.getElementById('calcRec'),
      kind = document.getElementById('calcKind'), out = document.getElementById('calcOut');
  if (msg && rec && kind && out) {
    var PRICE = 0.65, COST = { regular: 1, priority: 2, otp: 2 };
    function parts(len) { return len === 0 ? 0 : (len <= 160 ? 1 : Math.ceil(len / 153)); }
    function run() {
      var p = parts(msg.value.length), r = Math.max(0, parseInt(rec.value || '0', 10) || 0);
      var per = p * COST[kind.value], total = per * r;
      out.innerHTML = msg.value.length + ' characters = <b>' + p + ' part(s)</b> per recipient · ' +
        per + ' credit(s) each · <b>' + total + ' credits</b> total ≈ <b>₱' + (total * PRICE).toFixed(2) + '</b>';
    }
    [msg, rec, kind].forEach(function (el) { el.addEventListener('input', run); el.addEventListener('change', run); });
    run();
  }
});
