<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
require __DIR__ . '/../inc/ia.php';
security_headers();
require_admin();

$issues = db()->query("SELECT DISTINCT issue FROM announcements WHERE status = 'validated' AND issue <> '' ORDER BY issue DESC")->fetchAll(PDO::FETCH_COLUMN);
$issue = (string)($_GET['issue'] ?? $_POST['issue'] ?? ($issues[0] ?? ''));
if (!preg_match('/^\d{4}-\d{2}$/', $issue)) $issue = '';
$list = [];
if ($issue !== '') { $st = db()->prepare("SELECT * FROM announcements WHERE status = 'validated' AND issue = ? ORDER BY created_at"); $st->execute([$issue]); $list = $st->fetchAll(); }
$byId = []; foreach ($list as $a) $byId[(int)$a['id']] = $a;

$msg = ''; $preview = null; $reply = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $issue !== '') {
    csrf_check();
    $reply = clean_multiline((string)($_POST['reply'] ?? ''), 60000);
    $parsed = ia_parse($reply);
    if (($_POST['action'] ?? '') === 'apply') {
        $n = 0;
        foreach ((array)($_POST['apply'] ?? []) as $id) {
            $id = (int)$id;
            if (isset($byId[$id], $parsed['items'][$id])) {
                db()->prepare('UPDATE announcements SET title = ?, what = ?, updated_at = ? WHERE id = ? AND status = \'validated\'')
                    ->execute([$parsed['items'][$id]['title'], $parsed['items'][$id]['what'], date('c'), $id]);
                $n++;
            }
        }
        $msg = flash('ok', $n . ' annonce(s) mise(s) à jour avec la proposition de l\'IA.');
        $st->execute([$issue]); $list = $st->fetchAll(); $byId = []; foreach ($list as $a) $byId[(int)$a['id']] = $a;
        $reply = '';
    } else {
        $preview = $parsed;
        if (!$parsed['items'] && $parsed['edito'] === '') $msg = flash('err', 'Je n\'ai pas reconnu la réponse de l\'IA. Elle doit contenir des blocs « ### 12 » suivis de « TITRE: » et « TEXTE: ». Redemandez-lui en rappelant le format.');
    }
}

layout_top('Rédiger avec l\'IA – Administration', admin_nav('ia.php'));
echo '<h1>Rédiger avec l\'IA</h1>' . $msg;
echo '<p class="lead">Une aide pour relire et reformuler les annonces avant l\'envoi, <strong>sans clé ni compte technique</strong> : vous copiez la demande ci-dessous dans un assistant (par exemple Claude sur claude.ai), puis vous collez sa réponse ici. Vous relisez chaque proposition et décidez de l\'appliquer ou non.</p>';
echo '<p class="notice notice-info"><strong>Respect des données personnelles :</strong> la demande ne contient que les textes publics des annonces (titre, description, lieu, date). Jamais de nom, d\'e-mail, de téléphone ni de photo d\'annonceur.</p>';
if (!$issues) { echo '<p>Aucune annonce validée pour le moment. Validez d\'abord des annonces dans l\'onglet « Annonces ».</p>'; layout_bottom(); echo '</body></html>'; exit; }

echo '<form method="get" class="card" action="ia.php"><div class="field"><label for="issue">Numéro</label><select id="issue" name="issue">';
foreach ($issues as $i) echo '<option value="' . h($i) . '"' . ($i === $issue ? ' selected' : '') . '>' . h(ucfirst(issue_label($i))) . '</option>';
echo '</select></div><div class="actions"><button class="btn" type="submit">Afficher</button></div></form>';

echo '<div class="card"><h2>1. Copier la demande</h2><p>' . count($list) . ' annonce(s) validée(s) pour ' . h(issue_label($issue)) . '. Copiez ce texte et collez-le dans votre assistant.</p>'
   . '<textarea id="prompt" class="export-box" readonly>' . h(ia_prompt($list, $issue)) . '</textarea>'
   . '<div class="actions"><button class="btn" type="button" data-copy="prompt">Copier le code</button></div></div>';

echo '<form class="card" method="post" action="ia.php"><h2>2. Coller la réponse de l\'IA</h2>' . csrf_field() . '<input type="hidden" name="issue" value="' . h($issue) . '">'
   . '<div class="field"><label for="reply">Réponse de l\'assistant</label><textarea id="reply" name="reply" class="export-box" placeholder="### 12&#10;TITRE: …&#10;TEXTE: …">' . h($reply) . '</textarea></div>'
   . '<div class="actions"><button class="btn" type="submit" name="action" value="preview">Voir les propositions</button></div></form>';

if ($preview && ($preview['items'] || $preview['edito'] !== '')) {
    echo '<form class="card" method="post" action="ia.php"><h2>3. Relire et appliquer</h2>' . csrf_field() . '<input type="hidden" name="issue" value="' . h($issue) . '"><input type="hidden" name="reply" value="' . h($reply) . '">';
    if ($preview['edito'] !== '') {
        echo '<h3>Édito proposé</h3><textarea id="edito" class="export-box" readonly>' . h($preview['edito']) . '</textarea><div class="actions"><button class="btn btn-ghost" type="button" data-copy="edito">Copier le code</button></div>'
           . '<p class="hint">À coller dans le mot de l\'éditeur du modèle de newsletter.</p>';
    }
    foreach ($preview['items'] as $id => $p) {
        if (!isset($byId[$id])) { echo '<p class="hint">L\'annonce n°' . (int)$id . ' ne fait pas partie de ce numéro : ignorée.</p>'; continue; }
        $old = $byId[$id];
        echo '<div class="tbl-wrap mt-18"><table class="tbl"><thead><tr><th></th><th>Actuel</th><th>Proposé par l\'IA</th></tr></thead><tbody>'
           . '<tr><th>Titre</th><td>' . h($old['title']) . '</td><td><strong>' . h($p['title']) . '</strong></td></tr>'
           . '<tr><th>Texte</th><td>' . h($old['what']) . '</td><td>' . h($p['what']) . '</td></tr></tbody></table></div>'
           . '<div class="consent mt-14"><input id="ap' . (int)$id . '" type="checkbox" name="apply[]" value="' . (int)$id . '" checked><label for="ap' . (int)$id . '">Appliquer à l\'annonce n°' . (int)$id . ' (' . h($old['org_name']) . ')</label></div>';
    }
    if ($preview['items']) echo '<div class="actions"><button class="btn" type="submit" name="action" value="apply" data-confirm="Remplacer les textes cochés par les propositions de l\'IA ?">Appliquer les propositions cochées</button></div>';
    echo '</form>';
}
echo '<script src="admin.js"></script>';
layout_bottom(); echo '</body></html>';
