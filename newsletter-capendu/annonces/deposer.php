<?php
declare(strict_types=1);
require __DIR__ . '/inc/layout.php';
security_headers();
start_session();

$errors = [];
$v = ['category' => '', 'title' => '', 'what' => '', 'place' => '', 'whenx' => '', 'conditions' => '', 'public_contact' => '', 'link_url' => '',
      'org_name' => '', 'contact_name' => '', 'contact_email' => $_SESSION['partner_email'] ?? '', 'contact_phone' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!empty($_POST['website'])) { header('Location: deposer.php?ok=1'); exit; }          // champ piège rempli : robot
    if (!form_stamp_ok((string)($_POST['stamp'] ?? ''))) $errors[] = 'Le formulaire a expiré ou a été envoyé trop vite. Merci de réessayer.';
    if (rate_count('submit', 3600) >= 5) $errors[] = 'Trop d\'envois depuis votre connexion. Réessayez dans une heure.';

    $v['category']       = (string)($_POST['category'] ?? '');
    $v['title']          = one_line((string)($_POST['title'] ?? ''), 90);
    $v['what']           = clean((string)($_POST['what'] ?? ''), 700);
    $v['place']          = one_line((string)($_POST['place'] ?? ''), 140);
    $v['whenx']          = one_line((string)($_POST['whenx'] ?? ''), 140);
    $v['conditions']     = one_line((string)($_POST['conditions'] ?? ''), 240);
    $v['public_contact'] = one_line((string)($_POST['public_contact'] ?? ''), 140);
    $v['link_url']       = trim((string)($_POST['link_url'] ?? ''));
    $v['org_name']       = one_line((string)($_POST['org_name'] ?? ''), 90);
    $v['contact_name']   = one_line((string)($_POST['contact_name'] ?? ''), 90);
    $v['contact_email']  = one_line((string)($_POST['contact_email'] ?? ''), 150);
    $v['contact_phone']  = one_line((string)($_POST['contact_phone'] ?? ''), 30);

    if (!isset(CATEGORIES[$v['category']])) $errors[] = 'Choisissez une rubrique.';
    if ($v['title'] === '') $errors[] = 'Indiquez un titre.';
    if (mb_strlen($v['what']) < 20) $errors[] = 'Décrivez votre annonce en quelques phrases (20 caractères au minimum).';
    if ($v['category'] !== 'pratique' && $v['whenx'] === '') $errors[] = 'Indiquez la date ou la période (rubrique « Quand »).';
    if ($v['place'] === '') $errors[] = 'Indiquez le lieu (rubrique « Où »).';
    if ($v['org_name'] === '') $errors[] = 'Indiquez le nom de votre commerce ou de votre association.';
    if ($v['contact_name'] === '') $errors[] = 'Indiquez votre nom.';
    if (!filter_var($v['contact_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Indiquez une adresse e-mail valide.';
    if ($v['link_url'] !== '' && safe_url($v['link_url']) === '') $errors[] = 'Le lien doit commencer par https:// (ou laissez le champ vide).';
    if (empty($_POST['consent'])) $errors[] = 'Cochez la case de consentement pour envoyer votre annonce.';

    if (!$errors) {
        $now = date('c');
        db()->prepare('INSERT INTO announcements (created_at, updated_at, status, category, title, what, place, whenx, conditions, public_contact, link_url,
                        org_name, contact_name, contact_email, contact_phone, consent_at)
                       VALUES (?, ?, \'pending\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$now, $now, $v['category'], $v['title'], $v['what'], $v['place'], $v['whenx'], $v['conditions'], $v['public_contact'],
                       safe_url($v['link_url']), $v['org_name'], $v['contact_name'], strtolower($v['contact_email']), $v['contact_phone'], $now]);
        rate_hit('submit');
        $id = (int)db()->lastInsertId();
        send_mail(ADMIN_EMAIL, 'Nouvelle annonce à valider (n°' . $id . ')',
            "Une nouvelle annonce attend votre validation.\n\nConnectez-vous à l'espace de validation : " . SITE_URL . "/annonces/admin/\n");
        header('Location: deposer.php?ok=1'); exit;
    }
}

layout_top('Déposer une annonce – Capendu Infos', '<a class="btn btn-small btn-ghost" href="partenaire/">Espace partenaire</a>');
echo '<h1>Déposer une annonce</h1>';
echo '<p class="lead">Commerçants, artisans, associations, clubs : votre annonce sera relue puis publiée gratuitement dans la newsletter mensuelle. Vous serez prévenu(e) par e-mail et vous pourrez suivre son avancement dans votre <a href="partenaire/">espace partenaire</a>.</p>';

if (isset($_GET['ok'])) {
    echo flash('ok', 'Merci ! Votre annonce a bien été reçue. Elle sera relue avant publication. Vous pouvez suivre son avancement dans votre <a href="partenaire/">espace partenaire</a>.');
    echo '<p><a class="btn" href="deposer.php">Déposer une autre annonce</a></p>';
    layout_bottom(); echo '</body></html>'; exit;
}
if ($errors) echo flash('err', '<strong>Quelques points à corriger :</strong><br>' . implode('<br>', array_map('h', $errors)));
?>
<form class="card" method="post" action="deposer.php" novalidate>
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
    <div class="field"><label for="link_url">Lien vers votre site ou votre page <span class="hint">(facultatif, https://…)</span></label><input id="link_url" name="link_url" type="url" maxlength="300" value="<?= h($v['link_url']) ?>"></div>
  </div>

  <h2 class="mt-26">Vos coordonnées <span class="hint">(privées, non publiées)</span></h2>
  <div class="form-grid">
    <div class="field"><label for="org_name">Commerce ou association</label><input id="org_name" name="org_name" type="text" maxlength="90" value="<?= h($v['org_name']) ?>" required></div>
    <div class="field"><label for="contact_name">Votre nom</label><input id="contact_name" name="contact_name" type="text" maxlength="90" autocomplete="name" value="<?= h($v['contact_name']) ?>" required></div>
    <div class="field"><label for="contact_email">Votre e-mail</label><input id="contact_email" name="contact_email" type="email" maxlength="150" autocomplete="email" value="<?= h($v['contact_email']) ?>" required></div>
    <div class="field"><label for="contact_phone">Téléphone <span class="hint">(facultatif)</span></label><input id="contact_phone" name="contact_phone" type="text" maxlength="30" autocomplete="tel" value="<?= h($v['contact_phone']) ?>"></div>
  </div>

  <div class="consent mt-18">
    <input id="consent" name="consent" type="checkbox" value="1" required>
    <label for="consent">J'accepte que mes coordonnées servent uniquement à échanger au sujet de mon annonce et à me donner accès à mon espace partenaire. Elles ne sont ni publiées ni cédées, et supprimées au plus tard 12 mois après le dépôt (<a href="<?= h(site_root()) ?>index.html#confidentialite">politique de confidentialité</a>). Je garantis détenir les droits sur les textes et images fournis.</label>
  </div>
  <div class="actions"><button class="btn" type="submit">Envoyer mon annonce</button></div>
</form>
<?php layout_bottom(); ?>
</body></html>
