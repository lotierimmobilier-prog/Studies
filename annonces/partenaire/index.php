<?php
declare(strict_types=1);
require __DIR__ . '/../inc/layout.php';
security_headers();
start_session();
purge_old();

// Déconnexion automatique après 2 h d'inactivité
if (isset($_SESSION['partner_email']) && time() - ($_SESSION['partner_seen'] ?? 0) > 7200) { unset($_SESSION['partner_email']); }
$email = $_SESSION['partner_email'] ?? null;
if ($email) $_SESSION['partner_seen'] = time();
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'link') {                                           // demande d'un lien de connexion
        $asked = strtolower(one_line((string)($_POST['email'] ?? ''), 150));
        if (!filter_var($asked, FILTER_VALIDATE_EMAIL)) {
            $msg = flash('err', 'Indiquez une adresse e-mail valide.');
        } elseif (rate_count('link', 3600) >= 5) {
            $msg = flash('err', 'Trop de demandes. Réessayez dans une heure.');
        } else {
            rate_hit('link');
            $st = db()->prepare('SELECT COUNT(*) FROM announcements WHERE contact_email = ?'); $st->execute([$asked]);
            $recent = db()->prepare('SELECT COUNT(*) FROM tokens WHERE email = ? AND expires > ?'); $recent->execute([$asked, time() + 1800 - 3600]);
            if ((int)$st->fetchColumn() > 0 && (int)$recent->fetchColumn() < 3) {
                $token = bin2hex(random_bytes(32));
                db()->prepare('INSERT INTO tokens (hash, email, expires) VALUES (?, ?, ?)')->execute([hash('sha256', $token), $asked, time() + 1800]);
                send_mail($asked, 'Votre lien de connexion – Capendu en bref',
                    "Bonjour,\n\nPour accéder à votre espace partenaire, ouvrez ce lien (valable 30 minutes, utilisable une seule fois) :\n\n"
                    . SITE_URL . '/annonces/partenaire/lien.php?t=' . $token . "\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nJérôme BOUBA, Capendu en bref");
            }
            // Même réponse dans tous les cas : on ne révèle pas quelles adresses sont connues.
            $msg = flash('ok', 'Si cette adresse a déjà servi à déposer une annonce, un e-mail avec un lien de connexion vient de vous être envoyé. Pensez à regarder dans les courriers indésirables.');
        }
    } elseif ($action === 'delete' && $email) {                          // retirer une annonce pas encore publiée
        $id = (int)($_POST['id'] ?? 0);
        $d = db()->prepare("DELETE FROM announcements WHERE id = ? AND contact_email = ? AND status IN ('pending','validated','refused')");
        $d->execute([$id, $email]);
        $msg = flash('ok', $d->rowCount() ? 'Votre annonce a été retirée.' : 'Cette annonce ne peut pas être retirée.');
    }
}

$nav = $email ? '<a class="btn btn-small btn-ghost" href="../deposer.php">Déposer une annonce</a>' : '<a class="btn btn-small btn-ghost" href="../deposer.php">Déposer une annonce</a>';
layout_top('Espace partenaire – Capendu en bref', $nav);
echo '<h1>Espace partenaire</h1>' . $msg;

if (!$email) {
    echo '<p class="lead">Suivez vos annonces : où elles en sont, dans quel numéro elles paraissent et combien de personnes ont cliqué. Pas de mot de passe à retenir : indiquez l\'adresse e-mail utilisée lors du dépôt, nous vous envoyons un lien de connexion.</p>';
    echo '<form class="card" method="post" action="index.php">' . csrf_field() . '<input type="hidden" name="action" value="link">'
       . '<div class="field"><label for="email">Votre adresse e-mail</label><input id="email" name="email" type="email" autocomplete="email" required></div>'
       . '<div class="actions"><button class="btn" type="submit">Recevoir mon lien de connexion</button></div></form>';
    echo '<p>Pas encore d\'annonce ? <a href="../deposer.php">Déposer une première annonce</a>.</p>';
    layout_bottom(); echo '</body></html>'; exit;
}

$st = db()->prepare('SELECT * FROM announcements WHERE contact_email = ? ORDER BY created_at DESC'); $st->execute([$email]);
$rows = $st->fetchAll();
$total = 0; $last30 = 0; $pub = 0;
foreach ($rows as &$r) {
    $r['clicks'] = clicks_total((int)$r['id']); $r['clicks30'] = clicks_since((int)$r['id'], 30);
    $total += $r['clicks']; $last30 += $r['clicks30']; if (in_array($r['status'], ['validated', 'published'], true)) $pub++;
}
unset($r);
echo '<p class="lead">Connecté(e) avec <strong>' . h($email) . '</strong>. <a href="logout.php">Se déconnecter</a></p>';
echo '<div class="stats"><div class="stat"><b>' . count($rows) . '</b><span>annonces déposées</span></div>'
   . '<div class="stat"><b>' . $pub . '</b><span>validées ou publiées</span></div>'
   . '<div class="stat"><b>' . $total . '</b><span>clics au total</span></div>'
   . '<div class="stat"><b>' . $last30 . '</b><span>clics sur 30 jours</span></div></div>';

if (!$rows) { echo '<p>Aucune annonce pour le moment.</p>'; }
else {
    echo '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Annonce</th><th>Avancement</th><th>Numéro</th><th class="num">Clics</th><th></th></tr></thead><tbody>';
    foreach ($rows as $r) {
        $steps = ['pending' => 'Reçue, en cours de relecture', 'validated' => 'Validée, prête à paraître', 'published' => 'Publiée dans la newsletter', 'refused' => 'Non retenue'];
        echo '<tr><td><strong>' . h($r['title']) . '</strong><br><span class="hint">' . h(CATEGORIES[$r['category']][1]) . ' · déposée le ' . h(date('d/m/Y', strtotime($r['created_at']))) . '</span></td>'
           . '<td>' . status_pill($r['status']) . '<br><span class="hint">' . h($steps[$r['status']]) . '</span>'
           . ($r['status'] === 'refused' && $r['refusal_reason'] !== '' ? '<br><span class="hint">Motif : ' . h($r['refusal_reason']) . '</span>' : '') . '</td>'
           . '<td>' . h($r['issue'] !== '' ? issue_label($r['issue']) : '–') . '</td>'
           . '<td class="num">' . (in_array($r['status'], ['validated', 'published'], true) ? '<strong>' . $r['clicks'] . '</strong><br><span class="hint">' . $r['clicks30'] . ' sur 30 j</span>' : '–') . '</td>'
           . '<td>';
        if (in_array($r['status'], ['validated', 'published'], true)) echo '<a href="../a.php?id=' . (int)$r['id'] . '">Voir</a><br>';
        if ($r['status'] !== 'published') {
            echo '<form method="post" action="index.php">' . csrf_field() . '<input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="' . (int)$r['id'] . '">'
               . '<button class="btn btn-small btn-ghost" type="submit">Retirer</button></form>';
        }
        echo '</td></tr>';
    }
    echo '</tbody></table></div>';
    echo '<p class="hint mt-14">Les clics sont comptés de façon anonyme (aucune personne n\'est identifiée). Ils mesurent les visites sur le lien « En savoir plus » de votre annonce dans la newsletter ; ils peuvent comprendre quelques clics répétés d\'une même personne.</p>';
}
layout_bottom();
echo '</body></html>';
