/**
 * Garder un vœu depuis la liste des résultats.
 *
 * Le mécanisme existait — `BoutonVoeu` — mais seulement sur la fiche d'une
 * formation. Depuis la liste, il fallait ouvrir la fiche, enregistrer, puis
 * revenir : trois écrans pour un geste qu'on fait quarante fois en comparant.
 *
 * Deux choses que ce module doit tenir, et qui ne vont pas de soi :
 *
 *   - l'état est VISIBLE avant le clic. Sur une fiche, « Enregistrer » suffit :
 *     on en regarde une à la fois. Sur une liste, il faut savoir lesquelles
 *     sont déjà gardées, sinon on les ajoute deux fois pour s'en assurer ;
 *   - le retrait passe par le RANG, pas par le code. C'est ce que l'API
 *     expose, et le rang change à chaque retrait — d'où `rangDe`, qui le
 *     relit dans la liste à jour plutôt que de le mémoriser.
 *
 * Règle 4 de CLAUDE.md : aucun vœu n'est masqué ni retiré par l'ALGORITHME.
 * Ici c'est l'élève qui retire le sien, sur son geste, et il le revoit dans
 * la liste aussitôt après. Rien ne disparaît de la vue.
 */

import type { Voeu } from './donnees.ts'

/** Les codes de formation déjà enregistrés, pour un test immédiat. */
export function codesEnregistres(voeux: readonly Voeu[]): ReadonlySet<string> {
  return new Set(voeux.map((v) => v.codeFormation))
}

/**
 * Le rang d'une formation dans la liste, ou `null` si elle n'y est pas.
 *
 * `retirerVoeu` prend un rang, et les rangs se resserrent après chaque
 * retrait : mémoriser celui qu'on a vu il y a trois clics retirerait le
 * mauvais vœu. On le relit donc dans la liste à jour, à chaque fois.
 */
export function rangDe(voeux: readonly Voeu[], code: string): number | null {
  return voeux.find((v) => v.codeFormation === code)?.rang ?? null
}

/** Ce qu'un clic doit déclencher, une fois l'état connu. */
export type Geste =
  | { readonly quoi: 'ajouter'; readonly code: string; readonly session: number }
  | { readonly quoi: 'retirer'; readonly rang: number }
  | { readonly quoi: 'inscrire' }

/**
 * Le geste que produit un clic.
 *
 * Sans compte, on n'essaie pas d'enregistrer pour échouer ensuite : on ouvre
 * l'inscription. Découvrir après coup que rien n'a été gardé est la façon la
 * plus sûre de perdre une liste qu'on croyait faite.
 */
export function gesteDuClic(
  voeux: readonly Voeu[],
  code: string,
  session: number,
  connecte: boolean,
): Geste {
  if (!connecte) return { quoi: 'inscrire' }
  const rang = rangDe(voeux, code)
  return rang === null ? { quoi: 'ajouter', code, session } : { quoi: 'retirer', rang }
}

/** Le libellé du bouton, selon l'état. Court : il tient sur une carte. */
export function libelleDuBouton(enregistre: boolean): string {
  return enregistre ? 'Dans mes vœux' : 'Garder'
}

/**
 * Ce que le bouton annonce aux lecteurs d'écran.
 *
 * Le libellé visible dit un ÉTAT (« Dans mes vœux »), le nom accessible dit
 * l'ACTION et la formation. Sur une liste de quarante cartes, quarante
 * boutons nommés « Garder » ne se distinguent pas les uns des autres.
 */
export function nomAccessible(enregistre: boolean, libelleFormation: string): string {
  return enregistre
    ? `Retirer ${libelleFormation} de mes vœux`
    : `Garder ${libelleFormation} dans mes vœux`
}

/** Le nombre de vœux gardés, tel qu'on l'annonce. Parcoursup en accepte dix. */
export const MAXIMUM_VOEUX = 10

/**
 * Le rappel affiché quand la liste se remplit, ou `null` s'il n'y a rien à
 * dire. Un compteur permanent sur quarante cartes serait du bruit ; le
 * plafond, lui, se découvre au pire moment si personne ne l'annonce.
 */
export function rappelDuPlafond(nombre: number): string | null {
  if (nombre >= MAXIMUM_VOEUX) {
    return `Tu as ${MAXIMUM_VOEUX} vœux, le maximum sur Parcoursup. Pour en garder un autre, retires-en un.`
  }
  if (nombre === MAXIMUM_VOEUX - 1) {
    return `Encore un vœu possible : Parcoursup en accepte ${MAXIMUM_VOEUX}.`
  }
  return null
}
