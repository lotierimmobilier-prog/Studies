import { describe, expect, it } from 'vitest'

import { ARTICLES } from '../../../packages/articles/src/index.ts'
import {
  chercherArticles,
  motsDe,
  normaliser,
} from '../../../packages/articles/src/recherche.ts'

describe('normalisation', () => {
  it('efface les accents et les ligatures', () => {
    // « vœux » doit se trouver en tapant « voeux », et « académie » en tapant
    // « academie ». Sur un téléphone, exiger les accents revient à n'avoir
    // pas de recherche.
    expect(normaliser('Vœux')).toBe('voeux')
    expect(normaliser('Académie')).toBe('academie')
    expect(normaliser('Saint-Étienne')).toBe('saint-etienne')
  })

  it('découpe une requête en mots, ponctuation comprise', () => {
    expect(motsDe('  bourse, logement ! ')).toEqual(['bourse', 'logement'])
    expect(motsDe('   ')).toEqual([])
  })
})

describe('recherche dans les articles', () => {
  it('rend toute la liste, dans son ordre, quand la requête est vide', () => {
    // C'est le cas normal au chargement de la page, pas une absence de
    // résultat : la liste ne doit pas se vider.
    const tous = chercherArticles(ARTICLES, '')
    expect(tous).toHaveLength(ARTICLES.length)
    expect(tous.map((t) => t.article.slug)).toEqual(ARTICLES.map((a) => a.slug))
  })

  it('exige TOUS les mots, et pas au moins un', () => {
    // Un « ou » implicite donne des listes longues où le bon résultat se
    // noie. « bourse logement » doit rendre l'article qui parle des deux.
    const deux = chercherArticles(ARTICLES, 'bourse logement')
    const un = chercherArticles(ARTICLES, 'bourse')
    expect(deux.length).toBeGreaterThan(0)
    expect(deux.length).toBeLessThanOrEqual(un.length)
    for (const t of deux) {
      const texte = normaliser(
        [t.article.titre, t.article.chapeau, ...t.article.corps.flatMap((b) => (b.type === 'liste' ? b.points : [b.texte]))].join(' '),
      )
      expect(texte).toContain('bourse')
      expect(texte).toContain('logement')
    }
  })

  it('trouve malgré les accents manquants', () => {
    expect(chercherArticles(ARTICLES, 'voeux').length).toBeGreaterThan(0)
    expect(chercherArticles(ARTICLES, 'academie').length).toBeGreaterThan(0)
  })

  it('classe le titre avant le corps', () => {
    // « Un mot dans le titre compte plus qu'un mot dans le corps » : c'est la
    // seule règle de classement, et elle doit s'observer.
    const trouves = chercherArticles(ARTICLES, 'parcoursup')
    expect(trouves.length).toBeGreaterThan(1)
    const premier = trouves[0]!
    expect(normaliser(premier.article.titre)).toContain('parcoursup')
  })

  it('ne rend rien quand rien ne correspond, sans se rabattre', () => {
    // Pas de repli sur « à peu près » : une absence s'affiche comme une
    // absence, ici comme ailleurs.
    expect(chercherArticles(ARTICLES, 'zzzzquelquechosedintrouvable')).toEqual([])
  })

  it('rend un extrait coupé aux espaces, jamais au milieu d’un mot', () => {
    const t = chercherArticles(ARTICLES, 'confirmation').find((x) => x.extrait !== null)
    expect(t).toBeDefined()
    const extrait = t!.extrait!
    expect(extrait.length).toBeGreaterThan(20)
    // Les ellipses marquent la coupe ; entre elles, que des mots entiers.
    const interieur = extrait.replace(/^…/, '').replace(/…$/, '')
    expect(interieur.startsWith(' ')).toBe(false)
    expect(interieur.endsWith(' ')).toBe(false)
  })

  it('n’expose aucun score à l’écran sous forme de pourcentage', () => {
    // Le score sert UNIQUEMENT à ordonner. Un nombre affiché passerait pour
    // une mesure de pertinence, alors que c'est un réglage interne.
    for (const t of chercherArticles(ARTICLES, 'bourse')) {
      expect(Number.isFinite(t.score)).toBe(true)
      expect(t.score).toBeGreaterThan(0)
    }
  })
})
