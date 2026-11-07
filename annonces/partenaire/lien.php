<?php
declare(strict_types=1);
require __DIR__ . '/../inc/layout.php';
security_headers();
start_session();
$token = (string)($_GET['t'] ?? $_POST['t'] ?? '');
$ok = preg_match('/^[a-f0-9]{64}$/', $token) === 1;
$row = null;
if ($ok) {
    $st = db()->prepare('SELECT * FROM tokens WHERE hash = ? AND used = 0 AND expires > ?');
    $st->execute([hash('sha256', $token), time()]);
    $row = $st->fetch() ?: null;
}
// Un simple affichage ne consomme pas le lien (les logiciels de messagerie l'ouvrent parfois à l'avance) : il faut confirmer.
if ($row && $_SERVER['REQUEST_METHOD'] === 'POST') {
    db()->prepare('UPDATE tokens SET used = 1 WHERE hash = ?')->execute([$row['hash']]);
    session_regenerate_id(true);
    $_SESSION['partner_email'] = $row['email'];
    $_SESSION['partner_seen'] = time();
    db()->prepare('UPDATE partners SET updated_at = ? WHERE contact_email = ?')->execute([date('c'), $row['email']]);
    header('Location: index.php'); exit;
}
layout_top('Connexion – Espace partenaire');
echo '<h1>Connexion à votre espace</h1>';
if (!$row) {
    echo flash('err', 'Ce lien n\'est plus valide (il dure 30 minutes et ne s\'utilise qu\'une fois).') . '<p><a class="btn" href="index.php">Recevoir un nouveau lien</a></p>';
} else {
    echo '<form class="card" method="post" action="lien.php"><input type="hidden" name="t" value="' . h($token) . '"><p>Confirmez pour accéder à votre espace partenaire.</p>'
       . '<div class="actions"><button class="btn" type="submit">Accéder à mon espace</button></div></form>';
}
layout_bottom(); echo '</body></html>';
