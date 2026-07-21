import type { Maison, Sejour, Session } from './types'

/**
 * Appels à l'API du portail. En développement, Vite proxifie `/api` vers le
 * serveur Node (voir vite.config.ts) ; en production, nginx fait de même.
 */

const CLE_JETON = 'portail-vacances-jeton'

/**
 * Préfixe des appels API. Vaut `/` en développement et `/<sous-chemin>/` en
 * production (injecté par Vite via `base`), afin que les requêtes atteignent le
 * bon chemin quand le site est servi sous un sous-dossier (ex. `/vacances/`).
 */
const BASE = import.meta.env.BASE_URL

export function jetonEnregistre(): string | null {
  return localStorage.getItem(CLE_JETON)
}

function enregistrerJeton(jeton: string): void {
  localStorage.setItem(CLE_JETON, jeton)
}

export function oublierJeton(): void {
  localStorage.removeItem(CLE_JETON)
}

async function lireErreur(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { erreur?: string }
    return data.erreur ?? 'Une erreur est survenue.'
  } catch {
    return 'Une erreur est survenue.'
  }
}

/** Connexion par login + mot de passe. */
export async function seConnecter(
  login: string,
  motDePasse: string,
): Promise<Session> {
  const res = await fetch(`${BASE}api/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, motDePasse }),
  })
  if (!res.ok) throw new Error(await lireErreur(res))
  const data = (await res.json()) as {
    jeton: string
    sejour: Sejour
    maison: Maison
  }
  enregistrerJeton(data.jeton)
  return data
}

/** Restaure une session à partir du jeton enregistré (au rechargement). */
export async function restaurerSession(): Promise<Session | null> {
  const jeton = jetonEnregistre()
  if (!jeton) return null
  const res = await fetch(`${BASE}api/sejour`, {
    headers: { Authorization: `Bearer ${jeton}` },
  })
  if (!res.ok) {
    oublierJeton()
    return null
  }
  const data = (await res.json()) as { sejour: Sejour; maison: Maison }
  return { jeton, ...data }
}
