/**
 * Le front ne calcule pas d'euros : il assemble des entrées réelles et lit ce
 * que le moteur rend. Ces tests vérifient l'assemblage et les règles d'affichage.
 */
import { describe, expect, it } from 'vitest'

import {
  calculerResultats,
  jumeauxGeographiques,
  loyerMensuelBrut,
  refAide,
  trierParRAV,
  type Reponses,
  type ResultatFormation,
} from '../calcul.ts'
import { codeInseeDe, loyerDe, normaliser, type AideLogement, type Formation } from '../donnees.ts'
import { REPONSES_PAR_DEFAUT } from '../parcours.tsx'

const LE_JOUR = '2026-09-19'

const REPONSES: Reponses = {
  ...REPONSES_PAR_DEFAUT,
  filiere: 'Licence',
  echelonBourse: '5',
  contributionFamiliale: 150,
  jobBas: 200,
  jobHaut: 300,
  repasCrousParMois: 15,
  coursesMensuelles: 120,
  fraisDiversMensuels: 80,
  surfaceM2: 25,
  transportMensuel: 30,
  fraisScolariteAnnuels: 0,
  fraisInstallation: 800,
}

function formation(id: string, ville: string, dep: string, filiere = 'Licence'): Formation {
  return {
    id,
    libelle: `${filiere} de test`,
    etablissement: 'Établissement de test',
    ville,
    departement: dep,
    academie: 'Limoges',
    filiere,
    selective: false,
    capacite: 100,
    admis: 80,
    tauxAcces: 62,
    partBoursiers: 30,
    lien: null,
    session: '2025',
    codeInsee: codeInseeDe(ville, dep),
  }
}

function aide(ref: string, montant: number): AideLogement {
  return {
    ref,
    aide: {
      montant,
      source: 'OpenFisca France',
      millesime: '2026-09',
      hypothese: 'test',
    },
  }
}

describe('résolution des communes réelles', () => {
  it('retrouve le code INSEE de villes du jeu Parcoursup', () => {
    expect(codeInseeDe('Limoges', '87')).toBe('87085')
    expect(codeInseeDe('Toulouse', '31')).toBe('31555')
  })

  it('gère les arrondissements de Paris, que l’indicateur de loyers découpe', () => {
    expect(codeInseeDe('Paris 13e  Arrondissement', '75')).toBe('75113')
  })

  it('normalise les ligatures et les Saint abrégés', () => {
    expect(normaliser('Vandœuvre-lès-Nancy')).toBe('vandoeuvre les nancy')
    expect(normaliser('St-Étienne')).toBe('saint etienne')
  })

  it('rend null pour une ville hors du jeu, sans rien deviner', () => {
    expect(codeInseeDe('Bruxelles', '99')).toBeNull()
    expect(loyerDe(null)).toBeNull()
  })

  it('donne un loyer encadré par ses bornes', () => {
    const loyer = loyerDe('87085')
    expect(loyer).not.toBeNull()
    if (loyer === null) return
    expect(loyer.euroParM2.bas).toBeLessThanOrEqual(loyer.euroParM2.central)
    expect(loyer.euroParM2.central).toBeLessThanOrEqual(loyer.euroParM2.haut)
    expect(loyer.millesime).toMatch(/^\d{4}$/)
  })
})

describe('loyer mensuel envoyé à OpenFisca', () => {
  it('monte avec le scénario prudent et baisse avec l’optimiste', () => {
    const f = formation('1', 'Limoges', '87')
    const bas = loyerMensuelBrut(f, REPONSES, 'optimiste')
    const central = loyerMensuelBrut(f, REPONSES, 'central')
    const haut = loyerMensuelBrut(f, REPONSES, 'prudent')
    expect(bas).not.toBeNull()
    expect(bas!).toBeLessThan(central!)
    expect(central!).toBeLessThan(haut!)
  })

  it('rend null quand la commune n’a pas d’indicateur', () => {
    expect(loyerMensuelBrut(formation('2', 'Bruxelles', '99'), REPONSES, 'central')).toBeNull()
  })
})

describe('résultats', () => {
  const f = formation('10', 'Limoges', '87')
  const aides = new Map<string, AideLogement>([
    [refAide('10', 'optimiste'), aide(refAide('10', 'optimiste'), 180)],
    [refAide('10', 'central'), aide(refAide('10', 'central'), 180)],
    [refAide('10', 'prudent'), aide(refAide('10', 'prudent'), 180)],
  ])

  it('calcule un reste-à-vivre et détaille chaque ligne avec sa source', () => {
    const [resultat] = calculerResultats([f], REPONSES, aides, LE_JOUR)
    expect(resultat).toBeDefined()
    if (!resultat) return
    expect(resultat.parScenario.central.ravMensuel).not.toBeNull()
    for (const ligne of resultat.parScenario.central.lignes) {
      if (ligne.statut !== 'calcule') continue
      expect(ligne.valeur.source.length).toBeGreaterThan(0)
      expect(ligne.valeur.millesime.length).toBeGreaterThan(0)
    }
  })

  it('refuse de calculer quand l’aide au logement manque, et dit pourquoi', () => {
    const sansAide = new Map<string, AideLogement>([
      [refAide('10', 'central'), { ref: refAide('10', 'central'), raison: 'OpenFisca injoignable' }],
    ])
    const [resultat] = calculerResultats([f], REPONSES, sansAide, LE_JOUR)
    if (!resultat) throw new Error('résultat attendu')
    expect(resultat.parScenario.central.ravMensuel).toBeNull()
    expect(resultat.parScenario.central.postesManquants).toContain('loyer_net')
    expect(resultat.raisonAide).toBe('OpenFisca injoignable')
  })

  it('garde dans la liste les vœux non calculables, en dernier', () => {
    const calculable = calculerResultats([f], REPONSES, aides, LE_JOUR)[0]
    const inconnu = calculerResultats(
      [formation('11', 'Bruxelles', '99')],
      REPONSES,
      new Map(),
      LE_JOUR,
    )[0]
    if (!calculable || !inconnu) throw new Error('résultats attendus')
    const tries = trierParRAV([inconnu, calculable])
    expect(tries).toHaveLength(2)
    expect(tries[0]?.formation.id).toBe('10')
    expect(tries[1]?.formation.id).toBe('11')
  })
})

describe('jumeaux géographiques', () => {
  function avecRav(id: string, ville: string, dep: string, rav: number): ResultatFormation {
    return {
      formation: formation(id, ville, dep),
      parScenario: {
        optimiste: { ravMensuel: rav, lignes: [], postesManquants: [], soutenabilite: 'soutenable', avertissements: [], scenario: 'optimiste', dateDeCalcul: LE_JOUR },
        central: { ravMensuel: rav, lignes: [], postesManquants: [], soutenabilite: 'soutenable', avertissements: [], scenario: 'central', dateDeCalcul: LE_JOUR },
        prudent: { ravMensuel: rav, lignes: [], postesManquants: [], soutenabilite: 'soutenable', avertissements: [], scenario: 'prudent', dateDeCalcul: LE_JOUR },
      },
      raisonAide: null,
    }
  }

  it('ne propose que des villes où il reste davantage, et dit l’écart', () => {
    const cible = avecRav('a', 'Toulouse', '31', 500)
    const tous = [cible, avecRav('b', 'Limoges', '87', 580), avecRav('c', 'Lyon', '69', 420)]
    const jumeaux = jumeauxGeographiques(tous, cible)
    expect(jumeaux).toHaveLength(1)
    expect(jumeaux[0]?.resultat.formation.ville).toBe('Limoges')
    expect(jumeaux[0]?.ecart).toBe(80)
  })

  it('ne compare pas des filières différentes', () => {
    const cible = avecRav('a', 'Toulouse', '31', 500)
    const autre = avecRav('b', 'Limoges', '87', 580)
    const autreFiliere: ResultatFormation = {
      ...autre,
      formation: { ...autre.formation, filiere: 'BTS' },
    }
    expect(jumeauxGeographiques([cible, autreFiliere], cible)).toHaveLength(0)
  })
})
