/**
 * Retours d'étudiants déjà inscrits dans une formation.
 *
 * Trois axes seulement, comme le fixe le module M10 du cahier des charges :
 * coût réel constaté, facilité à trouver un logement, ambiance. Aucun texte
 * libre n'est collecté ici, et il n'existe nulle part de note globale sur
 * l'établissement — c'est une contrainte juridique autant qu'éditoriale.
 */

/** Année universitaire d'un retour, au format 2026-2027. C'est le millésime. */
export type Millesime = string

export const AXES = ['cout', 'logement', 'ambiance'] as const
export type Axe = (typeof AXES)[number]

export interface Retour {
  readonly id: string
  /** Clé pivot de la formation : cod_aff_form de Parcoursup. */
  readonly codFormation: string
  readonly millesime: Millesime
  /** Coût mensuel réellement constaté par l'étudiant, en euros. */
  readonly coutReelMensuel: number
  /** Facilité à trouver un logement, de 1 (très difficile) à 5 (très facile). */
  readonly faciliteLogement: number
  /** Ambiance ressentie, de 1 à 5. */
  readonly ambiance: number
  /** Année d'études au moment du retour : 1 pour la première année. */
  readonly anneeEtudes: number
  /** Horodatage de la collecte, pour la règle 6. */
  readonly collecteLe: string
}

/**
 * En dessous de ce nombre de retours, aucun agrégat n'est publié : trop peu
 * d'observations pour dire quoi que ce soit, et le risque de réidentification
 * devient réel sur une petite formation.
 */
export const RETOURS_MINIMUM = 5

export interface Distribution {
  readonly nombre: number
  readonly median: number
  readonly premierQuartile: number
  readonly troisiemeQuartile: number
  readonly minimum: number
  readonly maximum: number
}

export type Agregat =
  | {
      readonly statut: 'publie'
      readonly codFormation: string
      readonly millesime: Millesime
      readonly nombreRetours: number
      readonly coutReelMensuel: Distribution
      readonly faciliteLogement: Distribution
      readonly ambiance: Distribution
      readonly source: string
      readonly calculeLe: string
    }
  | {
      readonly statut: 'trop_peu_de_retours'
      readonly codFormation: string
      readonly millesime: Millesime
      readonly nombreRetours: number
      readonly raison: string
    }
