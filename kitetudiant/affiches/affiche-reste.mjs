/**
 * L'affiche « Reste » — A4 portrait, pour les CDI et salles d'orientation.
 *
 * Elle applique la philosophie de philosophie-reste.md : une masse de marques,
 * un vide prélevé dedans, et ce qui demeure autour.
 *
 * ── Le parti pris ────────────────────────────────────────────────────────
 *
 * Le champ compte EXACTEMENT 1246 marques : une par commune dont le loyer est
 * connu dans le jeu de données du site. Ce n'est pas un motif décoratif qui
 * ressemblerait à de la donnée — c'est la donnée. La dernière rangée reste
 * incomplète, parce qu'un compte exact ne tombe pas juste, et l'arrondir pour
 * faire joli serait exactement le genre de petit mensonge que ce site refuse.
 *
 * Le titre n'est pas posé PAR-DESSUS le champ : les marques s'écoulent autour
 * de lui comme l'eau contourne une pierre. Aucune n'est masquée, aucune n'est
 * retirée — le compte reste juste au chiffre près. C'est la soustraction qui
 * donne son nom au mouvement, et au reste-à-vivre.
 *
 *   node kitetudiant/affiches/affiche-reste.mjs
 */

import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Le navigateur n'est pas une dépendance du projet : cette affiche est un
 * outil de maintenance, pas une étape du build. On le cherche là où
 * l'environnement de développement l'installe, et on le dit s'il manque.
 */
function trouverChromium() {
  const exiger = createRequire(import.meta.url)
  for (const chemin of [
    'playwright-core',
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
    '/tmp/node_modules/playwright-core',
  ]) {
    try {
      return exiger(chemin).chromium
    } catch {
      continue
    }
  }
  throw new Error(
    'Aucun navigateur sans interface trouvé. Installe playwright-core, ou ' +
      'pose CHROMIUM=/chemin/vers/chrome. L’affiche déjà rendue est versionnée.',
  )
}
const chromium = trouverChromium()

const RACINE = resolve(import.meta.dirname, '..', '..')
const POLICES = join(RACINE, 'kitetudiant', 'web', 'src', 'polices')
const MONO = join(RACINE, '.agents', 'skills', 'canvas-design', 'canvas-fonts', 'IBMPlexMono-Regular.ttf')
const SORTIE = join(RACINE, 'kitetudiant', 'affiches')

/* ------------------------------------------------- la donnée, vérifiable */

const communes = JSON.parse(
  readFileSync(join(RACINE, 'kitetudiant', 'web', 'donnees', 'communes.json'), 'utf8'),
)
const MARQUES = Object.keys(communes.communes).length
const MILLESIME = communes.millesimeLoyers

const b64 = (f) => readFileSync(f).toString('base64')

/* --------------------------------------------------------- la géométrie */
/* Tout en millimètres : c'est une pièce imprimée, pas une page web. */

const PAGE = { l: 210, h: 297 }
const MARGE = 18
const PITCH = 3.35 // entraxe d'une marque à l'autre
const MARQUE = 2.1 // côté d'une marque
const CHAMP = { x: MARGE, y: 40, l: PAGE.l - MARGE * 2 }
const COLONNES = Math.floor(CHAMP.l / PITCH)

/* Le vide : la zone où les marques ne viennent jamais, et où vit le titre. */
const VIDE = { x: MARGE - 1, y: 104, l: 150, h: 78 }

/**
 * Place exactement `MARQUES` marques, rangée par rangée, en contournant le
 * vide. On ne saute pas une marque : on la reporte plus loin. Le champ
 * s'allonge donc juste ce qu'il faut, et le compte reste exact.
 */
function poser() {
  const posees = []
  let rangee = 0
  while (posees.length < MARQUES) {
    const y = CHAMP.y + rangee * PITCH
    for (let c = 0; c < COLONNES && posees.length < MARQUES; c++) {
      const x = CHAMP.x + c * PITCH
      const dansLeVide =
        x + MARQUE > VIDE.x && x < VIDE.x + VIDE.l && y + MARQUE > VIDE.y && y < VIDE.y + VIDE.h
      if (dansLeVide) continue
      posees.push({ x, y })
    }
    rangee += 1
    if (rangee > 200) break // garde-fou : une géométrie absurde ne boucle pas
  }
  return posees
}

const marques = poser()
const basDuChamp = Math.max(...marques.map((m) => m.y)) + MARQUE

function page() {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><style>
  @font-face { font-family:'Poppins'; font-weight:400; font-display:block;
    src:url(data:font/woff2;base64,${b64(join(POLICES, 'poppins-400.woff2'))}) format('woff2'); }
  @font-face { font-family:'Poppins'; font-weight:600; font-display:block;
    src:url(data:font/woff2;base64,${b64(join(POLICES, 'poppins-600.woff2'))}) format('woff2'); }
  @font-face { font-family:'Poppins'; font-weight:700; font-display:block;
    src:url(data:font/woff2;base64,${b64(join(POLICES, 'poppins-700.woff2'))}) format('woff2'); }
  /* Une seconde famille, et une seule : le relevé. Elle ne sert qu'aux
     annotations de provenance — le registre d'une planche scientifique, pas
     une coquetterie typographique. */
  @font-face { font-family:'Releve'; font-weight:400; font-display:block;
    src:url(data:font/truetype;base64,${b64(MONO)}) format('truetype'); }

  @page { size: A4 portrait; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${PAGE.l}mm; height:${PAGE.h}mm; }
  body {
    background:#f7f9fa; color:#17222e;
    font-family:'Poppins', sans-serif;
    position:relative; overflow:hidden;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }

  .marque-site {
    position:absolute; left:${MARGE}mm; top:${MARGE}mm;
    font-weight:600; font-size:5.4mm; letter-spacing:-0.01em; color:#19304a;
  }
  .marque-site i { font-style:normal; color:#1b8184; }

  /* Le champ. Aucune ombre, aucun dégradé : une surface pleine. */
  .champ { position:absolute; inset:0; }
  .champ b {
    position:absolute; display:block;
    width:${MARQUE}mm; height:${MARQUE}mm;
    background:#19304a;
  }

  /* Le vide et ce qu'il porte. */
  .titre {
    position:absolute;
    left:${MARGE}mm; top:${VIDE.y + 6}mm; width:${VIDE.l - 8}mm;
    font-weight:700; font-size:16.5mm; line-height:1.03; letter-spacing:-0.03em;
  }
  .sous {
    position:absolute;
    left:${MARGE}mm; top:${VIDE.y + 62}mm; width:${VIDE.l - 14}mm;
    font-weight:400; font-size:4.1mm; line-height:1.5; color:#546475;
  }

  /* Le pied forme UN bloc serré — triade, mention, adresse — et laisse
     au-dessus de lui une seule grande respiration. Trois éléments espacés
     régulièrement sur le tiers inférieur donnaient trois petits vides
     accidentels ; un seul grand vide se lit comme une décision. */

  /* La triade : trois segments rigoureusement égaux. Des emblèmes, pas une
     mesure — c'est leur égalité qui interdit de les lire comme des valeurs. */
  .triade { position:absolute; left:${MARGE}mm; top:${PAGE.h - 41}mm; display:flex; gap:1.4mm; }
  .triade span { display:block; width:11mm; height:1.8mm; }
  .triade span:nth-child(1){ background:#1b8184; }
  .triade span:nth-child(2){ background:#19304a; }
  .triade span:nth-child(3){ background:#e8c477; }
  .triade-note {
    position:absolute; left:${MARGE}mm; top:${PAGE.h - 36.5}mm;
    font-weight:600; font-size:3.5mm; color:#19304a; letter-spacing:0.01em;
  }

  .adresse {
    position:absolute; left:${MARGE}mm; bottom:${MARGE}mm;
    font-weight:700; font-size:7.6mm; letter-spacing:-0.02em; color:#19304a;
  }
  .adresse i { font-style:normal; color:#1b8184; }

  /* Les annotations : minces, serrées, factuelles, portant leur millésime. */
  .releve {
    position:absolute; right:${MARGE}mm; bottom:${MARGE}mm; width:78mm;
    font-family:'Releve', monospace; font-size:2.7mm; line-height:1.55;
    color:#546475; text-align:right;
  }
  .legende {
    position:absolute; right:${MARGE}mm; top:${basDuChamp + 5}mm; width:74mm;
    font-family:'Releve', monospace; font-size:2.85mm; line-height:1.55;
    color:#546475; text-align:right;
  }
</style></head>
<body>
  <div class="marque-site">KitEtudiant<i>.fr</i></div>

  <div class="champ">
    ${marques.map((m) => `<b style="left:${m.x.toFixed(3)}mm;top:${m.y.toFixed(3)}mm"></b>`).join('')}
  </div>

  <div class="titre">Trouve la meilleure solution pour l’année prochaine.</div>
  <div class="sous">
    Études, logement, budget, aides : tout ce qui se décide entre janvier et
    juillet, au même endroit, avec des chiffres datés et leur source.
  </div>

  <div class="legende">
    une marque par commune dont<br />le loyer est connu — ${MARQUES.toLocaleString('fr-FR').replace(/ | /g, ' ')} communes
  </div>

  <div class="triade"><span></span><span></span><span></span></div>
  <div class="triade-note">trois critères tenus séparés, jamais fondus en une note</div>

  <div class="adresse">kitetudiant<i>.fr</i></div>
  <div class="releve">
    loyers : indicateur DGALN / ANIL,<br />
    millésime ${MILLESIME}, relevé le ${communes.genereLe}<br />
    aucun montant n’est estimé
  </div>
</body></html>`
}

/* ------------------------------------------------------------------ rendu */

mkdirSync(SORTIE, { recursive: true })
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM,
  args: ['--no-sandbox'],
})
// La fenêtre doit faire exactement une A4 à 96 ppp, sinon la capture est
// tronquée à la hauteur par défaut. Le facteur d'échelle donne un aperçu net
// à l'écran ; le PDF, lui, reste vectoriel et indépendant de ce réglage.
const onglet = await navigateur.newPage({
  viewport: { width: 794, height: 1123 },
  deviceScaleFactor: 2,
})
await onglet.setContent(page(), { waitUntil: 'load' })
await onglet.evaluate(() => document.fonts.ready)

// Contrôle : le champ doit tenir au-dessus du vide et de la triade.
// Contrôle de débordement : aucun élément ne doit sortir de la page.
const debord = await onglet.evaluate(() => {
  const page = document.body.getBoundingClientRect()
  const sortis = []
  for (const e of document.querySelectorAll('body > *:not(.champ), .champ b')) {
    const r = e.getBoundingClientRect()
    if (r.right > page.right + 0.5 || r.bottom > page.bottom + 0.5 || r.left < -0.5 || r.top < -0.5) {
      sortis.push(`${e.className || e.tagName} à ${Math.round(r.top)}×${Math.round(r.left)}`)
    }
  }
  return sortis
})

await onglet.pdf({
  path: join(SORTIE, 'affiche-reste.pdf'),
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
})
await onglet.screenshot({ path: join(SORTIE, 'affiche-reste.png'), fullPage: false })
await navigateur.close()

console.log(`${marques.length} marques posées (attendu ${MARQUES})`)
console.log(`bas du champ : ${basDuChamp.toFixed(1)} mm — le vide commence à ${VIDE.y} mm`)
console.log(`éléments hors page : ${debord.length === 0 ? 'aucun' : debord.join(', ')}`)
console.log(`écrit : ${join(SORTIE, 'affiche-reste.pdf')} et .png`)
