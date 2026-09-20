/**
 * Cartes de partage des articles du blog.
 *
 * ── À quoi elles servent ─────────────────────────────────────────────────
 *
 * Quand on colle un lien d'article dans un message, un réseau social ou une
 * conversation, l'aperçu affiché vient des balises Open Graph. Sans
 * « og:image », l'aperçu est nu : un titre gris sur fond blanc, que personne
 * n'ouvre. Ce script fabrique, pour chaque article, l'image de cet aperçu.
 *
 * ── Pourquoi ce n'est PAS dans le build ──────────────────────────────────
 *
 * Le rendu passe par un navigateur sans interface, qui n'est pas installé sur
 * le serveur où tourne « npm run build:kitetudiant ». Faire dépendre le build
 * de Chromium casserait le déploiement pour une image décorative. Les cartes
 * sont donc fabriquées ici, à la main, et VERSIONNÉES dans
 * kitetudiant/web/public/partage/. Vite recopie ce dossier tel quel.
 *
 * Un test vérifie que chaque article a sa carte : ajouter un article sans
 * relancer ce script fait échouer la suite, plutôt que de livrer en silence un
 * article dont l'aperçu est nu.
 *
 *   node --import tsx kitetudiant/scripts/visuels-partage.ts
 *
 * ── La composition ───────────────────────────────────────────────────────
 *
 * Une colonne alignée à gauche sur fond papier, et une barre de marge en trois
 * segments RIGOUREUSEMENT égaux — turquoise, marine, ambre. Ce n'est pas un
 * graphique : les tiers sont égaux, donc aucun ne peut se lire comme une
 * valeur. C'est l'emblème de la seule idée que ce site ne négocie jamais, les
 * trois critères tenus séparés (règle 5 de CLAUDE.md).
 *
 * Le corps du titre est le seul endroit où la carte hausse la voix. La date de
 * publication figure en pied : toute donnée affichée porte sa date (règle 6),
 * et une carte de partage n'y échappe pas.
 */

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { ARTICLES } from '../packages/articles/src/index.ts'

const RACINE = resolve(import.meta.dirname, '..', '..')
const POLICES = join(RACINE, 'kitetudiant', 'web', 'src', 'polices')
const SORTIE = join(RACINE, 'kitetudiant', 'web', 'public', 'partage')

export const LARGEUR = 1200
export const HAUTEUR = 630

/* --------------------------------------------------------------- Chromium */

/**
 * Le strict nécessaire de l'interface du navigateur.
 *
 * Décrit ici plutôt qu'importé : playwright n'est pas une dépendance du
 * projet, et « import type » de ses définitions ferait échouer le typage de
 * quiconque ne l'a pas installé — y compris l'intégration continue, qui n'a
 * aucune raison de l'avoir. Le typage reste strict, il porte seulement sur les
 * cinq appels que ce script utilise.
 */
interface Onglet {
  setContent(html: string, options: { waitUntil: 'load' }): Promise<void>
  evaluate<T>(fonction: () => T): Promise<T>
  screenshot(options: { type: 'png' }): Promise<Buffer>
}
interface Navigateur {
  newPage(options: {
    viewport: { width: number; height: number }
    deviceScaleFactor: number
  }): Promise<Onglet>
  close(): Promise<void>
}
interface Lanceur {
  chromium: {
    launch(options: { executablePath?: string; args: string[] }): Promise<Navigateur>
  }
}

/**
 * Le navigateur n'est pas une dépendance du projet : il n'entre ni dans
 * package.json ni dans le paquet livré. On le cherche là où l'environnement
 * de développement l'installe, et on le dit clairement s'il manque.
 */
async function ouvrirNavigateur(): Promise<Navigateur> {
  const exiger = createRequire(import.meta.url)
  const chemins = ['playwright-core', 'playwright', '/opt/node22/lib/node_modules/playwright']
  for (const chemin of chemins) {
    try {
      const { chromium } = exiger(chemin) as Lanceur
      return await chromium.launch({
        ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
        args: ['--no-sandbox'],
      })
    } catch {
      continue
    }
  }
  throw new Error(
    'Aucun navigateur sans interface trouvé. Ce script est un outil de ' +
      'maintenance, pas une étape du build : installe playwright-core ' +
      'localement, ou pose CHROMIUM=/chemin/vers/chrome. Les cartes déjà ' +
      'fabriquées sont versionnées, le site n’a pas besoin de ce script pour ' +
      'être construit.',
  )
}

/* ------------------------------------------------------------ la composition */

function base64(fichier: string): string {
  return readFileSync(fichier).toString('base64')
}

function echapper(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Le corps du titre, choisi sur sa longueur.
 *
 * Trois paliers plutôt qu'une réduction continue : un titre long doit rester
 * plus petit qu'un titre court, mais deux cartes côte à côte ne doivent pas
 * donner l'impression de deux gabarits différents.
 */
function corpsDuTitre(titre: string): number {
  if (titre.length <= 32) return 78
  if (titre.length <= 52) return 64
  return 54
}

/** Le mois et l'année, en toutes lettres. « septembre 2026 ». */
function moisEtAnnee(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Protège la ponctuation double française.
 *
 * En français, « : », « ; », « ? » et « ! » sont précédés d'une espace, et
 * cette espace est insécable : sans elle, le deux-points d'un titre se
 * retrouve seul en début de ligne. C'est exactement ce qui arrivait à
 * « Confirmer ses vœux : l'étape… ».
 *
 * On emploie l'espace insécable ordinaire (U+00A0) et non la fine (U+202F) :
 * Poppins rend la fine à 3,4 px là où l'ordinaire fait 6,4 px, au point de
 * paraître absente. C'est le même arbitrage que nombres.ts, pour la même
 * raison, mesuré le même jour.
 */
const INSECABLE = '\u00A0'
function ponctuationFrancaise(texte: string): string {
  return texte
    .replace(/\s*([:;?!])/g, `${INSECABLE}$1`)
    .replace(/«\s*/g, `«${INSECABLE}`)
    .replace(/\s*»/g, `${INSECABLE}»`)
}

/**
 * Le chapeau, ramené à ce qui tient en deux lignes.
 *
 * On coupe sur une fin de PHRASE, jamais au milieu : « et la date de… » en
 * bas d'une carte de partage donne l'impression d'un texte tronqué par
 * accident. Mieux vaut une phrase de moins, complète.
 */
function chapeauCourt(chapeau: string): string {
  // Assez haut pour que la plupart des chapeaux passent entiers : le test du
  // blog les borne à 220 caractères, et la carte en loge 175 sans déborder.
  const LIMITE = 175
  if (chapeau.length <= LIMITE) return chapeau

  // Découpe sur la ponctuation finale, en gardant le séparateur.
  const phrases = chapeau.match(/[^.!?]+[.!?]+\s*/g) ?? []
  let garde = ''
  for (const phrase of phrases) {
    if ((garde + phrase).trimEnd().length > LIMITE) break
    garde += phrase
  }
  // Une phrase complète, même courte, vaut mieux qu'une phrase tronquée :
  // « Formuler un vœu ne suffit pas. » se tient ; « et la date de… » non.
  if (garde.trim().length > 0) return garde.trimEnd()

  // Aucune phrase complète ne tient : on coupe au dernier mot entier.
  const coupe = chapeau.slice(0, LIMITE)
  const dernier = coupe.lastIndexOf(' ')
  return `${coupe.slice(0, dernier > 60 ? dernier : LIMITE).trimEnd()}…`
}

/** Ce qu'une carte affiche, qu'elle décrive un article ou une page du site. */
interface Sujet {
  readonly slug: string
  readonly titre: string
  readonly chapeau: string
  readonly publieLe: string
}

/**
 * Les deux pages qui ne sont pas des articles mais qui se partagent autant.
 *
 * L'accueil surtout : c'est le lien qu'on envoie à un ami ou à ses parents.
 * Sans carte, le partage le plus fréquent du site serait le seul à rester nu.
 */
const PAGES: readonly Sujet[] = [
  {
    slug: 'accueil',
    titre: 'Ce qu’il te restera pour vivre, vœu par vœu',
    chapeau:
      'Chaque formation sous trois angles tenus séparés : tes chances d’y entrer, ce ' +
      'qu’elle vaut pour toi, et ton reste-à-vivre une fois sur place.',
    publieLe: '2026-09-20',
  },
  {
    slug: 'blog',
    titre: 'Bien gérer sa scolarité',
    chapeau:
      'Comprendre la procédure, monter un dossier qui tient, choisir une ville où l’on ' +
      'pourra rester jusqu’au diplôme. Des articles courts, sans chiffre inventé.',
    publieLe: '2026-09-20',
  },
]

function page(article: Sujet, polices: Record<string, string>): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><style>
  @font-face { font-family: 'Poppins'; font-weight: 400; font-display: block;
    src: url(data:font/woff2;base64,${polices.r}) format('woff2'); }
  @font-face { font-family: 'Poppins'; font-weight: 600; font-display: block;
    src: url(data:font/woff2;base64,${polices.d}) format('woff2'); }
  @font-face { font-family: 'Poppins'; font-weight: 700; font-display: block;
    src: url(data:font/woff2;base64,${polices.g}) format('woff2'); }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${LARGEUR}px; height: ${HAUTEUR}px;
    background: #f7f9fa;
    font-family: 'Poppins', sans-serif;
    color: #17222e;
    display: flex;
    /* Pas d'arrondi, pas d'ombre, pas de dégradé : la carte est une surface
       pleine, pas une carte d'interface posée sur un fond. */
  }

  /* La barre de marge. Trois segments égaux, jamais proportionnels à quoi que
     ce soit : c'est une signature, pas une mesure. */
  .marge { width: 22px; flex: 0 0 22px; display: flex; flex-direction: column; }
  .marge span { flex: 1 1 0; }
  .marge span:nth-child(1) { background: #1b8184; }
  .marge span:nth-child(2) { background: #19304a; }
  .marge span:nth-child(3) { background: #e8c477; }

  .colonne {
    flex: 1; display: flex; flex-direction: column;
    padding: 62px 78px 56px 66px;
  }

  .marque { font-weight: 600; font-size: 27px; letter-spacing: -0.01em; color: #19304a; }
  .marque i { font-style: normal; color: #1b8184; }

  .corps { flex: 1; display: flex; flex-direction: column; justify-content: center; }

  h1 {
    font-weight: 700;
    font-size: ${corpsDuTitre(article.titre)}px;
    line-height: 1.07;
    letter-spacing: -0.025em;
    max-width: 17ch;
    /* Drapeau à droite : les titres français ont des mots longs, et la
       justification créerait des lézardes visibles à cette taille. */
    text-wrap: balance;
  }

  .chapeau {
    margin-top: 24px;
    font-weight: 400;
    font-size: 24px;
    line-height: 1.45;
    color: #546475;
    max-width: 46ch;
  }

  /* Une seule mention en pied : la date. Le temps de lecture y figurait, mais
     tous les articles tiennent en une ou deux minutes — l'afficher revenait à
     annoncer leur brièveté sur chaque partage. La date, elle, est la signature
     de ce site : toute donnée affichée porte la sienne. */
  .pied {
    font-weight: 600; font-size: 21px; color: #19304a;
    border-top: 2px solid #dce2e8; padding-top: 20px;
  }
</style></head>
<body>
  <div class="marge"><span></span><span></span><span></span></div>
  <div class="colonne">
    <div class="marque">KitEtudiant<i>.fr</i></div>
    <div class="corps">
      <h1>${echapper(ponctuationFrancaise(article.titre))}</h1>
      <p class="chapeau">${echapper(ponctuationFrancaise(chapeauCourt(article.chapeau)))}</p>
    </div>
    <div class="pied">${echapper(moisEtAnnee(article.publieLe))}</div>
  </div>
</body></html>`
}

/* ------------------------------------------------------------------ rendu */

async function principal(): Promise<void> {
  const polices = {
    r: base64(join(POLICES, 'poppins-400.woff2')),
    d: base64(join(POLICES, 'poppins-600.woff2')),
    g: base64(join(POLICES, 'poppins-700.woff2')),
  }

  mkdirSync(SORTIE, { recursive: true })
  const navigateur = await ouvrirNavigateur()
  const onglet = await navigateur.newPage({
    viewport: { width: LARGEUR, height: HAUTEUR },
    deviceScaleFactor: 1,
  })

  let total = 0
  for (const article of [...ARTICLES, ...PAGES]) {
    await onglet.setContent(page(article, polices), { waitUntil: 'load' })
    await onglet.evaluate(() => document.fonts.ready)

    // Le script contrôle sa propre sortie : onze cartes relues à l'œil, c'est
    // onze occasions de laisser passer un titre qui dépasse de deux pixels.
    const debord = await onglet.evaluate(() => {
      const c = document.querySelector('.colonne')
      return c === null ? -1 : c.scrollHeight - c.clientHeight
    })
    if (debord > 0) {
      throw new Error(
        `« ${article.titre} » déborde de sa carte de ${debord} px. Raccourcis ` +
          'le titre ou le chapeau de l’article, ou baisse un palier dans ' +
          'corpsDuTitre() — ne rogne pas la composition pour un seul article.',
      )
    }

    const image = await onglet.screenshot({ type: 'png' })
    const fichier = join(SORTIE, `${article.slug}.png`)
    writeFileSync(fichier, image)
    total += image.length
    console.log(`${article.slug}.png — ${Math.round(image.length / 1024)} Ko`)
  }

  await navigateur.close()
  console.log(
    `\n${ARTICLES.length + PAGES.length} cartes écrites dans kitetudiant/web/public/partage, ` +
      `${Math.round(total / 1024)} Ko au total.`,
  )
}

await principal()
