<?php
declare(strict_types=1);
// Page publique d'une annonce validée (destination des clics quand l'annonceur n'a pas de lien).
require __DIR__ . '/inc/layout.php';
security_headers();
$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare("SELECT * FROM announcements WHERE id = ? AND status IN ('validated','published')");
$st->execute([$id]);
$a = $st->fetch();
if (!$a) { http_response_code(404); layout_top('Annonce introuvable – Capendu en bref'); echo '<h1>Annonce introuvable</h1><p><a href="../index.html">Retour à l\'accueil</a></p>'; layout_bottom(); echo '</body></html>'; exit; }
[$tag, $rub] = CATEGORIES[$a['category']];
layout_top($a['title'] . ' – Capendu en bref');
?>
<article class="fiche-pub">
  <?php if ($a['photo'] !== ''): ?><img class="fiche-photo" src="photo.php?id=<?= (int)$a['id'] ?>" alt="" loading="lazy"><?php endif; ?>
  <span class="tag<?= $a['category'] === 'offre' ? ' tag-offre' : '' ?>"><?= h($tag) ?></span>
  <h1><?= h($a['title']) ?></h1>
  <p><?= nl2br(h($a['what'])) ?></p>
  <dl class="kv mt-16">
    <dt>Où</dt><dd><?= h($a['place']) ?></dd>
    <?php if ($a['whenx'] !== ''): ?><dt>Quand</dt><dd><?= h($a['whenx']) ?></dd><?php endif; ?>
    <?php if ($a['conditions'] !== ''): ?><dt>Conditions</dt><dd><?= h($a['conditions']) ?></dd><?php endif; ?>
    <dt>Proposé par</dt><dd><?= h($a['org_name']) ?></dd>
    <?php if ($a['public_contact'] !== ''): ?><dt>Contact</dt><dd><?= h($a['public_contact']) ?></dd><?php endif; ?>
  </dl>
  <?php if ($a['category'] === 'offre'): ?><p class="hint mt-14">Offre commerciale publiée sous la responsabilité du commerçant. Prix, dates et conditions peuvent changer.</p><?php endif; ?>
</article>
<p class="mt-20"><a href="../index.html">← Capendu en bref</a></p>
<?php layout_bottom(); ?>
</body></html>
