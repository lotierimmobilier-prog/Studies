import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Jetons de session signés (HMAC-SHA256), sans dépendance externe.
 *
 * Un jeton encode `{ sub, role, exp }` en base64url, suivi de sa signature.
 * `role` vaut « voyageur » (accès au portail) ou « admin » (accès à
 * l'administration). On peut vérifier qu'un jeton est authentique et non expiré
 * sans stocker d'état côté serveur.
 */

const SECRET =
  process.env.SESSION_SECRET ??
  'secret-de-developpement-a-changer-en-production'

/** Durée de validité d'un jeton : 30 jours (couvre largement un séjour). */
const DUREE_MS = 1000 * 60 * 60 * 24 * 30

export type Role = 'voyageur' | 'admin'

export interface Charge {
  sub: string
  role: Role
}

function base64url(donnees: string): string {
  return Buffer.from(donnees, 'utf8').toString('base64url')
}

function signer(charge: string): string {
  return createHmac('sha256', SECRET).update(charge).digest('base64url')
}

/** Crée un jeton signé pour un sujet (code de séjour, ou « admin ») et un rôle. */
export function creerJeton(
  sub: string,
  role: Role,
  maintenant = Date.now(),
): string {
  const charge = base64url(
    JSON.stringify({ sub, role, exp: maintenant + DUREE_MS }),
  )
  return `${charge}.${signer(charge)}`
}

/**
 * Vérifie un jeton et renvoie sa charge (`{ sub, role }`) s'il est valide et non
 * expiré, sinon `null`. La comparaison de signature est à temps constant.
 */
export function verifierJeton(
  jeton: string | undefined,
  maintenant = Date.now(),
): Charge | null {
  if (!jeton) return null
  const points = jeton.split('.')
  if (points.length !== 2) return null
  const [charge, signature] = points

  const attendue = signer(charge)
  const a = Buffer.from(signature)
  const b = Buffer.from(attendue)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const { sub, role, exp } = JSON.parse(
      Buffer.from(charge, 'base64url').toString('utf8'),
    ) as { sub: string; role: Role; exp: number }
    if (typeof exp !== 'number' || exp < maintenant) return null
    if (role !== 'voyageur' && role !== 'admin') return null
    return { sub, role }
  } catch {
    return null
  }
}
