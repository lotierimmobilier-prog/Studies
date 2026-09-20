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

const RACINE = resolve(import.meta.dirname, '..', '..')
const SORTIE = join(RACINE, 'dist-kitetudiant')
const BASE = (process.env.VITE_BASE ?? '/').endsWith('/')
  ? (process.env.VITE_BASE ?? '/')
  : `${process.env.VITE_BASE}/`
const ORIGINE = (process.env.SITE_ORIGINE ?? 'https://kitetudiant.fr').replace(/\/$/, '')

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
function questionsFrequentes(article: Article): string | null {
  const questions = article.questions ?? []
  if (questions.length === 0) return null
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
  canonique: string,
  contenu: string,
  extra = '',
): string {
  let html = coquille
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${echapper(titre)}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta name="description" content="${echapper(description)}" />`,
  )
  const entetes = [
    `<link rel="canonical" href="${echapper(canonique)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${echapper(titre)}" />`,
    `<meta property="og:description" content="${echapper(description)}" />`,
    `<meta property="og:url" content="${echapper(canonique)}" />`,
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
      <p><time datetime="${article.publieLe}">${article.publieLe}</time></p>
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
const accueilTitre = 'KitEtudiant.fr — trouve la meilleure solution pour l’année prochaine'
const accueilDescription =
  'Études, logement, budget, aides : tout ce qui se décide entre janvier et juillet, ' +
  'au même endroit, avec des chiffres datés et leur source.'
ecrire(
  join(SORTIE, 'index.html'),
  coquille
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${echapper(accueilTitre)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/,
      `<meta name="description" content="${echapper(accueilDescription)}" />`,
    )
    .replace(
      '</head>',
      `  ${[
        `<link rel="canonical" href="${echapper(accueilCanonique)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:title" content="${echapper(accueilTitre)}" />`,
        `<meta property="og:description" content="${echapper(accueilDescription)}" />`,
        `<meta property="og:url" content="${echapper(accueilCanonique)}" />`,
        `<meta property="og:locale" content="fr_FR" />`,
        ...enTetesDePartage('accueil', accueilTitre),
        `<script type="application/ld+json">${identiteDuSite()}</script>`,
      ].join('\n    ')}\n  </head>`,
    ),
)

// ------------------------------------------------------------- plan du site
const adresses = [
  { url: `${ORIGINE}${BASE}`, le: ARTICLES[0]?.publieLe, priorite: '1.0' },
  { url: `${ORIGINE}${BASE}blog`, le: ARTICLES[0]?.publieLe, priorite: '0.8' },
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

- [Accueil](${ORIGINE}${BASE}) : le calculateur et la méthode.
- [Blog](${ORIGINE}${BASE}blog) : la liste des articles.
- [Plan du site](${ORIGINE}${BASE}sitemap.xml)
`,
)

console.log(
  `Pré-rendu : ${ARTICLES.length} articles + la liste, plan du site, robots.txt et llms.txt écrits dans ${SORTIE}`,
)
