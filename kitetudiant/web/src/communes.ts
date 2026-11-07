/**
 * Les communes, par leur code INSEE.
 *
 * Module à part, et non une fonction de plus dans `donnees.ts` : la console
 * d'administration en a besoin pour nommer les communes de ses statistiques,
 * et elle n'a rien à faire du reste de la couche de données — formations,
 * vœux, offres d'emploi.
 *
 * La table ne porte que les communes dont un loyer est publié : 1 246 sur les
 * trente-cinq mille que compte la France. Un code absent n'est donc pas une
 * anomalie, c'est le cas ordinaire pour un village.
 */

import communes from '../donnees/communes.json'

const TABLE = communes.communes as Record<string, { nom?: string }>

/** Le nom d'une commune, ou `null` si la table ne la connaît pas. */
export function nomCommune(codeInsee: string): string | null {
  return TABLE[codeInsee]?.nom ?? null
}

/**
 * Le numéro de département d'un code INSEE.
 *
 * Deux caractères, sauf outre-mer où il en faut trois : 971 Guadeloupe,
 * 974 La Réunion, 976 Mayotte… Couper à deux y donnerait « 97 » pour toutes,
 * ce qui ne distingue plus rien. La Corse, elle, tient en deux — « 2A », « 2B ».
 */
export function departementDe(codeInsee: string): string {
  return /^9[78]/.test(codeInsee) ? codeInsee.slice(0, 3) : codeInsee.slice(0, 2)
}

/**
 * Une commune telle qu'on la lit : « Limoges (87) ».
 *
 * ── Pourquoi le département, et pas le nom seul ──────────────────────────
 *
 * Sept noms sont portés par deux communes dans cette table — Valence,
 * Saint-Denis, Sainte-Marie, Saint-Pierre… « Sainte-Marie » seul, dans un
 * tableau de statistiques, ne dit pas s'il s'agit de la Martinique ou de La
 * Réunion. Le numéro de département tranche, et tient en quatre caractères.
 *
 * ── Ce qui se passe quand on ne connaît pas ──────────────────────────────
 *
 * Le code brut s'affiche, tel quel. C'est laid, et c'est voulu : inventer un
 * nom approchant, ou écrire « commune inconnue », ferait perdre la seule
 * information dont on dispose — celle qui permet d'aller vérifier.
 */
export function communeLisible(codeInsee: string): string {
  // Un code vide ne devrait pas arriver — le paquet `statistiques` ne retient
  // que ce qui ressemble à un code INSEE — mais s'il arrivait, il donnerait
  // une barre sans nom dans un tableau. Le tiret est celui qu'emploie déjà la
  // console pour une valeur absente.
  if (codeInsee.trim() === '') return '—'
  const nom = nomCommune(codeInsee)
  return nom === null ? codeInsee : `${nom} (${departementDe(codeInsee)})`
}
