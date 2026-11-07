<?php
declare(strict_types=1);
// Redirection comptabilisée : le lien « En savoir plus » de la newsletter passe ici.
// Seule une annonce validée existante peut être ciblée ; la destination vient de la base, jamais de l'adresse demandée.
require __DIR__ . '/inc/bootstrap.php';
$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare("SELECT link_url FROM announcements WHERE id = ? AND status IN ('validated','published')");
$st->execute([$id]);
$a = $st->fetch();
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
if (!$a) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); exit('Annonce introuvable.'); }
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !bot_request()) {   // compteur anonyme : aucune adresse IP ni cookie enregistré
    db()->prepare('INSERT INTO clicks (announcement_id, day, n) VALUES (?, ?, 1) ON CONFLICT(announcement_id, day) DO UPDATE SET n = n + 1')
        ->execute([$id, date('Y-m-d')]);
}
$dest = safe_url((string)$a['link_url']);
header('Location: ' . ($dest !== '' ? $dest : 'a.php?id=' . $id), true, 302);
