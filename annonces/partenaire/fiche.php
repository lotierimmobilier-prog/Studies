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
    $phone = one_line((string)($_POST['public_phone'] ?? ''), 30);
    $help = !empty($_POST['can_help']) ? 1 : 0;
    $logo = (string)$p['logo']; $err = '';
    if (!empty($_POST['remove_logo']) && $logo !== '') { delete_logo($logo); $logo = ''; }
    [$newLogo, $logoErr] = save_logo($_FILES['logo'] ?? []);
    if ($logoErr !== '') $err = $logoErr; elseif ($newLogo !== '') { if ($logo !== '') delete_logo($logo); $logo = $newLogo; }
    if ($address === '') $err = $err ?: 'Indiquez l\'adresse de votre organisation.';
    elseif (!preg_match('/\d{2}/', $phone)) $err = $err ?: 'Indiquez un numéro de téléphone.';
    if ($err !== '') $msg = flash('err', h($err));
    else {
        db()->prepare('UPDATE partners SET address = ?, public_phone = ?, logo = ?, can_help = ?, updated_at = ? WHERE id = ?')->execute([$address, $phone, $logo, $help, date('c'), $p['id']]);
        send_mail(ADMIN_EMAIL, 'Fiche partenaire modifiée', "Le partenaire « {$p['org_name']} » a modifié sa fiche publique.\n" . SITE_URL . "/annonces/admin/partenaires.php?s=approved\n");
        $msg = flash('ok', 'Votre fiche a été mise à jour.');
        $st = db()->prepare('SELECT * FROM partners WHERE id = ?'); $st->execute([$p['id']]); $p = $st->fetch();
    }
}
layout_top('Ma fiche partenaire – Capendu en bref', '<a class="btn btn-small btn-ghost" href="index.php">Mon espace</a>');
echo '<h1>Ma fiche partenaire</h1>' . $msg . '<p class="lead">Ces informations sont publiques : elles apparaissent sur la <a href="../partenaires.php">liste des partenaires</a>. Le nom et le numéro officiel ne peuvent pas être modifiés ici.</p>';
?>
<form class="card" method="post" action="fiche.php" enctype="multipart/form-data" novalidate>
  <?= csrf_field() ?>
  <dl class="kv"><dt>Organisation</dt><dd><?= h($p['org_name']) ?></dd><dt>Numéro officiel</dt><dd><?= h($p['org_id']) ?></dd></dl>
  <div class="form-grid mt-18">
    <div class="field full"><label for="address">Adresse de l'organisation</label><input id="address" name="address" type="text" maxlength="200" value="<?= h($p['address']) ?>" required></div>
    <div class="field"><label for="public_phone">Téléphone de l'organisation</label><input id="public_phone" name="public_phone" type="text" maxlength="30" value="<?= h($p['public_phone']) ?>" required></div>
    <div class="field"><label for="logo">Nouveau logo <span class="hint">(JPEG, PNG ou WebP, 2 Mo maximum)</span></label><input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp"></div>
  </div>
  <?php if ($p['logo'] !== ''): ?><p class="mt-14"><img class="admin-logo" src="../logo.php?id=<?= (int)$p['id'] ?>" alt="Logo actuel"></p><div class="consent mt-14"><input id="remove_logo" name="remove_logo" type="checkbox" value="1"><label for="remove_logo">Retirer mon logo</label></div><?php endif; ?>
  <div class="consent mt-14"><input id="can_help" name="can_help" type="checkbox" value="1" <?= (int)$p['can_help'] ? 'checked' : '' ?>><label for="can_help">Je veux bien aider les habitants à s'inscrire à la newsletter, sur place.</label></div>
  <div class="actions"><button class="btn" type="submit">Enregistrer ma fiche</button></div>
</form>
<?php layout_bottom(); ?>
</body></html>
