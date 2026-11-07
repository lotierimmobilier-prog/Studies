/** Admissibilité : ce que les statistiques publiées permettent d'en dire. */

export type TypeBac = 'general' | 'technologique' | 'professionnel' | 'autre'

/** Statistiques publiées par le ministère pour une formation et une session. */
export interface StatsFormation {
  readonly session: string
  readonly capacite: number | null
  readonly admisTotal: number | null
  /** Taux d'accès officiel, en points de pourcentage. */
  readonly tauxAcces: number | null
  readonly admisBacGeneral: number | null
  readonly admisBacTechno: number | null
  readonly admisBacPro: number | null
  readonly admisAutres: number | null
  readonly admisBoursiers: number | null
  readonly admisMemeAcademie: number | null
  /** Répartition des admis par mention au bac. */
  readonly admisSansMention: number | null
  readonly admisMentionAB: number | null
  readonly admisMentionB: number | null
  readonly admisMentionTB: number | null
  readonly admisMentionTBF: number | null
  readonly selective: boolean
}

export interface ProfilAdmission {
  readonly typeBac: TypeBac
  /** Moyenne générale sur 20, ou null si aucune note n'est connue. */
  readonly moyenneGenerale: number | null
  readonly boursier: boolean
  readonly memeAcademie: boolean
}

export type Admissibilite =
  | {
      readonly statut: 'fourchette'
      /** Bornes en points de pourcentage, arrondies à l'entier. */
      readonly bas: number
      readonly haut: number
      readonly tauxAccesPublie: number
      readonly effectifAdmis: number
      readonly source: string
      readonly millesime: string
      readonly facteurs: readonly string[]
    }
  | {
      readonly statut: 'effectif_insuffisant'
      readonly effectifAdmis: number | null
      readonly raison: string
    }
  | {
      readonly statut: 'donnee_manquante'
      readonly raison: string
    }
