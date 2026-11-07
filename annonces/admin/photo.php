<?php
declare(strict_types=1);
// Aperçu de la photo d'une annonce pour l'administrateur, à tout statut.
require __DIR__ . '/../inc/admin_auth.php';
require_admin();
$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare('SELECT photo FROM announcements WHERE id = ?'); $st->execute([$id]);
$name = (string)$st->fetchColumn();
$path = $name !== '' ? photo_path($name) : '';
if ($path === '' || !is_file($path)) { http_response_code(404); exit('Photo introuvable.'); }
header('Content-Type: image/jpeg'); header('X-Content-Type-Options: nosniff'); header('Cache-Control: private, no-store'); header('Content-Length: ' . filesize($path));
readfile($path);
