<?php
declare(strict_types=1);
// Liste publique des partenaires (entreprises et associations validées par l'éditeur).
require __DIR__ . '/inc/layout.php';
security_headers();
header('Cache-Control: public, max-age=300');
$type = (string)($_GET['type'] ?? '');
$where = "status = 'approved'" . (isset(ORG_TYPES[$type]) ? ' AND org_type = :t' : '');
$st = db()->prepare("SELECT * FROM partners WHERE $where ORDER BY org_name COLLATE NOCASE");
$isT = isset(ORG_TYPES[$type]); if ($isT) $st->bindValue(':t', $type);
$st->execute(); $rows = $st->fetchAll();

function initials(string $name): string {
    $w = preg_split('/[\s\-\']+/u', trim($name)) ?: [];
    $w = array_values(array_filter($w, fn($x) => mb_strlen($x) > 2 || count($w) === 1));
    $i = ''; foreach (array_slice($w, 0, 2) as $x) $i .= mb_strtoupper(mb_substr($x, 0, 1));
    return $i !== '' ? $i : '·';
}
layout_top('Nos partenaires – Capendu en bref', '<a class="btn btn-small" href="' . h(site_root()) . 'devenir-partenaire.html">Devenir partenaire</a>', false);
echo '<h1>Nos partenaires</h1>';
echo '<p class="lead">Les entreprises et associations de Capendu, et les associations voisines dont l\'activité se déroule sur la commune, qui font vivre le village et partagent ici leurs événements, leurs offres et leur actualité. Inscription gratuite.</p>';
echo '<nav class="tabs" aria-label="Filtrer"><a href="partenaires.php"' . (!$isT ? ' aria-current="page"' : '') . '>Tous</a>';
foreach (ORG_TYPES as $k => $l) echo '<a href="?type=' . h($k) . '"' . ($type === $k ? ' aria-current="page"' : '') . '>' . h($k === 'entreprise' ? 'Entreprises et commerces' : 'Associations et clubs') . '</a>';
echo '</nav>';
if (!$rows) {
    echo '<div class="card"><p>La liste se remplit au fur et à mesure des inscriptions. Soyez parmi les premiers : <a href="' . h(site_root()) . 'devenir-partenaire.html">devenir partenaire</a>.</p></div>';
} else {
    echo '<ul class="partners-grid">';
    foreach ($rows as $p) {
        $tel = preg_replace('/[^\d+]/', '', $p['public_phone']) ?? '';
        echo '<li class="partner-card">';
        echo $p['logo'] !== '' ? '<img class="partner-logo" src="logo.php?id=' . (int)$p['id'] . '" alt="Logo de ' . h($p['org_name']) . '" loading="lazy">' : '<div class="partner-initials" aria-hidden="true">' . h(initials($p['org_name'])) . '</div>';
        echo '<div class="partner-info"><span class="tag">' . h($p['eligibility'] === 'voisine' ? 'Association voisine' : ($p['org_type'] === 'association' ? 'Association' : 'Entreprise')) . '</span>'
           . '<h2>' . h($p['org_name']) . '</h2>'
           . ($p['address'] !== '' ? '<p class="partner-line"><span class="hint">Siège social :</span> ' . h($p['address']) . '</p>' : '')
           . ($p['eligibility'] === 'voisine' && $p['activity_place'] !== '' ? '<p class="partner-line"><span class="hint">Activité à Capendu :</span> ' . h($p['activity_place']) . '</p>' : '')
           . ($tel !== '' ? '<p class="partner-line"><a href="tel:' . h($tel) . '">' . h($p['public_phone']) . '</a></p>' : '')
           . ((int)$p['can_help'] ? '<p class="partner-help">Peut vous aider à vous inscrire à la newsletter</p>' : '') . '</div></li>';
    }
    echo '</ul>';
}
layout_bottom(); echo '</body></html>';
