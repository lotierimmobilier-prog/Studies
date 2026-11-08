<?php
declare(strict_types=1);
// Fiche publique du partenaire : adresse, téléphone, logo, aide à l'inscription.
require __DIR__ . '/../inc/layout.php';
security_headers();
$p = current_partner();
if (!$p) { header('Location: index.php'); exit; }
$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $address = one_line((string)($_POST['address'] ?? ''), 200);
    $postal = preg_replace('/\s+/', '', one_line((string)($_POST['postal_code'] ?? ''), 10)); $city = one_line((string)($_POST['city'] ?? ''), 80);
    $phone = one_line((string)($_POST['public_phone'] ?? ''), 30);
    $help = !empty($_POST['can_help']) ? 1 : 0;
    $logo = (string)$p['logo']; $err = '';
    if (!empty($_POST['remove_logo']) && $logo !== '') { delete_logo($logo); $logo = ''; }
    [$newLogo, $logoErr] = save_logo($_FILES['logo'] ?? []);
    if ($logoErr !== '') $err = $logoErr; elseif ($newLogo !== '') { if ($logo !== '') delete_logo($logo); $logo = $newLogo; }
    $activity = $p['eligibility'] === 'voisine' ? one_line((string)($_POST['activity_place'] ?? ''), 200) : '';
    $elig = check_eligibility($p['org_type'], $p['eligibility'], full_address(['address' => $address, 'postal_code' => $postal, 'city' => $city]), $activity ?: (string)$p['activity_place']);
    if ($elig) $err = $err ?: $elig[0];
    elseif ($address === '') $err = $err ?: 'Indiquez l\'adresse du siège social.';
    elseif (($te = check_town($postal, $city)) !== '') $err = $err ?: $te;
    elseif (!preg_match('/\d{2}/', $phone)) $err = $err ?: 'Indiquez un numéro de téléphone.';
    if ($err !== '') $msg = flash('err', h($err));
    else {
        db()->prepare('UPDATE partners SET address = ?, postal_code = ?, city = ?, public_phone = ?, logo = ?, can_help = ?, activity_place = CASE WHEN eligibility = \'voisine\' THEN ? ELSE \'\' END, updated_at = ? WHERE id = ?')->execute([$address, $postal, $city, $phone, $logo, $help, $activity !== '' ? $activity : (string)$p['activity_place'], date('c'), $p['id']]);
        send_mail(ADMIN_EMAIL, 'Fiche partenaire modifiée', "Le partenaire « {$p['org_name']} » a modifié sa fiche publique.\n" . SITE_URL . "/annonces/admin/partenaires.php?s=approved\n");
        $msg = flash('ok', 'Votre fiche a été mise à jour.');
        $st = db()->prepare('SELECT * FROM partners WHERE id = ?'); $st->execute([$p['id']]); $p = $st->fetch();
    }
}
layout_top('Ma fiche partenaire – Capendu en bref', '<a class="btn btn-small btn-ghost" href="index.php">Mon espace</a>');
echo '<h1>Ma fiche partenaire</h1>' . $msg . '<p class="lead">Ces informations sont publiques : elles apparaissent sur la <a href="../partenaires.php">liste des partenaires</a>. Le nom de l\'organisation ne peut pas être modifié ici.</p>';
$legacy = (string)$p['postal_code'] === '' && (string)$p['city'] === '';
?>
<form class="card" method="post" action="fiche.php" enctype="multipart/form-data" novalidate>
  <?= csrf_field() ?>
  <dl class="kv"><dt>Organisation</dt><dd><?= h($p['org_name']) ?></dd><dt>Statut</dt><dd><?= h(ELIGIBILITY[$p['eligibility']] ?? '') ?></dd></dl>
  <div class="form-grid mt-18">
    <div class="field full"><label for="address">Adresse du siège social <span class="hint">(numéro et rue)</span></label><input id="address" name="address" type="text" maxlength="200" value="<?= h($legacy ? preg_replace('/[\s,]*11\s?700\s*Capendu\s*$/iu', '', (string)$p['address']) : $p['address']) ?>" autocomplete="address-line1" required></div>
    <div class="field"><label for="postal_code">Code postal</label><input id="postal_code" name="postal_code" type="text" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" value="<?= h($p['postal_code'] !== '' ? $p['postal_code'] : '11700') ?>" autocomplete="postal-code" required></div>
    <div class="field"><label for="city">Ville</label><input id="city" name="city" type="text" maxlength="80" value="<?= h($p['city'] !== '' ? $p['city'] : 'Capendu') ?>" autocomplete="address-level2" required></div>
    <?php if ($p['eligibility'] === 'voisine'): ?><div class="field full"><label for="activity_place">Lieu de l'activité à Capendu</label><input id="activity_place" name="activity_place" type="text" maxlength="200" value="<?= h($p['activity_place']) ?>"></div><?php endif; ?>
    <div class="field"><label for="public_phone">Téléphone de l'organisation</label><input id="public_phone" name="public_phone" type="text" maxlength="30" value="<?= h($p['public_phone']) ?>" required></div>
    <div class="field"><label for="logo">Nouveau logo <span class="hint">(JPEG, PNG ou WebP, 2 Mo maximum)</span></label><input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp"></div>
  </div>
  <?php if ($p['logo'] !== ''): ?><p class="mt-14"><img class="admin-logo" src="../logo.php?id=<?= (int)$p['id'] ?>" alt="Logo actuel"></p><div class="consent mt-14"><input id="remove_logo" name="remove_logo" type="checkbox" value="1"><label for="remove_logo">Retirer mon logo</label></div><?php endif; ?>
  <div class="consent mt-14"><input id="can_help" name="can_help" type="checkbox" value="1" <?= (int)$p['can_help'] ? 'checked' : '' ?>><label for="can_help">Je veux bien aider les habitants à s'inscrire à la newsletter, sur place.</label></div>
  <div class="actions"><button class="btn" type="submit">Enregistrer ma fiche</button></div>
</form>
<?php layout_bottom(); ?>
</body></html>
