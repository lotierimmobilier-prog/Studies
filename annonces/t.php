<?php
declare(strict_types=1);
/* Sert les pages publiques statiques en comptant la visite (mesure d'audience anonyme).
   Toute erreur de comptage est ignorée : la page est toujours servie. */
const T_FILES = [
    'index'      => ['index.html', 'text/html; charset=utf-8'],
    'devenir'    => ['devenir-partenaire.html', 'text/html; charset=utf-8'],
    'qui'        => ['qui-est-derriere.html', 'text/html; charset=utf-8'],
    'rgpd'       => ['rgpd.html', 'text/html; charset=utf-8'],
    'llms'       => ['llms.txt', 'text/plain; charset=utf-8'],
    'robots'     => ['robots.txt', 'text/plain; charset=utf-8'],
    'sitemap'    => ['sitemap.xml', 'application/xml; charset=utf-8'],
];
$key = (string)($_GET['f'] ?? 'index');
if (!isset(T_FILES[$key])) $key = 'index';
[$file, $type] = T_FILES[$key];
$path = dirname(__DIR__) . '/' . $file;
if (!is_file($path)) { http_response_code(404); exit('Page introuvable'); }

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && is_file(__DIR__ . '/config.php')) {
    try {
        ob_start();
        require __DIR__ . '/inc/bootstrap.php';
        require __DIR__ . '/inc/track.php';
        track_hit($file);
        ob_end_clean();
    } catch (Throwable $e) { while (ob_get_level()) ob_end_clean(); }
}
header('Content-Type: ' . $type);
header('Cache-Control: no-cache');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', (int)filemtime($path)) . ' GMT');
readfile($path);
