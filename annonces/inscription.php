<?php
declare(strict_types=1);
// Inscription d'une entreprise ou d'une association : validée par l'éditeur avant tout dépôt d'annonce.
require __DIR__ . '/inc/layout.php';
security_headers();
start_session();

$errors = [];
$v = ['org_type' => '', 'org_id' => '', 'org_name' => '', 'address' => '', 'public_phone' => '', 'contact_name' => '', 'contact_email' => '', 'contact_phone' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!empty($_POST['website'])) { header('Location: inscription.php?ok=1'); exit; }
    if (!form_stamp_ok((string)($_POST['stamp'] ?? ''))) $errors[] = 'Le formulaire a expiré ou a été envoyé trop vite. Merci de réessayer.';
    if (rate_count('signup', 3600) >= 5) $errors[] = 'Trop d\'envois depuis votre connexion. Réessayez dans une heure.';
    $v['org_type']      = (string)($_POST['org_type'] ?? '');
    $v['org_id']        = one_line((string)($_POST['org_id'] ?? ''), 30);
    $v['org_name']      = one_line((string)($_POST['org_name'] ?? ''), 90);
    $v['address']       = one_line((string)($_POST['address'] ?? ''), 200);
    $v['public_phone']  = one_line((string)($_POST['public_phone'] ?? ''), 30);
    $canHelp = !empty($_POST['can_help']) ? 1 : 0;
    $v['contact_name']  = one_line((string)($_POST['contact_name'] ?? ''), 90);
    $v['contact_email'] = strtolower(one_line((string)($_POST['contact_email'] ?? ''), 150));
    $v['contact_phone'] = one_line((string)($_POST['contact_phone'] ?? ''), 30);

    $orgId = '';
    if (!isset(ORG_TYPES[$v['org_type']])) $errors[] = 'Indiquez si vous inscrivez une entreprise ou une association.';
    else { [$orgId, $orgErr] = clean_org_id($v['org_type'], $v['org_id']); if ($orgErr !== '') $errors[] = $orgErr; }
    if ($v['org_name'] === '') $errors[] = 'Indiquez le nom de votre commerce ou de votre association.';
    if ($v['address'] === '') $errors[] = 'Indiquez l\'adresse de votre commerce ou de votre association (elle figurera dans la liste des partenaires).';
    if (!preg_match('/\d{2}/', $v['public_phone'])) $errors[] = 'Indiquez un numéro de téléphone pour la liste des partenaires.';
    if ($v['contact_name'] === '') $errors[] = 'Indiquez votre nom.';
    if (!filter_var($v['contact_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Indiquez une adresse e-mail valide.';
    if (empty($_POST['org_certify'])) $errors[] = 'Cochez la case qui certifie que vous représentez une entreprise ou une association enregistrée.';
    if (empty($_POST['purpose_ok'])) $errors[] = 'Cochez la case qui confirme que vous avez compris le but de Capendu en bref (vitrine gratuite de promotion du village).';
    if (empty($_POST['listing_ok'])) $errors[] = 'Cochez la case qui autorise la publication de votre organisation dans la liste des partenaires.';
    if (empty($_POST['consent'])) $errors[] = 'Cochez la case de consentement pour envoyer votre inscription.';
    if (!$errors) {
        $dup = db()->prepare('SELECT COUNT(*) FROM partners WHERE org_id = ? OR contact_email = ?'); $dup->execute([$orgId, $v['contact_email']]);
        if ((int)$dup->fetchColumn() > 0) $errors[] = 'Une inscription existe déjà pour ce numéro ou cette adresse e-mail. Si c\'est la vôtre, ouvrez votre espace partenaire ; sinon, écrivez-nous avec le formulaire de contact.';
    }
    $logo = '';
    if (!$errors) { [$logo, $logoErr] = save_logo($_FILES['logo'] ?? []); if ($logoErr !== '') $errors[] = $logoErr; }
    if (!$errors) {
        [$orgOk, $orgLabel] = verify_org($orgId);
        $now = date('c');
        db()->prepare('INSERT INTO partners (created_at, updated_at, status, org_type, org_id, org_name, contact_name, contact_email, contact_phone, org_verified, org_check, consent_at, address, public_phone, logo, can_help)
                       VALUES (?, ?, \'pending\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$now, $now, $v['org_type'], $orgId, $v['org_name'], $v['contact_name'], $v['contact_email'], $v['contact_phone'], $orgOk ? 1 : 0, $orgLabel, $now, $v['address'], $v['public_phone'], $logo, $canHelp]);
        rate_hit('signup');
        send_mail(ADMIN_EMAIL, 'Nouvelle inscription partenaire à valider', "Une organisation demande son inscription.\n\nValidez-la dans l'administration : " . SITE_URL . "/annonces/admin/partenaires.php\n");
        header('Location: inscription.php?ok=1'); exit;
    }
}

layout_top('Inscrire mon organisation – Capendu en bref', '<a class="btn btn-small btn-ghost" href="partenaire/">Espace partenaire</a>');
echo '<h1>Inscrire mon organisation</h1>';
echo '<p class="lead">Capendu en bref est une <strong>vitrine gratuite pour promouvoir le village</strong> : vos événements, vos tarifs promotionnels, votre actualité et le retour sur vos événements passés. Votre inscription est <strong>validée par l\'éditeur</strong> après vérification de votre numéro officiel. <a href="' . h(site_root()) . 'devenir-partenaire.html">Relire le but et le fonctionnement</a>.</p>';
echo '<p class="notice notice-info"><strong>Réservé aux entreprises et associations enregistrées</strong> (numéro SIRET, ou numéro RNA / SIRET pour une association). Les particuliers ne peuvent pas s\'inscrire.</p>';
if (isset($_GET['ok'])) {
    echo flash('ok', 'Merci ! Votre inscription a bien été reçue. Elle sera examinée par l\'éditeur. Dès qu\'elle est validée, vous recevez un e-mail avec la marche à suivre pour déposer vos annonces.');
    layout_bottom(); echo '</body></html>'; exit;
}
if ($errors) echo flash('err', '<strong>Quelques points à corriger :</strong><br>' . implode('<br>', array_map('h', $errors)));
?>
<form class="card" method="post" action="inscription.php" enctype="multipart/form-data" novalidate>
  <?= csrf_field() ?>
  <input type="hidden" name="stamp" value="<?= h(form_stamp()) ?>">
  <div class="hp" aria-hidden="true"><label>Ne pas remplir <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <fieldset class="cats">
    <legend>Vous inscrivez une…</legend>
    <?php foreach (ORG_TYPES as $k => $l): ?>
      <label><input type="radio" name="org_type" value="<?= h($k) ?>" <?= $v['org_type'] === $k ? 'checked' : '' ?>> <?= h($l) ?></label>
    <?php endforeach; ?>
  </fieldset>
  <div class="form-grid mt-18">
    <div class="field"><label for="org_id">Numéro officiel <span class="hint">(SIRET, ou RNA pour une association)</span></label><input id="org_id" name="org_id" type="text" maxlength="30" value="<?= h($v['org_id']) ?>" placeholder="Ex. 123 456 789 00012 ou W123456789" required></div>
    <div class="field"><label for="org_name">Nom du commerce ou de l'association</label><input id="org_name" name="org_name" type="text" maxlength="90" value="<?= h($v['org_name']) ?>" required></div>
  </div>
  <h2 class="mt-26">Votre fiche dans la liste des partenaires <span class="hint">(publique)</span></h2>
  <p class="hint">Ces informations seront visibles par tous sur la page des partenaires. Indiquez les coordonnées <strong>de l'organisation</strong> (et non votre numéro personnel si vous ne souhaitez pas qu'il soit public).</p>
  <div class="form-grid mt-14">
    <div class="field full"><label for="address">Adresse de l'organisation</label><input id="address" name="address" type="text" maxlength="200" value="<?= h($v['address']) ?>" autocomplete="street-address" placeholder="Rue, code postal, Capendu" required></div>
    <div class="field"><label for="public_phone">Téléphone de l'organisation</label><input id="public_phone" name="public_phone" type="text" maxlength="30" value="<?= h($v['public_phone']) ?>" autocomplete="tel" required></div>
    <div class="field"><label for="logo">Logo <span class="hint">(recommandé : JPEG, PNG ou WebP, 2 Mo maximum)</span></label><input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp"></div>
  </div>
  <p class="hint mt-14">Sans logo, vos initiales sont affichées à la place.</p>
  <div class="consent mt-14"><input id="can_help" name="can_help" type="checkbox" value="1"><label for="can_help">Facultatif : je veux bien aider les habitants à s'inscrire à la newsletter, sur place. Ma fiche le mentionnera.</label></div>

  <h2 class="mt-26">Vos coordonnées <span class="hint">(privées, non publiées)</span></h2>
  <div class="form-grid">
    <div class="field"><label for="contact_name">Votre nom</label><input id="contact_name" name="contact_name" type="text" maxlength="90" autocomplete="name" value="<?= h($v['contact_name']) ?>" required></div>
    <div class="field"><label for="contact_email">Votre e-mail <span class="hint">(sert à vous connecter)</span></label><input id="contact_email" name="contact_email" type="email" maxlength="150" autocomplete="email" value="<?= h($v['contact_email']) ?>" required></div>
    <div class="field"><label for="contact_phone">Téléphone <span class="hint">(facultatif)</span></label><input id="contact_phone" name="contact_phone" type="text" maxlength="30" autocomplete="tel" value="<?= h($v['contact_phone']) ?>"></div>
  </div>
  <div class="consent mt-18"><input id="purpose_ok" name="purpose_ok" type="checkbox" value="1"><label for="purpose_ok">J'ai compris que Capendu en bref est une <strong>vitrine gratuite</strong> pour promouvoir le village : j'y publierai mes événements, mes tarifs promotionnels, mon actualité et le retour sur mes événements passés.</label></div>
  <div class="consent mt-14"><input id="listing_ok" name="listing_ok" type="checkbox" value="1"><label for="listing_ok">J'autorise la publication du nom, du logo, de l'adresse et du téléphone de mon organisation dans la liste des partenaires du site.</label></div>
  <div class="consent mt-14"><input id="org_certify" name="org_certify" type="checkbox" value="1"><label for="org_certify">Je certifie représenter une entreprise ou une association enregistrée, et être habilité(e) à publier en son nom. Le numéro est contrôlé auprès du registre public national.</label></div>
  <div class="consent mt-14"><input id="consent" name="consent" type="checkbox" value="1"><label for="consent">J'accepte que ces informations servent uniquement à examiner mon inscription, à échanger au sujet de mes annonces et à m'ouvrir mon espace partenaire. Elles ne sont ni publiées ni cédées (<a href="<?= h(site_root()) ?>index.html#confidentialite">politique de confidentialité</a>).</label></div>
  <div class="actions"><button class="btn" type="submit">Envoyer mon inscription</button></div>
</form>
<?php layout_bottom(); ?>
</body></html>
