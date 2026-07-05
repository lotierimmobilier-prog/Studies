import type { Formation } from '../types'

/**
 * Client frontend du service de prix (backend `server/`).
 *
 * Le navigateur ne peut pas scraper directement les sites d'écoles (CORS) :
 * il interroge notre API, qui fait le scraping côté serveur. En cas d'API
 * indisponible, on retombe silencieusement sur le prix indicatif déjà présent
 * sur la formation (dérivé du statut public/privé).
 */

export interface PrixFormation {
  etablissement: string
  prixAnnuel: number | null
  devise: 'EUR'
  gratuitBoursier?: boolean
  source: 'curated' | 'scrape' | 'estimation'
  url?: string
  note?: string
  dateMaj: string
}

// Préfixe des appels API. Par défaut, on suit le sous-chemin de déploiement
// (import.meta.env.BASE_URL, ex. « /studies/ » sur le VPS, « / » à la racine),
// pour que l'API soit servie sous le même préfixe que le front. VITE_PRIX_API
// permet de forcer une URL absolue (dev, backend séparé).
const BASE = ((import.meta.env.VITE_PRIX_API ?? import.meta.env.BASE_URL ?? '') as string).replace(/\/$/, '')

/** Formatte un prix annuel en libellé lisible. */
export function formaterPrix(p: PrixFormation): string {
  if (p.prixAnnuel === null) return p.note ?? 'Prix à vérifier'
  if (p.prixAnnuel === 0)
    return `Gratuit${p.note ? ` — ${p.note}` : ''}`
  const montant = p.prixAnnuel.toLocaleString('fr-FR')
  const bourse = p.gratuitBoursier ? ' (gratuit pour les boursiers)' : ''
  return `${montant} €/an${bourse}`
}

/**
 * Récupère les prix d'un lot de formations via le backend.
 * Renvoie une Map id de formation → PrixFormation. Vide si l'API échoue.
 */
export async function chargerPrix(
  formations: Formation[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, PrixFormation>> {
  const resultat = new Map<string, PrixFormation>()
  if (formations.length === 0) return resultat

  const requetes = formations.map((f) => ({
    id: f.id,
    etablissement: f.etablissement,
    statut: f.statut,
    formation: f.nom,
  }))

  try {
    const res = await fetchImpl(`${BASE}/api/prix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requetes),
    })
    if (!res.ok) return resultat
    const prix = (await res.json()) as PrixFormation[]
    prix.forEach((p, i) => {
      const id = formations[i]?.id
      if (id) resultat.set(id, p)
    })
  } catch {
    // API indisponible : on renvoie une map vide, le prix indicatif prend le relais.
  }
  return resultat
}
