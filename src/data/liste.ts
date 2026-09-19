import type { ResultatSimulation } from '../types'

/**
 * « Ma liste de vœux » : sélection de formations sauvegardée localement
 * (localStorage), pour que l'étudiant retrouve sa short-list d'une session à
 * l'autre et puisse l'exporter.
 *
 * On stocke un instantané minimal (id + libellés + probabilité) plutôt qu'un
 * simple id : les identifiants de l'open data peuvent changer entre deux
 * simulations, mais le vœu reste affichable et exportable.
 */

export interface VoeuSauve {
  id: string
  nom: string
  etablissement: string
  ville: string
  probabilite: number
}

const CLEF = 'parcoursup.maliste.v1'

/** Sous-ensemble de Storage réellement utilisé (facilite l'injection en test). */
export type Stockage = Pick<Storage, 'getItem' | 'setItem'>

function stockageParDefaut(): Stockage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Construit un vœu sauvegardable à partir d'un résultat de simulation. */
export function versVoeu(r: ResultatSimulation): VoeuSauve {
  return {
    id: r.formation.id,
    nom: r.formation.nom,
    etablissement: r.formation.etablissement,
    ville: r.formation.ville,
    probabilite: r.probabilite,
  }
}

/** Charge la liste sauvegardée (best-effort ; [] si absente ou corrompue). */
export function chargerListe(stockage: Stockage | null = stockageParDefaut()): VoeuSauve[] {
  if (!stockage) return []
  try {
    const brut = stockage.getItem(CLEF)
    if (!brut) return []
    const parse = JSON.parse(brut)
    if (!Array.isArray(parse)) return []
    return parse.filter(
      (v): v is VoeuSauve => v && typeof v.id === 'string' && typeof v.nom === 'string',
    )
  } catch {
    return []
  }
}

/** Persiste la liste (best-effort). */
export function sauvegarderListe(
  liste: VoeuSauve[],
  stockage: Stockage | null = stockageParDefaut(),
): void {
  try {
    stockage?.setItem(CLEF, JSON.stringify(liste))
  } catch {
    // Stockage indisponible (mode privé, quota) : on ignore.
  }
}

/** Ajoute ou retire un vœu de la liste, et renvoie la nouvelle liste. */
export function basculerVoeu(liste: VoeuSauve[], voeu: VoeuSauve): VoeuSauve[] {
  return liste.some((v) => v.id === voeu.id)
    ? liste.filter((v) => v.id !== voeu.id)
    : [...liste, voeu]
}

/** Récapitulatif texte de la liste, pour copie / téléchargement. */
export function exporterTexte(liste: VoeuSauve[]): string {
  if (liste.length === 0) return 'Ma liste de vœux Parcoursup : (vide)'
  const lignes = liste.map(
    (v, i) =>
      `${i + 1}. ${v.nom} — ${v.etablissement} (${v.ville}) · ~${v.probabilite}% de chances`,
  )
  return ['Ma liste de vœux Parcoursup', '', ...lignes].join('\n')
}
