import { describe, it, expect } from 'vitest'

import { estUnChoix, troisChoix, type Proposition } from '../recommandations.ts'
import type { ResultatFormation } from '../calcul.ts'
import { euros } from '../nombres.ts'

/**
 * Fabrique un résultat minimal. On ne construit que ce que les trois choix
 * regardent : le reste n'entre pas dans la décision, et le mettre ici
 * laisserait croire le contraire.
 */
function resultat(options: {
  id: string
  codeInsee: string | null
  affinite: number
  domaineInconnu?: boolean
  admissible?: boolean
  tauxAcces?: number
  haut?: number
  rav: number | null
}): ResultatFormation {
  const adm = options.admissible === false
    ? { statut: 'donnee_manquante' as const, raison: 'pas de statistique publiée' }
    : {
        statut: 'fourchette' as const,
        bas: 10,
        haut: options.haut ?? 50,
        tauxAccesPublie: options.tauxAcces ?? 30,
        effectifAdmis: 120,
        source: 'Parcoursup',
        millesime: '2025',
        facteurs: [],
      }
  return {
    formation: {
      id: options.id,
      libelle: `Formation ${options.id}`,
      etablissement: `Établissement ${options.id}`,
      ville: 'Ville',
      departement: '87',
      academie: 'Limoges',
      codeInsee: options.codeInsee,
    },
    parScenario: {
      central: { ravMensuel: options.rav },
      prudent: { ravMensuel: options.rav },
      optimiste: { ravMensuel: options.rav },
    },
    raisonAide: null,
    affinite: {
      score: options.affinite,
      domaineInconnu: options.domaineInconnu ?? false,
      raisons: [],
    },
    admissibilite: adm,
  } as unknown as ResultatFormation
}

/** Limoges 45.85/1.25 · Toulouse 43.60/1.43 · Paris 13e 48.86/2.34 */
const LIMOGES = '87085'
const TOULOUSE = '31555'
const PARIS = '75113'

function critere(p: readonly Proposition[], nom: string): Proposition {
  return p.find((x) => x.critere === nom)!
}

describe('les trois choix', () => {
  const jeu = [
    resultat({ id: 'a', codeInsee: PARIS, affinite: 90, rav: -200, haut: 40 }),
    resultat({ id: 'b', codeInsee: LIMOGES, affinite: 40, rav: 380 }),
    resultat({ id: 'c', codeInsee: TOULOUSE, affinite: 70, rav: 120 }),
  ]

  it('propose toujours les trois, dans le même ordre', () => {
    const p = troisChoix(jeu, null, false)
    expect(p.map((x) => x.critere)).toEqual(['geographique', 'strategique', 'economique'])
  })

  it('choisit la plus proche pour le critère géographique', () => {
    // Un élève à Brive : Limoges est à ~70 km, Toulouse à ~200, Paris à ~400.
    const p = troisChoix(jeu, { lat: 45.16, lon: 1.53 }, false)
    const geo = critere(p, 'geographique')
    expect(estUnChoix(geo) && geo.resultat.formation.id).toBe('b')
    expect(estUnChoix(geo) && geo.valeur).toMatch(/à \d+ km/)
  })

  it('dit « dans ta commune » quand on y est', () => {
    const p = troisChoix(jeu, { lat: 45.85, lon: 1.25 }, false)
    const geo = critere(p, 'geographique')
    expect(estUnChoix(geo) && geo.valeur).toBe('dans ta commune')
  })

  it('choisit la meilleure correspondance pour le critère stratégique', () => {
    const p = troisChoix(jeu, null, false)
    const strat = critere(p, 'strategique')
    expect(estUnChoix(strat) && strat.resultat.formation.id).toBe('a')
    expect(estUnChoix(strat) && strat.valeur).toBe('90/100 de correspondance')
  })

  it('ne promet aucune prévision de carrière', () => {
    const strat = critere(troisChoix(jeu, null, false), 'strategique')
    expect(estUnChoix(strat) && strat.pourquoi).toMatch(/pas une prévision de carrière/)
  })

  it('choisit le meilleur reste-à-vivre pour le critère économique', () => {
    const eco = critere(troisChoix(jeu, null, false), 'economique')
    expect(estUnChoix(eco) && eco.resultat.formation.id).toBe('b')
    // Comparé à la mise en forme partagée plutôt qu'à une chaîne recopiée :
    // les espaces y sont insécables, et une chaîne écrite à la main dériverait
    // au premier changement de typographie.
    expect(estUnChoix(eco) && eco.valeur).toBe(`${euros(380)} par mois`)
  })

  it('ne choisit jamais deux fois le même critère au même endroit', () => {
    // Les trois critères peuvent désigner la même formation — c'est même un bon
    // signe — mais chacun doit le justifier par SON chiffre, pas par celui d'un
    // autre.
    const unique = [resultat({ id: 'z', codeInsee: LIMOGES, affinite: 80, rav: 500 })]
    const p = troisChoix(unique, { lat: 45.85, lon: 1.25 }, false)
    const valeurs = p.filter(estUnChoix).map((x) => x.valeur)
    expect(new Set(valeurs).size).toBe(3)
  })
})

describe('les absences sont motivées, jamais silencieuses', () => {
  const jeu = [resultat({ id: 'a', codeInsee: LIMOGES, affinite: 50, rav: 300 })]

  it('sans position, le choix géographique explique ce qui manque', () => {
    const geo = critere(troisChoix(jeu, null, false), 'geographique')
    expect(estUnChoix(geo)).toBe(false)
    expect(!estUnChoix(geo) && geo.raison).toMatch(/position/)
  })

  it('sans compte, le choix économique renvoie vers l’inscription', () => {
    const eco = critere(troisChoix(jeu, null, true), 'economique')
    expect(estUnChoix(eco)).toBe(false)
    expect(!estUnChoix(eco) && eco.raison).toMatch(/compte/)
  })

  it('sans reste-à-vivre calculable, il le dit plutôt que de se taire', () => {
    const sansRav = [resultat({ id: 'a', codeInsee: LIMOGES, affinite: 50, rav: null })]
    const eco = critere(troisChoix(sansRav, null, false), 'economique')
    expect(!estUnChoix(eco) && eco.raison).toMatch(/loyer|aide au logement/)
  })

  it('sans statistique d’admission, le choix stratégique s’abstient', () => {
    const sansStats = [
      resultat({ id: 'a', codeInsee: LIMOGES, affinite: 50, rav: 300, admissible: false }),
    ]
    const strat = critere(troisChoix(sansStats, null, false), 'strategique')
    expect(estUnChoix(strat)).toBe(false)
  })

  it('une commune sans position ne fait pas disparaître le critère pour les autres', () => {
    const mixte = [
      resultat({ id: 'inconnue', codeInsee: null, affinite: 99, rav: 900 }),
      resultat({ id: 'connue', codeInsee: TOULOUSE, affinite: 10, rav: 10 }),
    ]
    const geo = critere(troisChoix(mixte, { lat: 43.6, lon: 1.43 }, false), 'geographique')
    expect(estUnChoix(geo) && geo.resultat.formation.id).toBe('connue')
  })
})
