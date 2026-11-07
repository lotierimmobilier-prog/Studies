<?php
declare(strict_types=1);
// Inscription d'une entreprise ou d'une association : validée par l'éditeur avant tout dépôt d'annonce.
require __DIR__ . '/inc/layout.php';
security_headers();
start_session();

$errors = [];
$v = ['org_type' => '', 'org_id' => '', 'org_name' => '', 'contact_name' => '', 'contact_email' => '', 'contact_phone' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!empty($_POST['website'])) { header('Location: inscription.php?ok=1'); exit; }
    if (!form_stamp_ok((string)($_POST['stamp'] ?? ''))) $errors[] = 'Le formulaire a expiré ou a été envoyé trop vite. Merci de réessayer.';
    if (rate_count('signup', 3600) >= 5) $errors[] = 'Trop d\'envois depuis votre connexion. Réessayez dans une heure.';
    $v['org_type']      = (string)($_POST['org_type'] ?? '');
    $v['org_id']        = one_line((string)($_POST['org_id'] ?? ''), 30);
    $v['org_name']      = one_line((string)($_POST['org_name'] ?? ''), 90);
    $v['contact_name']  = one_line((string)($_POST['contact_name'] ?? ''), 90);
    $v['contact_email'] = strtolower(one_line((string)($_POST['contact_email'] ?? ''), 150));
    $v['contact_phone'] = one_line((string)($_POST['contact_phone'] ?? ''), 30);

    $orgId = '';
    if (!isset(ORG_TYPES[$v['org_type']])) $errors[] = 'Indiquez si vous inscrivez une entreprise ou une association.';
    else { [$orgId, $orgErr] = clean_org_id($v['org_type'], $v['org_id']); if ($orgErr !== '') $errors[] = $orgErr; }
    if ($v['org_name'] === '') $errors[] = 'Indiquez le nom de votre commerce ou de votre association.';
    if ($v['contact_name'] === '') $errors[] = 'Indiquez votre nom.';
    if (!filter_var($v['contact_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Indiquez une adresse e-mail valide.';
    if (empty($_POST['org_certify'])) $errors[] = 'Cochez la case qui certifie que vous représentez une entreprise ou une association enregistrée.';
    if (empty($_POST['consent'])) $errors[] = 'Cochez la case de consentement pour envoyer votre inscription.';
    if (!$errors) {
        $dup = db()->prepare('SELECT COUNT(*) FROM partners WHERE org_id = ? OR contact_email = ?'); $dup->execute([$orgId, $v['contact_email']]);
        if ((int)$dup->fetchColumn() > 0) $errors[] = 'Une inscription existe déjà pour ce numéro ou cette adresse e-mail. Si c\'est la vôtre, ouvrez votre espace partenaire ; sinon, écrivez-nous avec le formulaire de contact.';
    }
    if (!$errors) {
        [$orgOk, $orgLabel] = verify_org($orgId);
        $now = date('c');
        db()->prepare('INSERT INTO partners (created_at, updated_at, status, org_type, org_id, org_name, contact_name, contact_email, contact_phone, org_verified, org_check, consent_at)
                       VALUES (?, ?, \'pending\', ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$now, $now, $v['org_type'], $orgId, $v['org_name'], $v['contact_name'], $v['contact_email'], $v['contact_phone'], $orgOk ? 1 : 0, $orgLabel, $now]);
        rate_hit('signup');
        send_mail(ADMIN_EMAIL, 'Nouvelle inscription partenaire à valider', "Une organisation demande son inscription.\n\nValidez-la dans l'administration : " . SITE_URL . "/annonces/admin/partenaires.php\n");
        header('Location: inscription.php?ok=1'); exit;
    }
}

layout_top('Inscrire mon organisation – Capendu en bref', '<a class="btn btn-small btn-ghost" href="partenaire/">Espace partenaire</a>');
echo '<h1>Inscrire mon organisation</h1>';
echo '<p class="lead">Capendu en bref relaie gratuitement les offres, les événements et les actualités des <strong>entreprises et des associations enregistrées</strong>. Votre inscription est <strong>validée par l\'éditeur</strong> après vérification de votre numéro officiel. Ensuite, vous déposez vos annonces depuis votre espace partenaire.</p>';
echo '<p class="notice notice-info"><strong>Réservé aux entreprises et associations enregistrées</strong> (numéro SIRET, ou numéro RNA / SIRET pour une association). Les particuliers ne peuvent pas s\'inscrire.</p>';
if (isset($_GET['ok'])) {
    echo flash('ok', 'Merci ! Votre inscription a bien été reçue. Elle sera examinée par l\'éditeur. Dès qu\'elle est validée, vous recevez un e-mail avec la marche à suivre pour déposer vos annonces.');
    layout_bottom(); echo '</body></html>'; exit;
}
if ($errors) echo flash('err', '<strong>Quelques points à corriger :</strong><br>' . implode('<br>', array_map('h', $errors)));
?>
<form class="card" method="post" action="inscription.php" novalidate>
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
  <h2 class="mt-26">Vos coordonnées <span class="hint">(privées, non publiées)</span></h2>
  <div class="form-grid">
    <div class="field"><label for="contact_name">Votre nom</label><input id="contact_name" name="contact_name" type="text" maxlength="90" autocomplete="name" value="<?= h($v['contact_name']) ?>" required></div>
    <div class="field"><label for="contact_email">Votre e-mail <span class="hint">(sert à vous connecter)</span></label><input id="contact_email" name="contact_email" type="email" maxlength="150" autocomplete="email" value="<?= h($v['contact_email']) ?>" required></div>
    <div class="field"><label for="contact_phone">Téléphone <span class="hint">(facultatif)</span></label><input id="contact_phone" name="contact_phone" type="text" maxlength="30" autocomplete="tel" value="<?= h($v['contact_phone']) ?>"></div>
  </div>
  <div class="consent mt-18"><input id="org_certify" name="org_certify" type="checkbox" value="1"><label for="org_certify">Je certifie représenter une entreprise ou une association enregistrée, et être habilité(e) à publier en son nom. Le numéro est contrôlé auprès du registre public national.</label></div>
  <div class="consent mt-14"><input id="consent" name="consent" type="checkbox" value="1"><label for="consent">J'accepte que ces informations servent uniquement à examiner mon inscription, à échanger au sujet de mes annonces et à m'ouvrir mon espace partenaire. Elles ne sont ni publiées ni cédées (<a href="<?= h(site_root()) ?>index.html#confidentialite">politique de confidentialité</a>).</label></div>
  <div class="actions"><button class="btn" type="submit">Envoyer mon inscription</button></div>
</form>
<?php layout_bottom(); ?>
</body></html>
