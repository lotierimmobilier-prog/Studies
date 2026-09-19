import { describe, expect, it } from 'vitest'

import { admissibilite, EFFECTIF_MINIMUM, moyenneEstimeeDesAdmis } from '../fourchette.ts'
import type { ProfilAdmission, StatsFormation } from '../types.ts'

const SOURCE = 'Parcoursup 2025, open data du ministère'

const STATS: StatsFormation = {
  session: '2025',
  capacite: 120,
  admisTotal: 100,
  tauxAcces: 40,
  admisBacGeneral: 70,
  admisBacTechno: 20,
  admisBacPro: 5,
  admisAutres: 5,
  admisBoursiers: 30,
  admisMemeAcademie: 60,
  admisSansMention: 10,
  admisMentionAB: 30,
  admisMentionB: 40,
  admisMentionTB: 15,
  admisMentionTBF: 5,
  selective: true,
}

const PROFIL: ProfilAdmission = {
  typeBac: 'general',
  moyenneGenerale: 14,
  boursier: false,
  memeAcademie: false,
}

describe('garde-fous', () => {
  it('refuse d’estimer sous 30 admis connus', () => {
    const r = admissibilite(PROFIL, { ...STATS, admisTotal: 29 }, SOURCE)
    expect(r.statut).toBe('effectif_insuffisant')
    if (r.statut !== 'effectif_insuffisant') return
    expect(r.raison).toContain('29 admis')
    expect(EFFECTIF_MINIMUM).toBe(30)
  })

  it('dit quand le taux d’accès n’est pas publié', () => {
    const r = admissibilite(PROFIL, { ...STATS, tauxAcces: null }, SOURCE)
    expect(r.statut).toBe('donnee_manquante')
  })

  it('rend toujours une fourchette, jamais un point', () => {
    const r = admissibilite(PROFIL, STATS, SOURCE)
    if (r.statut !== 'fourchette') throw new Error('fourchette attendue')
    expect(r.haut).toBeGreaterThan(r.bas)
  })

  it('élargit la fourchette quand les admis sont moins nombreux', () => {
    const peu = admissibilite(PROFIL, { ...STATS, admisTotal: 35 }, SOURCE)
    const beaucoup = admissibilite(PROFIL, { ...STATS, admisTotal: 1200 }, SOURCE)
    if (peu.statut !== 'fourchette' || beaucoup.statut !== 'fourchette') throw new Error('fourchettes attendues')
    expect(peu.haut - peu.bas).toBeGreaterThan(beaucoup.haut - beaucoup.bas)
  })

  it('reste dans les bornes 0 à 100', () => {
    const r = admissibilite(
      { ...PROFIL, moyenneGenerale: 20, memeAcademie: true, boursier: true },
      { ...STATS, tauxAcces: 98 },
      SOURCE,
    )
    if (r.statut !== 'fourchette') throw new Error('fourchette attendue')
    expect(r.bas).toBeGreaterThanOrEqual(0)
    expect(r.haut).toBeLessThanOrEqual(100)
  })
})

describe('moyenne estimée des admis', () => {
  it('se déduit de la répartition par mention', () => {
    // (10×11 + 30×13 + 40×15 + 15×17 + 5×19) / 100 = 1450 / 100 = 14,5
    expect(moyenneEstimeeDesAdmis(STATS)).toBeCloseTo(14.5, 2)
  })

  it('rend null quand aucune mention n’est publiée', () => {
    expect(
      moyenneEstimeeDesAdmis({
        ...STATS,
        admisSansMention: null,
        admisMentionAB: null,
        admisMentionB: null,
        admisMentionTB: null,
        admisMentionTBF: null,
      }),
    ).toBeNull()
  })
})

describe('facteurs', () => {
  function centre(p: ProfilAdmission, s: StatsFormation = STATS): number {
    const r = admissibilite(p, s, SOURCE)
    if (r.statut !== 'fourchette') throw new Error('fourchette attendue')
    return (r.bas + r.haut) / 2
  }

  it('monte avec la moyenne de l’élève', () => {
    expect(centre({ ...PROFIL, moyenneGenerale: 17 })).toBeGreaterThan(
      centre({ ...PROFIL, moyenneGenerale: 11 }),
    )
  })

  it('monte pour un bac majoritaire chez les admis, baisse pour un bac rare', () => {
    expect(centre({ ...PROFIL, typeBac: 'general' })).toBeGreaterThan(
      centre({ ...PROFIL, typeBac: 'professionnel' }),
    )
  })

  it('tient compte de l’académie, davantage hors formation sélective', () => {
    const ecartSelective =
      centre({ ...PROFIL, memeAcademie: true }) - centre({ ...PROFIL, memeAcademie: false })
    const nonSelective = { ...STATS, selective: false }
    const ecartNonSelective =
      centre({ ...PROFIL, memeAcademie: true }, nonSelective) -
      centre({ ...PROFIL, memeAcademie: false }, nonSelective)
    expect(ecartNonSelective).toBeGreaterThan(ecartSelective)
  })

  it('nomme chaque facteur pour que l’élève puisse lire le chiffre', () => {
    const r = admissibilite(PROFIL, STATS, SOURCE)
    if (r.statut !== 'fourchette') throw new Error('fourchette attendue')
    expect(r.facteurs.length).toBeGreaterThanOrEqual(3)
    expect(r.source).toBe(SOURCE)
    expect(r.millesime).toBe('2025')
    expect(r.tauxAccesPublie).toBe(40)
  })

  it('dit quand aucune note n’a été renseignée', () => {
    const r = admissibilite({ ...PROFIL, moyenneGenerale: null }, STATS, SOURCE)
    if (r.statut !== 'fourchette') throw new Error('fourchette attendue')
    expect(r.facteurs.join(' ')).toContain('Aucune note renseignée')
  })
})

describe('largeur de la fourchette', () => {
  it('ne dépasse jamais 40 points de large', () => {
    for (const admis of [30, 35, 50, 200, 5000]) {
      const r = admissibilite(PROFIL, { ...STATS, admisTotal: admis }, SOURCE)
      if (r.statut !== 'fourchette') throw new Error('fourchette attendue')
      expect(r.haut - r.bas).toBeLessThanOrEqual(40)
    }
  })

  it('reste d’au moins 10 points, même sur un très gros effectif', () => {
    const r = admissibilite(PROFIL, { ...STATS, admisTotal: 20000 }, SOURCE)
    if (r.statut !== 'fourchette') throw new Error('fourchette attendue')
    expect(r.haut - r.bas).toBeGreaterThanOrEqual(10)
  })
})
