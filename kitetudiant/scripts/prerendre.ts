/**
 * Pré-rendu des pages du blog, plan du site et robots.txt.
 *
 * Pourquoi c'est nécessaire. Le site est une application rendue dans le
 * navigateur : le HTML livré est une coquille vide, et tout le texte apparaît
 * une fois le JavaScript exécuté. Les moteurs savent exécuter du JavaScript,
 * mais ils le font plus tard, moins souvent, et pas toujours. Un blog dont le
 * texte n'existe qu'après exécution part avec un handicap qu'aucun mot-clé ne
 * rattrape.
 *
 * Ce script écrit donc, pour chaque article, une vraie page HTML contenant le
 * texte de l'article, son titre, sa description, son lien canonique et ses
 * données structurées. L'application prend la main au chargement et remplace
 * ce contenu par la version interactive — le visiteur ne voit pas la
 * différence, le robot voit un article.
 *
 * Il tourne APRÈS « vite build », sur le dossier de sortie.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { ARTICLES, MENTION_SOURCE, type Article } from '../packages/articles/src/index.ts'
import {
  ACCUEIL_DESCRIPTION,
  ACCUEIL_QUESTIONS,
  ACCUEIL_TITRE_ONGLET,
  ACCUEIL_TITRE_PAGE,
} from '../packages/articles/src/accueil.ts'
/* Le même module que l'application, pour que la page livrée et la page
   rendue affichent la même date. Il n'importe rien du navigateur. */
import { dateLisible } from '../web/src/dates.ts'
import { MILLESIME_CALENDRIER, RELEVE_LE } from '../web/src/calendrier.ts'
import { nombre } from '../packages/budget-engine/src/nombres.ts'

const RACINE = resolve(import.meta.dirname, '..', '..')
const SORTIE = join(RACINE, 'dist-kitetudiant')
const BASE = (process.env.VITE_BASE ?? '/').endsWith('/')
  ? (process.env.VITE_BASE ?? '/')
  : `${process.env.VITE_BASE}/`
const ORIGINE = (process.env.SITE_ORIGINE ?? 'https://kitetudiant.fr').replace(/\/$/, '')

/**
 * Ce que le site couvre, lu dans le jeu de données lui-même.
 *
 * Compté, jamais écrit en dur : un chiffre de couverture recopié à la main
 * devient faux au premier import et personne ne s'en aperçoit. C'est la
 * même raison qui fait compter `NOMBRE_COMMUNES_AVEC_LOYER` côté
 * application (web/src/donnees.ts).
 */
const COMMUNES = JSON.parse(
  readFileSync(join(RACINE, 'kitetudiant', 'web', 'donnees', 'communes.json'), 'utf8'),
) as {
  readonly millesimeLoyers: string
  readonly genereLe: string
  readonly source: string
  readonly communes: Readonly<Record<string, unknown>>
}

/** Échappe un texte pour l'insérer dans du HTML. */
function echapper(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Le corps d'un article, en HTML. */
function corpsEnHtml(article: Article): string {
  const morceaux = article.corps.map((bloc) => {
    switch (bloc.type) {
      case 'titre':
        return `<h2>${echapper(bloc.texte)}</h2>`
      case 'liste':
        return `<ul>${bloc.points.map((p) => `<li>${echapper(p)}</li>`).join('')}</ul>`
      case 'encadre':
      case 'paragraphe':
        return `<p>${echapper(bloc.texte)}</p>`
    }
  })
  return morceaux.join('\n      ')
}

/**
 * La ligne de date d'un article, telle que l'application l'écrit.
 *
 * Elle affichait la date ISO brute — « 2025-09-01 » — là où l'application
 * écrit « 1 septembre 2025 ». Deux versions de la même page qui ne disent
 * pas la même chose, et la version livrée aux robots était la moins
 * lisible des deux. La date de révision manquait aussi : `dateModified`
 * était dans les données structurées, mais invisible à l'écran, si bien
 * qu'un article revu passait pour jamais relu.
 *
 * L'attribut `datetime` garde la forme machine : c'est son rôle.
 */
function dateDeLArticle(article: Article): string {
  const revu =
    article.revuLe !== null
      ? ` · revu le <time datetime="${article.revuLe}">${echapper(dateLisible(article.revuLe))}</time>`
      : ''
  return (
    `<p><time datetime="${article.publieLe}">` +
    `${echapper(dateLisible(article.publieLe))}</time>${revu}</p>`
  )
}

/**
 * Données structurées, au format que les moteurs comprennent.
 * Elles disent explicitement que l'éditeur est KitEtudiant.fr, ce qui évite
 * qu'un article décrivant la procédure passe pour une source officielle.
 */
function donneesStructurees(article: Article): string {
  const objet = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.titre,
    description: article.chapeau,
    datePublished: article.publieLe,
    ...(article.revuLe !== null ? { dateModified: article.revuLe } : {}),
    inLanguage: 'fr-FR',
    keywords: article.motsCles.join(', '),
    author: { '@type': 'Organization', name: 'KitEtudiant.fr' },
    publisher: { '@type': 'Organization', name: 'KitEtudiant.fr' },
    mainEntityOfPage: `${ORIGINE}${BASE}blog/${article.slug}`,
  }
  // « </script> » dans une valeur casserait la balise : on neutralise.
  return JSON.stringify(objet).replaceAll('</', '<\\/')
}

/**
 * Les questions fréquentes, en données structurées.
 *
 * C'est le format que les moteurs — et surtout les moteurs génératifs —
 * savent reprendre tel quel. Une question posée avec sa réponse autoportante
 * est la plus petite unité citable qui existe : elle tient debout hors de
 * son article, ce qu'un paragraphe au milieu d'un fil ne fait pas.
 *
 * Rendu `null` quand l'article n'en a pas : un FAQPage vide serait signalé
 * comme une erreur par les validateurs, et surtout il annoncerait un contenu
 * qui n'existe pas.
 */
function questionsEnFaq(
  questions: readonly { readonly question: string; readonly reponse: string }[],
): string {
  const objet = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.reponse },
    })),
  }
  return JSON.stringify(objet).replaceAll('</', '<\\/')
}

function questionsFrequentes(article: Article): string | null {
  const questions = article.questions ?? []
  if (questions.length === 0) return null
  return questionsEnFaq(questions)
}

/**
 * Le fil d'Ariane, en données structurées.
 *
 * Il existe déjà à l'écran (web/src/filAriane.tsx) mais un moteur ne le
 * déduit pas d'une liste de liens : il faut le lui dire. C'est ce qui fait
 * apparaître « kitetudiant.fr › Blog › Comprendre Parcoursup » sous le
 * résultat, au lieu de l'URL brute.
 *
 * Les positions commencent à 1 — zéro est refusé par les validateurs.
 */
function filDAriane(article: Article): string {
  const objet = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ORIGINE}${BASE}` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${ORIGINE}${BASE}blog` },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.titre,
        item: `${ORIGINE}${BASE}blog/${article.slug}`,
      },
    ],
  }
  return JSON.stringify(objet).replaceAll('</', '<\\/')
}

/**
 * L'identité du site, posée une fois sur l'accueil.
 *
 * Sans elle, un moteur — et plus encore un moteur génératif qui cite ses
 * sources — n'a aucun moyen de savoir QUI parle. C'est d'autant plus
 * important ici que les articles décrivent une procédure officielle sans
 * être officiels : l'éditeur doit être nommé, et la non-affiliation dite.
 */
function identiteDuSite(): string {
  const objet = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${ORIGINE}${BASE}#editeur`,
        name: 'KitEtudiant.fr',
        url: `${ORIGINE}${BASE}`,
        description:
          'KitEtudiant.fr aide les lycéens à choisir leurs vœux Parcoursup en ' +
          'croisant trois critères tenus séparés : les chances d’admission publiées, ' +
          'l’adéquation au profil, et le reste-à-vivre mensuel calculé ville par ville.',
        // Dit explicitement, parce qu'un moteur génératif qui cite le site
        // pourrait sinon le présenter comme une source officielle.
        disambiguatingDescription:
          'Service indépendant. KitEtudiant.fr n’est affilié ni à Parcoursup, ni au ' +
          'ministère de l’Enseignement supérieur, ni aux CROUS.',
        knowsLanguage: 'fr-FR',
      },
      {
        '@type': 'WebSite',
        '@id': `${ORIGINE}${BASE}#site`,
        name: 'KitEtudiant.fr',
        url: `${ORIGINE}${BASE}`,
        inLanguage: 'fr-FR',
        publisher: { '@id': `${ORIGINE}${BASE}#editeur` },
      },
    ],
  }
  return JSON.stringify(objet).replaceAll('</', '<\\/')
}

/**
 * Les en-têtes de partage.
 *
 * Sans « og:image », coller un lien du site dans un message ou sur un réseau
 * affiche un aperçu nu — un titre gris sur fond blanc, que personne n'ouvre.
 * Les cartes sont fabriquées à part (kitetudiant/scripts/visuels-partage.ts)
 * et versionnées, parce que leur rendu demande un navigateur sans interface
 * que le serveur de déploiement n'a pas.
 *
 * L'adresse doit être ABSOLUE : un aperçu est fabriqué par un serveur tiers,
 * qui n'a aucun moyen de résoudre « /partage/x.png » contre l'adresse de la
 * page. C'est aussi pourquoi elle est construite à partir de l'origine et de
 * la base de déploiement, jamais écrite en dur.
 */
function enTetesDePartage(nom: string, titreAlternatif: string): string[] {
  const image = `${ORIGINE}${BASE}partage/${nom}.png`
  return [
    `<meta property="og:image" content="${echapper(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${echapper(titreAlternatif)}" />`,
    // Sans cette ligne, l'aperçu se réduit à une vignette carrée : la carte
    // est composée pour le grand format, pas pour un timbre-poste.
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
}

/** Remplace le titre, la description et le canonique de la coquille. */
function coquilleAvec(
  coquille: string,
  titre: string,
  description: string,
  /**
   * L'adresse qui fait foi, ou `null` pour n'en déclarer aucune.
   *
   * `null` sert à la coquille de repli : une page qui n'annonce pas sa forme
   * canonique est prise pour elle-même ; une page qui en annonce une fausse
   * est effacée de l'index au profit de celle qu'elle désigne.
   */
  canonique: string | null,
  contenu: string,
  extra = '',
  /**
   * « article » pour un article, « website » pour tout le reste. Réglé ici
   * plutôt que rattrapé après coup : l'accueil corrigeait la valeur par un
   * `.replace` sur le HTML produit, ce qui marchait tant qu'un seul appel
   * en avait besoin — la coquille de repli en fait un deuxième.
   */
  type: 'article' | 'website' = 'article',
): string {
  let html = coquille
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${echapper(titre)}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta name="description" content="${echapper(description)}" />`,
  )
  const entetes = [
    ...(canonique === null
      ? []
      : [
          `<link rel="canonical" href="${echapper(canonique)}" />`,
          `<meta property="og:url" content="${echapper(canonique)}" />`,
        ]),
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${echapper(titre)}" />`,
    `<meta property="og:description" content="${echapper(description)}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    extra,
  ]
    .filter(Boolean)
    .join('\n    ')
  html = html.replace('</head>', `  ${entetes}\n  </head>`)
  // Le contenu est posé DANS la racine de l'application : React le remplacera
  // au montage. Le robot, lui, lit le HTML tel qu'il arrive.
  html = html.replace('<div id="root"></div>', `<div id="root">${contenu}</div>`)
  return html
}

function ecrire(chemin: string, contenu: string): void {
  mkdirSync(dirname(chemin), { recursive: true })
  writeFileSync(chemin, contenu, 'utf8')
}

const coquille = readFileSync(join(SORTIE, 'index.html'), 'utf8')
/* La coquille est lue dans la SORTIE, et l'accueil y est réécrite plus bas :
   relancer ce script sans « vite build » entre-temps poserait un second lien
   canonique, un second jeu d'og:* et un second bloc JSON-LD — sur l'accueil,
   et sur chaque article qui hérite d'elle. Deux canoniques contradictoires,
   Google les ignore tous les deux.
   
   Vérifié : au second passage, l'accueil portait deux canoniques, deux
   og:title et deux JSON-LD, et l'article aussi. Le pipeline nominal enchaîne
   bien build puis pré-rendu, mais rien n'empêchait de lancer le second seul. */
if (coquille.includes('rel="canonical"')) {
  throw new Error(
    'La coquille porte déjà un lien canonique : le pré-rendu a donc déjà ' +
      'tourné sur cette sortie. Relance « npm run build:kitetudiant », qui ' +
      'refait le build avant le pré-rendu.',
  )
}
if (!coquille.includes('<div id="root"></div>')) {
  throw new Error(
    'La coquille ne contient pas « <div id="root"></div> » : le pré-rendu ne ' +
      'saurait pas où poser le contenu. Vérifie kitetudiant/web/index.html.',
  )
}

// ---------------------------------------------------------------- articles
for (const article of ARTICLES) {
  const canonique = `${ORIGINE}${BASE}blog/${article.slug}`
  const faq = questionsFrequentes(article)
  // Les questions sont écrites dans le HTML autant que dans les données
  // structurées. Un moteur qui ne lit pas le JSON-LD — et un lecteur arrivé
  // là avant que l'application ne prenne la main — les trouve quand même.
  const questionsHtml =
    (article.questions ?? []).length === 0
      ? ''
      : `
      <section>
      <h2>Questions fréquentes</h2>
      <dl>
        ${(article.questions ?? [])
          .map(
            (q) =>
              `<dt>${echapper(q.question)}</dt><dd>${echapper(q.reponse)}</dd>`,
          )
          .join('\n        ')}
      </dl>
      </section>`
  const contenu = `
    <main>
      <article>
      <h1>${echapper(article.titre)}</h1>
      ${dateDeLArticle(article)}
      <p>${echapper(article.chapeau)}</p>
      ${corpsEnHtml(article)}${questionsHtml}
      <p>${echapper(MENTION_SOURCE)}</p>
      </article>
    </main>`
  ecrire(
    join(SORTIE, 'blog', article.slug, 'index.html'),
    coquilleAvec(
      coquille,
      `${article.titre} — KitEtudiant.fr`,
      article.chapeau,
      canonique,
      contenu,
      [
        ...enTetesDePartage(article.slug, `${article.titre} — KitEtudiant.fr`),
        `<script type="application/ld+json">${donneesStructurees(article)}</script>`,
        `<script type="application/ld+json">${filDAriane(article)}</script>`,
        ...(faq !== null ? [`<script type="application/ld+json">${faq}</script>`] : []),
      ].join('\n    '),
    ),
  )
}

// ------------------------------------------------------------ liste du blog
const listeHtml = `
    <main>
      <h1>Bien gérer sa scolarité</h1>
      <ul>
        ${ARTICLES.map(
          (a) =>
            `<li><a href="${BASE}blog/${a.slug}">${echapper(a.titre)}</a> — ${echapper(a.chapeau)}</li>`,
        ).join('\n        ')}
      </ul>
    </main>`
ecrire(
  join(SORTIE, 'blog', 'index.html'),
  coquilleAvec(
    coquille,
    'Bien gérer sa scolarité — le blog de KitEtudiant.fr',
    'Comprendre Parcoursup, monter son dossier, choisir sa ville et tenir son budget : ' +
      'des articles courts et vérifiables pour les lycéens et leurs familles.',
    `${ORIGINE}${BASE}blog`,
    listeHtml,
    enTetesDePartage('blog', 'Bien gérer sa scolarité — le blog de KitEtudiant.fr').join('\n    '),
  ),
)

// ------------------------------------------------------------------ accueil
// La coquille sortie de Vite ne porte aucun en-tête de partage. L'accueil est
// pourtant le lien le plus souvent envoyé — à un ami, à ses parents. On le
// complète ici plutôt que d'écrire une adresse absolue en dur dans index.html,
// qui deviendrait fausse le jour où la base de déploiement change.
const accueilCanonique = `${ORIGINE}${BASE}`
const accueilTitre = ACCUEIL_TITRE_ONGLET
const accueilDescription = ACCUEIL_DESCRIPTION
/**
 * Le corps de l'accueil, posé dans la coquille.
 *
 * ── Pourquoi ce n'était pas là, et pourquoi il le faut ───────────────────
 *
 * L'accueil ne recevait que des métadonnées : son `<div id="root">` restait
 * vide, et la page livrée par nginx ne contenait donc AUCUN lien. Pour un
 * robot qui n'exécute pas JavaScript — et pour tous ceux qui l'exécutent
 * mais rationnent ce budget — le site commençait et finissait sur une page
 * blanche. Le blog n'était atteignable que par le plan du site.
 *
 * On pose ici de quoi partir : le titre, la promesse, et les liens vers les
 * trois entrées publiques. React remplace tout au montage ; cette version
 * n'est lue que par ce qui ne monte pas.
 *
 * Le texte reprend MOT POUR MOT celui de `accueil.tsx`. Deux formulations
 * différentes pour la même page — l'une pour les robots, l'autre pour les
 * gens — c'est la définition du contenu masqué, et ça se sanctionne.
 */
function corpsAccueil(): string {
  const liens = [
    { url: `${BASE}chercher-une-ecole`, texte: 'Chercher une école' },
    { url: `${BASE}blog`, texte: 'Le blog : Parcoursup, budget et logement' },
    ...ARTICLES.slice(0, 6).map((a) => ({
      url: `${BASE}blog/${a.slug}`,
      texte: a.titre,
    })),
  ]
  return [
    '<main>',
    `<h1>${echapper(ACCUEIL_TITRE_PAGE)}</h1>`,
    `<p>${echapper(accueilDescription)}</p>`,
    '<nav aria-label="Aller à l’essentiel"><ul>',
    ...liens.map((l) => `<li><a href="${echapper(l.url)}">${echapper(l.texte)}</a></li>`),
    '</ul></nav>',
    // Les mêmes questions qu'à l'écran, et dans le même ordre. Écrites en
    // clair autant qu'en JSON-LD : un moteur qui ne lit pas les données
    // structurées les trouve quand même, et un lecteur arrivé avant que
    // l'application ne prenne la main aussi.
    '<section><h2>Les questions qu’on nous pose</h2><dl>',
    ...ACCUEIL_QUESTIONS.map(
      (q) => `<dt>${echapper(q.question)}</dt><dd>${echapper(q.reponse)}</dd>`,
    ),
    '</dl></section>',
    '</main>',
  ].join('')
}

ecrire(
  join(SORTIE, 'index.html'),
  coquilleAvec(
    coquille,
    accueilTitre,
    accueilDescription,
    accueilCanonique,
    corpsAccueil(),
    [
      ...enTetesDePartage('accueil', accueilTitre),
      `<script type="application/ld+json">${identiteDuSite()}</script>`,
      /* La page la plus citée d'un site est son accueil, et c'était la
         seule à n'avoir aucune question déclarée. Une question suivie de sa
         réponse est la plus petite unité citable qui existe : elle tient
         debout hors de la page, ce qu'un paragraphe ne fait pas. */
      `<script type="application/ld+json">${questionsEnFaq(ACCUEIL_QUESTIONS)}</script>`,
    ].join('\n    '),
    'website',
  ),
)

// --------------------------------------------------- coquille des vues React
/*
 * Le repli de nginx, pour toutes les adresses qui ne sont pas pré-rendues.
 *
 * ── Ce qui se passait ────────────────────────────────────────────────────
 *
 * La configuration dit « try_files $uri $uri/ /index.html » : une adresse
 * sans fichier — /formation/2519, /etablissement/0870669E,
 * /chercher-une-ecole — reçoit donc index.html. Or index.html, c'est
 * l'accueil pré-rendue, qui porte depuis ce script :
 *
 *     <link rel="canonical" href="https://kitetudiant.fr/">
 *     <meta property="og:url" content="https://kitetudiant.fr/">
 *     <title>KitEtudiant.fr — choisir ses vœux Parcoursup …</title>
 *
 * Autrement dit, CHAQUE fiche du site — elles se comptent par milliers —
 * déclarait elle-même être un doublon de l'accueil. Un canonique est une
 * déclaration, pas une suggestion : c'est la façon la plus efficace qui
 * soit de faire désindexer ses propres pages.
 *
 * `useMetadonnees` corrige le tir au montage de React, mais le canonique
 * est lu AVANT : par un moteur qui explore sans exécuter le JavaScript, et
 * par tous les robots d'aperçu — messageries, réseaux sociaux — dont aucun
 * n'exécute de JavaScript.
 *
 * ── Ce que cette coquille fait ───────────────────────────────────────────
 *
 * Elle ne déclare NI canonique NI og:url. Une page qui n'annonce pas sa
 * forme canonique est simplement prise pour elle-même, ce qui est le
 * comportement voulu ; une page qui en annonce une fausse est effacée.
 *
 * Elle porte en revanche un titre et une carte de partage génériques, pour
 * qu'un lien collé dans une conversation avant que React ne rende quoi que
 * ce soit montre au moins le site, et pas un aperçu nu.
 *
 * nginx doit retomber sur « /app.html » et non « /index.html » :
 * deploy/vps-setup.sh et deploy/nginx.conf.example le font.
 */
ecrire(
  join(SORTIE, 'app.html'),
  coquilleAvec(
    coquille,
    ACCUEIL_TITRE_ONGLET,
    ACCUEIL_DESCRIPTION,
    // Pas de canonique : c'est tout l'objet de ce fichier.
    null,
    // Pas de corps non plus. Écrire ici celui de l'accueil rendrait chaque
    // fiche identique à l'accueil aux yeux d'un robot — le défaut d'à côté.
    '',
    enTetesDePartage('accueil', 'KitEtudiant.fr').join('\n    '),
    'website',
  ),
)

// ------------------------------------------------------------- plan du site
/* Les chemins PRIVÉS, tenus hors des index.
   
   Ce ne sont pas des pages de contenu : une page de connexion indexée vole
   des clics aux pages utiles, et « Mes vœux » n'a rien à montrer à qui n'a
   pas de compte. Ils sont énumérés ici, nommément, parce que `routes.test.ts`
   exige que CHAQUE route de `routes.ts` soit soit au plan du site, soit dans
   cette liste — une route ajoutée sans qu'on y pense fait échouer le test
   plutôt que de disparaître en silence.
   
   `Disallow` empêche une nouvelle exploration ; il ne désindexe pas une page
   déjà connue. Les écrans concernés portent donc AUSSI un
   « <meta name="robots" content="noindex"> » posé au montage. */
const CHEMINS_PRIVES = ['connexion', 'inscription', 'mon-compte', 'mes-cartes', 'mes-voeux']

const adresses = [
  { url: `${ORIGINE}${BASE}`, le: ARTICLES[0]?.publieLe, priorite: '1.0' },
  { url: `${ORIGINE}${BASE}blog`, le: ARTICLES[0]?.publieLe, priorite: '0.8' },
  /* La recherche d'école manquait au plan, et c'est la seule page publique
     qui répond à « qu'est-ce qu'il y a comme écoles à Limoges ? ». Sans elle
     au plan et sans lien depuis l'accueil livrée, elle n'était atteignable
     par aucun robot. */
  { url: `${ORIGINE}${BASE}chercher-une-ecole`, le: ARTICLES[0]?.publieLe, priorite: '0.8' },
  ...ARTICLES.map((a) => ({
    url: `${ORIGINE}${BASE}blog/${a.slug}`,
    le: a.revuLe ?? a.publieLe,
    priorite: '0.6',
  })),
]
ecrire(
  join(SORTIE, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${adresses
  .map(
    (a) =>
      `  <url><loc>${echapper(a.url)}</loc>` +
      (a.le ? `<lastmod>${a.le}</lastmod>` : '') +
      `<priority>${a.priorite}</priority></url>`,
  )
  .join('\n')}
</urlset>
`,
)

// ---------------------------------------------------------------- robots.txt
ecrire(
  join(SORTIE, 'robots.txt'),
  `# Les robots d'indexation, tous autorisés.
User-agent: *
Allow: /
# La console d'administration n'a rien à faire dans un index.
Disallow: ${BASE}admin.html
# Les pages de compte non plus : rien à y lire sans être connecté, et une
# page de connexion indexée vole des clics aux pages qui répondent vraiment.
${CHEMINS_PRIVES.map((c) => `Disallow: ${BASE}${c}`).join('\n')}

# Les robots des moteurs génératifs, nommés un par un.
#
# « User-agent: * » les couvre déjà. On les écrit quand même, parce qu'un
# jour quelqu'un restreindra la règle générale et les emportera sans le
# vouloir. Chacun gouverne une capacité PRÉCISE, et les confondre est
# l'erreur la plus répandue sur le sujet :
#
#   OAI-SearchBot    → citabilité dans ChatGPT Search
#   Claude-SearchBot → citabilité dans la recherche Claude
#   PerplexityBot    → citabilité dans Perplexity
#   Googlebot        → recherche Google ET AI Overviews
#
# Les robots d'ENTRAÎNEMENT sont autre chose : GPTBot, ClaudeBot,
# Google-Extended, Applebot-Extended, CCBot n'ouvrent aucune citation et
# ne servent qu'à nourrir des modèles. Le site ne les bloque pas — ses
# articles sont publics et sans donnée personnelle — mais il ne compte pas
# sur eux non plus.
User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

Sitemap: ${ORIGINE}${BASE}sitemap.xml
`,
)

// ------------------------------------------------------------------ llms.txt
/*
 * Une carte du site à l'usage des moteurs génératifs.
 *
 * Ce n'est PAS un standard du web : Google Search l'ignore, et aucun moteur
 * ne s'engage à le lire. Il coûte quelques lignes et sert à une chose —
 * qu'un modèle qui cite le site sache ce qu'il cite, et surtout ce que le
 * site NE fait pas. Un outil d'orientation présenté comme officiel, ou
 * comme un classement d'écoles, serait pire qu'une absence de citation.
 *
 * Il ne contient aucun montant. Les barèmes changent ; le calculateur les
 * affiche avec leur source et leur millésime, un fichier statique ne le
 * peut pas (règle 1 et règle 6 de CLAUDE.md).
 */
ecrire(
  join(SORTIE, 'llms.txt'),
  `# KitEtudiant.fr

> Outil indépendant qui aide les lycéens français à choisir leurs vœux
> Parcoursup. Chaque formation est regardée sous trois angles tenus
> séparés : les chances d'admission réellement publiées, l'adéquation au
> profil scolaire, et le reste-à-vivre mensuel une fois sur place.

## Ce que le site fait

- Il calcule un **reste-à-vivre mensuel** ville par ville : loyer, aide au
  logement, bourse, CVEC, repas, transport. Chaque euro porte sa source et
  son millésime.
- Il affiche les **statistiques d'admission publiées** par le ministère pour
  la session précédente, telles quelles.
- Il explique la **procédure Parcoursup** dans ${ARTICLES.length} articles.

## Couverture et millésimes

Ces chiffres sont comptés dans les données au moment du build, pas recopiés
à la main.

- **${nombre(Object.keys(COMMUNES.communes).length)} communes** avec un loyer de référence.
- **Loyers** : millésime ${COMMUNES.millesimeLoyers}. ${COMMUNES.source}.
- **Jeu de communes** assemblé le ${dateLisible(COMMUNES.genereLe)}.
- **Calendrier Parcoursup** : session ${MILLESIME_CALENDRIER}, relevé le ${dateLisible(RELEVE_LE)}.
- **Formations et établissements** : interrogés en direct dans l'open data
  publié, à chaque affichage. Le site n'en garde pas de copie datée, donc la
  fiche montre toujours le dernier millésime publié par le ministère.
- **Cette page** a été écrite le ${dateLisible(new Date().toISOString().slice(0, 10))}.

## Ce que le site ne fait pas

- Il **ne classe pas** les écoles entre elles. Pas de palmarès, pas de note
  globale : trois critères séparés, jamais fondus en un chiffre unique.
- Il **n'est pas officiel**. Il n'est affilié ni à Parcoursup, ni au
  ministère de l'Enseignement supérieur, ni aux CROUS. En cas de doute,
  parcoursup.gouv.fr fait foi.
- Il **n'accède à aucun dossier Parcoursup** et ne transmet rien à la
  plateforme.
- Il **n'invente aucun montant**. Une donnée absente s'affiche comme absente.
- Il **ne publie pas les dates** de la session à venir tant que l'État ne
  les a pas fixées. Les articles parlent en mois, jamais en jours.

## Articles

${ARTICLES.map((a) => `- [${a.titre}](${ORIGINE}${BASE}blog/${a.slug}) : ${a.chapeau}`).join('\n')}

## Pages

- [Accueil](${ORIGINE}${BASE}) : le questionnaire, le calcul du
  reste-à-vivre et la méthode.
- [Chercher une école](${ORIGINE}${BASE}chercher-une-ecole) : recherche par
  ville, par domaine ou par nom d'établissement.
- [Blog](${ORIGINE}${BASE}blog) : la liste des articles.
- [Plan du site](${ORIGINE}${BASE}sitemap.xml)

## Fiches

Une page par formation et une par établissement, atteignables depuis la
recherche. Elles se comptent par milliers et dépendent d'un appel à l'open
data, donc elles ne figurent pas au plan du site — c'est assumé, pas un
oubli.

- Formation : \`${ORIGINE}${BASE}formation/<code d'affectation Parcoursup>\`
- Établissement : \`${ORIGINE}${BASE}etablissement/<code UAI>\`

Chaque fiche porte le taux d'accès publié, le reste-à-vivre estimé dans la
commune de l'école, et les débouchés — nombre d'offres en cours sur France
Travail pour les métiers liés à la formation. Aucune de ces pages ne classe
les écoles entre elles.
`,
)

console.log(
  `Pré-rendu : ${ARTICLES.length} articles + la liste, plan du site, robots.txt et llms.txt écrits dans ${SORTIE}`,
)
