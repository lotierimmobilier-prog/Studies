import type { PrixFormation, RequetePrix } from './types'
import { chercherCurated, clefEtab, estimerParCategorie } from './registre'
import { extrairePrix } from './scraper'
import { CacheDisque } from './cache'

/**
 * Service de prix : combine base curée, scraping du site de l'école et
 * estimation par catégorie, avec cache.
 *
 * Ordre de résolution :
 *   1. cache (si frais et non expiré)
 *   2. base curée — si une URL est connue, tentative de scraping pour un montant
 *      à jour ; sinon on garde le montant curé
 *   3. estimation par catégorie (statut / filière) en dernier recours
 */

export interface OptionsService {
  cache?: CacheDisque<PrixFormation>
  fetchImpl?: typeof fetch
  /** Horloge injectable (tests). */
  now?: () => number
  /** Délai max d'un scraping (ms). */
  timeoutMs?: number
}

async function scraperUrl(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<number | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'ParcoursupSimulator/0.1 (+contact)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    return extrairePrix(html)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function obtenirPrix(
  req: RequetePrix,
  options: OptionsService = {},
): Promise<PrixFormation> {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? 6000
  const maintenant = now()
  const clef = clefEtab(req.etablissement) + '|' + (req.fili ?? '')

  const enCache = options.cache?.get(clef, maintenant)
  if (enCache) return enCache

  let resultat: PrixFormation

  const curated = chercherCurated(req.etablissement)
  if (curated) {
    let prix = curated.prixAnnuel
    let source: PrixFormation['source'] = 'curated'
    if (curated.url) {
      const scrappe = await scraperUrl(curated.url, fetchImpl, timeoutMs)
      if (scrappe !== null) {
        prix = scrappe
        source = 'scrape'
      }
    }
    resultat = {
      etablissement: req.etablissement,
      prixAnnuel: prix,
      devise: 'EUR',
      gratuitBoursier: curated.gratuitBoursier,
      source,
      url: curated.url,
      note: curated.note,
      dateMaj: new Date(maintenant).toISOString(),
    }
  } else {
    resultat = {
      ...estimerParCategorie(req),
      dateMaj: new Date(maintenant).toISOString(),
    }
  }

  await options.cache?.set(clef, resultat, maintenant)
  return resultat
}
