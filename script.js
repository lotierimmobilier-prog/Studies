// Validation du formulaire d'inscription. Aucun traceur, aucune donnée envoyée ailleurs qu'au formulaire Brevo.
(function () {
  var form = document.getElementById('inscription');
  if (!form) return;
  var status = document.getElementById('form-status');
  var email = document.getElementById('email');
  var consent = document.getElementById('consent');

  function say(msg, cls) { status.textContent = msg; status.className = 'form-status ' + (cls || ''); }

  form.addEventListener('submit', function (e) {
    say('');
    email.removeAttribute('aria-invalid');
    // Anti-robots : le champ piège doit rester vide.
    if (form.elements['email_address_check'] && form.elements['email_address_check'].value) { e.preventDefault(); return; }
    if (!email.value || !email.checkValidity()) {
      e.preventDefault(); email.setAttribute('aria-invalid', 'true');
      say('Veuillez saisir une adresse e-mail valide.', 'err'); email.focus(); return;
    }
    if (!consent.checked) {
      e.preventDefault();
      say('Pour vous abonner, cochez la case d\'acceptation.', 'err'); consent.focus(); return;
    }
    // Envoi au formulaire Brevo sans quitter le site : on affiche notre propre page de remerciement.
    if (/sibforms\.com\/serve\//.test(form.getAttribute('action')) && window.fetch && window.FormData) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
      say('Envoi en cours…', '');
      fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.success) { window.location.href = 'merci.html'; return; }
          if (btn) btn.disabled = false;
          say('Votre inscription n\'a pas pu être enregistrée. Vérifiez votre adresse e-mail et réessayez.', 'err');
        })
        .catch(function () { form.submit(); });   // en dernier recours : envoi classique, qui inscrit quand même
      return;
    }
    // Tant que le formulaire Brevo n'est pas branché, on n'envoie rien.
    if (/REMPLACER/.test(form.getAttribute('action'))) {
      e.preventDefault();
      say('Formulaire en cours de configuration : aucune donnée n\'a été envoyée.', 'err');
    }
  });
})();
