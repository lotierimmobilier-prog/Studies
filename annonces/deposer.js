// Aide à la rédaction (sans intelligence artificielle ni service externe) : compteur, conseils et exemple selon la rubrique.
(function () {
  var what = document.getElementById('what');
  var box = document.getElementById('aide');
  if (!what || !box) return;
  var MAX = parseInt(box.getAttribute('data-max') || '700', 10);
  var EXEMPLES = {
    offre: 'Exemple : « Cette semaine, 10 % sur tout le pain de campagne, sur présentation de la newsletter. Valable du 1er au 15 décembre. »',
    sport: 'Exemple : « Tournoi de pétanque ouvert à tous, par équipes de deux. Inscriptions sur place dès 13 h 30. Buvette sur place. »',
    asso: 'Exemple : « Repas de fin d\'année de l\'association. Au programme : cassoulet, tombola et musique. Réservation avant le 10 décembre. »',
    sortie: 'Exemple : « Marché de Noël sur la place du village. Une trentaine d\'exposants, vin chaud et animations pour les enfants. »',
    pratique: 'Exemple : « La mairie annexe change ses horaires : ouverte le mardi et le jeudi de 9 h à 12 h. »'
  };
  function cat() { var c = document.querySelector('input[name="category"]:checked'); return c ? c.value : ''; }
  function ok(t) { return '<li class="ok">' + t + '</li>'; }
  function ko(t) { return '<li class="ko">' + t + '</li>'; }
  function refresh() {
    var t = what.value, n = t.length, v = [];
    var maj = (t.match(/[A-ZÀ-Ý]/g) || []).length, lettres = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    var place = (document.getElementById('place') || {}).value || '';
    var quand = (document.getElementById('whenx') || {}).value || '';
    v.push(n >= 60 ? ok('Votre texte est assez détaillé.') : ko('Ajoutez quelques précisions (au moins 60 caractères conseillés).'));
    v.push(n <= 500 ? ok('Longueur idéale (moins de 500 caractères).') : ko('Texte un peu long : essayez de le raccourcir (moins de 500 caractères).'));
    v.push(lettres > 20 && maj / lettres > 0.3 ? ko('Évitez les majuscules : le texte est plus agréable à lire en minuscules.') : ok('Pas de majuscules excessives.'));
    v.push(place.trim().length > 2 ? ok('Le lieu est indiqué.') : ko('Indiquez le lieu (champ « Où »).'));
    v.push(/\d/.test(quand) ? ok('La date est indiquée.') : ko('Indiquez une date complète (champ « Quand »), par exemple « samedi 12 décembre à 14 h ».'));
    var ex = EXEMPLES[cat()] ? '<p class="exemple">' + EXEMPLES[cat()] + '</p>' : '';
    box.innerHTML = '<p><strong>' + n + ' / ' + MAX + ' caractères</strong></p><ul class="check">' + v.join('') + '</ul>' + ex;
  }
  ['input', 'change'].forEach(function (e) { document.querySelector('form').addEventListener(e, refresh); });
  refresh();
})();
