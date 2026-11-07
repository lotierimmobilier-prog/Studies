<?php
declare(strict_types=1);
// Photo d'une annonce : servie seulement une fois l'annonce validée (jamais avant relecture).
require __DIR__ . '/inc/bootstrap.php';
$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare("SELECT photo FROM announcements WHERE id = ? AND status IN ('validated','published')");
$st->execute([$id]);
$name = (string)$st->fetchColumn();
$path = $name !== '' ? photo_path($name) : '';
if ($path === '' || !is_file($path)) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); exit('Photo introuvable.'); }
header('Content-Type: image/jpeg');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=86400');
header('Content-Length: ' . filesize($path));
readfile($path);
