<?php
declare(strict_types=1);
// Dépôt d'une annonce : réservé aux partenaires (siège social à Capendu, ou association voisine active à Capendu) dont l'inscription a été validée.
require __DIR__ . '/inc/layout.php';
security_headers();
start_session();
$partner = current_partner();

if (!$partner) {
    layout_top('Déposer une annonce – Capendu en bref', '<a class="btn btn-small btn-ghost" href="partenaire/">Espace partenaire</a>');
    echo '<h1>Déposer une annonce</h1>';
    echo '<p class="notice notice-info"><strong>Réservé aux entreprises et associations dont le siège social est à Capendu,</strong> et aux associations voisines dont l\'activité se déroule sur la commune. Votre organisation doit d\'abord être inscrite et validée par l\'éditeur. Les particuliers ne peuvent pas déposer d\'annonce.</p>';
    echo '<div class="card"><h2>1. Inscrivez votre organisation</h2><p>Il suffit de quelques informations sur votre organisation (nom, adresse du siège social, téléphone, logo). L\'éditeur valide votre inscription.</p><div class="actions"><a class="btn" href="inscription.php">Inscrire mon organisation</a></div></div>';
    echo '<div class="card"><h2>2. Déjà inscrit et validé ?</h2><p>Ouvrez votre espace partenaire : un lien de connexion est envoyé à votre adresse e-mail, sans mot de passe. Vous pourrez alors déposer vos annonces.</p><div class="actions"><a class="btn btn-ghost" href="partenaire/">Ouvrir mon espace partenaire</a></div></div>';
    layout_bottom(); echo '</body></html>'; exit;
}

$errors = [];
$v = ['category' => '', 'title' => '', 'what' => '', 'place' => '', 'whenx' => '', 'conditions' => '', 'public_contact' => '', 'link_url' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!empty($_POST['website'])) { header('Location: deposer.php?ok=1'); exit; }
    if (!form_stamp_ok((string)($_POST['stamp'] ?? ''))) $errors[] = 'Le formulaire a expiré ou a été envoyé trop vite. Merci de réessayer.';
    if (rate_count('submit', 3600) >= 10) $errors[] = 'Trop d\'envois depuis votre connexion. Réessayez dans une heure.';
    $v['category']       = (string)($_POST['category'] ?? '');
    $v['title']          = one_line((string)($_POST['title'] ?? ''), 90);
    $v['what']           = clean((string)($_POST['what'] ?? ''), 700);
    $v['place']          = one_line((string)($_POST['place'] ?? ''), 140);
    $v['whenx']          = one_line((string)($_POST['whenx'] ?? ''), 140);
    $v['conditions']     = one_line((string)($_POST['conditions'] ?? ''), 240);
    $v['public_contact'] = one_line((string)($_POST['public_contact'] ?? ''), 140);
    $v['link_url']       = trim((string)($_POST['link_url'] ?? ''));

    if (!isset(CATEGORIES[$v['category']])) $errors[] = 'Choisissez une rubrique.';
    if ($v['title'] === '') $errors[] = 'Indiquez un titre.';
    if (mb_strlen($v['what']) < 20) $errors[] = 'Décrivez votre annonce en quelques phrases (20 caractères au minimum).';
    if ($v['category'] !== 'pratique' && $v['whenx'] === '') $errors[] = 'Indiquez la date ou la période (rubrique « Quand »).';
    if ($v['place'] === '') $errors[] = 'Indiquez le lieu (rubrique « Où »).';
    if ($v['link_url'] !== '' && safe_url($v['link_url']) === '') $errors[] = 'Le lien doit commencer par https:// (ou laissez le champ vide).';
    if (empty($_POST['consent'])) $errors[] = 'Cochez la case qui garantit vos droits sur les textes et images.';
    $hasPhoto = (int)($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    if ($hasPhoto && empty($_POST['photo_rights'])) $errors[] = 'Pour joindre une photo, cochez la case qui garantit vos droits sur la photo.';

    $photo = '';
    if (!$errors) { [$photo, $photoErr] = save_photo($_FILES['photo'] ?? []); if ($photoErr !== '') $errors[] = $photoErr; }
    if (!$errors) {
        $now = date('c');
        db()->prepare('INSERT INTO announcements (created_at, updated_at, status, category, title, what, place, whenx, conditions, public_contact, link_url,
                        org_name, contact_name, contact_email, contact_phone, consent_at, photo, org_type, org_id, org_verified, org_check, partner_id)
                       VALUES (?, ?, \'pending\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?)')
            ->execute([$now, $now, $v['category'], $v['title'], $v['what'], $v['place'], $v['whenx'], $v['conditions'], $v['public_contact'], safe_url($v['link_url']),
                       $partner['org_name'], $partner['contact_name'], $partner['contact_email'], $partner['contact_phone'], $now, $photo,
                       $partner['org_type'], $partner['org_id'], 'Partenaire validé par l\'éditeur', (int)$partner['id']]);
        db()->prepare('UPDATE partners SET updated_at = ? WHERE id = ?')->execute([$now, $partner['id']]);
        rate_hit('submit');
        $id = (int)db()->lastInsertId();
        send_mail(ADMIN_EMAIL, 'Nouvelle annonce à valider (n°' . $id . ')', "Une nouvelle annonce attend votre validation.\n\nConnectez-vous à l'espace de validation : " . SITE_URL . "/annonces/admin/\n");
        header('Location: deposer.php?ok=1'); exit;
    }
}

layout_top('Déposer une annonce – Capendu en bref', '<a class="btn btn-small btn-ghost" href="partenaire/">Mon espace partenaire</a>');
echo '<h1>Déposer une annonce</h1>';
echo '<p class="lead">Au nom de <strong>' . h($partner['org_name']) . '</strong>. Votre annonce sera relue puis publiée gratuitement dans la newsletter mensuelle. Vous suivez son avancement dans votre <a href="partenaire/">espace partenaire</a>.</p>';
if (isset($_GET['ok'])) {
    echo flash('ok', 'Merci ! Votre annonce a bien été reçue. Elle sera relue avant publication. Suivez son avancement dans votre <a href="partenaire/">espace partenaire</a>.');
    echo '<p><a class="btn" href="deposer.php">Déposer une autre annonce</a></p>';
    layout_bottom(); echo '</body></html>'; exit;
}
if ($errors) echo flash('err', '<strong>Quelques points à corriger :</strong><br>' . implode('<br>', array_map('h', $errors)));
[$issueLabel, $deadlineLabel] = next_deadline();
echo '<p class="notice notice-info"><strong>Calendrier :</strong> pour paraître dans le numéro de <strong>' . h($issueLabel) . '</strong>, déposez votre annonce <strong>avant le ' . h($deadlineLabel) . '</strong>. Pensez à publier une annonce avant votre événement, puis un « retour sur les événements » après.</p>';
?>
<details class="assistant" open data-org="<?= h($partner['org_name']) ?>" data-issue="<?= h($issueLabel) ?>" data-deadline="<?= h($deadlineLabel) ?>">
  <summary>Assistant IA : organisez votre publication</summary>
  <p>Racontez en vrac ce que vous voulez annoncer. L'assistant prépare une demande pour Claude, l'assistant IA gratuit de claude.ai (aucune clé ni installation), qui vous renvoie une annonce claire, rangée dans la bonne rubrique avec un conseil de calendrier. Vous collez sa réponse ici et le formulaire se remplit tout seul. Vous relisez et vous gardez la main.</p>
  <ol class="assist-steps">
    <li><label for="ia_notes"><strong>1. Vos idées en vrac</strong> <span class="hint">(événement, prix, dates, lieu, public…)</span></label>
      <textarea id="ia_notes" placeholder="Ex. : repas de fin d'année de l'association le 12 décembre à la salle des fêtes, cassoulet et tombola, 15 euros, réservation avant le 8"></textarea></li>
    <li><strong>2. Envoyez-la à Claude</strong> <button class="btn btn-small" type="button" id="ia_copy">Copier et ouvrir Claude</button> <span class="hint" id="ia_copied" role="status"></span><br>
      <span class="hint">La demande est copiée et <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">claude.ai</a> s'ouvre dans un nouvel onglet : faites « Coller » puis envoyez. Ne lui donnez aucune donnée personnelle (noms de particuliers, téléphones).</span></li>
    <li><label for="ia_reply"><strong>3. Collez sa réponse</strong></label>
      <textarea id="ia_reply" placeholder="RUBRIQUE: …&#10;TITRE: …&#10;TEXTE: …"></textarea>
      <button class="btn btn-small btn-ghost" type="button" id="ia_fill">Remplir le formulaire avec la réponse</button> <span class="hint" id="ia_status" role="status"></span>
      <p id="ia_conseil" class="ia-conseil" hidden></p></li>
  </ol>
</details>
<form class="card" method="post" action="deposer.php" enctype="multipart/form-data" novalidate>
  <?= csrf_field() ?>
  <input type="hidden" name="stamp" value="<?= h(form_stamp()) ?>">
  <div class="hp" aria-hidden="true"><label>Ne pas remplir <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

  <fieldset class="cats">
    <legend>Rubrique</legend>
    <?php foreach (CATEGORIES as $k => [$tag, $label]): ?>
      <label><input type="radio" name="category" value="<?= h($k) ?>" <?= $v['category'] === $k ? 'checked' : '' ?>> <?= h($label) ?></label>
    <?php endforeach; ?>
  </fieldset>

  <div class="form-grid mt-18">
    <div class="field full"><label for="title">Titre <span class="hint">(court et concret)</span></label><input id="title" name="title" type="text" maxlength="90" value="<?= h($v['title']) ?>" required></div>
    <div class="field full"><label for="what">Quoi <span class="hint">(en quelques phrases simples, 700 caractères maximum)</span></label><textarea id="what" name="what" maxlength="700" required><?= h($v['what']) ?></textarea></div>
    <div class="field"><label for="place">Où</label><input id="place" name="place" type="text" maxlength="140" value="<?= h($v['place']) ?>" required></div>
    <div class="field"><label for="whenx">Quand <span class="hint">(date complète)</span></label><input id="whenx" name="whenx" type="text" maxlength="140" value="<?= h($v['whenx']) ?>"></div>
    <div class="field full"><label for="conditions">Conditions <span class="hint">(pour une offre : prix, dates, restrictions – facultatif)</span></label><input id="conditions" name="conditions" type="text" maxlength="240" value="<?= h($v['conditions']) ?>"></div>
    <div class="field"><label for="public_contact">Contact à publier <span class="hint">(facultatif)</span></label><input id="public_contact" name="public_contact" type="text" maxlength="140" value="<?= h($v['public_contact']) ?>"></div>
    <div class="field"><label for="link_url">Lien d'inscription ou d'information <span class="hint">(facultatif, https://…)</span></label><input id="link_url" name="link_url" type="url" maxlength="300" value="<?= h($v['link_url']) ?>" placeholder="Page d'inscription, billetterie, site…"></div>
    <div class="field full"><label for="photo">Photo <span class="hint">(facultatif : JPEG, PNG ou WebP, 5 Mo maximum)</span></label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"></div>
    <div class="consent full"><input id="photo_rights" name="photo_rights" type="checkbox" value="1"><label for="photo_rights">Si je joins une photo : je garantis en détenir les droits et avoir l'accord des personnes qui y sont reconnaissables. Elle est redimensionnée et ses données cachées (lieu, appareil) sont supprimées.</label></div>
  </div>
  <div id="aide" class="aide" aria-live="polite" data-max="700"></div>

  <div class="consent mt-18">
    <input id="consent" name="consent" type="checkbox" value="1" required>
    <label for="consent">Je garantis détenir les droits sur les textes et images fournis et j'accepte leur publication gratuite dans la newsletter et sur le site de Capendu en bref (<a href="<?= h(site_root()) ?>index.html#confidentialite">politique de confidentialité</a>).</label>
  </div>
  <div class="actions"><button class="btn" type="submit">Envoyer mon annonce</button></div>
</form>
<script src="deposer.js?v=<?= (int)@filemtime(__DIR__ . '/deposer.js') ?>"></script>
<?php layout_bottom(); ?>
</body></html>
