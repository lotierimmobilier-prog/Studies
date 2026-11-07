<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
start_session();
$msg = '';
$setup = !admin_exists();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $pw = (string)($_POST['password'] ?? '');
    if ($setup) {                                                       // première utilisation : création du mot de passe
        if (!hash_equals(SETUP_CODE, (string)($_POST['setup_code'] ?? ''))) { $msg = flash('err', 'Code d\'installation incorrect.'); }
        elseif (mb_strlen($pw) < 12) { $msg = flash('err', 'Le mot de passe doit contenir au moins 12 caractères.'); }
        elseif ($pw !== (string)($_POST['password2'] ?? '')) { $msg = flash('err', 'Les deux mots de passe ne sont pas identiques.'); }
        else {
            db()->prepare('INSERT INTO admin (id, password_hash) VALUES (1, ?)')->execute([password_hash($pw, PASSWORD_DEFAULT)]);
            $setup = false; $msg = flash('ok', 'Mot de passe créé. Vous pouvez vous connecter. Vous pouvez maintenant retirer SETUP_CODE de config.php.');
        }
    } else {
        if (rate_count('adminfail', 900) >= 5) { $msg = flash('err', 'Trop de tentatives. Réessayez dans 15 minutes.'); }
        else {
            $hash = (string)db()->query('SELECT password_hash FROM admin WHERE id = 1')->fetchColumn();
            if (password_verify($pw, $hash)) {
                session_regenerate_id(true);
                $_SESSION['admin'] = true; $_SESSION['admin_seen'] = time();
                if (password_needs_rehash($hash, PASSWORD_DEFAULT)) db()->prepare('UPDATE admin SET password_hash = ? WHERE id = 1')->execute([password_hash($pw, PASSWORD_DEFAULT)]);
                header('Location: index.php'); exit;
            }
            rate_hit('adminfail'); usleep(400000);
            $msg = flash('err', 'Mot de passe incorrect.');
        }
    }
}
layout_top('Administration – Capendu en bref', '');
echo '<h1>' . ($setup ? 'Première utilisation' : 'Administration') . '</h1>' . $msg;
echo '<form class="card" method="post" action="login.php" autocomplete="off">' . csrf_field();
if ($setup) {
    echo '<p>Choisissez le mot de passe administrateur (12 caractères minimum). Le code d\'installation est celui écrit dans <code>config.php</code>.</p>'
       . '<div class="field"><label for="setup_code">Code d\'installation</label><input id="setup_code" name="setup_code" type="password" required></div>'
       . '<div class="field mt-14"><label for="password">Nouveau mot de passe</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required></div>'
       . '<div class="field mt-14"><label for="password2">Confirmer le mot de passe</label><input id="password2" name="password2" type="password" autocomplete="new-password" minlength="12" required></div>';
} else {
    echo '<div class="field"><label for="password">Mot de passe</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>';
}
echo '<div class="actions"><button class="btn" type="submit">' . ($setup ? 'Créer le mot de passe' : 'Se connecter') . '</button></div></form>';
layout_bottom(); echo '</body></html>';
