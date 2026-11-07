// Confirmation avant suppression et bouton « Copier ». Pas de service externe.
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-confirm]');
  if (b && !window.confirm(b.getAttribute('data-confirm'))) { e.preventDefault(); return; }
  var c = e.target.closest('[data-copy]');
  if (c) {
    var t = document.getElementById(c.getAttribute('data-copy'));
    if (!t) return;
    t.select();
    var done = function () { c.textContent = 'Copié !'; setTimeout(function () { c.textContent = 'Copier le code'; }, 2000); };
    if (navigator.clipboard) { navigator.clipboard.writeText(t.value).then(done, function () { document.execCommand('copy'); done(); }); }
    else { document.execCommand('copy'); done(); }
  }
});
