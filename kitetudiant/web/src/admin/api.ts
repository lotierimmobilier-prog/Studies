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

import { BASE_API } from '../donnees.ts'
import type { Article } from '../../../packages/articles/src/index.ts'

const CLE_JETON = 'kitetudiant.admin.jeton'
/** Session d'élève ordinaire, posée par le site (voir donnees.ts). */
const CLE_SESSION_SITE = 'kitetudiant.session'

/**
 * Jeton à présenter à l'API d'administration.
 *
 * Deux origines possibles, dans cet ordre : le jeton d'exploitation saisi ici,
 * puis, à défaut, la session du compte avec lequel on navigue déjà. Le serveur
 * accepte la seconde si l'adresse figure dans ADMIN_EMAILS — c'est ce qui
 * évite de ressaisir un secret de quarante caractères quand on est déjà
 * connecté. Il tranche, pas nous : ici on se contente de proposer.
 */
export function lireJeton(): string {
  try {
    const saisi = sessionStorage.getItem(CLE_JETON)
    if (saisi) return saisi
  } catch {
    /* stockage refusé : on tente la session du site */
  }
  try {
    return localStorage.getItem(CLE_SESSION_SITE) ?? ''
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
  const reponse = await fetch(`${BASE_API}/admin${chemin}`, {
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

/* ------------------------------------------------------------- articles */

/**
 * Les articles écrits depuis la console.
 *
 * Ceux du dépôt (kitetudiant/packages/articles) ne passent pas par ici : ils
 * sont versionnés et pré-rendus au build. La console ne gère que les ajouts
 * postérieurs — et les corrections d'un article du dépôt, qu'elle recouvre en
 * republiant sous le même identifiant.
 */
export function listerArticles(): Promise<readonly Article[]> {
  return appeler<readonly Article[]>('/articles')
}

/** Ce que le formulaire envoie. Le serveur valide, normalise et tranche. */
export interface SaisieArticle {
  readonly titre: string
  readonly chapeau: string
  /** Texte brut, dans la mini-syntaxe de `enBlocs` (« ## », « - », « > »). */
  readonly corps: string
  readonly motsCles: readonly string[]
  /** Forcé pour recouvrir un article existant ; sinon déduit du titre. */
  readonly slug?: string
}

export function publierArticle(saisie: SaisieArticle): Promise<Article> {
  return appeler<Article>('/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saisie),
  })
}

export function retirerArticle(slug: string): Promise<{ ok: boolean }> {
  return appeler<{ ok: boolean }>(`/articles?slug=${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
}
