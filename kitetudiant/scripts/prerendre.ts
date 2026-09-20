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
  const contenu = `
    <main>
      <article>
      <h1>${echapper(article.titre)}</h1>
      <p><time datetime="${article.publieLe}">${article.publieLe}</time></p>
      <p>${echapper(article.chapeau)}</p>
      ${corpsEnHtml(article)}
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
      `<script type="application/ld+json">${donneesStructurees(article)}</script>`,
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
  `User-agent: *
Allow: /
# La console d'administration n'a rien à faire dans un index.
Disallow: ${BASE}admin.html
Sitemap: ${ORIGINE}${BASE}sitemap.xml
`,
)

console.log(
  `Pré-rendu : ${ARTICLES.length} articles + la liste, plan du site et robots.txt écrits dans ${SORTIE}`,
)
