<?php
declare(strict_types=1);
/* Sert les pages publiques statiques en comptant la visite (mesure d'audience anonyme).
   Toute erreur de comptage est ignorée : la page est toujours servie. */
const T_FILES = [
    'index'      => ['index.html', 'text/html; charset=utf-8'],
    'devenir'    => ['devenir-partenaire.html', 'text/html; charset=utf-8'],
    'qui'        => ['a-propos.html', 'text/html; charset=utf-8'],
    'conditions' => ['conditions.html', 'text/html; charset=utf-8'],
    'histoire'   => ['capendu-histoire.html', 'text/html; charset=utf-8'],
    'liens'      => ['liens.html', 'text/html; charset=utf-8'],
    'rgpd'       => ['rgpd.html', 'text/html; charset=utf-8'],
    'llms'       => ['llms.txt', 'text/plain; charset=utf-8'],
    'robots'     => ['robots.txt', 'text/plain; charset=utf-8'],
    'sitemap'    => ['sitemap.xml', 'application/xml; charset=utf-8'],
];
$key = (string)($_GET['f'] ?? 'index');
if (!isset(T_FILES[$key])) $key = 'index';
[$file, $type] = T_FILES[$key];
$path = dirname(__DIR__) . '/' . $file;
if (!is_file($path)) { http_response_code(404); header('Cache-Control: no-store'); exit('Page introuvable'); }

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && is_file(__DIR__ . '/config.php')) {
    try {
        ob_start();
        require __DIR__ . '/inc/bootstrap.php';
        require __DIR__ . '/inc/track.php';
        track_hit($file);
        ob_end_clean();
    } catch (Throwable $e) { while (ob_get_level()) ob_end_clean(); }
}
// Résumé des ressources utiles aux agents (RFC 8288) et négociation du format (HTML ou Markdown)
$isHtml = str_starts_with($type, 'text/html');
header('Link: </llms.txt>; rel="describedby"; type="text/plain"; title="llms.txt", </sitemap.xml>; rel="sitemap"; type="application/xml", '
     . '</.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"; title="MCP Server Card", '
     . '<https://capenduenbref.fr/' . ($file === 'index.html' ? '' : $file) . '>; rel="alternate"; type="text/markdown"');
if ($isHtml) {
    header('Vary: Accept');
    require_once __DIR__ . '/inc/markdown.php';
    if (wants_markdown((string)($_SERVER['HTTP_ACCEPT'] ?? ''))) {
        $md = html_to_markdown((string)file_get_contents($path), 'https://capenduenbref.fr/' . ($file === 'index.html' ? '' : $file));
        header('Content-Type: text/markdown; charset=utf-8');
        header('Cache-Control: no-cache');
        header('x-markdown-tokens: ' . (int)ceil(strlen($md) / 4));
        header('Content-Signal: search=yes, ai-input=yes, ai-train=no');
        echo $md; exit;
    }
}
header('Content-Type: ' . $type);
header('Cache-Control: no-cache');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', (int)filemtime($path)) . ' GMT');
readfile($path);
