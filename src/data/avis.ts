/**
 * Client des avis Google (note ⭐ + nombre d'avis), servis par le backend via
 * l'API officielle Google Places. Repli silencieux (Map vide) si l'API est
 * indisponible ou non configurée : l'app fonctionne sans note.
 */

export interface AvisEcole {
  etablissement: string
  note: number | null
  nombreAvis: number | null
  source: 'google' | 'indisponible'
  urlMaps?: string
  dateMaj: string
}

// Voir src/data/prix.ts : le préfixe API suit le sous-chemin de déploiement.
const BASE = ((import.meta.env.VITE_PRIX_API ?? import.meta.env.BASE_URL ?? '') as string).replace(/\/$/, '')

/** Libellé lisible d'une note (ex. « 4,3/5 · 128 avis »), ou null si absente. */
export function formaterAvis(a: AvisEcole): string | null {
  if (a.source !== 'google' || a.note === null) return null
  const note = a.note.toFixed(1).replace('.', ',')
  const avis = a.nombreAvis ? ` · ${a.nombreAvis} avis` : ''
  return `${note}/5${avis}`
}

interface FormationAvis {
  id: string
  etablissement: string
  ville?: string
}

/** Récupère en lot les avis des formations données ; clé = formation.id. */
export async function chargerAvis(
  formations: FormationAvis[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, AvisEcole>> {
  const map = new Map<string, AvisEcole>()
  if (formations.length === 0) return map
  try {
    const res = await fetchImpl(`${BASE}/api/avis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        formations.map((f) => ({ etablissement: f.etablissement, ville: f.ville })),
      ),
    })
    if (!res.ok) return map
    const liste = (await res.json()) as AvisEcole[]
    formations.forEach((f, i) => {
      const a = liste[i]
      if (a && a.source === 'google') map.set(f.id, a)
    })
    return map
  } catch {
    return map
  }
}
