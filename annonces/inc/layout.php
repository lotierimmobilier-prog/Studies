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
       . '<nav aria-label="Navigation">' . $nav . '</nav></div>'
       . '<nav class="nav-mobile" aria-label="Menu"><div class="nav-mobile-row">'
       . '<a href="' . site_root() . 'index.html#pourquoi">Pourquoi</a><a href="' . site_root() . 'annonces/partenaires.php">Nos partenaires</a>'
       . '<a href="' . site_root() . 'devenir-partenaire.html">Devenir partenaire</a>'
       . '<a href="' . site_root() . 'index.html#confidentialite">Vos données</a><a href="' . site_root() . 'annonces/contact.php">Nous écrire</a>'
       . '</div></nav></header><main id="contenu" class="inner page">';
}
function layout_bottom(): void {
    $r = site_root();
    echo '</main><footer class="site-footer"><div class="inner"><p><strong>Capendu en bref</strong> · Newsletter indépendante, non affiliée à la mairie de Capendu</p>'
       . '<p><a href="' . $r . 'index.html#confidentialite">Politique de confidentialité</a> · <a href="' . $r . 'index.html#mentions-legales">Mentions légales</a> · <a href="' . $r . 'qui-est-derriere.html">Qui sommes-nous ?</a> · <a href="' . (in_subdir() ? '../' : '') . 'contact.php">Nous écrire</a></p></div></footer>';
}
function flash(string $type, string $msg): string { return '<p class="notice notice-' . h($type) . '" role="status">' . $msg . '</p>'; }
function status_pill(string $s): string { return '<span class="pill pill-' . h($s) . '">' . h(STATUTS[$s] ?? $s) . '</span>'; }
