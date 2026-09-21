/**
 * Le défilement d'un chiffre, calculé à part de React.
 *
 * Trois choses valent d'être testées seules, et aucune ne demande le DOM :
 * l'amorti, la valeur rendue à un instant donné, et surtout la garantie que
 * la dernière image tombe EXACTEMENT sur la cible. Un compteur qui s'arrête
 * à 1 245 sur 1 246 afficherait un chiffre faux — règle 1.
 */

/** Durée du défilement, en millisecondes. Assez pour être vu, assez court
 *  pour ne pas faire attendre la lecture. */
export const DUREE_MS = 900

/**
 * Amorti de sortie : rapide au début, lent à la fin.
 *
 * `1 − (1 − t)³`. Un défilement linéaire se lit comme un compteur de station
 * essence ; celui-ci se lit comme un chiffre qui se pose.
 */
export function amorti(t: number): number {
  const borne = Math.min(Math.max(t, 0), 1)
  return 1 - (1 - borne) ** 3
}

/**
 * La valeur entière à afficher après `ecoule` millisecondes.
 *
 * `ecoule >= duree` rend la cible elle-même, sans arrondi intermédiaire : la
 * dernière image doit être le vrai chiffre, au chiffre près.
 */
export function valeurA(cible: number, ecoule: number, duree = DUREE_MS): number {
  if (duree <= 0 || ecoule >= duree) return cible
  if (ecoule <= 0) return 0
  return Math.round(cible * amorti(ecoule / duree))
}

/** Vrai quand le visiteur a demandé qu'on lui épargne les animations. */
export function mouvementRefuse(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}
