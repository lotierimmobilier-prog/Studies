/**
 * Garde d'accès de la console d'administration.
 *
 * Trois barrières, dans cet ordre :
 *
 *   1. HTTPS obligatoire, sauf en local. Sur le VPS, le site sert encore en
 *      HTTP simple : y exposer une console enverrait le jeton et les clés en
 *      clair sur le réseau. Le code refuse plutôt que de faire confiance à
 *      l'exploitant.
 *   2. Une preuve d'identité, de l'une des deux façons ci-dessous.
 *   3. Un verrouillage après échecs répétés, pour qu'un secret ne se devine
 *      pas à la force brute.
 *
 * Deux façons d'entrer, et elles ne se valent pas :
 *
 *   - ADMIN_TOKEN, un secret d'au moins 24 caractères venu de l'environnement,
 *     jamais du coffre : voler le fichier de secrets ne donne pas l'entrée ;
 *   - une session d'un compte dont l'adresse figure dans ADMIN_EMAILS.
 *
 * La seconde est plus commode et PLUS FAIBLE : elle ramène la sécurité de la
 * console à celle d'un mot de passe de dix caractères, là où le jeton en
 * compte quarante. Le verrouillage après cinq échecs s'applique aux deux, et
 * le jeton reste disponible comme voie de secours si un compte est compromis.
 * ADMIN_EMAILS vide — le défaut — laisse le jeton seul maître.
 */

import type { IncomingMessage } from 'node:http'

import { jetonValide } from './secrets'

export type RefusAdmin =
  | { readonly code: 503; readonly erreur: string }
  | { readonly code: 421; readonly erreur: string }
  | { readonly code: 401; readonly erreur: string }
  | { readonly code: 429; readonly erreur: string; readonly reessayerDansS: number }

/** Échecs tolérés avant verrouillage, et durée du verrou. */
export const ECHECS_MAX = 5
export const VERROU_MS = 15 * 60 * 1000

interface Compteur {
  echecs: number
  verrouJusqua: number
}

export class GardeAdmin {
  private compteurs = new Map<string, Compteur>()

  constructor(private maintenant: () => number = Date.now) {}

  /**
   * Vrai si la requête arrive par un canal chiffré, ou depuis la machine
   * elle-même. Derrière nginx, c'est `x-forwarded-proto` qui fait foi.
   */
  private canalSur(req: IncomingMessage): boolean {
    const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0]?.trim()
    if (proto === 'https') return true
    if ((req.socket as { encrypted?: boolean }).encrypted === true) return true
    const hote = String(req.headers.host ?? '')
    return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(hote)
  }

  private clientDe(req: IncomingMessage): string {
    const transmis = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()
    return transmis || req.socket.remoteAddress || 'inconnu'
  }

  /**
   * Adresses autorisées à administrer avec leur compte. Lues à chaque appel
   * pour qu'un changement d'environnement prenne effet au redémarrage sans
   * dépendre d'un ordre d'initialisation.
   */
  private static adressesAdmin(): string[] {
    return String(process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.length > 0)
  }

  /**
   * `null` quand l'accès est accordé ; sinon le refus à renvoyer tel quel.
   *
   * `emailDeSession` résout le porteur d'un jeton de session ; sans elle, seul
   * ADMIN_TOKEN ouvre la porte.
   */
  async verifier(
    req: IncomingMessage,
    emailDeSession?: (jeton: string) => Promise<string | null>,
  ): Promise<RefusAdmin | null> {
    const attendu = process.env.ADMIN_TOKEN
    const admins = GardeAdmin.adressesAdmin()
    const jetonUtilisable = typeof attendu === 'string' && attendu.length >= 24
    const comptesUtilisables = admins.length > 0 && emailDeSession !== undefined
    if (!jetonUtilisable && !comptesUtilisables) {
      return {
        code: 503,
        erreur:
          'Console d’administration désactivée : définissez ADMIN_TOKEN (au moins 24 caractères), ou ADMIN_EMAILS avec des comptes actifs.',
      }
    }
    if (!this.canalSur(req)) {
      return {
        code: 421,
        erreur:
          'La console d’administration exige HTTPS. Sur ce serveur, le site est encore servi en HTTP : configurez le certificat avant de l’utiliser.',
      }
    }

    const client = this.clientDe(req)
    const compteur = this.compteurs.get(client)
    const t = this.maintenant()
    if (compteur && compteur.verrouJusqua > t) {
      return {
        code: 429,
        erreur: 'Trop de tentatives. Réessayez plus tard.',
        reessayerDansS: Math.ceil((compteur.verrouJusqua - t) / 1000),
      }
    }

    const entete = String(req.headers.authorization ?? '')
    const fourni = entete.startsWith('Bearer ') ? entete.slice(7) : ''

    let accorde = false
    if (fourni.length > 0) {
      if (jetonUtilisable && jetonValide(fourni, attendu as string)) {
        accorde = true
      } else if (comptesUtilisables) {
        const email = await (emailDeSession as (j: string) => Promise<string | null>)(fourni)
        accorde = email !== null && admins.includes(email.trim().toLowerCase())
      }
    }

    if (!accorde) {
      const suivant: Compteur = {
        echecs: (compteur?.echecs ?? 0) + 1,
        verrouJusqua: compteur?.verrouJusqua ?? 0,
      }
      if (suivant.echecs >= ECHECS_MAX) {
        suivant.echecs = 0
        suivant.verrouJusqua = t + VERROU_MS
      }
      this.compteurs.set(client, suivant)
      return {
        code: 401,
        erreur: 'Accès refusé : jeton d’administration invalide, ou compte non autorisé.',
      }
    }

    this.compteurs.delete(client)
    return null
  }
}
