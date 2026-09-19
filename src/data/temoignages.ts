/**
 * Client des témoignages étudiants (note ⭐ sur 5 + commentaire + année),
 * modérés côté serveur. Repli silencieux si le backend est indisponible.
 */

export type StatutTemoignage = 'approuve' | 'en_attente' | 'rejete'

export interface TemoignageEtudiant {
  id: string
  etablissement: string
  note: number
  commentaire: string
  annee?: number
  statut: StatutTemoignage
  dateMaj: string
}

export interface SyntheseTemoignages {
  etablissement: string
  moyenne: number | null
  nombre: number
  temoignages: TemoignageEtudiant[]
}

export interface RequeteTemoignage {
  etablissement: string
  note: number
  commentaire: string
  annee?: number
}

export type ResultatSoumission =
  | { ok: true; temoignage: TemoignageEtudiant }
  | { ok: false; statut: 'rejete'; raison: string }

// Voir src/data/prix.ts : le préfixe API suit le sous-chemin de déploiement.
const BASE = ((import.meta.env.VITE_PRIX_API ?? import.meta.env.BASE_URL ?? '') as string).replace(/\/$/, '')

const VIDE = (etablissement: string): SyntheseTemoignages => ({
  etablissement,
  moyenne: null,
  nombre: 0,
  temoignages: [],
})

/** Récupère les témoignages approuvés d'un établissement + la moyenne. */
export async function chargerTemoignages(
  etablissement: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SyntheseTemoignages> {
  try {
    const res = await fetchImpl(
      `${BASE}/api/temoignages?etablissement=${encodeURIComponent(etablissement)}`,
    )
    if (!res.ok) return VIDE(etablissement)
    return (await res.json()) as SyntheseTemoignages
  } catch {
    return VIDE(etablissement)
  }
}

/** Soumet un témoignage. Le serveur renvoie le verdict de modération. */
export async function soumettreTemoignage(
  req: RequeteTemoignage,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultatSoumission> {
  try {
    const res = await fetchImpl(`${BASE}/api/temoignages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    return (await res.json()) as ResultatSoumission
  } catch {
    return {
      ok: false,
      statut: 'rejete',
      raison: 'Envoi impossible (serveur indisponible).',
    }
  }
}
