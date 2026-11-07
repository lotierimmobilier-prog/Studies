/**
 * Le module de barèmes est le seul endroit d'où un euro a le droit de sortir.
 * Ces tests vérifient qu'il ne triche jamais : pas d'extrapolation, pas de
 * repli, et une source pour chaque montant.
 */
import { describe, expect, it } from 'vitest'

import {
  BAREMES,
  estIndisponible,
  estPerime,
  montantApplicable,
  montantIndexe,
  valeurApplicable,
  type CleBareme,
} from '../index.ts'

describe('structure des barèmes', () => {
  it('donne à chaque valeur datée au moins une référence officielle', () => {
    for (const [cle, bareme] of Object.entries(BAREMES)) {
      for (const date of Object.keys(bareme.valeurs_par_date)) {
        const refs = bareme.references_par_date[date] ?? []
        expect(refs.length, `${cle} au ${date} n’a aucune référence`).toBeGreaterThan(0)
        expect(
          refs.some((r) => (r.href ?? '').length > 0 || (r.title ?? '').length > 0),
          `${cle} au ${date} a une référence vide`,
        ).toBe(true)
      }
    }
  })

  it('date toutes les entrées au format ISO', () => {
    for (const [cle, bareme] of Object.entries(BAREMES)) {
      for (const date of Object.keys(bareme.valeurs_par_date)) {
        expect(date, `${cle} : date mal formée`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('dit d’où vient chaque barème et quand il a été extrait', () => {
    for (const [cle, bareme] of Object.entries(BAREMES)) {
      expect(bareme.provenance.origine.length, cle).toBeGreaterThan(0)
      expect(bareme.provenance.extrait_le, cle).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('choix du millésime', () => {
  it('retient la dernière valeur entrée en vigueur avant la date demandée', () => {
    const r = valeurApplicable('bourse_criteres_sociaux', '2022-12-31')
    if (estIndisponible(r)) throw new Error(r.raison)
    expect(r.millesime).toBe('2022-07-18')
  })

  it('bascule sur le millésime suivant le jour de son entrée en vigueur', () => {
    const veille = valeurApplicable('bourse_criteres_sociaux', '2023-03-14')
    const jour = valeurApplicable('bourse_criteres_sociaux', '2023-03-15')
    if (estIndisponible(veille) || estIndisponible(jour)) throw new Error('millésime introuvable')
    expect(veille.millesime).toBe('2022-07-18')
    expect(jour.millesime).toBe('2023-03-15')
  })

  it('refuse de répondre avant la première valeur connue, sans rien extrapoler', () => {
    const r = valeurApplicable('bourse_criteres_sociaux', '2000-01-01')
    expect(estIndisponible(r)).toBe(true)
    if (!estIndisponible(r)) return
    expect(r.raison).toContain('2015-07-15')
  })
})

describe('barème vide', () => {
  it('rend une indisponibilité motivée pour les droits d’inscription', () => {
    const r = montantApplicable('droits_inscription', '2026-09-19')
    expect(estIndisponible(r)).toBe(true)
    if (!estIndisponible(r)) return
    expect(r.raison).toContain('aucune valeur')
  })
})

describe('échelons de bourse', () => {
  it('nomme l’échelon 0 bis par son libellé officiel', () => {
    const r = montantIndexe('bourse_criteres_sociaux', '0bis', '2026-09-19')
    if (estIndisponible(r)) throw new Error(r.raison)
    expect(r.valeur).toBe(145.4)
  })

  it('refuse un échelon qui n’existe pas, en listant ceux qui existent', () => {
    const r = montantIndexe('bourse_criteres_sociaux', '8', '2026-09-19')
    expect(estIndisponible(r)).toBe(true)
    if (!estIndisponible(r)) return
    expect(r.raison).toContain('0bis')
  })

  it('distingue une table d’un montant unique', () => {
    expect(estIndisponible(montantApplicable('bourse_criteres_sociaux', '2026-09-19'))).toBe(true)
    expect(estIndisponible(montantIndexe('cvec', '1', '2026-09-19'))).toBe(true)
  })
})

describe('fraîcheur', () => {
  it('signale un barème dont la dernière vérification est dépassée', () => {
    const r = valeurApplicable('bourse_criteres_sociaux', '2026-09-19')
    if (estIndisponible(r)) throw new Error(r.raison)
    expect(r.verifieLe).toBe('2025-08-20')
    expect(estPerime(r, '2026-09-19')).toBe(true)
    expect(estPerime(r, '2025-01-01')).toBe(false)
  })
})

describe('montants réglementaires attendus au 19 septembre 2026', () => {
  const attendus: ReadonlyArray<readonly [CleBareme, number]> = [
    ['aide_merite', 900],
    ['aide_mobilite_parcoursup', 500],
    ['bourse_nombre_mensualites', 10],
    ['cvec', 105],
    ['repas_crous_boursier', 1],
    ['repas_crous_non_boursier', 1],
  ]

  it.each(attendus)('%s vaut %d', (cle, valeur) => {
    const r = montantApplicable(cle, '2026-09-19')
    if (estIndisponible(r)) throw new Error(r.raison)
    expect(r.valeur).toBe(valeur)
  })
})
