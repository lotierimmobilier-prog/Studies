/* Partage : copie du message et menu de partage natif. Aucun service externe, aucune donnée envoyée. */
(function () {
  'use strict';
  function note(btn, msg) {
    var card = btn.closest('.share-card'); var n = card && card.querySelector('.share-ok');
    if (n) { n.textContent = msg; setTimeout(function () { n.textContent = ''; }, 3000); }
  }
  document.querySelectorAll('[data-share-native]').forEach(function (b) { if (navigator.share) b.hidden = false; });
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-share-copy]');
    if (c) {
      var text = c.getAttribute('data-share-copy');
      var done = function () { note(c, 'Message copié : collez-le où vous voulez.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copiez le message :', text); }); }
      else { window.prompt('Copiez le message :', text); }
      return;
    }
    var s = e.target.closest('[data-share-native]');
    if (s && navigator.share) {
      navigator.share({ title: s.getAttribute('data-share-title') || 'Capendu en bref', text: s.getAttribute('data-share-native') }).catch(function () {});
    }
  });
}());
