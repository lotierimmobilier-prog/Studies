<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function in_subdir(): bool { $s = $_SERVER['SCRIPT_NAME'] ?? ''; return str_contains($s, '/admin/') || str_contains($s, '/partenaire/'); }
function site_root(): string { return in_subdir() ? '../../' : '../'; }   // dossier du site statique

function layout_top(string $title, string $nav = '', bool $noindex = true): void {
    $css = in_subdir() ? '../annonces.css' : 'annonces.css';
    page_head($title, '<link rel="stylesheet" href="' . $css . '">', $noindex, site_root());
    echo '<a class="skip" href="#contenu">Aller au contenu</a>'
       . '<header class="site-header"><div class="inner"><a class="logo" href="' . site_root() . 'index.html"><span class="logo-mark" aria-hidden="true"></span>Capendu en bref</a>'
       . '<nav aria-label="Navigation">' . $nav . '</nav></div></header><main id="contenu" class="inner page">';
}
function layout_bottom(): void {
    $r = site_root();
    echo '</main><footer class="site-footer"><div class="inner"><p><strong>Capendu en bref</strong> · Newsletter indépendante, non affiliée à la mairie de Capendu</p>'
       . '<p><a href="' . $r . 'index.html#confidentialite">Politique de confidentialité</a> · <a href="' . $r . 'index.html#mentions-legales">Mentions légales</a></p></div></footer>';
}
function flash(string $type, string $msg): string { return '<p class="notice notice-' . h($type) . '" role="status">' . $msg . '</p>'; }
function status_pill(string $s): string { return '<span class="pill pill-' . h($s) . '">' . h(STATUTS[$s] ?? $s) . '</span>'; }
