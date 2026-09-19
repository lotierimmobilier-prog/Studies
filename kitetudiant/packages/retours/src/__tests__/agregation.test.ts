import { describe, expect, it } from 'vitest'

import { agreger, archive, distribution, evolutionDuCout, millesimesDe, quantile } from '../agregation.ts'
import { RETOURS_MINIMUM, type Retour } from '../types.ts'

const LE_JOUR = '2026-09-19T00:00:00Z'

function retour(
  codFormation: string,
  millesime: string,
  cout: number,
  logement = 3,
  ambiance = 4,
): Retour {
  return {
    id: `${codFormation}-${millesime}-${cout}`,
    codFormation,
    millesime,
    coutReelMensuel: cout,
    faciliteLogement: logement,
    ambiance,
    anneeEtudes: 1,
    collecteLe: LE_JOUR,
  }
}

const CINQ = [520, 540, 560, 600, 700].map((c) => retour('2519', '2026-2027', c))

describe('quantiles', () => {
  it('rend la valeur unique d’une série à un élément', () => {
    expect(quantile([12], 0.5)).toBe(12)
  })

  it('interpole entre deux valeurs encadrantes', () => {
    expect(quantile([10, 20], 0.5)).toBe(15)
    expect(quantile([0, 10, 20, 30], 0.25)).toBe(7.5)
  })

  it('refuse une série vide plutôt que de rendre zéro', () => {
    expect(() => quantile([], 0.5)).toThrow()
  })
})

describe('distribution', () => {
  it('trie avant de calculer, quel que soit l’ordre d’arrivée', () => {
    const a = distribution([700, 520, 600, 540, 560])
    const b = distribution([520, 540, 560, 600, 700])
    expect(a).toEqual(b)
    expect(a.median).toBe(560)
    expect(a.minimum).toBe(520)
    expect(a.maximum).toBe(700)
  })
})

describe('seuil de publication', () => {
  it('ne publie rien en dessous du seuil, et dit combien il manque', () => {
    const r = agreger('2519', '2026-2027', CINQ.slice(0, 4), LE_JOUR)
    expect(r.statut).toBe('trop_peu_de_retours')
    if (r.statut !== 'trop_peu_de_retours') return
    expect(r.nombreRetours).toBe(4)
    expect(r.raison).toContain(String(RETOURS_MINIMUM))
  })

  it('publie dès que le seuil est atteint', () => {
    const r = agreger('2519', '2026-2027', CINQ, LE_JOUR)
    expect(r.statut).toBe('publie')
    if (r.statut !== 'publie') return
    expect(r.nombreRetours).toBe(5)
    expect(r.coutReelMensuel.median).toBe(560)
    expect(r.source).toContain('2026-2027')
    expect(r.calculeLe).toBe(LE_JOUR)
  })

  it('accorde le singulier quand il n’y a qu’un retour', () => {
    const r = agreger('2519', '2026-2027', CINQ.slice(0, 1), LE_JOUR)
    if (r.statut !== 'trop_peu_de_retours') throw new Error('attendu sous le seuil')
    expect(r.raison).toContain('1 retour sur')
  })
})

describe('étanchéité des millésimes et des formations', () => {
  it('ne mélange pas deux années', () => {
    const melange = [...CINQ, ...[900, 950, 1000].map((c) => retour('2519', '2025-2026', c))]
    const r = agreger('2519', '2026-2027', melange, LE_JOUR)
    if (r.statut !== 'publie') throw new Error('publication attendue')
    expect(r.nombreRetours).toBe(5)
    expect(r.coutReelMensuel.maximum).toBe(700)
  })

  it('ne mélange pas deux formations', () => {
    const melange = [...CINQ, ...[100, 110, 120].map((c) => retour('9999', '2026-2027', c))]
    const r = agreger('2519', '2026-2027', melange, LE_JOUR)
    if (r.statut !== 'publie') throw new Error('publication attendue')
    expect(r.coutReelMensuel.minimum).toBe(520)
  })
})

describe('archives par année', () => {
  const deuxAns = [
    ...CINQ,
    ...[480, 500, 510, 540, 620].map((c) => retour('2519', '2025-2026', c)),
    retour('2519', '2024-2025', 470),
  ]

  it('liste les millésimes du plus récent au plus ancien', () => {
    expect(millesimesDe('2519', deuxAns)).toEqual(['2026-2027', '2025-2026', '2024-2025'])
  })

  it('garde une année sous le seuil dans l’archive, avec sa raison', () => {
    const a = archive('2519', deuxAns, LE_JOUR)
    expect(a).toHaveLength(3)
    expect(a[0]?.statut).toBe('publie')
    expect(a[1]?.statut).toBe('publie')
    expect(a[2]?.statut).toBe('trop_peu_de_retours')
  })

  it('mesure l’évolution du coût médian entre deux années publiées', () => {
    const e = evolutionDuCout(archive('2519', deuxAns, LE_JOUR))
    expect(e).not.toBeNull()
    expect(e?.de).toBe('2025-2026')
    expect(e?.vers).toBe('2026-2027')
    expect(e?.ecartEuros).toBe(50) // médiane 560 contre 510
  })

  it('ne compare pas avec une année sous le seuil', () => {
    const uneSeuleAnneePubliee = [...CINQ, retour('2519', '2025-2026', 400)]
    expect(evolutionDuCout(archive('2519', uneSeuleAnneePubliee, LE_JOUR))).toBeNull()
  })
})

describe('ce que le module ne fait pas', () => {
  it('ne produit aucune note globale d’établissement', () => {
    const r = agreger('2519', '2026-2027', CINQ, LE_JOUR)
    const cles = Object.keys(r).join(' ')
    expect(cles).not.toMatch(/global|etablissement|note/i)
  })

  it('ne collecte aucun texte libre : le type n’en a pas', () => {
    const r = CINQ[0] as Retour
    for (const valeur of Object.values(r)) {
      if (typeof valeur !== 'string') continue
      // Seuls des identifiants, un millésime et une date sont des chaînes.
      expect(valeur.length).toBeLessThan(40)
    }
  })
})
