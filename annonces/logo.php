<?php
declare(strict_types=1);
// Logo d'un partenaire : public seulement une fois l'inscription validée.
require __DIR__ . '/inc/bootstrap.php';
$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare("SELECT logo FROM partners WHERE id = ? AND status = 'approved'"); $st->execute([$id]);
$name = (string)$st->fetchColumn();
$path = $name !== '' ? logo_path($name) : '';
if ($path === '' || !is_file($path)) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); exit('Logo introuvable.'); }
header('Content-Type: image/png'); header('X-Content-Type-Options: nosniff'); header('Cache-Control: public, max-age=86400'); header('Content-Length: ' . filesize($path));
readfile($path);
