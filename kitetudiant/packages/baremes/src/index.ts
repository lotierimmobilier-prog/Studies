import aideMerite from '../donnees/aide-merite.json' with { type: 'json' }
import aideMobiliteParcoursup from '../donnees/aide-mobilite-parcoursup.json' with { type: 'json' }
import bourseCriteresSociaux from '../donnees/bourse-criteres-sociaux.json' with { type: 'json' }
import bourseNombreMensualites from '../donnees/bourse-nombre-mensualites.json' with { type: 'json' }
import cvec from '../donnees/cvec.json' with { type: 'json' }
import droitsInscription from '../donnees/droits-inscription.json' with { type: 'json' }
import repasCrousBoursier from '../donnees/repas-crous-boursier.json' with { type: 'json' }
import repasCrousNonBoursier from '../donnees/repas-crous-non-boursier.json' with { type: 'json' }

import type {
  Bareme,
  BaremeIndisponible,
  Reference,
  ValeurApplicable,
  ValeurBareme,
} from './types.ts'

export type * from './types.ts'

export const BAREMES = {
  aide_merite: aideMerite as Bareme,
  aide_mobilite_parcoursup: aideMobiliteParcoursup as Bareme,
  bourse_criteres_sociaux: bourseCriteresSociaux as Bareme,
  bourse_nombre_mensualites: bourseNombreMensualites as Bareme,
  cvec: cvec as Bareme,
  droits_inscription: droitsInscription as Bareme,
  repas_crous_boursier: repasCrousBoursier as Bareme,
  repas_crous_non_boursier: repasCrousNonBoursier as Bareme,
} as const satisfies Record<string, Bareme>

export type CleBareme = keyof typeof BAREMES

function formaterReferences(references: readonly Reference[] | undefined): string {
  if (!references || references.length === 0) return 'source non renseignée'
  return references
    .map((r) => [r.title, r.href].filter(Boolean).join(' — '))
    .filter((s) => s.length > 0)
    .join(' ; ')
}

/**
 * Valeur d'un barème en vigueur à la date donnée : la dernière entrée dont la
 * date d'effet est antérieure ou égale. Aucune extrapolation, aucun repli — si
 * rien ne s'applique, on le dit.
 */
export function valeurApplicable(
  cle: CleBareme,
  aLaDate: string,
): ValeurApplicable | BaremeIndisponible {
  const bareme = BAREMES[cle]
  const dates = Object.keys(bareme.valeurs_par_date).sort()
  if (dates.length === 0) {
    return { cle, raison: `Le barème « ${bareme.libelle} » ne contient aucune valeur.` }
  }
  const applicables = dates.filter((d) => d <= aLaDate)
  if (applicables.length === 0) {
    return {
      cle,
      raison:
        `Le barème « ${bareme.libelle} » ne couvre pas le ${aLaDate} : ` +
        `sa première valeur entre en vigueur le ${dates[0]}.`,
    }
  }
  const millesime = applicables[applicables.length - 1] as string
  return {
    valeur: bareme.valeurs_par_date[millesime] as ValeurBareme,
    millesime,
    source: formaterReferences(bareme.references_par_date[millesime]),
    verifieLe: bareme.derniere_valeur_encore_valide_le,
  }
}

/**
 * Vrai quand le barème n'a rien à rendre. Générique pour servir aussi aux
 * types que les appelants dérivent d'une valeur applicable.
 */
export function estIndisponible<T extends object>(
  resultat: T | BaremeIndisponible,
): resultat is BaremeIndisponible {
  return 'raison' in resultat
}

/** Montant scalaire d'un barème, ou son indisponibilité. */
export function montantApplicable(
  cle: CleBareme,
  aLaDate: string,
): ValeurApplicable<number> | BaremeIndisponible {
  const resultat = valeurApplicable(cle, aLaDate)
  if (estIndisponible(resultat)) return resultat
  if (typeof resultat.valeur !== 'number') {
    return { cle, raison: `Le barème « ${cle} » est une table, pas un montant unique.` }
  }
  return { ...resultat, valeur: resultat.valeur }
}

/** Montant d'une entrée de table (échelon de bourse), ou son indisponibilité. */
export function montantIndexe(
  cle: CleBareme,
  index: string,
  aLaDate: string,
): ValeurApplicable<number> | BaremeIndisponible {
  const resultat = valeurApplicable(cle, aLaDate)
  if (estIndisponible(resultat)) return resultat
  if (typeof resultat.valeur === 'number') {
    return { cle, raison: `Le barème « ${cle} » est un montant unique, pas une table.` }
  }
  const montant = resultat.valeur[index]
  if (montant === undefined) {
    const connus = Object.keys(resultat.valeur).join(', ')
    return {
      cle,
      raison: `Le barème « ${cle} » n'a pas d'entrée « ${index} » au millésime ${resultat.millesime} (entrées : ${connus}).`,
    }
  }
  return { ...resultat, valeur: montant }
}

/**
 * Un barème est périmé quand sa dernière vérification est antérieure à la date
 * demandée. Ce n'est pas une erreur : c'est une information à afficher.
 */
export function estPerime(resultat: ValeurApplicable, aLaDate: string): boolean {
  return resultat.verifieLe !== null && resultat.verifieLe < aLaDate
}
