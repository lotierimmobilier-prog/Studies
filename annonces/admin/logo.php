<?php
declare(strict_types=1);
// Aperçu du logo d'un partenaire pour l'administrateur, à tout statut.
require __DIR__ . '/../inc/admin_auth.php';
require_admin();
$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare('SELECT logo FROM partners WHERE id = ?'); $st->execute([$id]);
$name = (string)$st->fetchColumn(); $path = $name !== '' ? logo_path($name) : '';
if ($path === '' || !is_file($path)) { http_response_code(404); exit('Logo introuvable.'); }
header('Content-Type: image/png'); header('X-Content-Type-Options: nosniff'); header('Cache-Control: private, no-store'); header('Content-Length: ' . filesize($path));
readfile($path);
