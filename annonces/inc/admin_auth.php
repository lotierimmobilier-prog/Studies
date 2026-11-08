<?php
declare(strict_types=1);
require_once __DIR__ . '/layout.php';

function admin_exists(): bool { return (bool)db()->query('SELECT 1 FROM admin WHERE id = 1')->fetchColumn(); }

function require_admin(): void {
    start_session();
    if (!empty($_SESSION['admin']) && time() - ($_SESSION['admin_seen'] ?? 0) <= 7200) { $_SESSION['admin_seen'] = time(); return; }
    unset($_SESSION['admin']);
    header('Location: login.php'); exit;
}
function admin_nav(string $current = ''): string {
    $new = (int)db()->query("SELECT COUNT(*) FROM messages WHERE status = 'new'")->fetchColumn();
    $pend = (int)db()->query("SELECT COUNT(*) FROM partners WHERE status = 'pending'")->fetchColumn();
    $apend = (int)db()->query("SELECT COUNT(*) FROM announcements WHERE status = 'pending'")->fetchColumn();
    $items = [
        'accueil.php' => ['Tableau de bord', 0], 'partenaires.php' => ['Partenaires', $pend], 'index.php' => ['Annonces', $apend], 'messages.php' => ['Messages', $new],
        'stats.php' => ['Clics', 0], 'visites.php' => ['Visites et IA', 0], 'ia.php' => ['Rédiger avec l\'IA', 0], 'export.php' => ['Préparer le numéro', 0], 'motdepasse.php' => ['Mot de passe', 0],
    ];
    $o = '<!--admin-->';
    foreach ($items as $f => [$l, $n]) $o .= '<a href="' . $f . '"' . ($f === $current ? ' aria-current="page"' : '') . '>' . h($l) . ($n ? ' <b class="badge">' . $n . '</b>' : '') . '</a>';
    return $o . '<a class="admin-out" href="logout.php">Déconnexion</a>';
}
