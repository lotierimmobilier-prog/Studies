<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
require_admin();
$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $hash = (string)db()->query('SELECT password_hash FROM admin WHERE id = 1')->fetchColumn();
    $new = (string)($_POST['new'] ?? '');
    if (!password_verify((string)($_POST['current'] ?? ''), $hash)) $msg = flash('err', 'Mot de passe actuel incorrect.');
    elseif (mb_strlen($new) < 12) $msg = flash('err', 'Le nouveau mot de passe doit contenir au moins 12 caractères.');
    elseif ($new !== (string)($_POST['new2'] ?? '')) $msg = flash('err', 'Les deux nouveaux mots de passe ne sont pas identiques.');
    else { db()->prepare('UPDATE admin SET password_hash = ? WHERE id = 1')->execute([password_hash($new, PASSWORD_DEFAULT)]); session_regenerate_id(true); $msg = flash('ok', 'Mot de passe modifié.'); }
}
layout_top('Mot de passe – Administration', admin_nav('motdepasse.php'));
echo '<h1>Changer le mot de passe</h1>' . $msg
   . '<form class="card" method="post" action="motdepasse.php" autocomplete="off">' . csrf_field()
   . '<div class="field"><label for="current">Mot de passe actuel</label><input id="current" name="current" type="password" autocomplete="current-password" required></div>'
   . '<div class="field mt-14"><label for="new">Nouveau mot de passe (12 caractères minimum)</label><input id="new" name="new" type="password" autocomplete="new-password" minlength="12" required></div>'
   . '<div class="field mt-14"><label for="new2">Confirmer</label><input id="new2" name="new2" type="password" autocomplete="new-password" minlength="12" required></div>'
   . '<div class="actions"><button class="btn" type="submit">Enregistrer</button></div></form>';
layout_bottom(); echo '</body></html>';
