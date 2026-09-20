/**
 * Les jetons d'aller-retour de la connexion Google.
 *
 * Deux secrets de très courte durée, gardés en mémoire.
 *
 * ── L'ÉTAT, à l'aller ────────────────────────────────────────────────────
 *
 * Il part avec l'élève vers Google et revient avec lui. Il prouve que le
 * retour correspond à un départ que NOUS avons initié. Sans lui, un lien
 * fabriqué par un tiers et cliqué par l'élève ouvrirait une session dans le
 * compte du tiers — c'est la fixation de session, et elle se règle exactement
 * comme ça.
 *
 * ── LE TICKET, au retour ─────────────────────────────────────────────────
 *
 * Le serveur ne peut pas poser le jeton de session dans le navigateur : ce
 * serveur n'utilise pas de cookie, il attend un en-tête « Authorization » que
 * seule l'application sait envoyer. Le retour de Google, lui, est une
 * navigation ordinaire : aucun en-tête, aucun script à nous.
 *
 * On renvoie donc l'élève vers l'application avec un TICKET dans l'adresse,
 * que l'application échange aussitôt contre le vrai jeton, puis efface de la
 * barre d'adresse. Un secret dans une URL n'est jamais anodin — historique,
 * journaux, en-tête « Referer » — d'où les trois contraintes qui rendent ce
 * ticket peu intéressant à voler :
 *
 *   - il vit une minute ;
 *   - il ne sert qu'une fois, consommé à la lecture ;
 *   - il ne vaut rien seul : il ne donne accès à rien, il s'échange.
 *
 * Le jour où ce serveur gérera des cookies, ce fichier disparaîtra au profit
 * d'un cookie « httpOnly ». En attendant, c'est le compromis assumé.
 */

import { randomBytes } from 'node:crypto'

/** Durée de vie d'un état d'aller : le temps de s'authentifier chez Google. */
const ETAT_MS = 10 * 60 * 1000

/** Durée de vie d'un ticket de retour : le temps d'un chargement de page. */
const TICKET_MS = 60 * 1000

/** Au-delà, on refuse d'en créer : une file qui gonfle est une attaque. */
const MAXIMUM = 500

interface Entree<T> {
  readonly valeur: T
  readonly expireLe: number
}

/**
 * Un magasin de secrets éphémères, à usage unique.
 *
 * En mémoire, donc perdu au redémarrage : c'est voulu. Une connexion
 * interrompue par un redémarrage se refait en un clic, et rien ne justifie
 * d'écrire ces secrets sur un disque.
 */
export class SecretsEphemeres<T> {
  private readonly entrees = new Map<string, Entree<T>>()

  constructor(private readonly dureeMs: number) {}

  private purger(maintenant: number): void {
    for (const [cle, e] of this.entrees) {
      if (e.expireLe <= maintenant) this.entrees.delete(cle)
    }
  }

  /** Crée un secret et le renvoie. Lève si la file a débordé. */
  creer(valeur: T, maintenant: Date = new Date()): string {
    const t = maintenant.getTime()
    this.purger(t)
    if (this.entrees.size >= MAXIMUM) {
      throw new Error('Trop de connexions en cours. Réessaie dans un instant.')
    }
    const cle = randomBytes(32).toString('base64url')
    this.entrees.set(cle, { valeur, expireLe: t + this.dureeMs })
    return cle
  }

  /**
   * Lit un secret ET le supprime.
   *
   * La suppression fait partie de la lecture, sans quoi le même secret
   * servirait deux fois — c'est toute la valeur d'un usage unique.
   */
  consommer(cle: string, maintenant: Date = new Date()): T | null {
    const t = maintenant.getTime()
    this.purger(t)
    const e = this.entrees.get(cle)
    if (e === undefined) return null
    this.entrees.delete(cle)
    return e.expireLe > t ? e.valeur : null
  }

  /** Pour les tests et la console : combien de secrets vivants. */
  get taille(): number {
    this.purger(Date.now())
    return this.entrees.size
  }
}

/** Ce qu'on retient d'un départ vers Google. */
export interface DepartGoogle {
  /** Où renvoyer l'élève dans l'application une fois connecté. */
  readonly retour: string
}

/**
 * Ramène une adresse de retour à un chemin interne sûr.
 *
 * C'est une REDIRECTION OUVERTE qu'on ferme ici. Sans ce filtre, un lien
 * « …/google/debut?retour=https://ailleurs.example » enverrait l'élève chez
 * un tiers — avec le ticket de session dans l'adresse. Le tiers n'aurait plus
 * qu'à l'échanger pour entrer dans le compte.
 *
 * Est accepté : un chemin absolu du site, « /kitetudiant/ ». Sont refusés, et
 * remplacés par la racine : une adresse complète, un chemin relatif à la
 * racine du protocole (« //ailleurs.example », que les navigateurs traitent
 * comme un domaine), un retour à la ligne (injection d'en-tête), et tout ce
 * qui n'est pas un chemin.
 */
export function retourSur(demande: string | null, base = '/'): string {
  if (demande === null || demande === '') return base
  if (!demande.startsWith('/') || demande.startsWith('//')) return base
  if (/[\r\n\\]/.test(demande)) return base
  return demande
}

/** Ajoute un paramètre à un chemin, que celui-ci en ait déjà ou non. */
export function avecParametre(chemin: string, nom: string, valeur: string): string {
  const separateur = chemin.includes('?') ? '&' : '?'
  return `${chemin}${separateur}${nom}=${encodeURIComponent(valeur)}`
}

export const etatsGoogle = new SecretsEphemeres<DepartGoogle>(ETAT_MS)
export const ticketsGoogle = new SecretsEphemeres<{ readonly jeton: string; readonly expireLe: string }>(
  TICKET_MS,
)
