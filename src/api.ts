import type { Configuration, Session } from './types'

/**
 * Appels à l'API du portail. En développement, Vite proxifie `/api` vers le
 * serveur Node ; en production, nginx fait de même.
 */

const CLE_JETON = 'portail-code-jeton'
const CLE_JETON_ADMIN = 'portail-admin-jeton'

/**
 * Préfixe des appels API : `/` en dev, `/<sous-chemin>/` en prod (injecté par
 * Vite via `base`), pour fonctionner sous un sous-dossier (ex. `/maisoncapendu/`).
 */
const BASE = import.meta.env.BASE_URL

async function lireErreur(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { erreur?: string }
    return data.erreur ?? 'Une erreur est survenue.'
  } catch {
    return 'Une erreur est survenue.'
  }
}

// ----------------------------------------------------------------- voyageur

export function jetonEnregistre(): string | null {
  return localStorage.getItem(CLE_JETON)
}

export function oublierJeton(): void {
  localStorage.removeItem(CLE_JETON)
}

/** Connexion voyageur par simple code. */
export async function seConnecter(code: string): Promise<Session> {
  const res = await fetch(`${BASE}api/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error(await lireErreur(res))
  const data = (await res.json()) as Session
  localStorage.setItem(CLE_JETON, data.jeton)
  return data
}

/** Restaure une session voyageur à partir du jeton enregistré. */
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
  const data = (await res.json()) as Omit<Session, 'jeton'>
  return { jeton, ...data }
}

// -------------------------------------------------------------------- admin

export function jetonAdminEnregistre(): string | null {
  return localStorage.getItem(CLE_JETON_ADMIN)
}

export function oublierJetonAdmin(): void {
  localStorage.removeItem(CLE_JETON_ADMIN)
}

/** Connexion administrateur par mot de passe. */
export async function seConnecterAdmin(motDePasse: string): Promise<string> {
  const res = await fetch(`${BASE}api/admin/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motDePasse }),
  })
  if (!res.ok) throw new Error(await lireErreur(res))
  const { jeton } = (await res.json()) as { jeton: string }
  localStorage.setItem(CLE_JETON_ADMIN, jeton)
  return jeton
}

/** Charge la configuration complète (jeton admin requis). */
export async function chargerConfigAdmin(): Promise<Configuration> {
  const jeton = jetonAdminEnregistre()
  if (!jeton) throw new Error('Non connecté.')
  const res = await fetch(`${BASE}api/admin/config`, {
    headers: { Authorization: `Bearer ${jeton}` },
  })
  if (res.status === 401) {
    oublierJetonAdmin()
    throw new Error('Session administrateur expirée.')
  }
  if (!res.ok) throw new Error(await lireErreur(res))
  return (await res.json()) as Configuration
}

/** Enregistre la configuration complète (jeton admin requis). */
export async function enregistrerConfigAdmin(
  config: Configuration,
): Promise<void> {
  const jeton = jetonAdminEnregistre()
  if (!jeton) throw new Error('Non connecté.')
  const res = await fetch(`${BASE}api/admin/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jeton}`,
    },
    body: JSON.stringify(config),
  })
  if (res.status === 401) {
    oublierJetonAdmin()
    throw new Error('Session administrateur expirée.')
  }
  if (!res.ok) throw new Error(await lireErreur(res))
}
