/* Outils pour les agents dans le navigateur (WebMCP). Lecture seule : aucun outil n'envoie de formulaire ni de donnée. */
(function () {
  'use strict';
  var mc = navigator.modelContext;
  if (!mc || typeof mc.registerTool !== 'function') return;
  var BASE = 'https://capenduenbref.fr/';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function text(o) { return { content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }] }; }
  function mcpCall(name, args) {
    return fetch('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: name, arguments: args || {} } }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.error) throw new Error(j.error.message); return j.result; });
  }
  var PAGES = { subscribe: BASE + '#inscription', become_partner: BASE + 'devenir-partenaire.html', partner_login: BASE + 'annonces/partenaire/', partners: BASE + 'annonces/partenaires.php', contact: BASE + 'annonces/contact.php', about: BASE + 'a-propos.html', terms: BASE + 'conditions.html', privacy: BASE + 'rgpd.html', history: BASE + 'capendu-histoire.html', links: BASE + 'liens.html' };
  var tools = [
    { name: 'get_site_info', description: "Présente Capendu en bref, la newsletter locale gratuite et indépendante de Capendu (Aude), et ses pages utiles.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: function () { return mcpCall('get_site_info').then(function (r) { return r.content ? r : text(r); }); } },
    { name: 'get_publication_schedule', description: "Calendrier de la newsletter : envoi vers le 1er du mois, annonces acceptées jusqu'au 25 du mois précédent, prochaine échéance.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: function () {
        var d = new Date(), day = d.getDate(), ahead = day <= 25 ? 1 : 2;
        var issue = new Date(d.getFullYear(), d.getMonth() + ahead, 1);
        var dl = day <= 25 ? new Date(d.getFullYear(), d.getMonth(), 25) : new Date(d.getFullYear(), d.getMonth() + 1, 25);
        return text({ envoi: 'Tous les 1er du mois environ', date_limite_des_annonces: "Le 25 du mois précédant le numéro", prochaine_date_limite: dl.getDate() + ' ' + MOIS[dl.getMonth()], prochain_numero: MOIS[issue.getMonth()] + ' ' + issue.getFullYear(), gratuit: true });
      } },
    { name: 'list_partners', description: "Liste les entreprises et associations partenaires de Capendu en bref (nom, type, adresse, téléphone public).",
      inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['entreprise', 'association'] }, query: { type: 'string', maxLength: 60 } }, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: function (args) { return mcpCall('list_partners', args).then(function (r) { return r.content ? r : text(r); }); } },
    { name: 'get_page_url', description: "Donne l'adresse d'une page de Capendu en bref (abonnement, devenir partenaire, connexion partenaire, liste des partenaires, contact, à propos, conditions, RGPD, histoire de Capendu, liens utiles). Ne soumet aucun formulaire.",
      inputSchema: { type: 'object', properties: { page: { type: 'string', enum: Object.keys(PAGES) } }, required: ['page'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: function (args) { var u = PAGES[args && args.page]; return text(u ? { url: u } : { error: 'Page inconnue', pages: Object.keys(PAGES) }); } }
  ];
  try {
    tools.forEach(function (t) { mc.registerTool(t); });
  } catch (e) { /* l'API est expérimentale : on ignore toute erreur */ }
}());
