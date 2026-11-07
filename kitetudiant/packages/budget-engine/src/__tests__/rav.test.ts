/**
 * Les 10 cas types de `docs/cas-types.md`, écrits avant le moteur.
 * Chaque montant attendu est recalculable à la main depuis les barèmes.
 */
import { describe, expect, it } from 'vitest'

import { calculerFourchetteRAV, calculerRAV, classerSoutenabilite } from '../rav.ts'
import type { MontantSource, ProfilEleve, VoeuBudget } from '../types.ts'

const LE_JOUR = '2026-09-19'

function montant(valeur: number, quoi: string): MontantSource {
  return { montant: valeur, source: `Source de test — ${quoi}`, millesime: '2026', hypothese: quoi }
}

const BOURSIER_ECHELON_5: ProfilEleve = {
  echelonBourse: '5',
  exonereCvec: false,
  eligibleAideMerite: true,
  eligibleAideMobiliteParcoursup: true,
  contributionFamilialeMensuelle: 150,
  jobEtudiantMensuel: { bas: 200, haut: 300 },
  aidesRegionalesAnnuelles: null,
  repasCrousParMois: 15,
  coursesMensuelles: 120,
  fraisDiversMensuels: 80,
}

function voeu(euroParM2: number, apl: number, surcharges: Partial<VoeuBudget> = {}): VoeuBudget {
  return {
    codeInsee: '87085',
    loyer: {
      euroParM2: { bas: euroParM2 - 2, central: euroParM2, haut: euroParM2 + 2 },
      millesime: '2025',
      source: 'Indicateur des loyers par commune, millésime 2025',
      qualite: 'commune',
    },
    surfaceHypotheseM2: 25,
    aplMensuelle: montant(apl, 'APL simulée'),
    transportMensuel: montant(30, 'abonnement urbain étudiant'),
    fraisScolariteAnnuels: montant(0, 'droits d’inscription, boursier exonéré'),
    fraisInstallation: montant(800, 'dépôt de garantie et premier équipement'),
    assujettiCvec: true,
    ...surcharges,
  }
}

describe('cas 1 — boursier échelon 5 à Limoges', () => {
  const resultat = calculerRAV(BOURSIER_ECHELON_5, voeu(9, 180), 'central', LE_JOUR)

  it('rend un RAV de 691,20 € par mois', () => {
    expect(resultat.ravMensuel).toBe(691.2)
    expect(resultat.soutenabilite).toBe('soutenable')
    expect(resultat.postesManquants).toEqual([])
  })

  it('détaille chaque ligne avec sa source, son millésime et son hypothèse', () => {
    for (const ligne of resultat.lignes) {
      if (ligne.statut !== 'calcule') continue
      expect(ligne.valeur.source.length).toBeGreaterThan(0)
      expect(ligne.valeur.millesime.length).toBeGreaterThan(0)
      expect(ligne.valeur.hypothese.length).toBeGreaterThan(0)
    }
  })

  it('fait remonter la bourse au montant exact du barème', () => {
    const bourse = resultat.lignes.find((l) => l.poste === 'bourse_crous')
    expect(bourse?.statut).toBe('calcule')
    if (bourse?.statut !== 'calcule') return
    expect(bourse.valeur.montant).toBe(521.2)
    expect(bourse.valeur.millesime).toBe('2023-03-15')
    expect(bourse.valeur.source).toContain('Arrêté du 13 avril 2023')
  })

  it('amortit l’aide au mérite sur 10 mensualités', () => {
    const merite = resultat.lignes.find((l) => l.poste === 'aide_merite')
    expect(merite?.statut).toBe('calcule')
    if (merite?.statut !== 'calcule') return
    expect(merite.valeur.montant).toBe(900)
    expect(merite.mensualise).toBe(90)
  })
})

describe('cas 2 — le même élève à Toulouse', () => {
  it('perd 112,50 € de reste-à-vivre, tout le reste égal', () => {
    const limoges = calculerRAV(BOURSIER_ECHELON_5, voeu(9, 180), 'central', LE_JOUR)
    const toulouse = calculerRAV(BOURSIER_ECHELON_5, voeu(13.5, 180), 'central', LE_JOUR)
    expect(toulouse.ravMensuel).toBe(578.7)
    expect((limoges.ravMensuel ?? 0) - (toulouse.ravMensuel ?? 0)).toBeCloseTo(112.5, 10)
  })
})

const NON_BOURSIER: ProfilEleve = {
  ...BOURSIER_ECHELON_5,
  echelonBourse: null,
  eligibleAideMerite: false,
  eligibleAideMobiliteParcoursup: false,
  contributionFamilialeMensuelle: 400,
  jobEtudiantMensuel: { bas: 150, haut: 250 },
  repasCrousParMois: 10,
  coursesMensuelles: 200,
  fraisDiversMensuels: 120,
}

function voeuParis(surcharges: Partial<VoeuBudget> = {}): VoeuBudget {
  return voeu(28, 150, {
    codeInsee: '75113',
    transportMensuel: montant(40, 'abonnement Île-de-France étudiant'),
    fraisScolariteAnnuels: montant(175, 'droits d’inscription en licence'),
    fraisInstallation: montant(1500, 'dépôt de garantie, agence et déménagement'),
    ...surcharges,
  })
}

describe('cas 3 — non boursier à Paris 13e', () => {
  const resultat = calculerRAV(NON_BOURSIER, voeuParis(), 'central', LE_JOUR)

  it('rend un RAV de −498 € et classe le vœu non finançable', () => {
    expect(resultat.ravMensuel).toBe(-498)
    expect(resultat.soutenabilite).toBe('non_financable')
  })

  it('facture la CVEC, que le boursier ne paie pas', () => {
    const scolarite = resultat.lignes.find((l) => l.poste === 'frais_scolarite')
    expect(scolarite?.statut).toBe('calcule')
    if (scolarite?.statut !== 'calcule') return
    expect(scolarite.valeur.montant).toBe(280) // 175 € de droits + 105 € de CVEC
    expect(scolarite.mensualise).toBe(28)
  })
})

describe('cas 4 et 5 — la zone tendue et sa borne', () => {
  it('classe tendu un RAV de 102 €', () => {
    const r = calculerRAV(
      { ...NON_BOURSIER, contributionFamilialeMensuelle: 1000 },
      voeuParis(),
      'central',
      LE_JOUR,
    )
    expect(r.ravMensuel).toBe(102)
    expect(r.soutenabilite).toBe('tendu')
  })

  it('classe tendu, et non soutenable, un RAV d’exactement 150 €', () => {
    const r = calculerRAV(
      { ...NON_BOURSIER, contributionFamilialeMensuelle: 1048 },
      voeuParis(),
      'central',
      LE_JOUR,
    )
    expect(r.ravMensuel).toBe(150)
    expect(r.soutenabilite).toBe('tendu')
  })

  it('bascule à soutenable un centime plus haut', () => {
    expect(classerSoutenabilite(150.01)).toBe('soutenable')
    expect(classerSoutenabilite(150)).toBe('tendu')
    expect(classerSoutenabilite(0)).toBe('tendu')
    expect(classerSoutenabilite(-0.01)).toBe('non_financable')
    expect(classerSoutenabilite(null)).toBe('indeterminable')
  })
})

describe('cas 6 — commune sans indicateur de loyer', () => {
  const resultat = calculerRAV(
    BOURSIER_ECHELON_5,
    voeu(9, 180, { codeInsee: '97611', loyer: null }),
    'central',
    LE_JOUR,
  )

  it('refuse de rendre un RAV plutôt que d’en inventer un', () => {
    expect(resultat.ravMensuel).toBeNull()
    expect(resultat.soutenabilite).toBe('indeterminable')
    expect(resultat.postesManquants).toContain('loyer')
    expect(resultat.postesManquants).toContain('aide_logement')
  })

  it('dit pourquoi la donnée manque, en nommant la commune', () => {
    const ligne = resultat.lignes.find((l) => l.poste === 'loyer')
    expect(ligne?.statut).toBe('manquant')
    if (ligne?.statut !== 'manquant') return
    expect(ligne.raison).toContain('97611')
  })
})

describe('cas 7 — APL non simulée', () => {
  it('ne calcule pas l’aide, même avec un loyer connu', () => {
    const resultat = calculerRAV(
      BOURSIER_ECHELON_5,
      voeu(9, 180, { aplMensuelle: null }),
      'central',
      LE_JOUR,
    )
    expect(resultat.ravMensuel).toBeNull()
    expect(resultat.postesManquants).toContain('aide_logement')
    // Le loyer, lui, reste connu : c'est l'aide qui manque, pas le logement.
    const loyer = resultat.lignes.find((l) => l.poste === 'loyer')
    expect(loyer?.statut).toBe('calcule')
    const ligne = resultat.lignes.find((l) => l.poste === 'aide_logement')
    if (ligne?.statut !== 'manquant') throw new Error('ligne attendue manquante')
    expect(ligne.raison).toMatch(/OpenFisca/)
  })
})

describe('cas 8 — droits d’inscription indisponibles', () => {
  it('marque le poste manquant et bloque le RAV', () => {
    const resultat = calculerRAV(
      NON_BOURSIER,
      voeuParis({ fraisScolariteAnnuels: null }),
      'central',
      LE_JOUR,
    )
    expect(resultat.ravMensuel).toBeNull()
    expect(resultat.postesManquants).toContain('frais_scolarite')
    const ligne = resultat.lignes.find((l) => l.poste === 'frais_scolarite')
    if (ligne?.statut !== 'manquant') throw new Error('ligne attendue manquante')
    expect(ligne.raison).toContain('Onisep')
  })
})

describe('cas 9 — ce que coûte exactement la CVEC', () => {
  it('sépare 10,50 € par mois entre un boursier et un non boursier', () => {
    const base = voeuParis({ fraisScolariteAnnuels: montant(175, 'droits d’inscription') })
    const nonBoursier = calculerRAV(NON_BOURSIER, base, 'central', LE_JOUR)
    const memeProfilExonere = calculerRAV(
      { ...NON_BOURSIER, exonereCvec: true },
      base,
      'central',
      LE_JOUR,
    )
    const ecart = (memeProfilExonere.ravMensuel ?? 0) - (nonBoursier.ravMensuel ?? 0)
    expect(ecart).toBeCloseTo(10.5, 10)
  })

  it('nomme la raison de l’exonération dans l’hypothèse', () => {
    const r = calculerRAV(BOURSIER_ECHELON_5, voeuParis(), 'central', LE_JOUR)
    const ligne = r.lignes.find((l) => l.poste === 'frais_scolarite')
    if (ligne?.statut !== 'calcule') throw new Error('ligne attendue calculée')
    expect(ligne.valeur.hypothese).toContain('CVEC nulle')
  })
})

describe('cas 10 — les trois scénarios et la qualité de l’estimation', () => {
  const surMaille = voeu(9, 180, {
    loyer: {
      euroParM2: { bas: 7, central: 9, haut: 11 },
      millesime: '2025',
      source: 'Indicateur des loyers par commune, millésime 2025',
      qualite: 'maille',
    },
  })
  const fourchette = calculerFourchetteRAV(BOURSIER_ECHELON_5, surMaille, LE_JOUR)

  it('ordonne optimiste, central puis prudent', () => {
    const { optimiste, central, prudent } = fourchette
    expect(optimiste.ravMensuel).toBeGreaterThan(central.ravMensuel ?? 0)
    expect(central.ravMensuel).toBeGreaterThan(prudent.ravMensuel ?? 0)
  })

  it('écarte optimiste et central de 95 €, APL comprise', () => {
    // Loyer : 7 €/m² × 25 = 175 €, sous les 180 € d'APL, donc l'aide est
    // ramenée à 175 € ; le logement coûte 0 € net au lieu de −5 €, et l'écart
    // de loyer vaut 45 € et non 50 €.
    // Job étudiant : 300 € au lieu de 250 €, soit 50 € de plus. Total 95 €.
    expect((fourchette.optimiste.ravMensuel ?? 0) - (fourchette.central.ravMensuel ?? 0)).toBeCloseTo(95, 10)
  })

  it('plafonne l’aide au loyer quand l’APL le dépasse', () => {
    const loyer = fourchette.optimiste.lignes.find((l) => l.poste === 'loyer')
    const aide = fourchette.optimiste.lignes.find((l) => l.poste === 'aide_logement')
    if (loyer?.statut !== 'calcule' || aide?.statut !== 'calcule') {
      throw new Error('lignes attendues calculées')
    }
    // 7 €/m² × 25 m² = 175 €, pour une APL simulée à 180 €.
    expect(loyer.valeur.montant).toBeCloseTo(175, 10)
    expect(aide.valeur.montant).toBeCloseTo(175, 10)
    expect(aide.valeur.hypothese).toContain('ramenée au loyer')
    // Le logement ne rapporte rien : les deux lignes s'annulent, jamais plus.
    expect(aide.mensualise - loyer.mensualise).toBe(0)
  })

  it('avertit que le loyer n’est pas estimé au niveau communal', () => {
    expect(fourchette.central.avertissements.join(' ')).toContain('maille')
  })
})
