/**
 * Les textes courts des trois cases d'une fiche.
 *
 * Ils vivent à part de l'affichage pour être testables seuls : ce sont les
 * quelques mots que l'élève lira le plus souvent, et deux règles du projet s'y
 * jouent à chaque fois.
 *
 *   - CLAUDE.md interdit le texte anxiogène, et nommément « aucune chance ».
 *     Une estimation absente s'écrit donc « non estimé », jamais zéro ;
 *   - une donnée manquante s'affiche comme manquante, jamais comme un repli
 *     silencieux qui aurait l'air d'un vrai chiffre.
 */

import type { Admissibilite } from '../../packages/admissibilite/src/index.ts'
import type { Affinite } from '../../packages/profil-scolaire/src/index.ts'

/**
 * La valeur courte des chances d'admission.
 *
 * Une borne basse à zéro ne dit rien d'utile : on annonce alors un plafond,
 * ce qui reste vrai sans écrire à un lycéen qu'il n'a aucune chance.
 */
export function chancesCourtes(a: Admissibilite): string {
  if (a.statut !== 'fourchette') return 'non estimé'
  return a.bas === 0 ? `moins de ${a.haut} %` : `${a.bas} à ${a.haut} %`
}

/**
 * Vrai quand l'affinité ne repose sur rien.
 *
 * `raisons` énumère ce qui a joué dans le score. Vide ET score à zéro, cela
 * veut dire que l'élève n'a encore déclaré ni passions, ni notes, ni matière
 * préférée — pas que la formation lui convient mal. Afficher « 0/100 » dans ce
 * cas serait lu comme un jugement alors que c'est une donnée manquante, et
 * CLAUDE.md demande qu'une donnée manquante s'affiche comme manquante.
 */
function sansInformation(a: Affinite): boolean {
  return a.score === 0 && a.raisons.length === 0
}

/** La valeur courte de l'affinité, ou un tiret quand on ne peut rien en dire. */
export function affiniteCourte(a: Affinite): string {
  if (a.domaineInconnu || sansInformation(a)) return '—'
  return `${a.score}/100`
}

/** La ligne d'explication sous l'affinité. */
export function affiniteNote(a: Affinite): string {
  if (a.domaineInconnu) return 'domaine non reconnu'
  if (sansInformation(a)) return 'dis-nous ce qui t’intéresse'
  return 'selon tes notes et tes goûts'
}
