/**
 * Ce que les moteurs — et les moteurs GÉNÉRATIFS — trouvent sur le site.
 *
 * Ces tests lisent le SCRIPT de pré-rendu, pas sa sortie : le dossier
 * `dist-kitetudiant` n'existe pas tant que le build n'a pas tourné, et un
 * test qui dépendrait de lui passerait en silence quand il manque.
 *
 * ── Pourquoi ces garde-fous et pas d'autres ──────────────────────────────
 *
 * Un défaut de référencement ne casse rien, ne lève aucune erreur, et ne se
 * voit qu'au bout de plusieurs semaines dans une console tierce. C'est
 * exactement le genre de régression qu'un test doit attraper — d'autant que
 * le fichier qui la porte n'est touché qu'une fois tous les six mois.
 *
 * Ils ne mesurent PAS la qualité du référencement, qui ne se teste pas. Ils
 * vérifient que les signaux posés délibérément sont toujours là.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ARTICLES } from '../../../packages/articles/src/index.ts'

const SCRIPT = readFileSync(
  resolve(import.meta.dirname, '..', '..', '..', 'scripts', 'prerendre.ts'),
  'utf8',
)

describe('données structurées', () => {
  it('pose un Article, un fil d’Ariane et l’identité du site', () => {
    for (const type of ['Article', 'BreadcrumbList', 'Organization', 'WebSite']) {
      expect(SCRIPT, `le type ${type} a disparu des données structurées`).toContain(
        `'${type}'`,
      )
    }
  })

  it('neutralise « </script> » dans chaque bloc produit', () => {
    // Un titre d'article contenant « </script> » casserait la balise et
    // laisserait le reste du bloc s'exécuter comme du HTML. Chaque fabrique
    // de JSON-LD doit donc échapper, sans exception.
    const fabriques = SCRIPT.match(/JSON\.stringify\(objet\)[^\n]*/g) ?? []
    expect(fabriques.length).toBeGreaterThanOrEqual(3)
    for (const f of fabriques) expect(f).toContain('replaceAll')
  })

  it('dit que le site n’est pas officiel, là où un moteur le lira', () => {
    // Un moteur génératif qui cite le site pourrait le présenter comme une
    // source officielle. C'est le seul contresens qui ferait un vrai dégât :
    // il est démenti dans les données structurées ET dans llms.txt.
    expect(SCRIPT).toMatch(/n’est affilié ni à Parcoursup/)
    expect(SCRIPT).toMatch(/Il \*\*n'est pas officiel\*\*/)
  })
})

describe('robots.txt', () => {
  it('nomme les robots des moteurs génératifs un par un', () => {
    // « User-agent: * » les couvre déjà. Ils sont écrits quand même : le jour
    // où quelqu'un restreint la règle générale, il ne les emporte pas sans
    // le vouloir.
    for (const robot of ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'Googlebot']) {
      expect(SCRIPT, `${robot} n’est plus nommé dans robots.txt`).toContain(robot)
    }
  })

  it('ne confond pas un robot de citation avec un robot d’entraînement', () => {
    // GPTBot nourrit un modèle, OAI-SearchBot ouvre une citation. Les
    // confondre est l'erreur la plus répandue sur le sujet ; le fichier le
    // dit explicitement pour que personne ne « corrige » dans le mauvais sens.
    expect(SCRIPT).toMatch(/robots d'ENTRAÎNEMENT sont autre chose/)
  })

  it('garde la console d’administration hors des index', () => {
    expect(SCRIPT).toContain('Disallow: ${BASE}admin.html')
  })
})

describe('llms.txt', () => {
  it('est écrit, et liste tous les articles', () => {
    expect(SCRIPT).toContain("join(SORTIE, 'llms.txt')")
    expect(SCRIPT).toMatch(/ARTICLES\.map\(\(a\) => `- \[\$\{a\.titre\}\]/)
  })

  it('ne contient aucun montant en euros', () => {
    // Règle 1 de CLAUDE.md. Un barème change ; un fichier statique ne porte
    // ni source ni millésime, donc il ne peut pas chiffrer.
    const bloc = SCRIPT.slice(SCRIPT.indexOf("join(SORTIE, 'llms.txt')"))
    const fin = bloc.indexOf('console.log')
    expect(bloc.slice(0, fin)).not.toMatch(/\d[\d  ]*(€|euros?\b)/i)
  })

  /* ── La couverture, comptée et non recopiée ──────────────────────────
   *
   * Le fichier annonçait ce que le site FAIT sans jamais dire sur quoi ni
   * depuis quand. Un moteur génératif qui le cite ne pouvait pas savoir si
   * les chiffres dataient de l'an dernier, ni combien de communes le site
   * couvre — la question exacte qu'on lui pose (« est-ce que ça marche
   * pour ma ville ? »).
   *
   * Et il ne mentionnait ni la recherche d'écoles, ni les fiches, qui sont
   * pourtant l'essentiel des pages du site.
   */
  it('annonce sa couverture à partir des données, pas d’un chiffre recopié', () => {
    expect(SCRIPT).toContain('## Couverture et millésimes')
    // Compté dans le fichier de communes. Un nombre écrit en dur devient
    // faux au premier import, et personne ne s'en aperçoit.
    expect(SCRIPT).toMatch(/nombre\(Object\.keys\(COMMUNES\.communes\)\.length\)/)
    expect(SCRIPT).toContain('COMMUNES.millesimeLoyers')
  })

  it('écrit ses dates en toutes lettres', () => {
    // Elles sortaient en ISO brut — « 2026-09-19 » — dans un fichier dont
    // tout l'objet est d'être lu.
    expect(SCRIPT).toMatch(/dateLisible\(COMMUNES\.genereLe\)/)
    expect(SCRIPT).toMatch(/dateLisible\(RELEVE_LE\)/)
  })

  it('mentionne la recherche d’écoles et les fiches', () => {
    expect(SCRIPT).toContain('chercher-une-ecole')
    expect(SCRIPT).toContain('## Fiches')
  })
})

/**
 * Le fichier RÉELLEMENT écrit, quand il a été construit.
 *
 * Les tests ci-dessus lisent le script. Ça suffit pour ce qui est écrit en
 * dur, pas pour ce qui vient des données : le libellé de source du jeu de
 * loyers est interpolé dans llms.txt, et rien n'empêcherait un prochain
 * millésime d'y glisser un montant — ce que la règle 1 interdit.
 *
 * Le test se tait s'il n'y a pas de build : faire échouer une campagne
 * parce que `dist-kitetudiant` est absent apprendrait à l'ignorer.
 */
describe('llms.txt tel qu’il est écrit', () => {
  const CHEMIN = resolve(import.meta.dirname, '..', '..', '..', '..', 'dist-kitetudiant', 'llms.txt')
  const SORTIE = existsSync(CHEMIN) ? readFileSync(CHEMIN, 'utf8') : null

  it.skipIf(SORTIE === null)('ne chiffre aucun euro, données interpolées comprises', () => {
    expect(SORTIE).not.toMatch(/\d[\d  ]*(€|euros?\b)/i)
  })

  it.skipIf(SORTIE === null)('ne laisse passer aucune date en ISO brut', () => {
    // Sauf dans une adresse, où elle ne se lit pas.
    const horsLiens = (SORTIE ?? '').replace(/https?:\/\/\S+/g, ' ')
    expect(horsLiens).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})

describe('le plan du site couvre ce qui existe', () => {
  it('une adresse par article, plus l’accueil et la liste', () => {
    // Si un article est ajouté sans apparaître au plan, il reste invisible.
    expect(SCRIPT).toMatch(/\.\.\.ARTICLES\.map\(\(a\) => \(\{/)
    expect(ARTICLES.length).toBeGreaterThan(0)
  })

  it('date chaque adresse par sa dernière révision', () => {
    expect(SCRIPT).toContain('a.revuLe ?? a.publieLe')
  })
})
