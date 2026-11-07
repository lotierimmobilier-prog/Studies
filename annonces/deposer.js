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
    retour: 'Exemple : « Merci aux 120 participants du repas de l\'association ! Retour en photos sur une belle journée. Rendez-vous l\'an prochain. »',
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

// ---------- Assistant IA : tout se passe dans votre navigateur ; rien n'est envoyé à une IA par ce site ----------
(function () {
  var box = document.querySelector('.assistant');
  if (!box) return;
  var $ = function (id) { return document.getElementById(id); };
  var RUBRIQUES = { offre: 'offre', 'bonnes affaires': 'offre', promo: 'offre', sport: 'sport', asso: 'asso', association: 'asso', 'vie associative': 'asso',
                    sortie: 'sortie', sorties: 'sortie', loisirs: 'sortie', fetes: 'sortie', 'fêtes': 'sortie', retour: 'retour', 'retour sur les événements': 'retour',
                    pratique: 'pratique', 'infos pratiques': 'pratique', quotidien: 'pratique' };

  function buildPrompt(notes) {
    var org = box.getAttribute('data-org') || '', issue = box.getAttribute('data-issue') || '', dl = box.getAttribute('data-deadline') || '';
    return "Tu aides une organisation de Capendu (Aude) à rédiger une annonce pour la newsletter mensuelle « Capendu en bref ». Les lecteurs ont de 25 à 85 ans.\n\n" +
      "ORGANISATION : " + org + "\nPROCHAIN NUMÉRO : " + issue + " (annonces à déposer avant le " + dl + ")\n\n" +
      "RÈGLES\n- Phrases courtes, mots simples, ton chaleureux et neutre, vouvoiement.\n- Garde tous les faits exacts (dates, heures, lieux, prix, conditions). N'invente rien ; si une information manque, laisse le champ vide.\n" +
      "- Titre : 70 caractères maximum. Texte : 450 caractères maximum, sans émoji ni majuscules criardes.\n- Une offre commerciale doit rester clairement une offre, avec prix, dates et conditions.\n\n" +
      "FORMAT DE RÉPONSE (à respecter strictement, sans autre commentaire)\nRUBRIQUE: offre, sport, asso, sortie, retour ou pratique (retour = compte rendu d'un événement passé)\nTITRE: ...\nTEXTE: ...\nOU: ...\nQUAND: ...\nCONDITIONS: ...\n" +
      "CONSEIL: une phrase pour organiser la publication (moment idéal pour déposer, et idée de suite comme un « retour sur l'événement » après la date)\n\n" +
      "MES IDÉES EN VRAC\n" + (notes || '(à compléter)');
  }

  function parse(text) {
    var out = {}, key = null, lines = String(text || '').replace(/\r/g, '').replace(/\*\*/g, '').split('\n');
    var re = /^\s*(RUBRIQUE|TITRE|TEXTE|OU|OÙ|QUAND|CONDITIONS|CONSEIL)\s*:\s*(.*)$/i;
    lines.forEach(function (l) {
      var m = l.match(re);
      if (m) { key = m[1].toUpperCase().replace('Ù', 'U'); out[key] = m[2].trim(); }
      else if (key === 'TEXTE' && l.trim() !== '') out[key] += ' ' + l.trim();
    });
    return out;
  }

  function set(id, v) { var el = $(id); if (el && v) { el.value = v; } }
  function fill() {
    var r = parse($('ia_reply').value), st = $('ia_status'), n = 0;
    if (!r.TITRE && !r.TEXTE) { st.textContent = 'Réponse non reconnue : elle doit contenir « TITRE: » et « TEXTE: ».'; $('ia_conseil').hidden = true; return; }
    set('title', (r.TITRE || '').slice(0, 90)); set('what', (r.TEXTE || '').slice(0, 700)); set('place', (r.OU || '').slice(0, 140));
    set('whenx', (r.QUAND || '').slice(0, 140)); set('conditions', (r.CONDITIONS || '').slice(0, 240));
    var rub = RUBRIQUES[(r.RUBRIQUE || '').trim().toLowerCase()];
    if (rub) { var radio = document.querySelector('input[name="category"][value="' + rub + '"]'); if (radio) radio.checked = true; }
    ['title', 'what', 'place', 'whenx', 'conditions'].forEach(function (i) { if ($(i) && $(i).value) n++; });
    st.textContent = n + ' champ(s) rempli(s) : relisez et corrigez avant d\'envoyer.';
    var c = $('ia_conseil'); if (r.CONSEIL) { c.textContent = 'Conseil : ' + r.CONSEIL; c.hidden = false; } else { c.hidden = true; }
    $('what').dispatchEvent(new Event('input', { bubbles: true }));
  }

  $('ia_copy').addEventListener('click', function () {
    var text = buildPrompt($('ia_notes').value), ok = function () { $('ia_copied').textContent = 'Demande copiée : collez-la dans votre assistant.'; };
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(ok, function () { window.prompt('Copiez la demande :', text); }); }
    else { window.prompt('Copiez la demande :', text); }
  });
  $('ia_fill').addEventListener('click', fill);
  window.CBAide = { parse: parse, buildPrompt: buildPrompt };
})();
