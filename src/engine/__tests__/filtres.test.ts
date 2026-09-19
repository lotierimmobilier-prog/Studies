import { describe, it, expect } from 'vitest'
import type { Formation, ResultatSimulation } from '../../types'
import {
  filtrerResultats,
  filtresActifs,
  domainesDisponibles,
  villesDisponibles,
} from '../filtres'

function res(
  id: string,
  over: Partial<Formation> = {},
  probabilite = 50,
): ResultatSimulation {
  return {
    formation: {
      id,
      nom: over.nom ?? `Formation ${id}`,
      etablissement: over.etablissement ?? 'Établissement',
      ville: over.ville ?? 'Lyon',
      region: 'Auvergne-Rhône-Alpes',
      domaine: over.domaine ?? 'informatique',
      selectivite: over.selectivite ?? 'selective',
      tauxAccesBase: 50,
      matieresCles: {},
      attendus: '',
      ...over,
    },
    probabilite,
    adequation: 50,
    details: { academique: 50, specialites: 50, passion: 50, motivation: 50, geographie: 50 },
    explications: [],
  }
}

const jeu = [
  res('a', { nom: 'Licence Informatique', ville: 'Lyon', domaine: 'informatique', selectivite: 'non-selective' }),
  res('b', { nom: 'BUT Génie civil', ville: 'Paris', domaine: 'ingenieur', selectivite: 'selective' }),
  res('c', { nom: 'Licence Droit', ville: 'Lyon', domaine: 'droit', selectivite: 'non-selective' }),
]

describe('filtresActifs', () => {
  it('est faux pour des critères vides', () => {
    expect(filtresActifs({})).toBe(false)
    expect(filtresActifs({ texte: '  ', domaine: '' })).toBe(false)
  })
  it('est vrai dès qu’un critère est posé', () => {
    expect(filtresActifs({ ville: 'Lyon' })).toBe(true)
    expect(filtresActifs({ coutMax: 5000 })).toBe(true)
  })
})

describe('filtrerResultats', () => {
  it('renvoie tout sans critère', () => {
    expect(filtrerResultats(jeu, {})).toHaveLength(3)
  })

  it('recherche par texte, insensible casse/accents', () => {
    expect(filtrerResultats(jeu, { texte: 'informatique' }).map((r) => r.formation.id)).toEqual(['a'])
    expect(filtrerResultats(jeu, { texte: 'DROIT' }).map((r) => r.formation.id)).toEqual(['c'])
  })

  it('filtre par ville, domaine et sélectivité', () => {
    expect(filtrerResultats(jeu, { ville: 'Lyon' }).map((r) => r.formation.id)).toEqual(['a', 'c'])
    expect(filtrerResultats(jeu, { domaine: 'ingenieur' }).map((r) => r.formation.id)).toEqual(['b'])
    expect(filtrerResultats(jeu, { selectivite: 'non-selective' }).map((r) => r.formation.id)).toEqual(['a', 'c'])
  })

  it('filtre par coût max sans exclure les prix inconnus', () => {
    const prix = new Map([
      ['a', { etablissement: 'x', prixAnnuel: 170, devise: 'EUR' as const, source: 'curated' as const, dateMaj: '' }],
      ['b', { etablissement: 'x', prixAnnuel: 9000, devise: 'EUR' as const, source: 'curated' as const, dateMaj: '' }],
      // 'c' : prix inconnu → conservé
    ])
    const ids = filtrerResultats(jeu, { coutMax: 1000 }, { prix }).map((r) => r.formation.id)
    expect(ids).toEqual(['a', 'c'])
  })

  it('filtre par note min en excluant les formations sans note', () => {
    const avis = new Map([
      ['a', { etablissement: 'x', note: 4.5, nombreAvis: 10, source: 'google' as const, dateMaj: '' }],
      ['b', { etablissement: 'x', note: 3.0, nombreAvis: 5, source: 'google' as const, dateMaj: '' }],
    ])
    const ids = filtrerResultats(jeu, { noteMin: 4 }, { avis }).map((r) => r.formation.id)
    expect(ids).toEqual(['a'])
  })

  it('combine plusieurs critères', () => {
    const ids = filtrerResultats(jeu, { ville: 'Lyon', selectivite: 'non-selective', texte: 'licence' }).map(
      (r) => r.formation.id,
    )
    expect(ids).toEqual(['a', 'c'])
  })
})

describe('listes de valeurs', () => {
  it('extrait domaines et villes disponibles', () => {
    expect(domainesDisponibles(jeu).sort()).toEqual(['droit', 'informatique', 'ingenieur'])
    expect(villesDisponibles(jeu)).toEqual(['Lyon', 'Paris'])
  })
})
