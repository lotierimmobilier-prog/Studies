/**
 * Classer et filtrer la liste des résultats.
 *
 * ── Ce que la règle 4 de CLAUDE.md impose ────────────────────────────────
 *
 * « Aucun vœu n'est jamais masqué ou retiré par l'algorithme. Il peut être
 * signalé, jamais supprimé de la vue. »
 *
 * Un filtre posé par l'élève n'est pas l'algorithme : c'est lui qui décide,
 * et il sait ce qu'il a demandé. Mais la frontière est mince, et elle se
 * franchit sans bruit. Trois garde-fous la tiennent :
 *
 * 1. `filtrer` ne jette rien. Elle rend DEUX listes — ce qui reste et ce qui
 *    est écarté — et l'écran affiche toujours le compte des écartés.
 * 2. Aucun filtre n'est actif au départ. La liste s'ouvre entière.
 * 3. Un filtre est toujours défaisable d'un seul geste.
 *
 * ── Ce que le classement n'a PAS le droit de faire ───────────────────────
 *
 * La règle 5 interdit une note globale unique. Classer par « pertinence »,
 * c'est l'ordre que le calcul a déjà produit : d'abord l'affinité, puis le
 * reste-à-vivre, en deux temps et jamais additionnés. Les autres classements
 * trient sur UNE grandeur nommée, affichée, et l'élève voit laquelle. Aucun
 * ne mélange deux axes dans un même nombre.
 *
 * La note publique du lieu n'apparaît pas ici, et ne le peut pas : elle ne
 * figure pas dans `ResultatFormation`. Le module M10 du cahier des charges
 * l'interdit dans les critères de décision.
 */

import type { ResultatFormation } from './calcul.ts'

/* ------------------------------------------------------------ classements */

export type Classement = 'pertinence' | 'ville' | 'reste' | 'chances'

export const CLASSEMENTS: readonly { readonly cle: Classement; readonly libelle: string }[] = [
  { cle: 'pertinence', libelle: 'Ce qui te correspond' },
  { cle: 'reste', libelle: 'Ce qu’il te restera' },
  { cle: 'chances', libelle: 'Tes chances d’entrer' },
  { cle: 'ville', libelle: 'Ville (A → Z)' },
]

/**
 * Le reste-à-vivre du scénario central, ou `null` s'il n'a pas pu être
 * calculé. `null` n'est pas zéro : une formation dont le budget manque part
 * à la FIN du classement, elle n'est pas rangée comme la plus pauvre.
 */
function resteCentral(r: ResultatFormation): number | null {
  const central = r.parScenario.central
  return central.postesManquants.length > 0 ? null : central.ravMensuel
}

/**
 * Compare deux valeurs dont l'une peut manquer. Une valeur absente passe
 * toujours derrière une valeur connue, quel que soit le sens du tri : elle
 * n'est ni bonne ni mauvaise, elle est inconnue, et la ranger comme un zéro
 * serait inventer.
 */
function avecLesManquants(
  a: number | null,
  b: number | null,
  comparer: (x: number, y: number) => number,
): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return comparer(a, b)
}

/**
 * Rend une NOUVELLE liste classée. L'originale n'est pas touchée : c'est elle
 * qui porte l'ordre du calcul, et on doit pouvoir y revenir.
 */
export function classer(
  resultats: readonly ResultatFormation[],
  classement: Classement,
): ResultatFormation[] {
  const copie = [...resultats]
  switch (classement) {
    case 'pertinence':
      // L'ordre rendu par le calcul : affinité d'abord, reste-à-vivre
      // ensuite, en deux temps. On ne le recalcule pas ici.
      return copie
    case 'reste':
      return copie.sort((a, b) =>
        avecLesManquants(resteCentral(a), resteCentral(b), (x, y) => y - x),
      )
    case 'chances':
      return copie.sort((a, b) =>
        avecLesManquants(
          a.formation.tauxAcces,
          b.formation.tauxAcces,
          (x, y) => y - x,
        ),
      )
    case 'ville':
      return copie.sort((a, b) =>
        a.formation.ville.localeCompare(b.formation.ville, 'fr', { sensitivity: 'base' }),
      )
  }
}

/* ---------------------------------------------------------------- filtres */

export type Secteur = 'public' | 'prive'

/**
 * Le secteur, déduit du statut publié.
 *
 * Quatre valeurs existent dans le jeu du ministère, relevées le 20/09/2026 :
 * « Public » (11 108), « Privé sous contrat d'association » (1 938),
 * « Privé enseignement supérieur » (1 101), « Privé hors contrat » (105).
 *
 * Un statut absent ou inconnu rend `null`. Il n'est PAS rangé d'office dans
 * le public : la différence de coût entre les deux se compte en milliers
 * d'euros par an, et deviner ici tromperait sur un montant.
 */
export function secteurDe(statut: string | null): Secteur | null {
  if (statut === null) return null
  const normalise = statut.trim().toLowerCase()
  if (normalise.startsWith('public')) return 'public'
  if (normalise.startsWith('priv')) return 'prive'
  return null
}

export interface Filtres {
  /** `null` : aucun filtre de secteur, tout est affiché. */
  readonly secteur: Secteur | null
  /** Ville exacte, telle qu'elle est publiée. `null` : toutes les villes. */
  readonly ville: string | null
}

export const SANS_FILTRE: Filtres = { secteur: null, ville: null }

export function aucunFiltre(f: Filtres): boolean {
  return f.secteur === null && f.ville === null
}

export interface Partage {
  readonly retenus: ResultatFormation[]
  /**
   * Ce que le filtre écarte. Cette liste EXISTE, et l'écran en affiche
   * toujours le compte : c'est ce qui distingue un filtre choisi d'un vœu
   * escamoté (règle 4 de CLAUDE.md).
   */
  readonly ecartes: ResultatFormation[]
}

/**
 * Sépare, ne supprime pas.
 *
 * Une formation dont le statut est inconnu n'est JAMAIS écartée par le filtre
 * de secteur : l'élève a demandé « public », pas « tout sauf ce dont on ne
 * sait rien ». L'écarter reviendrait à transformer une donnée manquante en
 * réponse négative.
 */
export function filtrer(
  resultats: readonly ResultatFormation[],
  filtres: Filtres,
): Partage {
  const retenus: ResultatFormation[] = []
  const ecartes: ResultatFormation[] = []
  for (const r of resultats) {
    const secteur = secteurDe(r.formation.statutEtablissement)
    const secteurVaBien =
      filtres.secteur === null || secteur === null || secteur === filtres.secteur
    const villeVaBien = filtres.ville === null || r.formation.ville === filtres.ville
    if (secteurVaBien && villeVaBien) retenus.push(r)
    else ecartes.push(r)
  }
  return { retenus, ecartes }
}

/** Les villes présentes dans les résultats, par ordre alphabétique. */
export function villesDe(resultats: readonly ResultatFormation[]): string[] {
  const vues = new Set<string>()
  for (const r of resultats) vues.add(r.formation.ville)
  return [...vues].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
}

/** Le nombre de formations par secteur, pour que le filtre annonce sa portée. */
export function comptesParSecteur(
  resultats: readonly ResultatFormation[],
): { public: number; prive: number; inconnu: number } {
  const comptes = { public: 0, prive: 0, inconnu: 0 }
  for (const r of resultats) {
    const s = secteurDe(r.formation.statutEtablissement)
    if (s === 'public') comptes.public += 1
    else if (s === 'prive') comptes.prive += 1
    else comptes.inconnu += 1
  }
  return comptes
}
