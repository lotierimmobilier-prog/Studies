<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
require_admin();

layout_top('Statistiques – Administration', admin_nav('stats.php'));
echo '<h1>Statistiques des clics</h1><p class="lead">Les clics sont comptés de façon anonyme sur le bouton « En savoir plus » de chaque annonce.</p>';
$total = (int)db()->query('SELECT COALESCE(SUM(n),0) FROM clicks')->fetchColumn();
$last30 = (int)db()->query("SELECT COALESCE(SUM(n),0) FROM clicks WHERE day >= '" . date('Y-m-d', strtotime('-30 days')) . "'")->fetchColumn();
$ann = (int)db()->query("SELECT COUNT(*) FROM announcements WHERE status IN ('validated','published')")->fetchColumn();
echo '<div class="stats"><div class="stat"><b>' . $total . '</b><span>clics au total</span></div><div class="stat"><b>' . $last30 . '</b><span>clics sur 30 jours</span></div>'
   . '<div class="stat"><b>' . $ann . '</b><span>annonces validées ou publiées</span></div></div>';

echo '<h2>Par numéro</h2>';
$rows = db()->query("SELECT a.issue, COUNT(*) nb, COALESCE(SUM(c.t),0) clicks FROM announcements a
    LEFT JOIN (SELECT announcement_id, SUM(n) t FROM clicks GROUP BY announcement_id) c ON c.announcement_id = a.id
    WHERE a.status IN ('validated','published') AND a.issue <> '' GROUP BY a.issue ORDER BY a.issue DESC")->fetchAll();
if (!$rows) echo '<p>Pas encore de données.</p>';
else {
    echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Numéro</th><th class="num">Annonces</th><th class="num">Clics</th><th class="num">Clics par annonce</th></tr></thead><tbody>';
    foreach ($rows as $r) echo '<tr><td>' . h(issue_label($r['issue'])) . '</td><td class="num">' . (int)$r['nb'] . '</td><td class="num">' . (int)$r['clicks'] . '</td><td class="num">' . number_format($r['nb'] ? $r['clicks'] / $r['nb'] : 0, 1, ',', ' ') . '</td></tr>';
    echo '</tbody></table></div>';
}
echo '<h2 class="mt-26">Annonces les plus cliquées</h2>';
$top = db()->query("SELECT a.id, a.title, a.org_name, a.category, a.issue, COALESCE(SUM(c.n),0) t FROM announcements a LEFT JOIN clicks c ON c.announcement_id = a.id
    WHERE a.status IN ('validated','published') GROUP BY a.id ORDER BY t DESC, a.created_at DESC LIMIT 15")->fetchAll();
if (!$top) echo '<p>Pas encore de données.</p>';
else {
    echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Annonce</th><th>Annonceur</th><th>Rubrique</th><th class="num">Clics</th></tr></thead><tbody>';
    foreach ($top as $r) echo '<tr><td><a href="annonce.php?id=' . (int)$r['id'] . '">' . h($r['title']) . '</a></td><td>' . h($r['org_name']) . '</td><td>' . h(CATEGORIES[$r['category']][1]) . '</td><td class="num">' . (int)$r['t'] . '</td></tr>';
    echo '</tbody></table></div>';
}
layout_bottom(); echo '</body></html>';
