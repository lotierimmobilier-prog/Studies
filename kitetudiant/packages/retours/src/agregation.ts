/**
 * Agrégation des retours, millésime par millésime.
 *
 * Rien n'est lissé entre deux années : un millésime publié ne bouge plus, et
 * une année sans assez de retours reste sans agrégat plutôt que d'emprunter
 * les chiffres de l'année précédente.
 */

import {
  RETOURS_MINIMUM,
  type Agregat,
  type Distribution,
  type Millesime,
  type Retour,
} from './types.ts'

/** Quantile par interpolation linéaire, sur une série déjà triée. */
export function quantile(triees: readonly number[], p: number): number {
  if (triees.length === 0) throw new Error('série vide')
  if (triees.length === 1) return triees[0] as number
  const position = (triees.length - 1) * p
  const bas = Math.floor(position)
  const haut = Math.ceil(position)
  const valeurBasse = triees[bas] as number
  if (bas === haut) return valeurBasse
  const valeurHaute = triees[haut] as number
  return valeurBasse + (valeurHaute - valeurBasse) * (position - bas)
}

function arrondir(valeur: number): number {
  return Math.round(valeur * 100) / 100
}

export function distribution(valeurs: readonly number[]): Distribution {
  const triees = [...valeurs].sort((a, b) => a - b)
  return {
    nombre: triees.length,
    median: arrondir(quantile(triees, 0.5)),
    premierQuartile: arrondir(quantile(triees, 0.25)),
    troisiemeQuartile: arrondir(quantile(triees, 0.75)),
    minimum: arrondir(triees[0] as number),
    maximum: arrondir(triees[triees.length - 1] as number),
  }
}

/**
 * Agrège les retours d'une formation pour un millésime donné.
 *
 * Les retours d'autres formations ou d'autres millésimes sont ignorés : c'est
 * à l'appelant de les séparer, et cette fonction le vérifie plutôt que de
 * mélanger en silence.
 */
export function agreger(
  codFormation: string,
  millesime: Millesime,
  retours: readonly Retour[],
  calculeLe: string,
): Agregat {
  const pertinents = retours.filter(
    (r) => r.codFormation === codFormation && r.millesime === millesime,
  )
  if (pertinents.length < RETOURS_MINIMUM) {
    return {
      statut: 'trop_peu_de_retours',
      codFormation,
      millesime,
      nombreRetours: pertinents.length,
      raison:
        `${pertinents.length} retour${pertinents.length > 1 ? 's' : ''} sur ${millesime} : ` +
        `il en faut au moins ${RETOURS_MINIMUM} pour publier une statistique.`,
    }
  }
  return {
    statut: 'publie',
    codFormation,
    millesime,
    nombreRetours: pertinents.length,
    coutReelMensuel: distribution(pertinents.map((r) => r.coutReelMensuel)),
    faciliteLogement: distribution(pertinents.map((r) => r.faciliteLogement)),
    ambiance: distribution(pertinents.map((r) => r.ambiance)),
    source: `${pertinents.length} retours d’étudiants inscrits, année universitaire ${millesime}`,
    calculeLe,
  }
}

/** Millésimes disponibles pour une formation, du plus récent au plus ancien. */
export function millesimesDe(
  codFormation: string,
  retours: readonly Retour[],
): Millesime[] {
  const trouves = new Set(
    retours.filter((r) => r.codFormation === codFormation).map((r) => r.millesime),
  )
  return [...trouves].sort().reverse()
}

/**
 * Archive complète d'une formation : un agrégat par millésime, le plus récent
 * en tête. Les années trop peu fournies figurent quand même, avec leur raison :
 * une année vide est une information, pas un trou à cacher.
 */
export function archive(
  codFormation: string,
  retours: readonly Retour[],
  calculeLe: string,
): Agregat[] {
  return millesimesDe(codFormation, retours).map((m) =>
    agreger(codFormation, m, retours, calculeLe),
  )
}

/**
 * Évolution du coût médian constaté d'un millésime à l'autre.
 *
 * Ne compare que des millésimes publiés : comparer avec une année sous le
 * seuil reviendrait à donner du poids à deux ou trois témoignages.
 */
export function evolutionDuCout(
  archives: readonly Agregat[],
): { readonly de: Millesime; readonly vers: Millesime; readonly ecartEuros: number } | null {
  const publies = archives.filter(
    (a): a is Extract<Agregat, { statut: 'publie' }> => a.statut === 'publie',
  )
  if (publies.length < 2) return null
  const [recent, precedent] = publies
  if (!recent || !precedent) return null
  return {
    de: precedent.millesime,
    vers: recent.millesime,
    ecartEuros: arrondir(recent.coutReelMensuel.median - precedent.coutReelMensuel.median),
  }
}
