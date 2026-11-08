<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function in_subdir(): bool { $s = $_SERVER['SCRIPT_NAME'] ?? ''; return str_contains($s, '/admin/') || str_contains($s, '/partenaire/'); }
function site_root(): string { return in_subdir() ? '../../' : '../'; }   // dossier du site statique

function layout_top(string $title, string $nav = '', bool $noindex = true): void {
    $css = in_subdir() ? '../annonces.css' : 'annonces.css';
    $css .= '?v=' . (int)@filemtime(dirname(__DIR__) . '/annonces.css');
    page_head($title, '<link rel="stylesheet" href="' . $css . '">', $noindex, site_root());
    echo '<a class="skip" href="#contenu">Aller au contenu</a>'
       . '<header class="site-header"><div class="inner"><a class="logo" href="' . site_root() . 'index.html"><img src="' . site_root() . 'logo/logo.svg" alt="Capendu en bref" width="656" height="87"></a>'
       . '<nav aria-label="Navigation">' . $nav . '</nav>'
       . '<details class="menu-m"><summary aria-label="Menu"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>Menu</span></summary><div class="menu-m-panel"><a href="' . site_root() . 'index.html">Accueil</a><a href="' . site_root() . 'annonces/partenaires.php">Nos partenaires</a><a href="' . site_root() . 'index.html#pourquoi">Pourquoi une newsletter</a><a href="' . site_root() . 'index.html#confidentialite">Vos données</a><a href="' . site_root() . 'qui-est-derriere.html">Qui sommes-nous ?</a><a href="' . site_root() . 'annonces/contact.php">Nous écrire</a><div class="menu-m-pro"><span class="menu-m-label">Commerçants et associations</span><a class="pro-join" href="' . site_root() . 'devenir-partenaire.html">Devenir partenaire</a><a class="pro-login" href="' . site_root() . 'annonces/partenaire/">Connexion partenaire</a></div></div></details></div>'
       . '<nav class="nav-mobile" aria-label="Menu"><div class="nav-mobile-row">'
       . '<a href="' . site_root() . 'index.html#pourquoi">Pourquoi</a><a href="' . site_root() . 'annonces/partenaires.php">Nos partenaires</a>'
       . '<a href="' . site_root() . 'devenir-partenaire.html">Devenir partenaire</a>'
       . '<a href="' . site_root() . 'index.html#confidentialite">Vos données</a><a href="' . site_root() . 'annonces/contact.php">Nous écrire</a>'
       . '</div></nav></header><main id="contenu" class="inner page">';
}
function layout_bottom(): void {
    $r = site_root();
    echo '</main><footer class="site-footer"><div class="inner"><p><strong>Capendu en bref</strong> · Newsletter indépendante, non affiliée à la mairie de Capendu</p>'
       . '<p><a href="' . $r . 'index.html#confidentialite">Politique de confidentialité</a> · <a href="' . $r . 'rgpd.html">RGPD</a> · <a href="' . $r . 'index.html#mentions-legales">Mentions légales</a> · <a href="' . $r . 'qui-est-derriere.html">Qui sommes-nous ?</a> · <a href="' . (in_subdir() ? '../' : '') . 'contact.php">Nous écrire</a> <a class="admin-lock" href="' . $r . 'annonces/admin/" rel="nofollow" aria-label="Administration" title="Administration"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/></svg></a></p></div></footer>';
}
/** Frise du calendrier de la newsletter (inscription et espace partenaire). */
function planning_block(bool $connected = false): string {
    [$issue, $deadline] = next_deadline();
    $o = '<section class="planning card" aria-labelledby="t-planning"><h2 id="t-planning">Le calendrier de la newsletter</h2>'
       . '<p>La newsletter part <strong>tous les 1<sup>er</sup> du mois environ</strong>. Les annonces sont acceptées <strong>jusqu\'au 25 du mois précédent</strong>, pour laisser le temps de préparer le numéro.</p>'
       . '<p class="planning-next"><strong>Prochaine date limite : le ' . h($deadline) . '</strong> pour le numéro de ' . h($issue) . '.</p>'
       . '<ol class="timeline">'
       . '<li class="tl-1"><span class="tl-when">Jusqu\'au 25</span><strong>Vous déposez vos annonces</strong><span>Texte, photo et lien d\'inscription facultatif, depuis votre espace partenaire.</span></li>'
       . '<li class="tl-2"><span class="tl-when">Du 26 à fin de mois</span><strong>Nous préparons le numéro</strong><span>Relecture, validation, mise en page et vérification de l\'envoi.</span></li>'
       . '<li class="tl-3"><span class="tl-when">Vers le 1<sup>er</sup></span><strong>La newsletter part</strong><span>Elle arrive par e-mail chez tous les abonnés de Capendu.</span></li>'
       . '<li class="tl-4"><span class="tl-when">Dès l\'envoi</span><strong>Vous suivez les clics</strong><span>' . ($connected ? 'Le tableau ci-dessous compte les clics sur le lien de chacune de vos annonces.' : 'Chaque partenaire voit, dans son espace, les clics sur le lien de son annonce.') . '</span></li>'
       . '</ol></section>';
    return $o;
}
function flash(string $type, string $msg): string { return '<p class="notice notice-' . h($type) . '" role="status">' . $msg . '</p>'; }
function status_pill(string $s): string { return '<span class="pill pill-' . h($s) . '">' . h(STATUTS[$s] ?? $s) . '</span>'; }
