import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Jetons de session signés (HMAC-SHA256), sans dépendance externe.
 *
 * Un jeton encode `{ login, exp }` en base64url, suivi de sa signature. On peut
 * ainsi vérifier qu'un jeton est authentique et non expiré sans stocker d'état
 * côté serveur ni renvoyer le mot de passe au navigateur.
 */

const SECRET =
  process.env.SESSION_SECRET ??
  'secret-de-developpement-a-changer-en-production'

/** Durée de validité d'un jeton : 30 jours (couvre largement un séjour). */
const DUREE_MS = 1000 * 60 * 60 * 24 * 30

function base64url(donnees: string): string {
  return Buffer.from(donnees, 'utf8').toString('base64url')
}

function signer(charge: string): string {
  return createHmac('sha256', SECRET).update(charge).digest('base64url')
}

/** Crée un jeton signé pour un login donné. */
export function creerJeton(login: string, maintenant = Date.now()): string {
  const charge = base64url(
    JSON.stringify({ login, exp: maintenant + DUREE_MS }),
  )
  return `${charge}.${signer(charge)}`
}

/**
 * Vérifie un jeton et renvoie le login s'il est valide et non expiré, sinon
 * `null`. La comparaison de signature est à temps constant.
 */
export function verifierJeton(
  jeton: string | undefined,
  maintenant = Date.now(),
): string | null {
  if (!jeton) return null
  const points = jeton.split('.')
  if (points.length !== 2) return null
  const [charge, signature] = points

  const attendue = signer(charge)
  const a = Buffer.from(signature)
  const b = Buffer.from(attendue)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const { login, exp } = JSON.parse(
      Buffer.from(charge, 'base64url').toString('utf8'),
    ) as { login: string; exp: number }
    if (typeof exp !== 'number' || exp < maintenant) return null
    return login
  } catch {
    return null
  }
}
