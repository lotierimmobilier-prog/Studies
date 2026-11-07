<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
require_admin();
purge_old();

$s = (string)($_GET['s'] ?? 'pending');
if (!isset(STATUTS[$s]) && $s !== 'all') $s = 'pending';
$counts = [];
foreach (db()->query('SELECT status, COUNT(*) c FROM announcements GROUP BY status') as $r) $counts[$r['status']] = (int)$r['c'];

layout_top('Annonces – Administration', admin_nav('index.php'));
echo '<h1>Annonces</h1>';
if (!empty($counts['pending'])) echo flash('info', '<strong>' . (int)$counts['pending'] . '</strong> annonce(s) en attente de validation.');
echo '<nav class="tabs" aria-label="Filtrer par statut">';
foreach (STATUTS as $k => $l) echo '<a href="?s=' . h($k) . '"' . ($s === $k ? ' aria-current="page"' : '') . '>' . h($l) . ' (' . ($counts[$k] ?? 0) . ')</a>';
echo '<a href="?s=all"' . ($s === 'all' ? ' aria-current="page"' : '') . '>Toutes (' . array_sum($counts) . ')</a></nav>';

$q = $s === 'all' ? db()->query('SELECT * FROM announcements ORDER BY created_at DESC') : db()->prepare('SELECT * FROM announcements WHERE status = ? ORDER BY created_at DESC');
if ($s !== 'all') $q->execute([$s]);
$rows = $q->fetchAll();
if (!$rows) { echo '<p>Aucune annonce dans cette catégorie.</p>'; }
else {
    echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reçue le</th><th>Annonce</th><th>Annonceur</th><th>Statut</th><th>Numéro</th><th class="num">Clics</th></tr></thead><tbody>';
    foreach ($rows as $r) {
        echo '<tr><td>' . h(date('d/m/Y', strtotime($r['created_at']))) . '</td>'
           . '<td><a href="annonce.php?id=' . (int)$r['id'] . '"><strong>' . h($r['title']) . '</strong></a><br><span class="hint">' . h(CATEGORIES[$r['category']][1]) . '</span></td>'
           . '<td>' . h($r['org_name']) . '' . '</td><td>' . status_pill($r['status']) . '</td>'
           . '<td>' . h($r['issue'] !== '' ? issue_label($r['issue']) : '–') . '</td>'
           . '<td class="num">' . clicks_total((int)$r['id']) . '</td></tr>';
    }
    echo '</tbody></table></div>';
}
layout_bottom(); echo '</body></html>';
