import { describe, it, expect } from 'vitest'
import type { ResultatSimulation } from '../../types'
import {
  chargerListe,
  sauvegarderListe,
  basculerVoeu,
  exporterTexte,
  versVoeu,
  type Stockage,
  type VoeuSauve,
} from '../liste'

/** Stockage en mémoire pour simuler localStorage. */
function fakeStockage(initial: Record<string, string> = {}): Stockage {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

const voeu = (id: string): VoeuSauve => ({
  id,
  nom: `Formation ${id}`,
  etablissement: 'Établissement',
  ville: 'Lyon',
  probabilite: 60,
})

describe('versVoeu', () => {
  it('extrait un instantané depuis un résultat', () => {
    const r = {
      formation: { id: 'x', nom: 'Licence', etablissement: 'UdL', ville: 'Lyon' },
      probabilite: 72,
    } as ResultatSimulation
    expect(versVoeu(r)).toEqual({
      id: 'x',
      nom: 'Licence',
      etablissement: 'UdL',
      ville: 'Lyon',
      probabilite: 72,
    })
  })
})

describe('basculerVoeu', () => {
  it('ajoute puis retire un vœu', () => {
    const apres = basculerVoeu([], voeu('a'))
    expect(apres.map((v) => v.id)).toEqual(['a'])
    expect(basculerVoeu(apres, voeu('a'))).toHaveLength(0)
  })
})

describe('chargerListe / sauvegarderListe', () => {
  it('persiste et recharge', () => {
    const s = fakeStockage()
    sauvegarderListe([voeu('a'), voeu('b')], s)
    expect(chargerListe(s).map((v) => v.id)).toEqual(['a', 'b'])
  })

  it('renvoie [] sur données absentes ou corrompues', () => {
    expect(chargerListe(fakeStockage())).toEqual([])
    expect(chargerListe(fakeStockage({ 'parcoursup.maliste.v1': 'pas du json' }))).toEqual([])
  })

  it('tolère l’absence de stockage', () => {
    expect(chargerListe(null)).toEqual([])
    expect(() => sauvegarderListe([voeu('a')], null)).not.toThrow()
  })
})

describe('exporterTexte', () => {
  it('formate un récapitulatif numéroté', () => {
    const txt = exporterTexte([voeu('a')])
    expect(txt).toContain('Ma liste de vœux Parcoursup')
    expect(txt).toContain('1. Formation a — Établissement (Lyon) · ~60% de chances')
  })
  it('gère la liste vide', () => {
    expect(exporterTexte([])).toContain('(vide)')
  })
})
