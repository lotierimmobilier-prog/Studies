<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
require __DIR__ . '/../inc/track.php';
security_headers();
require_admin();

$pdo = db();
$n = fn(int $v): string => number_format($v, 0, ',', ' ');
$sum = function (string $where, array $args = []) use ($pdo): array {
    $st = $pdo->prepare("SELECT kind, COALESCE(SUM(hits),0) t FROM visits WHERE $where GROUP BY kind"); $st->execute($args);
    $o = ['human' => 0, 'ia' => 0, 'bot' => 0]; foreach ($st->fetchAll() as $r) $o[$r['kind']] = (int)$r['t']; return $o;
};
$uniq = function (string $from, string $to) use ($pdo): int { $st = $pdo->prepare('SELECT COALESCE(SUM(n),0) FROM uniques WHERE day BETWEEN ? AND ?'); $st->execute([$from, $to]); return (int)$st->fetchColumn(); };

layout_top('Visites et IA – Administration', admin_nav('visites.php'));
echo '<h1>Visites et robots IA</h1><p class="lead">Mesure anonyme, sans cookie : on compte des visites, jamais des personnes. Les robots des IA (ChatGPT, Claude, Perplexity…) sont comptés à part. Les visites sont comptées sur les trois pages publiques du site.</p>';

$today = date('Y-m-d'); $d30 = date('Y-m-d', strtotime('-29 days')); $m1 = date('Y-m-01'); $y1 = date('Y-01-01');
$t = $sum('day = ?', [$today]); $m = $sum('day >= ?', [$m1]); $y = $sum('day >= ?', [$y1]); $l = $sum('day >= ?', [$d30]);
echo '<div class="stats">'
   . '<div class="stat"><b>' . $n($t['human']) . '</b><span>visites aujourd\'hui</span></div>'
   . '<div class="stat"><b>' . $n($l['human']) . '</b><span>visites sur 30 jours (' . $n($uniq($d30, $today)) . ' visiteurs distincts par jour, cumulés)</span></div>'
   . '<div class="stat"><b>' . $n($m['human']) . '</b><span>visites ce mois-ci</span></div>'
   . '<div class="stat"><b>' . $n($y['human']) . '</b><span>visites cette année</span></div>'
   . '<div class="stat"><b>' . $n($l['ia']) . '</b><span>passages de robots IA sur 30 jours</span></div></div>';

echo '<h2>D\'où viennent les visiteurs (30 jours)</h2>';
$st = $pdo->prepare("SELECT src, SUM(hits) t FROM visits WHERE kind = 'human' AND day >= ? GROUP BY src ORDER BY t DESC"); $st->execute([$d30]);
$srcs = $st->fetchAll(); $tot = array_sum(array_map(fn($r) => (int)$r['t'], $srcs));
if (!$srcs) echo '<p>Pas encore de données.</p>';
else {
    echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Origine</th><th class="num">Visites</th><th class="num">Part</th></tr></thead><tbody>';
    foreach ($srcs as $r) echo '<tr><td>' . h(SRC_LABELS[$r['src']] ?? $r['src']) . '</td><td class="num">' . $n((int)$r['t']) . '</td><td class="num">' . round(100 * (int)$r['t'] / max(1, $tot)) . ' %</td></tr>';
    echo '</tbody></table></div>';
    $st = $pdo->prepare('SELECT host, SUM(hits) t FROM ref_hosts WHERE day >= ? GROUP BY host ORDER BY t DESC LIMIT 10'); $st->execute([$d30]);
    $hosts = $st->fetchAll();
    if ($hosts) { echo '<h3 class="mt-26">Sites qui nous envoient des visiteurs</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Site</th><th class="num">Visites</th></tr></thead><tbody>';
        foreach ($hosts as $r) echo '<tr><td>' . h($r['host']) . '</td><td class="num">' . $n((int)$r['t']) . '</td></tr>'; echo '</tbody></table></div>'; }
    echo '<p class="hint">Pour mesurer la newsletter ou un post, ajoutez <code>?src=newsletter</code>, <code>?src=facebook</code> ou <code>?src=instagram</code> à la fin du lien du site. Un clic venant de Facebook est aussi reconnu automatiquement.</p>';
}

echo '<h2 class="mt-26">Par jour (31 derniers jours)</h2>';
$st = $pdo->prepare("SELECT day, SUM(CASE WHEN kind='human' THEN hits ELSE 0 END) h, SUM(CASE WHEN kind='ia' THEN hits ELSE 0 END) i, SUM(CASE WHEN kind='bot' THEN hits ELSE 0 END) b FROM visits WHERE day >= ? GROUP BY day");
$st->execute([date('Y-m-d', strtotime('-30 days'))]); $byDay = []; foreach ($st->fetchAll() as $r) $byDay[$r['day']] = $r;
$st = $pdo->prepare('SELECT day, n FROM uniques WHERE day >= ?'); $st->execute([date('Y-m-d', strtotime('-30 days'))]); $un = []; foreach ($st->fetchAll() as $r) $un[$r['day']] = (int)$r['n'];
echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Jour</th><th class="num">Visites</th><th class="num">Visiteurs distincts</th><th class="num">Robots IA</th><th class="num">Autres robots</th></tr></thead><tbody>';
for ($i = 0; $i < 31; $i++) {
    $d = date('Y-m-d', strtotime("-$i days")); $r = $byDay[$d] ?? ['h' => 0, 'i' => 0, 'b' => 0];
    echo '<tr><td>' . h(date('d/m/Y', strtotime($d))) . '</td><td class="num">' . $n((int)$r['h']) . '</td><td class="num">' . $n($un[$d] ?? 0) . '</td><td class="num">' . $n((int)$r['i']) . '</td><td class="num">' . $n((int)$r['b']) . '</td></tr>';
}
echo '</tbody></table></div>';

foreach ([['mois', 'Cumul par mois', 7, 'substr(day,1,7)'], ['année', 'Cumul par année', 4, 'substr(day,1,4)']] as [$k, $title, $len, $expr]) {
    $rows = $pdo->query("SELECT $expr p, SUM(CASE WHEN kind='human' THEN hits ELSE 0 END) h, SUM(CASE WHEN kind='ia' THEN hits ELSE 0 END) i, SUM(CASE WHEN kind='bot' THEN hits ELSE 0 END) b FROM visits GROUP BY p ORDER BY p DESC")->fetchAll();
    $uq = []; foreach ($pdo->query("SELECT $expr p, SUM(n) n FROM uniques GROUP BY p")->fetchAll() as $r) $uq[$r['p']] = (int)$r['n'];
    echo '<h2 class="mt-26">' . $title . '</h2>';
    if (!$rows) { echo '<p>Pas encore de données.</p>'; continue; }
    echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' . ($k === 'mois' ? 'Mois' : 'Année') . '</th><th class="num">Visites</th><th class="num">Visiteurs distincts (somme des jours)</th><th class="num">Robots IA</th><th class="num">Autres robots</th></tr></thead><tbody>';
    foreach (array_slice($rows, 0, $k === 'mois' ? 36 : 10) as $r) {
        $lab = $k === 'mois' ? MOIS[(int)substr($r['p'], 5, 2)] . ' ' . substr($r['p'], 0, 4) : $r['p'];
        echo '<tr><td>' . h($lab) . '</td><td class="num">' . $n((int)$r['h']) . '</td><td class="num">' . $n($uq[$r['p']] ?? 0) . '</td><td class="num">' . $n((int)$r['i']) . '</td><td class="num">' . $n((int)$r['b']) . '</td></tr>';
    }
    echo '</tbody></table></div>';
}

echo '<h2 class="mt-26">Robots IA : qui passe, et quoi lisent-ils</h2>';
$st = $pdo->prepare("SELECT bot, SUM(CASE WHEN day >= ? THEN hits ELSE 0 END) r30, SUM(hits) tot, MAX(day) last FROM visits WHERE kind = 'ia' GROUP BY bot ORDER BY r30 DESC, tot DESC"); $st->execute([$d30]);
$bots = $st->fetchAll();
if (!$bots) echo '<p>Aucun robot IA détecté pour l\'instant. Le fichier <code>llms.txt</code> et <code>robots.txt</code> les accueillent : ils apparaîtront ici dès leur premier passage.</p>';
else {
    echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Robot</th><th class="num">30 jours</th><th class="num">Total</th><th>Dernier passage</th></tr></thead><tbody>';
    foreach ($bots as $r) echo '<tr><td>' . h($r['bot']) . '</td><td class="num">' . $n((int)$r['r30']) . '</td><td class="num">' . $n((int)$r['tot']) . '</td><td>' . h(date('d/m/Y', strtotime($r['last']))) . '</td></tr>';
    echo '</tbody></table></div>';
    $st = $pdo->prepare("SELECT page, SUM(hits) t FROM visits WHERE kind = 'ia' GROUP BY page ORDER BY t DESC"); $st->execute();
    echo '<h3 class="mt-26">Pages lues par les IA</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Page</th><th class="num">Passages</th></tr></thead><tbody>';
    foreach ($st->fetchAll() as $r) echo '<tr><td>' . h($r['page']) . '</td><td class="num">' . $n((int)$r['t']) . '</td></tr>';
    echo '</tbody></table></div>';
}
echo '<p class="hint">Les visites de robots ne sont jamais mêlées aux visites de personnes. Données agrégées par jour, conservées 5 ans, sans adresse IP ni identifiant.</p>';
layout_bottom(); echo '</body></html>';
