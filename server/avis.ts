import type { AvisEcole, RequeteAvis } from './types'
import { CacheDisque } from './cache'
import { clefEtab } from './registre'

/**
 * Service d'avis : note Google (⭐) et nombre d'avis d'un établissement.
 *
 * On utilise l'**API officielle Google Places** (« Find Place From Text »), qui
 * renvoie directement la note moyenne et le nombre d'avis. Scraper Google Maps
 * ou la recherche Google est contraire à leurs conditions d'utilisation et peu
 * fiable : on s'appuie donc sur l'API, avec une clé fournie via
 * `GOOGLE_MAPS_API_KEY`.
 *
 * Sans clé configurée, le service renvoie proprement « indisponible » (le front
 * n'affiche simplement pas de note), sans jamais bloquer la simulation.
 *
 * Résultats mis en cache (30 jours) — conforme aux limites de conservation des
 * données Places.
 */

const ENDPOINT =
  'https://maps.googleapis.com/maps/api/place/findplacefromtext/json'

export interface OptionsAvis {
  cache?: CacheDisque<AvisEcole>
  fetchImpl?: typeof fetch
  /** Horloge injectable (tests). */
  now?: () => number
  /** Délai max d'un appel (ms). */
  timeoutMs?: number
  /** Clé API Google Places (défaut : process.env.GOOGLE_MAPS_API_KEY). */
  apiKey?: string
}

interface FindPlaceReponse {
  status: string
  candidates?: Array<{
    place_id?: string
    name?: string
    rating?: number
    user_ratings_total?: number
  }>
}

async function interrogerGoogle(
  req: RequeteAvis,
  apiKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Omit<AvisEcole, 'dateMaj'> | null> {
  const requete = [req.etablissement, req.ville].filter(Boolean).join(' ')
  const params = new URLSearchParams({
    input: requete,
    inputtype: 'textquery',
    fields: 'place_id,name,rating,user_ratings_total',
    language: 'fr',
    key: apiKey,
  })

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${ENDPOINT}?${params.toString()}`, {
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as FindPlaceReponse
    if (data.status !== 'OK' || !data.candidates?.length) return null
    const c = data.candidates[0]
    if (typeof c.rating !== 'number') return null
    return {
      etablissement: req.etablissement,
      note: c.rating,
      nombreAvis: c.user_ratings_total ?? null,
      source: 'google',
      urlMaps: c.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${c.place_id}`
        : undefined,
    }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function obtenirAvis(
  req: RequeteAvis,
  options: OptionsAvis = {},
): Promise<AvisEcole> {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? 6000
  const apiKey = options.apiKey ?? process.env.GOOGLE_MAPS_API_KEY
  const maintenant = now()
  const clef = clefEtab(req.etablissement) + '|' + (req.ville ?? '')

  const enCache = options.cache?.get(clef, maintenant)
  if (enCache) return enCache

  const indisponible: AvisEcole = {
    etablissement: req.etablissement,
    note: null,
    nombreAvis: null,
    source: 'indisponible',
    dateMaj: new Date(maintenant).toISOString(),
  }

  // Pas de clé : on ne met PAS en cache (la clé peut être ajoutée ensuite).
  if (!apiKey) return indisponible

  const trouve = await interrogerGoogle(req, apiKey, fetchImpl, timeoutMs)
  const resultat: AvisEcole = trouve
    ? { ...trouve, dateMaj: new Date(maintenant).toISOString() }
    : indisponible

  await options.cache?.set(clef, resultat, maintenant)
  return resultat
}
