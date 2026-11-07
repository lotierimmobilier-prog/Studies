<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
require_admin();

$id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
$st = db()->prepare('SELECT * FROM announcements WHERE id = ?'); $st->execute([$id]);
$a = $st->fetch();
if (!$a) { http_response_code(404); exit('Annonce introuvable.'); }
$msg = '';

function field(string $k, int $max, bool $multi = false): string { $v = (string)($_POST[$k] ?? ''); return $multi ? clean($v, $max) : one_line($v, $max); }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $act = (string)($_POST['action'] ?? '');
    $now = date('c');
    if (in_array($act, ['save', 'validate', 'refuse'], true)) {                  // enregistre toujours les corrections de texte
        $cat = isset(CATEGORIES[$_POST['category'] ?? '']) ? $_POST['category'] : $a['category'];
        $link = trim((string)($_POST['link_url'] ?? ''));
        db()->prepare('UPDATE announcements SET category=?, title=?, what=?, place=?, whenx=?, conditions=?, public_contact=?, link_url=?, updated_at=? WHERE id=?')
            ->execute([$cat, field('title', 90), field('what', 700, true), field('place', 140), field('whenx', 140), field('conditions', 240),
                       field('public_contact', 140), safe_url($link), $now, $id]);
        if ($link !== '' && safe_url($link) === '') $msg .= flash('err', 'Le lien n\'a pas été enregistré : il doit commencer par https://.');
    }
    if ($act === 'validate') {
        $issue = preg_match('/^\d{4}-\d{2}$/', (string)($_POST['issue'] ?? '')) ? $_POST['issue'] : next_issue();
        db()->prepare("UPDATE announcements SET status='validated', issue=?, refusal_reason='', updated_at=? WHERE id=?")->execute([$issue, $now, $id]);
        if (!empty($_POST['notify'])) send_mail($a['contact_email'], 'Votre annonce est validée – Capendu Infos',
            "Bonjour {$a['contact_name']},\n\nVotre annonce « " . $a['title'] . " » est validée. Elle paraîtra dans le numéro de " . issue_label($issue) . ".\n"
            . "Vous pouvez suivre son avancement et le nombre de clics dans votre espace partenaire : " . SITE_URL . "/annonces/partenaire/\n\nMerci !\nJérôme BOUBA, Capendu Infos");
        $msg .= flash('ok', 'Annonce validée pour le numéro de ' . h(issue_label($issue)) . '.');
    } elseif ($act === 'refuse') {
        $reason = one_line((string)($_POST['reason'] ?? ''), 300);
        db()->prepare("UPDATE announcements SET status='refused', refusal_reason=?, issue='', updated_at=? WHERE id=?")->execute([$reason, $now, $id]);
        if (!empty($_POST['notify'])) send_mail($a['contact_email'], 'Votre annonce – Capendu Infos',
            "Bonjour {$a['contact_name']},\n\nMerci pour votre annonce « " . $a['title'] . " ». Nous ne pouvons pas la publier cette fois-ci."
            . ($reason !== '' ? "\n\nMotif : $reason" : '') . "\n\nVous pouvez la modifier et la déposer à nouveau sur " . SITE_URL . "/annonces/deposer.php\n\nJérôme BOUBA, Capendu Infos");
        $msg .= flash('ok', 'Annonce refusée.');
    } elseif ($act === 'reopen') {
        db()->prepare("UPDATE announcements SET status='pending', issue='', updated_at=? WHERE id=?")->execute([$now, $id]);
        $msg .= flash('ok', 'Annonce remise en attente.');
    } elseif ($act === 'delete') {
        db()->prepare('DELETE FROM announcements WHERE id = ?')->execute([$id]);
        header('Location: index.php'); exit;
    } elseif ($act === 'save') {
        $msg .= flash('ok', 'Modifications enregistrées.');
    }
    $st->execute([$id]); $a = $st->fetch();
}

layout_top('Annonce n°' . $id . ' – Administration', admin_nav('index.php'));
echo '<p><a href="index.php">← Toutes les annonces</a></p><h1>' . h($a['title']) . '</h1>' . $msg;
echo '<p>' . status_pill($a['status']) . ' ' . ($a['issue'] !== '' ? '<span class="hint">Numéro de ' . h(issue_label($a['issue'])) . '</span>' : '') . '</p>';
if (in_array($a['status'], ['validated', 'published'], true))
    echo '<div class="stats"><div class="stat"><b>' . clicks_total($id) . '</b><span>clics au total</span></div><div class="stat"><b>' . clicks_since($id, 30) . '</b><span>clics sur 30 jours</span></div></div>';
?>
<div class="card">
  <h2>Annonceur <span class="hint">(privé)</span></h2>
  <dl class="kv">
    <dt>Organisation</dt><dd><?= h($a['org_name']) ?></dd>
    <dt>Nom</dt><dd><?= h($a['contact_name']) ?></dd>
    <dt>E-mail</dt><dd><?= h($a['contact_email']) ?></dd>
    <dt>Téléphone</dt><dd><?= h($a['contact_phone'] ?: '–') ?></dd>
    <dt>Reçue le</dt><dd><?= h(date('d/m/Y à H:i', strtotime($a['created_at']))) ?> (consentement enregistré)</dd>
    <?php if ($a['refusal_reason'] !== ''): ?><dt>Motif du refus</dt><dd><?= h($a['refusal_reason']) ?></dd><?php endif; ?>
  </dl>
</div>

<form class="card" method="post" action="annonce.php?id=<?= $id ?>">
  <?= csrf_field() ?><input type="hidden" name="id" value="<?= $id ?>">
  <h2>Texte de l'annonce <span class="hint">(vous pouvez reformuler avant de valider)</span></h2>
  <div class="form-grid">
    <div class="field"><label for="category">Rubrique</label><select id="category" name="category">
      <?php foreach (CATEGORIES as $k => [$tag, $label]): ?><option value="<?= h($k) ?>" <?= $a['category'] === $k ? 'selected' : '' ?>><?= h($label) ?></option><?php endforeach; ?></select></div>
    <div class="field"><label for="title">Titre</label><input id="title" name="title" type="text" maxlength="90" value="<?= h($a['title']) ?>"></div>
    <div class="field full"><label for="what">Quoi</label><textarea id="what" name="what" maxlength="700"><?= h($a['what']) ?></textarea></div>
    <div class="field"><label for="place">Où</label><input id="place" name="place" type="text" maxlength="140" value="<?= h($a['place']) ?>"></div>
    <div class="field"><label for="whenx">Quand</label><input id="whenx" name="whenx" type="text" maxlength="140" value="<?= h($a['whenx']) ?>"></div>
    <div class="field full"><label for="conditions">Conditions</label><input id="conditions" name="conditions" type="text" maxlength="240" value="<?= h($a['conditions']) ?>"></div>
    <div class="field"><label for="public_contact">Contact publié</label><input id="public_contact" name="public_contact" type="text" maxlength="140" value="<?= h($a['public_contact']) ?>"></div>
    <div class="field"><label for="link_url">Lien du bouton « En savoir plus »</label><input id="link_url" name="link_url" type="url" maxlength="300" value="<?= h($a['link_url']) ?>" placeholder="Vide = page de l'annonce sur le site"></div>
  </div>
  <div class="consent mt-18"><input id="notify" name="notify" type="checkbox" value="1" checked><label for="notify">Prévenir l'annonceur par e-mail (validation ou refus)</label></div>
  <div class="form-grid mt-18">
    <div class="field"><label for="issue">Numéro de parution</label><input id="issue" name="issue" type="month" value="<?= h($a['issue'] !== '' ? $a['issue'] : next_issue()) ?>"></div>
    <div class="field"><label for="reason">Motif du refus <span class="hint">(si refus, visible par l'annonceur)</span></label><input id="reason" name="reason" type="text" maxlength="300" value="<?= h($a['refusal_reason']) ?>"></div>
  </div>
  <div class="actions">
    <button class="btn" type="submit" name="action" value="validate">Valider pour ce numéro</button>
    <button class="btn btn-ghost" type="submit" name="action" value="save">Enregistrer sans valider</button>
    <button class="btn btn-danger" type="submit" name="action" value="refuse">Refuser</button>
  </div>
</form>

<form class="card" method="post" action="annonce.php?id=<?= $id ?>">
  <?= csrf_field() ?><input type="hidden" name="id" value="<?= $id ?>">
  <div class="actions">
    <?php if ($a['status'] !== 'pending'): ?><button class="btn btn-ghost" type="submit" name="action" value="reopen">Remettre en attente</button><?php endif; ?>
    <button class="btn btn-danger" type="submit" name="action" value="delete" data-confirm="Supprimer définitivement cette annonce et les coordonnées de l'annonceur ?">Supprimer définitivement</button>
  </div>
</form>
<script src="admin.js"></script>
<?php layout_bottom(); ?>
</body></html>
