/** Types du moteur budgétaire. Aucune dépendance au framework web. */

export type Scenario = 'optimiste' | 'central' | 'prudent'

/**
 * Signature imposée par CLAUDE.md : un montant ne circule jamais seul, il
 * porte sa source, son millésime et l'hypothèse qui l'a produit.
 */
export interface MontantSource {
  readonly montant: number
  readonly source: string
  readonly millesime: string
  readonly hypothese: string
}

export const POSTES_DEPENSE = [
  'loyer',
  'transport',
  'alimentation',
  'frais_divers',
  'frais_scolarite',
  'frais_installation',
] as const

export const POSTES_RESSOURCE = [
  'aide_logement',
  'contribution_familiale',
  'job_etudiant',
  'bourse_crous',
  'aide_merite',
  'aide_mobilite_parcoursup',
  'aides_regionales',
] as const

export type PosteDepense = (typeof POSTES_DEPENSE)[number]
export type PosteRessource = (typeof POSTES_RESSOURCE)[number]
export type Poste = PosteDepense | PosteRessource

export type Sens = 'depense' | 'ressource'

/** `annuel` signifie amorti sur les 10 mensualités de l'année universitaire. */
export type Periodicite = 'mensuel' | 'annuel'

export interface LigneCalculee {
  readonly statut: 'calcule'
  readonly poste: Poste
  readonly sens: Sens
  readonly periodicite: Periodicite
  readonly valeur: MontantSource
  /** Contribution mensuelle au RAV, toujours positive. */
  readonly mensualise: number
}

export interface LigneManquante {
  readonly statut: 'manquant'
  readonly poste: Poste
  readonly sens: Sens
  readonly raison: string
}

/** Un poste sans objet pour ce profil : exonéré, non concerné. Vaut zéro. */
export interface LigneSansObjet {
  readonly statut: 'sans_objet'
  readonly poste: Poste
  readonly sens: Sens
  readonly raison: string
}

export type LigneBudget = LigneCalculee | LigneManquante | LigneSansObjet

export type Soutenabilite = 'soutenable' | 'tendu' | 'non_financable' | 'indeterminable'

/** Échelons de bourse sur critères sociaux qui donnent lieu à un versement. */
export const ECHELONS_BOURSE = ['0bis', '1', '2', '3', '4', '5', '6', '7'] as const
export type EchelonBourse = (typeof ECHELONS_BOURSE)[number]

export interface ProfilEleve {
  /**
   * Échelon de bourse sur critères sociaux. `null` = non boursier.
   * L'échelon 0, qui exonère sans donner lieu à versement mensuel, se déclare
   * avec `echelonBourse: null` et `exonereCvec: true`.
   */
  readonly echelonBourse: EchelonBourse | null
  /**
   * Exonération de CVEC hors bourse sur critères sociaux : bénéficiaire d'une
   * aide spécifique annuelle, ou boursier géré par une région.
   * Source : https://www.etudiant.gouv.fr/fr/faq-cvec-2402
   */
  readonly exonereCvec: boolean
  readonly eligibleAideMerite: boolean
  readonly eligibleAideMobiliteParcoursup: boolean
  /** Saisies déclaratives. `null` = l'élève ne l'a pas renseigné. */
  readonly contributionFamilialeMensuelle: number | null
  readonly jobEtudiantMensuel: { readonly bas: number; readonly haut: number } | null
  readonly aidesRegionalesAnnuelles: number | null
  readonly repasCrousParMois: number
  readonly coursesMensuelles: number | null
  readonly fraisDiversMensuels: number | null
}

export interface LoyerCommune {
  /** Loyer d'annonce estimé, charges comprises, en euros par m². */
  readonly euroParM2: { readonly bas: number; readonly central: number; readonly haut: number }
  readonly millesime: string
  readonly source: string
  /** Maille d'estimation de l'indicateur : commune, maille ou EPCI. */
  readonly qualite: 'commune' | 'maille' | 'EPCI'
}

export interface VoeuBudget {
  readonly codeInsee: string | null
  readonly loyer: LoyerCommune | null
  readonly surfaceHypotheseM2: number
  /** APL mensuelle simulée. Doit venir d'OpenFisca, jamais d'une approximation. */
  readonly aplMensuelle: MontantSource | null
  readonly transportMensuel: MontantSource | null
  /**
   * Droits d'inscription annuels, déjà nets de toute exonération propre à
   * l'établissement : ils dépendent de la formation, pas du moteur.
   */
  readonly fraisScolariteAnnuels: MontantSource | null
  readonly fraisInstallation: MontantSource | null
  /** Faux pour les formations non concernées par la CVEC (BTS, DMA…). */
  readonly assujettiCvec: boolean
}

export interface ResultatRAV {
  readonly scenario: Scenario
  /** `null` dès qu'un poste manque : le RAV n'est jamais partiel. */
  readonly ravMensuel: number | null
  readonly lignes: readonly LigneBudget[]
  readonly postesManquants: readonly Poste[]
  readonly soutenabilite: Soutenabilite
  readonly avertissements: readonly string[]
  readonly dateDeCalcul: string
}
