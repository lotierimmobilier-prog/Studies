/**
 * Un barème est une suite de valeurs datées, chacune rattachée au texte
 * officiel qui la fixe. Rien d'autre n'a le droit de produire un euro dans
 * KITETUDIANT (règle 1 de CLAUDE.md).
 */

/** Référence au texte officiel qui fixe une valeur. */
export interface Reference {
  readonly title?: string
  readonly href?: string
  readonly note?: string
}

/** Valeur d'un barème : un montant, ou une table indexée (échelons de bourse). */
export type ValeurBareme = number | Readonly<Record<string, number>>

export interface Bareme {
  readonly cle: string
  readonly libelle: string
  readonly unite: string
  readonly description_source: string | null
  /** Clé = date d'entrée en vigueur au format ISO. */
  readonly valeurs_par_date: Readonly<Record<string, ValeurBareme>>
  readonly references_par_date: Readonly<Record<string, readonly Reference[]>>
  /** Date à laquelle la dernière valeur a été vérifiée encore en vigueur. */
  readonly derniere_valeur_encore_valide_le: string | null
  readonly provenance: {
    readonly origine: string
    readonly parametre: string | null
    readonly extrait_le: string
  }
}

/** Ce qu'un barème rend quand il a une valeur applicable à la date demandée. */
export interface ValeurApplicable<T extends ValeurBareme = ValeurBareme> {
  readonly valeur: T
  /** Date d'entrée en vigueur de la valeur retenue : c'est le millésime. */
  readonly millesime: string
  /** Texte officiel, sous forme lisible, pour la ligne de budget. */
  readonly source: string
  /** Date de dernière vérification, ou null si le barème ne la porte pas. */
  readonly verifieLe: string | null
}

/** Pourquoi un barème n'a rien à rendre. Jamais de valeur de repli. */
export interface BaremeIndisponible {
  readonly cle: string
  readonly raison: string
}
