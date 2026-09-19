/**
 * Appels de la console d'administration.
 *
 * Le jeton vit en `sessionStorage` : il disparaît à la fermeture de l'onglet.
 * Le mettre en `localStorage` le laisserait traîner sur la machine, ce qui
 * n'est pas acceptable pour un secret d'exploitation.
 */

export interface EtatSecret {
  readonly nom: string
  readonly configure: boolean
  readonly provenance: 'environnement' | 'coffre' | 'aucune'
  readonly fin: string | null
  readonly enregistreLe: string | null
}

export interface EtatBareme {
  readonly cle: string
  readonly libelle: string
  readonly millesime: string | null
  readonly verifieLe: string | null
  readonly perime: boolean
  readonly vide: boolean
}

export interface EtatSysteme {
  readonly le: string
  readonly secrets: readonly EtatSecret[]
  readonly baremes: readonly EtatBareme[]
  readonly millesimes: readonly { readonly millesime: string; readonly retours: number }[]
  readonly comptes: {
    readonly configure: boolean
    readonly comptes: number
    readonly sessionsActives: number
  }
}

const CLE_JETON = 'kitetudiant.admin.jeton'

export function lireJeton(): string {
  try {
    return sessionStorage.getItem(CLE_JETON) ?? ''
  } catch {
    return ''
  }
}

export function ecrireJeton(jeton: string): void {
  try {
    if (jeton) sessionStorage.setItem(CLE_JETON, jeton)
    else sessionStorage.removeItem(CLE_JETON)
  } catch {
    // Stockage refusé : le jeton ne survivra pas au rechargement, c'est tout.
  }
}

export class ErreurAdmin extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message)
  }
}

async function appeler<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`/api/admin${chemin}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${lireJeton()}`,
    },
  })
  const corps: unknown = await reponse.json().catch(() => ({}))
  if (!reponse.ok) {
    const message =
      typeof corps === 'object' && corps !== null && 'erreur' in corps
        ? String((corps as { erreur: unknown }).erreur)
        : `Erreur ${reponse.status}`
    throw new ErreurAdmin(message, reponse.status)
  }
  return corps as T
}

export function chercherEtat(): Promise<EtatSysteme> {
  return appeler<EtatSysteme>('/etat')
}

export function enregistrerCle(nom: string, valeur: string): Promise<EtatSecret> {
  return appeler<EtatSecret>('/cles', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, valeur }),
  })
}

export function oublierCle(nom: string): Promise<{ ok: boolean }> {
  return appeler<{ ok: boolean }>(`/cles?nom=${encodeURIComponent(nom)}`, { method: 'DELETE' })
}
