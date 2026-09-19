/**
 * Comptes élèves : inscription, connexion, sessions.
 *
 * Le site s'adresse à des MINEURS (règle 3 de CLAUDE.md). Tout ce fichier est
 * écrit sous cette contrainte, et le choix qui en découle est simple : on
 * stocke le strict nécessaire pour reconnaître quelqu'un, rien d'autre.
 *
 * Ce qui est stocké, et rien de plus :
 *   - l'adresse e-mail, CHIFFRÉE au repos (AES-256-GCM) ;
 *   - un index de recherche, HMAC-SHA256 de l'adresse normalisée, qui permet
 *     de retrouver un compte sans jamais déchiffrer toute la base ;
 *   - une empreinte scrypt du mot de passe, avec son sel ;
 *   - la date d'inscription et celle de la dernière connexion, pour pouvoir
 *     purger ce qui dort.
 *
 * Ce qui n'est PAS stocké : aucune note, aucun bulletin, aucun vœu, aucun
 * prénom, aucune date de naissance. Les réponses au questionnaire ne quittent
 * pas le navigateur. Un vol du fichier ne révèle donc ni qui étudie quoi, ni
 * quelles sont ses notes — et sans le secret maître, pas même les adresses.
 *
 * Les comptes inactifs depuis trois ans sont supprimés à l'ouverture du
 * fichier : une durée de conservation qui ne s'applique pas toute seule n'est
 * pas une durée de conservation.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scrypt as scryptRappel,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const scrypt = promisify(scryptRappel) as (
  motDePasse: string | Buffer,
  sel: string | Buffer,
  longueur: number,
) => Promise<Buffer>

/** Durée de vie d'une session. Au-delà, il faut se reconnecter. */
export const SESSION_JOURS = 30

/** Un compte qui n'a pas servi depuis ce délai est supprimé. */
export const PURGE_APRES_JOURS = 3 * 365

/** Longueur minimale du mot de passe. Un site scolaire n'est pas une banque,
 *  mais dix caractères restent le plancher raisonnable. */
export const MOT_DE_PASSE_MINIMUM = 10

/** Au-delà, on refuse : scrypt sur une entrée démesurée est un déni de service. */
const MOT_DE_PASSE_MAXIMUM = 200

/** Limite du RFC 5321 pour une adresse complète. */
const EMAIL_MAXIMUM = 254

const ECHECS_MAX = 5
const VERROU_MS = 15 * 60 * 1000

export class ComptesNonConfigures extends Error {
  constructor() {
    super(
      'Comptes indisponibles : la variable d’environnement COMPTES_MASTER_KEY n’est pas définie.',
    )
    this.name = 'ComptesNonConfigures'
  }
}

export class InscriptionInvalide extends Error {
  constructor(raison: string) {
    super(raison)
    this.name = 'InscriptionInvalide'
  }
}

export class EmailDejaInscrit extends Error {
  constructor() {
    super('Cette adresse a déjà un compte. Connecte-toi plutôt.')
    this.name = 'EmailDejaInscrit'
  }
}

export class IdentifiantsRefuses extends Error {
  constructor() {
    // Message volontairement identique pour un e-mail inconnu et un mot de
    // passe faux : dire lequel des deux est en cause permettrait d'énumérer
    // les adresses inscrites.
    super('Adresse ou mot de passe incorrect.')
    this.name = 'IdentifiantsRefuses'
  }
}

export class TropDEssais extends Error {
  constructor(public readonly secondes: number) {
    super(`Trop de tentatives. Réessaie dans ${Math.ceil(secondes / 60)} minutes.`)
    this.name = 'TropDEssais'
  }
}

interface CompteStocke {
  readonly index: string
  readonly emailChiffre: string
  readonly nonce: string
  readonly baliseAuth: string
  readonly selMotDePasse: string
  readonly empreinteMotDePasse: string
  readonly inscritLe: string
  readonly vuLe: string
}

interface SessionStockee {
  readonly empreinteJeton: string
  readonly index: string
  readonly expireLe: string
}

interface FichierComptes {
  readonly version: 1
  readonly sel: string
  readonly comptes: readonly CompteStocke[]
  readonly sessions: readonly SessionStockee[]
}

export interface SessionOuverte {
  readonly jeton: string
  readonly expireLe: string
}

export interface EtatComptes {
  readonly configure: boolean
  readonly comptes: number
  readonly sessionsActives: number
}

/**
 * Normalise une adresse avant comparaison. On se contente de retirer les
 * espaces et de passer en minuscules : aucune règle propre à un fournisseur
 * (les points de Gmail, par exemple) n'est appliquée, ce serait deviner.
 */
function normaliser(email: string): string {
  return email.trim().toLowerCase()
}

/** Validation délibérément simple : une adresse n'est vraiment vérifiée que
 *  par un envoi, et nous n'envoyons rien. On écarte l'absurde, pas plus. */
function emailPlausible(email: string): boolean {
  if (email.length === 0 || email.length > EMAIL_MAXIMUM) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)
}

function enJours(date: Date, jours: number): Date {
  return new Date(date.getTime() + jours * 24 * 60 * 60 * 1000)
}

/**
 * Dépôt de comptes. Sans secret maître, il se déclare non configuré et refuse
 * toute écriture : mieux vaut une porte annoncée fermée qu'un chiffrement de
 * façade avec une clé par défaut.
 */
export class DepotComptes {
  private cache: FichierComptes | null = null
  private readonly echecs = new Map<string, { nombre: number; jusqua: number }>()

  constructor(
    private readonly chemin: string,
    private readonly secretMaitre: string | undefined,
  ) {}

  get configure(): boolean {
    return typeof this.secretMaitre === 'string' && this.secretMaitre.length >= 16
  }

  private exigerConfiguration(): string {
    if (!this.configure) throw new ComptesNonConfigures()
    return this.secretMaitre as string
  }

  private async charger(maintenant: Date): Promise<FichierComptes> {
    if (this.cache) return this.cache
    let fichier: FichierComptes
    try {
      fichier = JSON.parse(await readFile(this.chemin, 'utf8')) as FichierComptes
    } catch {
      fichier = { version: 1, sel: randomBytes(16).toString('hex'), comptes: [], sessions: [] }
    }
    // La purge s'applique à l'ouverture : une règle de conservation qui ne
    // s'exécute jamais n'en est pas une.
    const limite = enJours(maintenant, -PURGE_APRES_JOURS).toISOString()
    const comptes = fichier.comptes.filter((c) => c.vuLe > limite)
    const vivants = new Set(comptes.map((c) => c.index))
    const sessions = fichier.sessions.filter(
      (s) => s.expireLe > maintenant.toISOString() && vivants.has(s.index),
    )
    this.cache = { ...fichier, comptes, sessions }
    return this.cache
  }

  private async enregistrer(fichier: FichierComptes): Promise<void> {
    this.cache = fichier
    await mkdir(dirname(this.chemin), { recursive: true })
    await writeFile(this.chemin, JSON.stringify(fichier, null, 2), { mode: 0o600 })
    await chmod(this.chemin, 0o600)
  }

  /** Clé de chiffrement des adresses, dérivée du secret maître. */
  private async cleChiffrement(sel: string): Promise<Buffer> {
    return scrypt(this.exigerConfiguration(), `${sel}:email`, 32)
  }

  /** Clé de l'index de recherche. Distincte de la précédente : une même clé
   *  pour chiffrer et pour indexer mélange deux usages sans bénéfice. */
  private async cleIndex(sel: string): Promise<Buffer> {
    return scrypt(this.exigerConfiguration(), `${sel}:index`, 32)
  }

  private async indexDe(email: string, sel: string): Promise<string> {
    const cle = await this.cleIndex(sel)
    return createHmac('sha256', cle).update(normaliser(email)).digest('hex')
  }

  private async chiffrerEmail(
    email: string,
    sel: string,
  ): Promise<{ emailChiffre: string; nonce: string; baliseAuth: string }> {
    const cle = await this.cleChiffrement(sel)
    const nonce = randomBytes(12)
    const chiffreur = createCipheriv('aes-256-gcm', cle, nonce)
    const chiffre = Buffer.concat([chiffreur.update(normaliser(email), 'utf8'), chiffreur.final()])
    return {
      emailChiffre: chiffre.toString('base64'),
      nonce: nonce.toString('base64'),
      baliseAuth: chiffreur.getAuthTag().toString('base64'),
    }
  }

  /** Déchiffre une adresse. Réservé à l'export d'un compte à son titulaire ;
   *  aucune route ne liste les adresses. */
  async dechiffrerEmail(compte: CompteStocke, sel: string): Promise<string> {
    const cle = await this.cleChiffrement(sel)
    const dechiffreur = createDecipheriv('aes-256-gcm', cle, Buffer.from(compte.nonce, 'base64'))
    dechiffreur.setAuthTag(Buffer.from(compte.baliseAuth, 'base64'))
    return Buffer.concat([
      dechiffreur.update(Buffer.from(compte.emailChiffre, 'base64')),
      dechiffreur.final(),
    ]).toString('utf8')
  }

  private async empreinte(motDePasse: string, sel: string): Promise<string> {
    return (await scrypt(motDePasse, sel, 64)).toString('hex')
  }

  private static empreinteJeton(jeton: string): string {
    return createHmac('sha256', 'session').update(jeton).digest('hex')
  }

  private valider(email: string, motDePasse: string): void {
    if (!emailPlausible(normaliser(email)))
      throw new InscriptionInvalide('Cette adresse e-mail ne semble pas valide.')
    if (motDePasse.length < MOT_DE_PASSE_MINIMUM)
      throw new InscriptionInvalide(
        `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MINIMUM} caractères.`,
      )
    if (motDePasse.length > MOT_DE_PASSE_MAXIMUM)
      throw new InscriptionInvalide('Ce mot de passe est trop long.')
  }

  private async ouvrirSession(
    fichier: FichierComptes,
    index: string,
    maintenant: Date,
  ): Promise<SessionOuverte> {
    const jeton = randomBytes(32).toString('base64url')
    const expireLe = enJours(maintenant, SESSION_JOURS).toISOString()
    await this.enregistrer({
      ...fichier,
      sessions: [
        ...fichier.sessions,
        { empreinteJeton: DepotComptes.empreinteJeton(jeton), index, expireLe },
      ],
    })
    return { jeton, expireLe }
  }

  async inscrire(
    email: string,
    motDePasse: string,
    maintenant: Date = new Date(),
  ): Promise<SessionOuverte> {
    this.exigerConfiguration()
    this.valider(email, motDePasse)
    const fichier = await this.charger(maintenant)
    const index = await this.indexDe(email, fichier.sel)
    if (fichier.comptes.some((c) => c.index === index)) throw new EmailDejaInscrit()

    const selMotDePasse = randomBytes(16).toString('hex')
    const compte: CompteStocke = {
      index,
      ...(await this.chiffrerEmail(email, fichier.sel)),
      selMotDePasse,
      empreinteMotDePasse: await this.empreinte(motDePasse, selMotDePasse),
      inscritLe: maintenant.toISOString(),
      vuLe: maintenant.toISOString(),
    }
    return this.ouvrirSession(
      { ...fichier, comptes: [...fichier.comptes, compte] },
      index,
      maintenant,
    )
  }

  async connecter(
    email: string,
    motDePasse: string,
    maintenant: Date = new Date(),
  ): Promise<SessionOuverte> {
    this.exigerConfiguration()
    const fichier = await this.charger(maintenant)
    const index = await this.indexDe(email, fichier.sel)

    const verrou = this.echecs.get(index)
    if (verrou && verrou.nombre >= ECHECS_MAX && verrou.jusqua > maintenant.getTime()) {
      throw new TropDEssais((verrou.jusqua - maintenant.getTime()) / 1000)
    }

    const compte = fichier.comptes.find((c) => c.index === index)
    // Même en l'absence de compte, on calcule une empreinte : sans cela, le
    // temps de réponse dirait si l'adresse existe.
    const selEssai = compte?.selMotDePasse ?? randomBytes(16).toString('hex')
    const attendu = compte?.empreinteMotDePasse ?? (await this.empreinte('—', selEssai))
    const obtenu = await this.empreinte(motDePasse, selEssai)
    const bon =
      compte !== undefined &&
      obtenu.length === attendu.length &&
      timingSafeEqual(Buffer.from(obtenu, 'hex'), Buffer.from(attendu, 'hex'))

    if (!bon) {
      const n = (verrou?.nombre ?? 0) + 1
      this.echecs.set(index, { nombre: n, jusqua: maintenant.getTime() + VERROU_MS })
      throw new IdentifiantsRefuses()
    }
    this.echecs.delete(index)
    const comptes = fichier.comptes.map((c) =>
      c.index === index ? { ...c, vuLe: maintenant.toISOString() } : c,
    )
    return this.ouvrirSession({ ...fichier, comptes }, index, maintenant)
  }

  /** Vrai si le jeton correspond à une session vivante. */
  async sessionValide(jeton: string, maintenant: Date = new Date()): Promise<boolean> {
    if (!this.configure || jeton.length === 0) return false
    const fichier = await this.charger(maintenant)
    const empreinte = DepotComptes.empreinteJeton(jeton)
    return fichier.sessions.some(
      (s) => s.empreinteJeton === empreinte && s.expireLe > maintenant.toISOString(),
    )
  }

  async deconnecter(jeton: string, maintenant: Date = new Date()): Promise<void> {
    if (!this.configure) return
    const fichier = await this.charger(maintenant)
    const empreinte = DepotComptes.empreinteJeton(jeton)
    await this.enregistrer({
      ...fichier,
      sessions: fichier.sessions.filter((s) => s.empreinteJeton !== empreinte),
    })
  }

  async etat(maintenant: Date = new Date()): Promise<EtatComptes> {
    if (!this.configure) return { configure: false, comptes: 0, sessionsActives: 0 }
    const fichier = await this.charger(maintenant)
    return {
      configure: true,
      comptes: fichier.comptes.length,
      sessionsActives: fichier.sessions.length,
    }
  }
}

/** Lit le jeton de session d'un en-tête `Authorization: Bearer …`. */
export function jetonDeLEnTete(entete: string | undefined): string {
  if (typeof entete !== 'string') return ''
  const m = /^Bearer\s+(.+)$/i.exec(entete.trim())
  return m?.[1]?.trim() ?? ''
}
