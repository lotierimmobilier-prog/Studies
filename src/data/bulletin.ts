import type { Matiere } from '../types'

/**
 * Client d'analyse de bulletin (backend). Envoie un PDF ou une image encodés
 * en base64 et récupère les notes extraites + l'analyse des appréciations.
 */

export interface AnalyseBulletin {
  notes: Partial<Record<Matiere, number>>
  appreciationGlobale: string
  signaux: { serieux: number; participation: number; progression: number }
  pointsForts: string[]
  pointsAmeliorer: string[]
}

export type ResultatBulletin =
  | { ok: true; analyse: AnalyseBulletin }
  | { ok: false; erreur: string; configRequise?: boolean }

// Voir src/data/prix.ts : le préfixe API suit le sous-chemin de déploiement
// (import.meta.env.BASE_URL), pour fonctionner à la racine ou sous « /studies ».
const BASE = ((import.meta.env.VITE_PRIX_API ?? import.meta.env.BASE_URL ?? '') as string).replace(/\/$/, '')

const TYPES_OK: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

/** Lit un fichier et renvoie ses données base64 (sans le préfixe data:). */
function lireBase64(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result)
      const virgule = res.indexOf(',')
      resolve(virgule >= 0 ? res.slice(virgule + 1) : res)
    }
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.readAsDataURL(fichier)
  })
}

/** Envoie un bulletin au backend pour analyse. */
export async function analyserBulletin(
  fichier: File,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultatBulletin> {
  const mediaType = TYPES_OK[fichier.type]
  if (!mediaType)
    return { ok: false, erreur: 'Format non supporté (PDF, JPG, PNG ou WebP).' }
  if (fichier.size > 8 * 1024 * 1024)
    return { ok: false, erreur: 'Fichier trop volumineux (max 8 Mo).' }

  try {
    const base64 = await lireBase64(fichier)
    const res = await fetchImpl(`${BASE}/api/bulletin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fichier: base64, mediaType }),
    })
    if (res.status === 503) {
      const data = (await res.json()) as { erreur?: string }
      return {
        ok: false,
        configRequise: true,
        erreur:
          data.erreur ??
          "L'analyse de bulletin nécessite la configuration de l'IA côté serveur.",
      }
    }
    if (!res.ok) return { ok: false, erreur: `Erreur serveur (${res.status}).` }
    const analyse = (await res.json()) as AnalyseBulletin
    return { ok: true, analyse }
  } catch {
    return {
      ok: false,
      erreur: 'Service d\'analyse injoignable. Vérifiez que le serveur tourne.',
    }
  }
}
