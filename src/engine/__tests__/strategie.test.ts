import { describe, it, expect } from 'vitest'
import type { ResultatSimulation } from '../../types'
import { categoriser, construireStrategie } from '../strategie'

function fakeResultat(id: string, probabilite: number): ResultatSimulation {
  return {
    formation: {
      id,
      nom: id,
      etablissement: 'Test',
      ville: 'Test',
      region: 'Île-de-France',
      domaine: 'informatique',
      selectivite: 'non-selective',
      tauxAccesBase: 50,
      matieresCles: {},
      attendus: '',
    },
    probabilite,
    details: {
      academique: 50,
      specialites: 50,
      passion: 50,
      motivation: 50,
      geographie: 50,
    },
    explications: [],
  }
}

describe('categoriser', () => {
  it('classe les fortes probabilités en valeur sûre', () => {
    expect(categoriser(80)).toBe('valeur-sure')
  })
  it('classe les probabilités moyennes en réaliste', () => {
    expect(categoriser(50)).toBe('realiste')
  })
  it('classe les faibles probabilités en ambitieux', () => {
    expect(categoriser(20)).toBe('ambitieux')
  })
})

describe('construireStrategie', () => {
  it('regroupe les résultats en catégories et limite le nombre par groupe', () => {
    const resultats = [
      fakeResultat('a', 90),
      fakeResultat('b', 80),
      fakeResultat('c', 70),
      fakeResultat('d', 68),
      fakeResultat('e', 50),
      fakeResultat('f', 20),
    ]
    const groupes = construireStrategie(resultats, 3)
    const sure = groupes.find((g) => g.categorie === 'valeur-sure')
    expect(sure?.resultats.length).toBe(3) // limité à 3 même si 4 candidats
    expect(groupes.find((g) => g.categorie === 'ambitieux')?.resultats).toHaveLength(1)
  })

  it("n'inclut pas les catégories vides", () => {
    const groupes = construireStrategie([fakeResultat('a', 50)])
    expect(groupes).toHaveLength(1)
    expect(groupes[0].categorie).toBe('realiste')
  })
})
