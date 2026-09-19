/**
 * Passage du profil déclaré et d'une formation réelle au reste-à-vivre.
 *
 * Tout le calcul monétaire est délégué au moteur budgétaire ; ce module ne fait
 * que rassembler les entrées et les étiqueter.
 */

import { calculerFourchetteRAV } from '../../packages/budget-engine/src/rav.ts'
import type {
  EchelonBourse,
  MontantSource,
  ProfilEleve,
  ResultatRAV,
  Scenario,
  VoeuBudget,
} from '../../packages/budget-engine/src/types.ts'

import { loyerDe, type AideLogement, type Formation } from './donnees.ts'

export interface Reponses {
  readonly typeBac: string
  readonly villeResidence: string
  readonly mobilite: 'meme_ville' | 'meme_region' | 'france'
  readonly filiere: string
  readonly academie: string | null
  readonly echelonBourse: EchelonBourse | null
  readonly echelonInconnu: boolean
  readonly anneeNaissance: number
  readonly contributionFamiliale: number
  readonly jobBas: number
  readonly jobHaut: number
  readonly repasCrousParMois: number
  readonly coursesMensuelles: number
  readonly fraisDiversMensuels: number
  readonly surfaceM2: number
  readonly transportMensuel: number
  readonly fraisScolariteAnnuels: number
  readonly fraisInstallation: number
}

const DECLARATIF = 'Saisie déclarative de l’élève'

function declare(montant: number, hypothese: string): MontantSource {
  return { montant, source: DECLARATIF, millesime: 'déclaratif', hypothese }
}

export function profilDepuisReponses(r: Reponses): ProfilEleve {
  return {
    echelonBourse: r.echelonBourse,
    exonereCvec: false,
    eligibleAideMerite: false,
    eligibleAideMobiliteParcoursup: false,
    contributionFamilialeMensuelle: r.contributionFamiliale,
    jobEtudiantMensuel: { bas: r.jobBas, haut: r.jobHaut },
    aidesRegionalesAnnuelles: null,
    repasCrousParMois: r.repasCrousParMois,
    coursesMensuelles: r.coursesMensuelles,
    fraisDiversMensuels: r.fraisDiversMensuels,
  }
}

/** Loyer mensuel brut d'un scénario, ce qu'il faut envoyer à OpenFisca. */
export function loyerMensuelBrut(formation: Formation, r: Reponses, scenario: Scenario): number | null {
  const loyer = loyerDe(formation.codeInsee)
  if (loyer === null) return null
  const m2 =
    scenario === 'optimiste'
      ? loyer.euroParM2.bas
      : scenario === 'prudent'
        ? loyer.euroParM2.haut
        : loyer.euroParM2.central
  return Math.round(m2 * r.surfaceM2 * 100) / 100
}

export const SCENARIOS: readonly Scenario[] = ['optimiste', 'central', 'prudent']

/** Clé d'appariement entre une demande d'aide et son scénario. */
export function refAide(formationId: string, scenario: Scenario): string {
  return `${formationId}::${scenario}`
}

export function voeuDepuisFormation(
  formation: Formation,
  r: Reponses,
  aides: ReadonlyMap<string, AideLogement>,
  scenario: Scenario,
): VoeuBudget {
  const aide = aides.get(refAide(formation.id, scenario))
  const aplMensuelle: MontantSource | null =
    aide && 'aide' in aide ? aide.aide : null
  return {
    codeInsee: formation.codeInsee,
    loyer: loyerDe(formation.codeInsee),
    surfaceHypotheseM2: r.surfaceM2,
    aplMensuelle,
    transportMensuel: declare(r.transportMensuel, 'abonnement de transport déclaré'),
    fraisScolariteAnnuels: declare(
      r.fraisScolariteAnnuels,
      'droits d’inscription déclarés, faute de source déterministe',
    ),
    fraisInstallation: declare(
      r.fraisInstallation,
      'frais d’installation déclarés : dépôt de garantie, déménagement, premier équipement',
    ),
    assujettiCvec: !/^BTS/i.test(formation.filiere),
  }
}

export interface ResultatFormation {
  readonly formation: Formation
  readonly parScenario: Readonly<Record<Scenario, ResultatRAV>>
  /** Raison de l'absence d'aide au logement, à afficher telle quelle. */
  readonly raisonAide: string | null
}

export function calculerResultats(
  formations: readonly Formation[],
  reponses: Reponses,
  aides: ReadonlyMap<string, AideLogement>,
  aLaDate: string,
): ResultatFormation[] {
  const profil = profilDepuisReponses(reponses)
  return formations.map((formation) => {
    const aide = aides.get(refAide(formation.id, 'central'))
    return {
      formation,
      parScenario: {
        optimiste: calculerFourchetteRAV(
          profil,
          voeuDepuisFormation(formation, reponses, aides, 'optimiste'),
          aLaDate,
        ).optimiste,
        central: calculerFourchetteRAV(
          profil,
          voeuDepuisFormation(formation, reponses, aides, 'central'),
          aLaDate,
        ).central,
        prudent: calculerFourchetteRAV(
          profil,
          voeuDepuisFormation(formation, reponses, aides, 'prudent'),
          aLaDate,
        ).prudent,
      },
      raisonAide: aide && 'raison' in aide ? aide.raison : null,
    }
  })
}

/**
 * Tri par reste-à-vivre décroissant. Les vœux dont le RAV est indéterminable
 * ne sont jamais retirés : ils passent en fin de liste, signalés.
 */
export function trierParRAV(resultats: readonly ResultatFormation[]): ResultatFormation[] {
  return [...resultats].sort((a, b) => {
    const ra = a.parScenario.central.ravMensuel
    const rb = b.parScenario.central.ravMensuel
    if (ra === null && rb === null) return 0
    if (ra === null) return 1
    if (rb === null) return -1
    return rb - ra
  })
}

/**
 * Jumeaux géographiques : la même formation ailleurs, là où il reste plus pour
 * vivre. On dit l'écart, jamais qu'une ville vaut mieux qu'une autre.
 */
export function jumeauxGeographiques(
  resultats: readonly ResultatFormation[],
  cible: ResultatFormation,
  combien = 3,
): { readonly resultat: ResultatFormation; readonly ecart: number }[] {
  const ravCible = cible.parScenario.central.ravMensuel
  if (ravCible === null) return []
  const memeFiliere = resultats.filter(
    (r) =>
      r.formation.id !== cible.formation.id &&
      r.formation.filiere === cible.formation.filiere &&
      r.formation.ville !== cible.formation.ville &&
      r.parScenario.central.ravMensuel !== null,
  )
  return memeFiliere
    .map((resultat) => ({
      resultat,
      ecart: Math.round(((resultat.parScenario.central.ravMensuel ?? 0) - ravCible) * 100) / 100,
    }))
    .filter((j) => j.ecart > 0)
    .sort((a, b) => b.ecart - a.ecart)
    .slice(0, combien)
}
