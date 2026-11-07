<?php
declare(strict_types=1);
// Formulaire de contact : questions, droits sur les données personnelles, aide. Aucun échange par e-mail avec le public.
require __DIR__ . '/inc/layout.php';
security_headers();
start_session();

$errors = [];
$v = ['subject' => '', 'name' => '', 'reply_to' => '', 'message' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!empty($_POST['website'])) { header('Location: contact.php?ok=1'); exit; }
    if (!form_stamp_ok((string)($_POST['stamp'] ?? ''))) $errors[] = 'Le formulaire a expiré ou a été envoyé trop vite. Merci de réessayer.';
    if (rate_count('contact', 3600) >= 5) $errors[] = 'Trop d\'envois depuis votre connexion. Réessayez dans une heure.';
    $v['subject']  = (string)($_POST['subject'] ?? '');
    $v['name']     = one_line((string)($_POST['name'] ?? ''), 90);
    $v['reply_to'] = one_line((string)($_POST['reply_to'] ?? ''), 150);
    $v['message']  = clean((string)($_POST['message'] ?? ''), 1500);
    if (!isset(SUJETS[$v['subject']])) $errors[] = 'Choisissez le sujet de votre message.';
    if (mb_strlen($v['message']) < 10) $errors[] = 'Écrivez votre message (10 caractères au minimum).';
    if (empty($_POST['consent'])) $errors[] = 'Cochez la case pour que nous puissions traiter votre message.';
    if (!$errors) {
        db()->prepare('INSERT INTO messages (created_at, subject, name, reply_to, message) VALUES (?, ?, ?, ?, ?)')
            ->execute([date('c'), $v['subject'], $v['name'], $v['reply_to'], $v['message']]);
        rate_hit('contact');
        send_mail(ADMIN_EMAIL, 'Nouveau message reçu', "Un nouveau message attend dans l'administration : " . SITE_URL . "/annonces/admin/messages.php\n");
        header('Location: contact.php?ok=1'); exit;
    }
}

layout_top('Nous écrire – Capendu en bref', '<a class="btn btn-small btn-ghost" href="deposer.php">Déposer une annonce</a>');
echo '<h1>Nous écrire</h1>';
echo '<p class="lead">Une question, une demande sur vos données personnelles, besoin d\'aide ? Utilisez ce formulaire : Capendu en bref n\'échange pas par e-mail. Votre message est lu par l\'éditeur bénévole, Jérôme BOUBA.</p>';
if (isset($_GET['ok'])) {
    echo flash('ok', 'Merci, votre message a bien été envoyé. Il sera lu dès que possible (délai maximum d\'un mois pour une demande sur vos données).');
    echo '<p><a class="btn" href="' . h(site_root()) . 'index.html">Retour à l\'accueil</a></p>';
    layout_bottom(); echo '</body></html>'; exit;
}
if ($errors) echo flash('err', '<strong>Quelques points à corriger :</strong><br>' . implode('<br>', array_map('h', $errors)));
?>
<form class="card" method="post" action="contact.php" novalidate>
  <?= csrf_field() ?>
  <input type="hidden" name="stamp" value="<?= h(form_stamp()) ?>">
  <div class="hp" aria-hidden="true"><label>Ne pas remplir <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <div class="form-grid">
    <div class="field full"><label for="subject">Sujet</label><select id="subject" name="subject" required>
      <option value="">Choisir…</option>
      <?php foreach (SUJETS as $k => $l): ?><option value="<?= h($k) ?>" <?= $v['subject'] === $k ? 'selected' : '' ?>><?= h($l) ?></option><?php endforeach; ?></select></div>
    <div class="field full"><label for="message">Votre message <span class="hint">(1 500 caractères maximum)</span></label><textarea id="message" name="message" maxlength="1500" required><?= h($v['message']) ?></textarea></div>
    <div class="field"><label for="name">Votre nom <span class="hint">(facultatif)</span></label><input id="name" name="name" type="text" maxlength="90" autocomplete="name" value="<?= h($v['name']) ?>"></div>
    <div class="field"><label for="reply_to">Pour vous répondre <span class="hint">(e-mail ou téléphone, facultatif)</span></label><input id="reply_to" name="reply_to" type="text" maxlength="150" value="<?= h($v['reply_to']) ?>"></div>
  </div>
  <p class="hint mt-14">Pour une demande sur vos données personnelles (accès, effacement…), indiquez l'adresse e-mail avec laquelle vous êtes inscrit(e) à la newsletter, afin que nous retrouvions votre dossier.</p>
  <div class="consent mt-18">
    <input id="consent" name="consent" type="checkbox" value="1" required>
    <label for="consent">J'accepte que mon message et les coordonnées indiquées soient utilisés uniquement pour répondre à ma demande. Ils sont supprimés au plus tard 12 mois après réception (<a href="<?= h(site_root()) ?>index.html#confidentialite">politique de confidentialité</a>).</label>
  </div>
  <div class="actions"><button class="btn" type="submit">Envoyer mon message</button></div>
</form>
<?php layout_bottom(); ?>
</body></html>
