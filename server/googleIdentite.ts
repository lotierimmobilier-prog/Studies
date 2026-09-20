/**
 * Connexion par compte Google.
 *
 * ── La décision qui structure ce fichier ─────────────────────────────────
 *
 * AUCUN script de Google n'est chargé sur le site. Le bouton officiel
 * « Se connecter avec Google » est un bout de JavaScript servi par Google :
 * l'inclure ferait partir l'adresse IP de CHAQUE visiteur vers Google, y
 * compris celles des élèves qui ne cliqueront jamais dessus, et sur un site
 * qui s'adresse à des mineurs (règle 3 de CLAUDE.md) c'est inacceptable.
 *
 * Ici, le bouton est un simple lien vers notre propre serveur. Google
 * n'apprend l'existence d'un élève qu'au moment où celui-ci choisit de
 * cliquer. C'est le seul coût de cette approche : le bouton ne ressemble pas
 * exactement à celui des autres sites.
 *
 * ── Ce qu'on demande à Google, et rien de plus ───────────────────────────
 *
 * Deux portées : « openid » et « email ». Pas « profile » — nous n'avons que
 * faire du prénom, de la photo ni de la langue, et ce qui n'est pas demandé
 * n'a pas à être protégé. Le compte créé ne contient donc rien de plus qu'un
 * compte créé avec un mot de passe : une adresse, chiffrée.
 *
 * ── Sur la vérification du jeton d'identité ──────────────────────────────
 *
 * Le jeton est récupéré par NOTRE serveur, directement auprès de Google, sur
 * une connexion TLS — il ne transite pas par le navigateur de l'élève. Dans
 * ce cas précis, la spécification OpenID Connect (§3.1.3.7) dispense de
 * vérifier la signature : le canal l'authentifie déjà. Nous vérifions en
 * revanche l'émetteur, le destinataire et le fait que Google ait confirmé
 * l'adresse — ces trois contrôles-là ne sont jamais facultatifs.
 */

const AUTORISATION = 'https://accounts.google.com/o/oauth2/v2/auth'
const JETON = 'https://oauth2.googleapis.com/token'
const EMETTEURS = ['https://accounts.google.com', 'accounts.google.com']

export class GoogleNonConfigure extends Error {
  constructor() {
    super('La connexion par compte Google n’est pas configurée sur ce serveur.')
    this.name = 'GoogleNonConfigure'
  }
}

export class GoogleRefuse extends Error {
  constructor(raison: string) {
    super(raison)
    this.name = 'GoogleRefuse'
  }
}

export interface ReglagesGoogle {
  readonly clientId: string
  readonly clientSecret: string
  /**
   * L'adresse exacte à laquelle Google renvoie l'élève. Elle doit figurer au
   * caractère près dans la console Google, sans quoi l'échange est refusé.
   */
  readonly retour: string
}

/**
 * Les réglages lus dans l'environnement, ou `null` si la connexion Google
 * n'est pas installée.
 *
 * `null` plutôt qu'une erreur : ce n'est pas une panne. Un serveur sans
 * identifiants Google fonctionne parfaitement, il propose simplement une
 * façon de moins de se connecter — et l'interface n'affiche pas un bouton
 * qui mènerait à un mur.
 */
export function reglagesGoogle(env: NodeJS.ProcessEnv = process.env): ReglagesGoogle | null {
  const clientId = env.GOOGLE_CLIENT_ID ?? ''
  const clientSecret = env.GOOGLE_CLIENT_SECRET ?? ''
  const retour = env.GOOGLE_REDIRECT_URI ?? ''
  if (clientId === '' || clientSecret === '' || retour === '') return null
  return { clientId, clientSecret, retour }
}

/**
 * L'adresse vers laquelle envoyer l'élève.
 *
 * `state` nous revient tel quel : c'est ce qui nous permet de vérifier que le
 * retour correspond bien à un départ que nous avons initié, et non à un lien
 * fabriqué par quelqu'un d'autre.
 */
export function urlDeDepart(reglages: ReglagesGoogle, etat: string): string {
  const p = new URLSearchParams({
    client_id: reglages.clientId,
    redirect_uri: reglages.retour,
    response_type: 'code',
    scope: 'openid email',
    state: etat,
    // Une adresse déjà vérifiée par Google ne redemande pas de consentement
    // à chaque connexion, mais on ne garde aucun jeton d'accès : pas de
    // « offline », donc pas de jeton de rafraîchissement à protéger.
    prompt: 'select_account',
  })
  return `${AUTORISATION}?${p.toString()}`
}

/** Le contenu utile d'un jeton d'identité Google. */
interface Charge {
  readonly iss?: unknown
  readonly aud?: unknown
  readonly exp?: unknown
  readonly email?: unknown
  readonly email_verified?: unknown
}

/** Décode la charge utile d'un JWT, sans vérifier la signature (cf. en-tête). */
function chargeDuJeton(jwt: string): Charge {
  const morceaux = jwt.split('.')
  if (morceaux.length !== 3) throw new GoogleRefuse('Jeton d’identité illisible.')
  try {
    return JSON.parse(Buffer.from(morceaux[1]!, 'base64url').toString('utf8')) as Charge
  } catch {
    throw new GoogleRefuse('Jeton d’identité illisible.')
  }
}

/**
 * Échange le code reçu contre l'adresse e-mail de l'élève.
 *
 * `recuperer` est injectable : les tests rejouent tout l'échange sans
 * appeler Google, ce qui permet de couvrir les cas de refus — adresse non
 * vérifiée, destinataire inattendu, jeton périmé — qu'on ne peut pas
 * provoquer sur le vrai service.
 */
export async function emailDepuisCode(
  reglages: ReglagesGoogle,
  code: string,
  recuperer: typeof fetch = fetch,
  maintenant: Date = new Date(),
): Promise<string> {
  const reponse = await recuperer(JETON, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: reglages.clientId,
      client_secret: reglages.clientSecret,
      redirect_uri: reglages.retour,
      grant_type: 'authorization_code',
    }).toString(),
  })

  if (!reponse.ok) {
    // Le corps d'erreur de Google peut contenir nos identifiants en écho :
    // on ne le recopie pas dans un message qui finira dans un journal.
    throw new GoogleRefuse(`Google a refusé l’échange (code ${reponse.status}).`)
  }

  const corps = (await reponse.json()) as { id_token?: unknown }
  if (typeof corps.id_token !== 'string') {
    throw new GoogleRefuse('Google n’a pas renvoyé de jeton d’identité.')
  }

  const charge = chargeDuJeton(corps.id_token)

  if (typeof charge.iss !== 'string' || !EMETTEURS.includes(charge.iss)) {
    throw new GoogleRefuse('Jeton d’identité émis par un tiers inattendu.')
  }
  // Le destinataire doit être NOUS. Sans ce contrôle, un jeton obtenu par une
  // autre application pour le même élève ouvrirait une session ici.
  if (charge.aud !== reglages.clientId) {
    throw new GoogleRefuse('Jeton d’identité destiné à une autre application.')
  }
  if (typeof charge.exp !== 'number' || charge.exp * 1000 <= maintenant.getTime()) {
    throw new GoogleRefuse('Jeton d’identité expiré.')
  }
  // L'adresse doit être confirmée par Google. C'est ce qui autorise à ouvrir
  // un compte existant : sans cette confirmation, n'importe qui déclarant
  // l'adresse de quelqu'un d'autre entrerait dans son compte.
  if (charge.email_verified !== true) {
    throw new GoogleRefuse('Google n’a pas confirmé cette adresse e-mail.')
  }
  if (typeof charge.email !== 'string' || !charge.email.includes('@')) {
    throw new GoogleRefuse('Google n’a pas renvoyé d’adresse e-mail.')
  }

  return charge.email.trim().toLowerCase()
}
