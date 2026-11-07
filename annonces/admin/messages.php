<?php
declare(strict_types=1);
require __DIR__ . '/../inc/admin_auth.php';
security_headers();
require_admin();
$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    $act = (string)($_POST['action'] ?? '');
    if ($act === 'done') { db()->prepare("UPDATE messages SET status='done' WHERE id=?")->execute([$id]); $msg = flash('ok', 'Message marqué comme traité.'); }
    elseif ($act === 'new') { db()->prepare("UPDATE messages SET status='new' WHERE id=?")->execute([$id]); $msg = flash('ok', 'Message remis dans les nouveaux.'); }
    elseif ($act === 'delete') { db()->prepare('DELETE FROM messages WHERE id=?')->execute([$id]); $msg = flash('ok', 'Message supprimé.'); }
}
$s = ($_GET['s'] ?? 'new') === 'done' ? 'done' : 'new';
$counts = ['new' => 0, 'done' => 0];
foreach (db()->query('SELECT status, COUNT(*) c FROM messages GROUP BY status') as $r) $counts[$r['status']] = (int)$r['c'];
$st = db()->prepare('SELECT * FROM messages WHERE status = ? ORDER BY created_at DESC'); $st->execute([$s]);
$rows = $st->fetchAll();

layout_top('Messages – Administration', admin_nav('messages.php'));
echo '<h1>Messages</h1>' . $msg;
echo '<nav class="tabs" aria-label="Filtrer"><a href="?s=new"' . ($s === 'new' ? ' aria-current="page"' : '') . '>Nouveaux (' . $counts['new'] . ')</a>'
   . '<a href="?s=done"' . ($s === 'done' ? ' aria-current="page"' : '') . '>Traités (' . $counts['done'] . ')</a></nav>';
if (!$rows) echo '<p>Aucun message.</p>';
foreach ($rows as $r) {
    echo '<div class="card"><p><strong>' . h(SUJETS[$r['subject']] ?? $r['subject']) . '</strong> <span class="hint">· reçu le ' . h(date('d/m/Y à H:i', strtotime($r['created_at']))) . '</span></p>'
       . '<p class="mt-14">' . nl2br(h($r['message'])) . '</p>'
       . '<dl class="kv mt-14"><dt>Nom</dt><dd>' . h($r['name'] ?: '–') . '</dd><dt>Pour répondre</dt><dd>' . h($r['reply_to'] ?: '–') . '</dd></dl>'
       . '<form method="post" action="messages.php?s=' . h($s) . '">' . csrf_field() . '<input type="hidden" name="id" value="' . (int)$r['id'] . '"><div class="actions">'
       . ($r['status'] === 'new' ? '<button class="btn" type="submit" name="action" value="done">Marquer comme traité</button>' : '<button class="btn btn-ghost" type="submit" name="action" value="new">Remettre dans les nouveaux</button>')
       . '<button class="btn btn-danger" type="submit" name="action" value="delete" data-confirm="Supprimer définitivement ce message ?">Supprimer</button></div></form></div>';
}
echo '<p class="hint">Les messages sont supprimés automatiquement 12 mois après leur réception.</p><script src="admin.js"></script>';
layout_bottom(); echo '</body></html>';
