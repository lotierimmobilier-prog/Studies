<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
require_admin();
purge_old();

function partner_edit_form(array $p, string $s): string {
    $i = (int)$p['id']; $o = '<form method="post" action="partenaires.php?s=' . h($s) . '">' . csrf_field() . '<input type="hidden" name="id" value="' . $i . '"><input type="hidden" name="action" value="edit"><div class="form-grid">';
    $fld = fn(string $name, string $label, string $val, string $extra = '', bool $full = false) => '<div class="field' . ($full ? ' full' : '') . '"><label for="e' . $name . $i . '">' . h($label) . '</label><input id="e' . $name . $i . '" name="' . $name . '" type="text" value="' . h($val) . '" ' . $extra . '></div>';
    $o .= $fld('org_name', 'Nom de l\'organisation', (string)$p['org_name'], 'maxlength="90" required', true);
    $o .= '<div class="field"><label for="et' . $i . '">Type</label><select id="et' . $i . '" name="org_type">';
    foreach (ORG_TYPES as $k => $l) $o .= '<option value="' . h($k) . '"' . ($p['org_type'] === $k ? ' selected' : '') . '>' . h($l) . '</option>';
    $o .= '</select></div><div class="field"><label for="ee' . $i . '">Statut</label><select id="ee' . $i . '" name="eligibility">';
    foreach (ELIGIBILITY as $k => $l) $o .= '<option value="' . h($k) . '"' . ($p['eligibility'] === $k ? ' selected' : '') . '>' . h($l) . '</option>';
    $o .= '</select></div>';
    $o .= $fld('address', 'Adresse (numéro et rue)', (string)$p['address'], 'maxlength="200" required', true);
    $o .= $fld('postal_code', 'Code postal', (string)$p['postal_code'], 'inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required') . $fld('city', 'Ville', (string)$p['city'], 'maxlength="80" required');
    $o .= $fld('activity_place', 'Lieu de l\'activité à Capendu (association voisine)', (string)$p['activity_place'], 'maxlength="200"', true);
    $o .= $fld('public_phone', 'Téléphone public', (string)$p['public_phone'], 'maxlength="30"') . $fld('contact_name', 'Nom du contact', (string)$p['contact_name'], 'maxlength="90" required');
    $o .= '<div class="field"><label for="ece' . $i . '">E-mail du contact</label><input id="ece' . $i . '" name="contact_email" type="email" value="' . h((string)$p['contact_email']) . '" maxlength="150" required></div>' . $fld('contact_phone', 'Téléphone du contact (privé)', (string)$p['contact_phone'], 'maxlength="30"');
    $o .= '</div><div class="consent mt-14"><input id="ech' . $i . '" name="can_help" type="checkbox" value="1"' . ((int)$p['can_help'] ? ' checked' : '') . '><label for="ech' . $i . '">Peut aider les habitants à s\'inscrire</label></div>'
        . '<p class="hint">Les annonces déjà déposées suivent le nouveau nom et la nouvelle adresse e-mail. Aucun e-mail n\'est envoyé au partenaire.</p>'
        . '<div class="actions"><button class="btn btn-small" type="submit">Enregistrer les modifications</button></div></form>';
    return $o;
}

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0); $act = (string)($_POST['action'] ?? '');
    $st = db()->prepare('SELECT * FROM partners WHERE id = ?'); $st->execute([$id]); $p = $st->fetch();
    if ($p) {
        $now = date('c');
        if ($act === 'approve') {
            db()->prepare("UPDATE partners SET status='approved', org_verified = 2, refusal_reason='', updated_at=? WHERE id=?")->execute([$now, $id]);
            if (!empty($_POST['notify'])) send_mail($p['contact_email'], 'Votre inscription est validée – Capendu en bref',
                "Bonjour {$p['contact_name']},\n\nL'inscription de « {$p['org_name']} » est validée. Vous pouvez maintenant déposer vos annonces :\n"
                . "1. ouvrez votre espace partenaire : " . SITE_URL . "/annonces/partenaire/ (un lien de connexion vous est envoyé par e-mail, sans mot de passe) ;\n"
                . "2. cliquez sur « Déposer une annonce ».\n\nMerci de participer à la vie de Capendu !\nJérôme BOUBA, Capendu en bref" . auto_notice());
            $msg = flash('ok', 'Inscription validée : ' . h($p['org_name']) . ' peut maintenant déposer des annonces.');
        } elseif ($act === 'edit') {                        // l'administrateur modifie la fiche d'un partenaire (organisation, adresse, contact)
            $f = [
                'org_name' => one_line((string)($_POST['org_name'] ?? ''), 90),
                'org_type' => (string)($_POST['org_type'] ?? ''),
                'eligibility' => (string)($_POST['eligibility'] ?? ''),
                'address' => one_line((string)($_POST['address'] ?? ''), 200),
                'postal_code' => preg_replace('/\s+/', '', one_line((string)($_POST['postal_code'] ?? ''), 10)),
                'city' => one_line((string)($_POST['city'] ?? ''), 80),
                'activity_place' => one_line((string)($_POST['activity_place'] ?? ''), 200),
                'public_phone' => one_line((string)($_POST['public_phone'] ?? ''), 30),
                'contact_name' => one_line((string)($_POST['contact_name'] ?? ''), 90),
                'contact_email' => strtolower(one_line((string)($_POST['contact_email'] ?? ''), 150)),
                'contact_phone' => one_line((string)($_POST['contact_phone'] ?? ''), 30),
            ];
            $can = !empty($_POST['can_help']) ? 1 : 0;
            $e = '';
            if ($f['org_name'] === '') $e = 'Indiquez le nom de l\'organisation.';
            elseif (!isset(ORG_TYPES[$f['org_type']])) $e = 'Type d\'organisation invalide.';
            elseif (!isset(ELIGIBILITY[$f['eligibility']])) $e = 'Statut invalide.';
            elseif ($f['address'] === '') $e = 'Indiquez l\'adresse.';
            elseif (($te = check_town($f['postal_code'], $f['city'])) !== '') $e = $te;
            elseif ($f['contact_name'] === '') $e = 'Indiquez le nom du contact.';
            elseif (!filter_var($f['contact_email'], FILTER_VALIDATE_EMAIL)) $e = 'Adresse e-mail du contact invalide.';
            else {
                $dup = db()->prepare('SELECT COUNT(*) FROM partners WHERE id <> ? AND (contact_email = ? OR (lower(org_name) = lower(?) AND status <> \'refused\'))');
                $dup->execute([$id, $f['contact_email'], $f['org_name']]);
                if ((int)$dup->fetchColumn() > 0) $e = 'Une autre organisation utilise déjà ce nom ou cette adresse e-mail.';
            }
            if ($e !== '') { $msg = flash('err', h($e)); }
            else {
                $pdo = db(); $pdo->beginTransaction();
                $pdo->prepare('UPDATE partners SET org_name=?, org_type=?, eligibility=?, address=?, postal_code=?, city=?, activity_place=?, public_phone=?, contact_name=?, contact_email=?, contact_phone=?, can_help=?, updated_at=? WHERE id=?')
                    ->execute([$f['org_name'], $f['org_type'], $f['eligibility'], $f['address'], $f['postal_code'], $f['city'], $f['eligibility'] === 'voisine' ? $f['activity_place'] : '', $f['public_phone'], $f['contact_name'], $f['contact_email'], $f['contact_phone'], $can, $now, $id]);
                // les annonces déjà déposées suivent la fiche (nom et adresse e-mail du partenaire)
                $pdo->prepare('UPDATE announcements SET contact_email = ?, org_name = ? WHERE contact_email = ?')->execute([$f['contact_email'], $f['org_name'], $p['contact_email']]);
                if ($f['contact_email'] !== $p['contact_email']) $pdo->prepare('DELETE FROM tokens WHERE email = ?')->execute([$p['contact_email']]);
                $pdo->commit();
                $msg = flash('ok', 'Fiche de ' . h($f['org_name']) . ' modifiée.');
            }
        } elseif ($act === 'logo') {                        // l'administrateur ajoute, remplace ou retire le logo d'un partenaire
            $logo = (string)$p['logo']; $err = '';
            if (!empty($_POST['remove_logo']) && $logo !== '') { delete_logo($logo); $logo = ''; $msg = flash('ok', 'Logo retiré : les initiales sont affichées.'); }
            [$newLogo, $logoErr] = save_logo($_FILES['logo'] ?? []);
            if ($logoErr !== '') $msg = flash('err', $logoErr);
            elseif ($newLogo !== '') { if ($logo !== '') delete_logo($logo); $logo = $newLogo; $msg = flash('ok', 'Logo enregistré pour ' . h($p['org_name']) . '.'); }
            elseif (empty($_POST['remove_logo'])) $msg = flash('err', 'Choisissez un fichier JPEG, PNG ou WebP.');
            db()->prepare('UPDATE partners SET logo = ?, updated_at = ? WHERE id = ?')->execute([$logo, $now, $id]);
        } elseif ($act === 'refuse') {
            $reason = one_line((string)($_POST['reason'] ?? ''), 300);
            db()->prepare("UPDATE partners SET status='refused', refusal_reason=?, updated_at=? WHERE id=?")->execute([$reason, $now, $id]);
            if (!empty($_POST['notify'])) send_mail($p['contact_email'], 'Votre inscription – Capendu en bref',
                "Bonjour {$p['contact_name']},\n\nNous ne pouvons pas valider l'inscription de « {$p['org_name']} » pour le moment." . ($reason !== '' ? "\n\nMotif : $reason" : '')
                . "\n\nLe service est réservé aux entreprises et associations dont le siège social est à Capendu, et aux associations voisines dont l'activité se déroule à Capendu. Si vous pensez à une erreur, utilisez le formulaire de contact." . auto_notice());
            $msg = flash('ok', 'Inscription refusée.');
        } elseif ($act === 'reopen') {
            db()->prepare("UPDATE partners SET status='pending', updated_at=? WHERE id=?")->execute([$now, $id]); $msg = flash('ok', 'Remis en attente.');
        } elseif ($act === 'delete') {                      // supprime le partenaire et toutes ses annonces (droit à l'effacement)
            $q = db()->prepare('SELECT id, photo FROM announcements WHERE contact_email = ?'); $q->execute([$p['contact_email']]);
            foreach ($q->fetchAll() as $a) { if ($a['photo'] !== '') delete_photo($a['photo']); }
            db()->prepare('DELETE FROM announcements WHERE contact_email = ?')->execute([$p['contact_email']]);
            if ($p['logo'] !== '') delete_logo($p['logo']);
            db()->prepare('DELETE FROM partners WHERE id = ?')->execute([$id]);
            $msg = flash('ok', 'Partenaire et annonces supprimés.');
        }
    }
}

$s = (string)($_GET['s'] ?? 'pending'); if (!isset(PARTNER_STATUTS[$s])) $s = 'pending';
$counts = ['pending' => 0, 'approved' => 0, 'refused' => 0];
foreach (db()->query('SELECT status, COUNT(*) c FROM partners GROUP BY status') as $r) $counts[$r['status']] = (int)$r['c'];
$st = db()->prepare('SELECT * FROM partners WHERE status = ? ORDER BY created_at DESC'); $st->execute([$s]); $rows = $st->fetchAll();

layout_top('Partenaires – Administration', admin_nav('partenaires.php'));
echo '<h1>Inscriptions des partenaires</h1>' . $msg;
echo '<p class="lead">Seules les entreprises et associations dont le <strong>siège social est à Capendu</strong>, et les <strong>associations voisines dont l\'activité se déroule à Capendu</strong>, peuvent déposer des annonces. Vérifiez cette condition avant de valider.</p>';
echo '<nav class="tabs" aria-label="Filtrer">';
foreach (PARTNER_STATUTS as $k => $l) echo '<a href="?s=' . h($k) . '"' . ($s === $k ? ' aria-current="page"' : '') . '>' . h($l) . ' (' . $counts[$k] . ')</a>';
echo '</nav>';
if (!$rows) echo '<p>Aucune inscription dans cette catégorie.</p>';
foreach ($rows as $p) {
    $elig = $p['eligibility'] === 'voisine' ? '<span class="pill pill-pending">Association voisine</span> activité à Capendu : ' . h($p['activity_place']) : '<span class="pill pill-validated">Siège social à Capendu</span>';
    echo '<div class="card"><h2>' . h($p['org_name']) . ' <span class="hint">(' . h(ORG_TYPES[$p['org_type']] ?? '') . ')</span></h2>'
       . '<dl class="kv"><dt>Éligibilité</dt><dd>' . $elig . '</dd><dt>Contact</dt><dd>' . h($p['contact_name']) . ' · ' . h($p['contact_email']) . ($p['contact_phone'] !== '' ? ' · ' . h($p['contact_phone']) : '') . '</dd>'
       . '<dt>Fiche publique</dt><dd><strong>Siège social :</strong> ' . h(full_address($p) ?: 'non renseigné') . '<br>' . ($p['logo'] !== '' ? '<img class="admin-logo" src="logo.php?id=' . (int)$p['id'] . '" alt="Logo"> ' : 'Pas de logo (initiales affichées). ') . '<br>' . h($p['public_phone'] ?: 'Téléphone non renseigné') . ((int)$p['can_help'] ? '<br><span class="pill pill-validated">Peut aider à l\'inscription</span>' : '') . '</dd>'
       . '<dt>Reçue le</dt><dd>' . h(date('d/m/Y à H:i', strtotime($p['created_at']))) . '</dd>'
       . ($p['refusal_reason'] !== '' ? '<dt>Motif du refus</dt><dd>' . h($p['refusal_reason']) . '</dd>' : '') . '</dl>'
       . '<details class="card-edit mt-14"><summary>Modifier la fiche</summary>' . partner_edit_form($p, $s) . '</details>'
       . '<form method="post" action="partenaires.php?s=' . h($s) . '" enctype="multipart/form-data" class="mt-14">' . csrf_field() . '<input type="hidden" name="id" value="' . (int)$p['id'] . '"><input type="hidden" name="action" value="logo">'
       . '<div class="field"><label for="lg' . (int)$p['id'] . '">' . ($p['logo'] !== '' ? 'Remplacer le logo' : 'Ajouter un logo') . ' <span class="hint">(JPEG, PNG ou WebP, 2 Mo maximum)</span></label><input id="lg' . (int)$p['id'] . '" name="logo" type="file" accept="image/jpeg,image/png,image/webp"></div>'
       . ($p['logo'] !== '' ? '<div class="consent"><input id="rl' . (int)$p['id'] . '" name="remove_logo" type="checkbox" value="1"><label for="rl' . (int)$p['id'] . '">Retirer le logo actuel</label></div>' : '')
       . '<button class="btn btn-small btn-ghost" type="submit">Enregistrer le logo</button></form>'
       . '<form method="post" action="partenaires.php?s=' . h($s) . '">' . csrf_field() . '<input type="hidden" name="id" value="' . (int)$p['id'] . '">';
    echo '<div class="consent mt-14"><input id="n' . (int)$p['id'] . '" name="notify" type="checkbox" value="1" checked><label for="n' . (int)$p['id'] . '">Prévenir le partenaire par e-mail</label></div>';
    if ($p['status'] !== 'approved') echo '<div class="field mt-14"><label for="r' . (int)$p['id'] . '">Motif du refus <span class="hint">(visible par le partenaire)</span></label><input id="r' . (int)$p['id'] . '" name="reason" type="text" maxlength="300"></div>';
    echo '<div class="actions">';
    if ($p['status'] !== 'approved') echo '<button class="btn" type="submit" name="action" value="approve">Valider l\'inscription</button>';
    if ($p['status'] === 'pending') echo '<button class="btn btn-danger" type="submit" name="action" value="refuse">Refuser</button>';
    if ($p['status'] !== 'pending') echo '<button class="btn btn-ghost" type="submit" name="action" value="reopen">Remettre en attente</button>';
    echo '<button class="btn btn-danger" type="submit" name="action" value="delete" data-confirm="Supprimer ce partenaire ET toutes ses annonces ?">Supprimer</button></div></form></div>';
}
echo '<script src="admin.js"></script>';
layout_bottom(); echo '</body></html>';
