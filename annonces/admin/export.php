<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
require __DIR__ . '/../inc/export_html.php';
security_headers(true);           // l'aperçu utilise des styles en ligne, comme l'e-mail
require_admin();

$issues = db()->query("SELECT DISTINCT issue FROM announcements WHERE status IN ('validated','published') AND issue <> '' ORDER BY issue DESC")->fetchAll(PDO::FETCH_COLUMN);
$issue = (string)($_GET['issue'] ?? $_POST['issue'] ?? ($issues[0] ?? ''));
if ($issue !== '' && !preg_match('/^\d{4}-\d{2}$/', $issue)) $issue = '';
$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $issue !== '') {
    csrf_check();
    $n = db()->prepare("UPDATE announcements SET status='published', updated_at=? WHERE status='validated' AND issue=?");
    $n->execute([date('c'), $issue]);
    $msg = flash('ok', $n->rowCount() . ' annonce(s) marquée(s) comme publiées. Les annonceurs le voient dans leur espace partenaire.');
}
$list = [];
if ($issue !== '') { $st = db()->prepare("SELECT * FROM announcements WHERE status IN ('validated','published') AND issue = ? ORDER BY created_at"); $st->execute([$issue]); $list = $st->fetchAll(); }
$validatedCount = count(array_filter($list, fn($a) => $a['status'] === 'validated'));

layout_top('Préparer le numéro – Administration', admin_nav('export.php'));
echo '<h1>Préparer le numéro</h1>' . $msg;
echo '<p class="lead">Les annonces validées sont regroupées par rubrique, avec un bouton « En savoir plus » dont les clics sont comptés. Copiez le code et collez-le dans l\'éditeur HTML de Brevo, à la place des fiches d\'exemple du modèle.</p>';
if (!$issues) { echo '<p>Aucune annonce validée pour le moment.</p>'; layout_bottom(); echo '</body></html>'; exit; }
echo '<form method="get" class="card" action="export.php"><div class="field"><label for="issue">Numéro</label><select id="issue" name="issue">';
foreach ($issues as $i) echo '<option value="' . h($i) . '"' . ($i === $issue ? ' selected' : '') . '>' . h(ucfirst(issue_label($i))) . '</option>';
echo '</select></div><div class="actions"><button class="btn" type="submit">Afficher</button></div></form>';

$html = x_sections($list);
echo '<div class="card"><h2>' . count($list) . ' annonce(s) pour ' . h(issue_label($issue)) . '</h2>';
echo '<label for="code" class="hint">Code HTML à coller dans Brevo</label><textarea id="code" class="export-box" readonly>' . h($html) . '</textarea>';
echo '<div class="actions"><button class="btn" type="button" data-copy="code">Copier le code</button></div>';
echo '<h3 class="mt-26">Aperçu</h3><div class="preview"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $html . '</table></div>';
if ($validatedCount > 0) {
    echo '<form method="post" action="export.php" class="mt-26">' . csrf_field() . '<input type="hidden" name="issue" value="' . h($issue) . '">'
       . '<p class="hint">Après l\'envoi de la newsletter : marquez les annonces comme publiées.</p>'
       . '<div class="actions"><button class="btn btn-ghost" type="submit" data-confirm="Marquer ' . $validatedCount . ' annonce(s) comme publiées ?">Marquer comme publiées</button></div></form>';
}
echo '</div><script src="admin.js"></script>';
layout_bottom(); echo '</body></html>';
