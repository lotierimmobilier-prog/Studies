import type { Domaine, ResultatSimulation } from '../types'
import type { PrixFormation } from '../data/prix'
import type { AvisEcole } from '../data/avis'

/**
 * Filtrage des résultats de simulation selon des critères choisis par
 * l'étudiant (recherche texte, domaine, ville, sélectivité, coût, note Google).
 *
 * Fonctions pures : l'UI garde l'état des critères et applique `filtrerResultats`
 * sur la liste complète, puis reconstruit les groupes et recommandations à
 * partir du résultat filtré.
 */

export interface CriteresFiltre {
  /** Recherche libre (nom de formation, établissement, ville). */
  texte?: string
  domaine?: Domaine | ''
  ville?: string
  selectivite?: 'selective' | 'non-selective' | ''
  /** Coût annuel maximum (€) ; les prix inconnus ne sont pas exclus. */
  coutMax?: number | null
  /** Note Google minimale (sur 5) ; exclut les formations sans note. */
  noteMin?: number | null
}

export interface ContexteFiltre {
  prix?: Map<string, PrixFormation>
  avis?: Map<string, AvisEcole>
}

/** Normalise une chaîne pour une comparaison insensible à la casse/accents. */
function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Indique si un ensemble de critères est effectivement actif. */
export function filtresActifs(c: CriteresFiltre): boolean {
  return Boolean(
    (c.texte && c.texte.trim()) ||
      c.domaine ||
      c.ville ||
      c.selectivite ||
      (c.coutMax != null) ||
      (c.noteMin != null),
  )
}

/** Applique les critères à un résultat. */
function correspond(
  r: ResultatSimulation,
  c: CriteresFiltre,
  ctx: ContexteFiltre,
): boolean {
  const f = r.formation

  if (c.texte && c.texte.trim()) {
    const q = normaliser(c.texte)
    const cible = normaliser(`${f.nom} ${f.etablissement} ${f.ville}`)
    if (!cible.includes(q)) return false
  }

  if (c.domaine && f.domaine !== c.domaine) return false
  if (c.ville && f.ville !== c.ville) return false
  if (c.selectivite && f.selectivite !== c.selectivite) return false

  if (c.coutMax != null) {
    const prix = ctx.prix?.get(f.id)?.prixAnnuel
    // Prix connu : on exige ≤ plafond. Prix inconnu : on n'exclut pas.
    if (typeof prix === 'number' && prix > c.coutMax) return false
  }

  if (c.noteMin != null) {
    const avis = ctx.avis?.get(f.id)
    // La note est requise : sans note Google, on exclut du filtre par note.
    if (!avis || avis.note == null || avis.note < c.noteMin) return false
  }

  return true
}

/** Renvoie les résultats correspondant aux critères (ordre préservé). */
export function filtrerResultats(
  resultats: ResultatSimulation[],
  criteres: CriteresFiltre,
  ctx: ContexteFiltre = {},
): ResultatSimulation[] {
  if (!filtresActifs(criteres)) return resultats
  return resultats.filter((r) => correspond(r, criteres, ctx))
}

/** Domaines présents dans les résultats (pour peupler un menu déroulant). */
export function domainesDisponibles(resultats: ResultatSimulation[]): Domaine[] {
  return [...new Set(resultats.map((r) => r.formation.domaine))]
}

/** Villes présentes dans les résultats, triées alphabétiquement. */
export function villesDisponibles(resultats: ResultatSimulation[]): string[] {
  return [...new Set(resultats.map((r) => r.formation.ville))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'fr'))
}
