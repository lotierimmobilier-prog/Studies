/**
 * Le logement, en deux lignes au lieu d'une.
 *
 * Le moteur rendait un seul poste « loyer net » : le loyer moins l'APL. Pour
 * un studio à 311 € et une aide de 183 €, il affichait « Loyer Net −128 € »,
 * un montant qui n'est le loyer de personne et que rien ne permet de vérifier.
 *
 * La soustraction n'a pas changé de résultat — elle est écrite là où elle se
 * lit. Ces tests tiennent les deux : le détail est devenu lisible, et le
 * reste-à-vivre est resté le même au centime.
 */

import { describe, expect, it } from 'vitest'

import { ligneAideLogement, ligneLoyer } from '../postes.ts'
import type { LigneBudget, VoeuBudget } from '../types.ts'

const LOYER = {
  euroParM2: { bas: 9.956, central: 12.453, haut: 15.575 },
  millesime: '2025',
  source: 'Indicateur des loyers par commune (DGALN / ANIL)',
  qualite: 'commune' as const,
}

/** Agen, 25 m² : exactement le cas que l'élève avait sous les yeux. */
function voeu(modif: Partial<VoeuBudget> = {}): VoeuBudget {
  return {
    codeInsee: '47001',
    loyer: LOYER,
    surfaceHypotheseM2: 25,
    aplMensuelle: {
      montant: 183.17,
      source: 'OpenFisca France',
      millesime: '2026-09',
      hypothese: 'Étudiant locataire d’un logement vide à 47001',
    },
    transportMensuel: null,
    fraisScolariteAnnuels: null,
    fraisInstallation: null,
    assujettiCvec: true,
    ...modif,
  } as VoeuBudget
}

function montant(l: LigneBudget): number {
  if (l.statut !== 'calcule') throw new Error(`ligne ${l.poste} non calculée`)
  return l.mensualise
}

describe('le loyer et l’aide sont deux lignes', () => {
  const v = voeu()

  it('affiche le loyer que l’élève paie, pas le loyer moins l’aide', () => {
    // 12,453 €/m² × 25 m² = 311,325 €. C'est ce qu'on signe au bailleur.
    expect(montant(ligneLoyer(v, 'central'))).toBeCloseTo(311.325, 3)
  })

  it('affiche l’aide en ressource, à son montant simulé', () => {
    const aide = ligneAideLogement(v, 'central')
    expect(aide.sens).toBe('ressource')
    expect(montant(aide)).toBeCloseTo(183.17, 3)
  })

  it('laisse le reste-à-vivre inchangé : la différence est la même', () => {
    // L'ancien poste unique valait 311,325 − 183,17 = 128,155 €.
    const net = montant(ligneLoyer(v, 'central')) - montant(ligneAideLogement(v, 'central'))
    expect(net).toBeCloseTo(128.155, 3)
  })

  it('ne dit plus « charges comprises » sur la ligne de l’aide', () => {
    /* L'hypothèse du loyer porte cette mention ; celle de l'aide porte la
       sienne, rendue par le serveur. Les mélanger produisait la phrase de
       cinq lignes que l'élève avait sous les yeux. */
    const loyer = ligneLoyer(v, 'central')
    if (loyer.statut !== 'calcule') throw new Error('ligne attendue calculée')
    expect(loyer.valeur.hypothese).toContain('charges comprises')
    expect(loyer.valeur.hypothese).not.toMatch(/APL|OpenFisca/)
    expect(loyer.valeur.source).not.toMatch(/OpenFisca/)
  })
})

describe('quand l’aide dépasse le loyer', () => {
  /* Une APL supérieure au loyer rendrait le logement rentable. La CAF ne verse
     jamais plus que ce qui est dû au bailleur. */
  const v = voeu({
    loyer: { ...LOYER, euroParM2: { bas: 4, central: 5, haut: 6 } },
  })

  it('plafonne l’aide au loyer, et le dit', () => {
    const aide = ligneAideLogement(v, 'central')
    expect(montant(aide)).toBeCloseTo(125, 3) // 5 €/m² × 25 m²
    if (aide.statut !== 'calcule') throw new Error('ligne attendue calculée')
    expect(aide.valeur.hypothese).toContain('ramenée au loyer')
  })

  it('ne fait jamais gagner d’argent au logement', () => {
    const net = montant(ligneLoyer(v, 'central')) - montant(ligneAideLogement(v, 'central'))
    expect(net).toBe(0)
  })
})

describe('quand une donnée manque', () => {
  it('nomme la commune quand l’indicateur ne la couvre pas', () => {
    const sansLoyer = voeu({ loyer: null })
    for (const l of [ligneLoyer(sansLoyer, 'central'), ligneAideLogement(sansLoyer, 'central')]) {
      expect(l.statut).toBe('manquant')
      if (l.statut !== 'manquant') continue
      expect(l.raison).toContain('47001')
    }
  })

  it('garde le loyer quand seule l’APL manque', () => {
    /* Le loyer, lui, est connu : l'afficher comme manquant serait mentir sur
       ce qu'on sait. C'est l'aide qui n'a pas pu être simulée. */
    const sansApl = voeu({ aplMensuelle: null })
    expect(ligneLoyer(sansApl, 'central').statut).toBe('calcule')
    const aide = ligneAideLogement(sansApl, 'central')
    expect(aide.statut).toBe('manquant')
    if (aide.statut !== 'manquant') return
    expect(aide.raison).toMatch(/OpenFisca/)
  })
})

describe('les trois scénarios', () => {
  const v = voeu()

  it('prennent les trois bornes de l’intervalle publié', () => {
    expect(montant(ligneLoyer(v, 'optimiste'))).toBeCloseTo(9.956 * 25, 3)
    expect(montant(ligneLoyer(v, 'central'))).toBeCloseTo(12.453 * 25, 3)
    expect(montant(ligneLoyer(v, 'prudent'))).toBeCloseTo(15.575 * 25, 3)
  })

  it('nomment la borne dans l’hypothèse', () => {
    for (const [scenario, mot] of [
      ['optimiste', 'borne basse'],
      ['central', 'valeur centrale'],
      ['prudent', 'borne haute'],
    ] as const) {
      const l = ligneLoyer(v, scenario)
      if (l.statut !== 'calcule') throw new Error('ligne attendue calculée')
      expect(l.valeur.hypothese).toContain(mot)
    }
  })
})
