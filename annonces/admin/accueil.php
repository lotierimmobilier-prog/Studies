<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
require_admin();
purge_old();

$pdo = db();
$one = fn(string $sql, array $a = []): int => (function () use ($pdo, $sql, $a) { $st = $pdo->prepare($sql); $st->execute($a); return (int)$st->fetchColumn(); })();
$pPend = $one("SELECT COUNT(*) FROM partners WHERE status = 'pending'");
$pOk = $one("SELECT COUNT(*) FROM partners WHERE status = 'approved'");
$aPend = $one("SELECT COUNT(*) FROM announcements WHERE status = 'pending'");
$aOk = $one("SELECT COUNT(*) FROM announcements WHERE status IN ('validated','published')");
$mNew = $one("SELECT COUNT(*) FROM messages WHERE status = 'new'");
$d30 = date('Y-m-d', strtotime('-29 days'));
$visits = $one("SELECT COALESCE(SUM(hits),0) FROM visits WHERE kind = 'human' AND day >= ?", [$d30]);
$ia = $one("SELECT COALESCE(SUM(hits),0) FROM visits WHERE kind = 'ia' AND day >= ?", [$d30]);
$clicks = $one('SELECT COALESCE(SUM(n),0) FROM clicks WHERE day >= ?', [$d30]);
[$issue, $deadline] = next_deadline();

layout_top('Tableau de bord – Administration', admin_nav('accueil.php'));
echo '<h1>Tableau de bord</h1><p class="lead">Bonjour ! Voici ce qui demande votre attention et les raccourcis de l\'administration.</p>';

echo '<h2>À traiter</h2><div class="todo-grid">'
   . '<a class="todo' . ($pPend ? ' todo-on' : '') . '" href="partenaires.php?s=pending"><b>' . $pPend . '</b><span>inscription(s) de partenaires à valider</span></a>'
   . '<a class="todo' . ($aPend ? ' todo-on' : '') . '" href="index.php?s=pending"><b>' . $aPend . '</b><span>annonce(s) à relire et valider</span></a>'
   . '<a class="todo' . ($mNew ? ' todo-on' : '') . '" href="messages.php"><b>' . $mNew . '</b><span>nouveau(x) message(s) du formulaire de contact</span></a></div>';

echo '<div class="card"><h2>Prochain numéro</h2><p>Numéro de <strong>' . h($issue) . '</strong> · les annonces sont acceptées jusqu\'au <strong>' . h($deadline) . '</strong>. Envoi vers le 1<sup>er</sup> du mois.</p>'
   . '<p class="actions-line"><a class="btn btn-small" href="ia.php">Rédiger avec l\'IA</a> <a class="btn btn-small btn-ghost" href="export.php">Préparer le numéro</a></p></div>';

echo '<h2>En chiffres</h2><div class="stats">'
   . '<div class="stat"><b>' . $pOk . '</b><span>partenaires validés</span></div>'
   . '<div class="stat"><b>' . $aOk . '</b><span>annonces validées ou publiées</span></div>'
   . '<div class="stat"><b>' . $visits . '</b><span>visites sur 30 jours</span></div>'
   . '<div class="stat"><b>' . $clicks . '</b><span>clics sur les annonces (30 jours)</span></div>'
   . '<div class="stat"><b>' . $ia . '</b><span>passages de robots IA (30 jours)</span></div></div>';

$rows = $pdo->query("SELECT id, org_name, created_at FROM partners WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5")->fetchAll();
if ($rows) { echo '<h2>Inscriptions en attente</h2><ul class="mini-list">'; foreach ($rows as $r) echo '<li><a href="partenaires.php?s=pending">' . h($r['org_name']) . '</a> <span class="hint">reçue le ' . h(date('d/m/Y', strtotime($r['created_at']))) . '</span></li>'; echo '</ul>'; }
$rows = $pdo->query("SELECT id, title, org_name, created_at FROM announcements WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5")->fetchAll();
if ($rows) { echo '<h2>Annonces en attente</h2><ul class="mini-list">'; foreach ($rows as $r) echo '<li><a href="annonce.php?id=' . (int)$r['id'] . '">' . h($r['title']) . '</a> <span class="hint">' . h($r['org_name']) . ' · ' . h(date('d/m/Y', strtotime($r['created_at']))) . '</span></li>'; echo '</ul>'; }

echo '<h2>Tout l\'espace</h2><div class="shortcuts">'
   . '<a href="partenaires.php"><strong>Partenaires</strong><span>Valider, modifier la fiche, ajouter un logo</span></a>'
   . '<a href="index.php"><strong>Annonces</strong><span>Relire, valider, rattacher à un numéro</span></a>'
   . '<a href="messages.php"><strong>Messages</strong><span>Formulaire de contact</span></a>'
   . '<a href="stats.php"><strong>Clics</strong><span>Intérêt des annonces par numéro</span></a>'
   . '<a href="visites.php"><strong>Visites et IA</strong><span>Audience, origine, robots IA</span></a>'
   . '<a href="ia.php"><strong>Rédiger avec l\'IA</strong><span>Relire et reformuler avec Claude</span></a>'
   . '<a href="export.php"><strong>Préparer le numéro</strong><span>Texte prêt pour la newsletter</span></a>'
   . '<a href="motdepasse.php"><strong>Mot de passe</strong><span>Changer le mot de passe admin</span></a></div>';
layout_bottom(); echo '</body></html>';
