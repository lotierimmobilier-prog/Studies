import { describe, it, expect } from 'vitest'
import type { ResultatSimulation } from '../../types'
import {
  faisabilite,
  scoreRecommandation,
  raisonsAdaptation,
  recommander,
} from '../recommandation'

function fakeResultat(
  id: string,
  {
    probabilite = 50,
    adequation = 50,
    details = {},
  }: {
    probabilite?: number
    adequation?: number
    details?: Partial<ResultatSimulation['details']>
  } = {},
): ResultatSimulation {
  return {
    formation: {
      id,
      nom: id,
      etablissement: 'Test',
      ville: 'Test',
      region: 'Île-de-France',
      domaine: 'informatique',
      selectivite: 'selective',
      tauxAccesBase: 50,
      matieresCles: {},
      attendus: '',
    },
    probabilite,
    adequation,
    details: {
      academique: 50,
      specialites: 50,
      passion: 50,
      motivation: 50,
      geographie: 50,
      ...details,
    },
    explications: [],
  }
}

describe('faisabilite', () => {
  it('plafonne à 1 dès que les chances sont correctes', () => {
    expect(faisabilite(45)).toBeCloseTo(1)
    expect(faisabilite(90)).toBeCloseTo(1)
  })
  it('décroît pour les formations hors de portée', () => {
    expect(faisabilite(0)).toBe(0)
    expect(faisabilite(22.5)).toBeCloseTo(0.5)
  })
})

describe('scoreRecommandation', () => {
  it('atténue une forte adéquation quand la formation est difficile', () => {
    const accessible = fakeResultat('a', { adequation: 80, probabilite: 60 })
    const difficile = fakeResultat('b', { adequation: 80, probabilite: 5 })
    expect(scoreRecommandation(accessible)).toBeGreaterThan(
      scoreRecommandation(difficile),
    )
  })

  it("ne fait pas remonter une formation facile mais peu adaptée au-dessus d'une formation bien adaptée", () => {
    const adaptee = fakeResultat('a', { adequation: 85, probabilite: 55 })
    const facileMaisInadaptee = fakeResultat('b', {
      adequation: 40,
      probabilite: 95,
    })
    expect(scoreRecommandation(adaptee)).toBeGreaterThan(
      scoreRecommandation(facileMaisInadaptee),
    )
  })
})

describe('raisonsAdaptation', () => {
  it('produit des badges à partir des sous-scores forts', () => {
    const r = fakeResultat('a', {
      probabilite: 65,
      details: { academique: 80, passion: 100, geographie: 100 },
    })
    const raisons = raisonsAdaptation(r)
    expect(raisons.some((x) => x.includes('matières clés'))).toBe(true)
    expect(raisons.some((x) => x.includes('passion'))).toBe(true)
    expect(raisons.some((x) => x.includes('région'))).toBe(true)
    expect(raisons.some((x) => x.includes('chances'))).toBe(true)
  })

  it('ne renvoie aucun badge pour un profil moyen', () => {
    expect(raisonsAdaptation(fakeResultat('a'))).toHaveLength(0)
  })
})

describe('recommander', () => {
  it('écarte les formations sous le seuil d’adéquation', () => {
    const reco = recommander([
      fakeResultat('faible', { adequation: 20, probabilite: 90 }),
      fakeResultat('adaptee', { adequation: 75, probabilite: 60 }),
    ])
    expect(reco).toHaveLength(1)
    expect(reco[0].resultat.formation.id).toBe('adaptee')
  })

  it('trie par score de recommandation et limite le nombre', () => {
    const reco = recommander(
      [
        fakeResultat('a', { adequation: 60, probabilite: 50 }),
        fakeResultat('b', { adequation: 90, probabilite: 60 }),
        fakeResultat('c', { adequation: 70, probabilite: 55 }),
        fakeResultat('d', { adequation: 80, probabilite: 55 }),
      ],
      2,
    )
    expect(reco).toHaveLength(2)
    expect(reco[0].resultat.formation.id).toBe('b') // meilleure adéquation accessible
    expect(reco[0].score).toBeGreaterThanOrEqual(reco[1].score)
  })
})
