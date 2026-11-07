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
    $items = ['index.php' => 'Annonces', 'stats.php' => 'Statistiques', 'export.php' => 'Préparer le numéro', 'motdepasse.php' => 'Mot de passe'];
    $o = '';
    foreach ($items as $f => $l) $o .= '<a href="' . $f . '"' . ($f === $current ? ' aria-current="page"' : '') . '>' . h($l) . '</a> ';
    return $o . '<a href="logout.php">Déconnexion</a>';
}
