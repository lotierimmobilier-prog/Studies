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
  /**
   * À la CONNEXION, le message par défaut est volontairement ambigu : dire
   * si c'est l'adresse ou le mot de passe qui est en cause permettrait
   * d'énumérer les adresses inscrites.
   *
   * Ailleurs, cette ambiguïté n'a plus d'objet et devient nuisible. Sur un
   * changement de mot de passe, la session identifie déjà le compte : il n'y
   * a rien à énumérer, et « adresse ou mot de passe incorrect » désigne une
   * adresse que l'élève n'a pas saisie. Il cherche alors une faute de frappe
   * dans un champ qui n'existe pas.
   */
  constructor(raison = 'Adresse ou mot de passe incorrect.') {
    super(raison)
    this.name = 'IdentifiantsRefuses'
  }
}

export class TropDEssais extends Error {
  constructor(public readonly secondes: number) {
    super(`Trop de tentatives. Réessaie dans ${Math.ceil(secondes / 60)} minutes.`)
    this.name = 'TropDEssais'
  }
}

export interface CompteStocke {
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

/**
 * Ce que le site sait d'un élève. Cette liste EST la réponse à « quelles sont
 * mes coordonnées ? » : il n'y en a pas d'autres, et l'écran le dit.
 *
 * Pas de nom, pas de prénom, pas d'adresse postale, pas de téléphone, pas de
 * date de naissance. Ce n'est pas un champ qu'on aurait oublié d'ajouter :
 * la règle 3 de CLAUDE.md impose la minimisation parce que les titulaires
 * sont MINEURS, et rien dans le calcul n'a besoin de ces données. Seule la
 * commune sert à chiffrer un loyer, et elle reste dans le navigateur avec le
 * reste des réponses.
 */
export interface ProfilCompte {
  readonly email: string
  readonly inscritLe: string
  readonly vuLe: string
  /** Fin de la session en cours. Au-delà, il faudra se reconnecter. */
  readonly sessionExpireLe: string
}

export interface EtatComptes {
  readonly configure: boolean
  readonly comptes: number
  readonly sessionsActives: number
}

/**
 * Les compteurs de comptes, pour la console d'administration.
 *
 * ── Ce qui n'y figure pas, et pourquoi ───────────────────────────────────
 *
 * Aucune adresse. Pas même une liste partielle, pas même hachée. Le fichier
 * des comptes chiffre les adresses au repos précisément pour qu'on ne puisse
 * pas les énumérer ; une fonction d'administration qui les déchiffrerait en
 * bloc annulerait cette protection, sur une base d'utilisateurs MINEURS
 * (règle 3 de CLAUDE.md).
 *
 * Ce qui est rendu, ce sont des COMPTES : combien, depuis quand, à quel
 * rythme. C'est ce qui sert à piloter, et cela ne désigne personne.
 *
 * ── Sur la purge ─────────────────────────────────────────────────────────
 *
 * `bientotPurges` est le nombre de comptes qui atteindront leurs trois ans
 * d'inactivité dans les quatre-vingt-dix jours. Une durée de conservation
 * qu'on ne voit pas approcher est une durée qu'on découvre après coup.
 */
export interface StatistiquesComptes {
  readonly configure: boolean
  readonly comptes: number
  readonly sessionsActives: number
  /** Créations par jour, en ordre chronologique. */
  readonly creationsParJour: readonly { readonly le: string; readonly nombre: number }[]
  /** Comptes vus au moins une fois dans les trente derniers jours. */
  readonly actifs30j: number
  readonly bientotPurges: number
  readonly premierCompteLe: string | null
  readonly dernierCompteLe: string | null
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

  /**
   * Ouvre une session à partir d'une adresse confirmée par un fournisseur
   * d'identité externe, en créant le compte s'il n'existe pas encore.
   *
   * ── Deux points qui méritent d'être explicites ─────────────────────────
   *
   * 1. LE COMPTE CRÉÉ N'A PAS DE MOT DE PASSE UTILISABLE. On lui pose une
   *    empreinte tirée d'un secret aléatoire que personne ne connaît, pas
   *    même nous. Laisser un champ vide aurait été plus simple et beaucoup
   *    plus dangereux : toute comparaison future avec une chaîne vide aurait
   *    ouvert le compte.
   *
   * 2. UN COMPTE EXISTANT EST REJOINT, PAS DUPLIQUÉ. Si l'élève s'était
   *    inscrit avec un mot de passe puis revient par le fournisseur, il
   *    retrouve son compte. C'est ce que l'on attend, et c'est sûr à une
   *    condition, vérifiée en amont : que le fournisseur ait confirmé que
   *    l'adresse lui appartient. Sans cette confirmation, quiconque
   *    déclarerait l'adresse d'un autre entrerait chez lui.
   *
   * Le compteur d'échecs n'est pas consulté : il protège la devinette de mot
   * de passe, et il n'y a pas de mot de passe à deviner ici.
   */
  async ouvrirParFournisseur(
    email: string,
    maintenant: Date = new Date(),
  ): Promise<SessionOuverte> {
    this.exigerConfiguration()
    const fichier = await this.charger(maintenant)
    const index = await this.indexDe(email, fichier.sel)
    const existant = fichier.comptes.find((c) => c.index === index)

    if (existant !== undefined) {
      const comptes = fichier.comptes.map((c) =>
        c.index === index ? { ...c, vuLe: maintenant.toISOString() } : c,
      )
      return this.ouvrirSession({ ...fichier, comptes }, index, maintenant)
    }

    const selMotDePasse = randomBytes(16).toString('hex')
    const compte: CompteStocke = {
      index,
      ...(await this.chiffrerEmail(email, fichier.sel)),
      selMotDePasse,
      // Un secret jetable, aussitôt oublié : le compte n'a pas de mot de
      // passe, et aucune saisie ne pourra jamais correspondre.
      empreinteMotDePasse: await this.empreinte(randomBytes(32).toString('hex'), selMotDePasse),
      inscritLe: maintenant.toISOString(),
      vuLe: maintenant.toISOString(),
    }
    return this.ouvrirSession(
      { ...fichier, comptes: [...fichier.comptes, compte] },
      index,
      maintenant,
    )
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

  /**
   * Adresse du titulaire d'une session, ou null si la session n'est pas
   * valide. Réservé à la reconnaissance des administrateurs : c'est le seul
   * endroit où une adresse est déchiffrée, et elle ne ressort jamais vers le
   * navigateur.
   */
  async emailDeSession(jeton: string, maintenant: Date = new Date()): Promise<string | null> {
    if (!this.configure || jeton.length === 0) return null
    const fichier = await this.charger(maintenant)
    const empreinte = DepotComptes.empreinteJeton(jeton)
    const session = fichier.sessions.find(
      (s) => s.empreinteJeton === empreinte && s.expireLe > maintenant.toISOString(),
    )
    if (session === undefined) return null
    const compte = fichier.comptes.find((c) => c.index === session.index)
    if (compte === undefined) return null
    try {
      return await this.dechiffrerEmail(compte, fichier.sel)
    } catch {
      // Secret maître changé depuis l'inscription : l'adresse est illisible.
      // Mieux vaut refuser l'accès que de deviner à qui appartient ce compte.
      return null
    }
  }

  /**
   * L'enregistrement chiffré du titulaire d'une session, tel qu'il est stocké.
   *
   * Sert à RECOPIER un compte vers PostgreSQL sans jamais déchiffrer son
   * adresse : la base reçoit le chiffré, le nonce et la balise
   * d'authentification tels quels, et l'index sert de clé de recherche. Le
   * secret maître ne sort donc pas de ce fichier, et la recopie ne crée
   * aucun instant où une adresse existe en clair quelque part.
   *
   * `null` quand la session est inconnue ou expirée.
   */
  async enregistrementDeSession(
    jeton: string,
    maintenant: Date = new Date(),
  ): Promise<CompteStocke | null> {
    if (!this.configure || jeton.length === 0) return null
    const fichier = await this.charger(maintenant)
    const empreinte = DepotComptes.empreinteJeton(jeton)
    const session = fichier.sessions.find(
      (s) => s.empreinteJeton === empreinte && s.expireLe > maintenant.toISOString(),
    )
    if (session === undefined) return null
    return fichier.comptes.find((c) => c.index === session.index) ?? null
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

  /**
   * Le profil du titulaire d'une session.
   *
   * L'adresse est déchiffrée ici et renvoyée au navigateur — contrairement à
   * `emailDeSession`, qui sert à reconnaître un administrateur et ne sort
   * jamais. C'est assumé : montrer à quelqu'un l'adresse sous laquelle il est
   * inscrit est la seule façon qu'il ait de vérifier laquelle c'est, et il
   * vient de prouver qu'il détient la session.
   */
  async profil(jeton: string, maintenant: Date = new Date()): Promise<ProfilCompte | null> {
    if (!this.configure || jeton.length === 0) return null
    const fichier = await this.charger(maintenant)
    const empreinte = DepotComptes.empreinteJeton(jeton)
    const session = fichier.sessions.find(
      (s) => s.empreinteJeton === empreinte && s.expireLe > maintenant.toISOString(),
    )
    if (session === undefined) return null
    const compte = fichier.comptes.find((c) => c.index === session.index)
    if (compte === undefined) return null
    try {
      return {
        email: await this.dechiffrerEmail(compte, fichier.sel),
        inscritLe: compte.inscritLe,
        vuLe: compte.vuLe,
        sessionExpireLe: session.expireLe,
      }
    } catch {
      // Secret maître changé depuis l'inscription : l'adresse est illisible.
      return null
    }
  }

  /**
   * Change le mot de passe, l'ANCIEN à l'appui.
   *
   * Exiger l'ancien n'est pas une formalité : une session vole ou s'emprunte
   * — un téléphone laissé déverrouillé suffit —, et sans cette vérification
   * celui qui la détient verrouillerait le compte pour son titulaire.
   *
   * Toutes les AUTRES sessions tombent, et celle-ci seule survit. C'est le
   * geste qu'on attend d'un changement de mot de passe : si quelqu'un d'autre
   * était connecté, il ne l'est plus ; et l'élève qui vient de le changer
   * n'est pas déconnecté par sa propre précaution.
   */
  async changerMotDePasse(
    jeton: string,
    ancien: string,
    nouveau: string,
    maintenant: Date = new Date(),
  ): Promise<void> {
    this.exigerConfiguration()
    const fichier = await this.charger(maintenant)
    const empreinte = DepotComptes.empreinteJeton(jeton)
    const session = fichier.sessions.find(
      (s) => s.empreinteJeton === empreinte && s.expireLe > maintenant.toISOString(),
    )
    const compte =
      session === undefined
        ? undefined
        : fichier.comptes.find((c) => c.index === session.index)
    if (session === undefined || compte === undefined) {
      throw new IdentifiantsRefuses('Session expirée ou invalide. Reconnecte-toi.')
    }

    // Le nouveau mot de passe est validé AVANT de vérifier l'ancien : sinon,
    // un mot de passe trop court renverrait « identifiants refusés » et
    // laisserait croire à une erreur de saisie de l'ancien.
    if (nouveau.length < MOT_DE_PASSE_MINIMUM) {
      throw new InscriptionInvalide(
        `Le nouveau mot de passe est trop court : ${MOT_DE_PASSE_MINIMUM} caractères au moins, ${nouveau.length} saisis.`,
      )
    }
    if (nouveau.length > MOT_DE_PASSE_MAXIMUM) {
      throw new InscriptionInvalide('Le nouveau mot de passe est trop long.')
    }

    const attendu = compte.empreinteMotDePasse
    const obtenu = await this.empreinte(ancien, compte.selMotDePasse)
    const bon =
      obtenu.length === attendu.length &&
      timingSafeEqual(Buffer.from(obtenu, 'hex'), Buffer.from(attendu, 'hex'))
    if (!bon) throw new IdentifiantsRefuses('Ton mot de passe actuel n’est pas le bon.')

    // Sel neuf : réutiliser l'ancien laisserait deux empreintes comparables
    // dans les sauvegardes successives du fichier.
    const selMotDePasse = randomBytes(16).toString('hex')
    const empreinteMotDePasse = await this.empreinte(nouveau, selMotDePasse)
    await this.enregistrer({
      ...fichier,
      comptes: fichier.comptes.map((c) =>
        c.index === compte.index ? { ...c, selMotDePasse, empreinteMotDePasse } : c,
      ),
      sessions: fichier.sessions.filter(
        (s) => s.index !== compte.index || s.empreinteJeton === empreinte,
      ),
    })
  }

  /**
   * Efface le compte et toutes ses sessions.
   *
   * Sans ancien mot de passe : quelqu'un qui détient la session peut déjà
   * tout voir, et exiger un secret pour PARTIR transformerait un droit en
   * parcours d'obstacles. Le titulaire est mineur, l'effacement doit être
   * plus facile que l'inscription, pas l'inverse.
   *
   * Rien ne survit côté serveur — ni adresse chiffrée, ni empreinte, ni
   * index. Les réponses et les cartes, elles, n'y ont jamais été : elles
   * vivent dans le navigateur, et l'écran dit comment les effacer.
   */
  async supprimerCompte(jeton: string, maintenant: Date = new Date()): Promise<boolean> {
    if (!this.configure || jeton.length === 0) return false
    const fichier = await this.charger(maintenant)
    const empreinte = DepotComptes.empreinteJeton(jeton)
    const session = fichier.sessions.find((s) => s.empreinteJeton === empreinte)
    if (session === undefined) return false
    await this.enregistrer({
      ...fichier,
      comptes: fichier.comptes.filter((c) => c.index !== session.index),
      sessions: fichier.sessions.filter((s) => s.index !== session.index),
    })
    return true
  }

  /**
   * Les compteurs, sans qu'aucune adresse ne quitte le chiffrement.
   *
   * Tout ce qui est lu ici — dates d'inscription, dates de dernière visite,
   * sessions — figure déjà en clair dans le fichier : ce sont des dates, pas
   * des identités. Le champ `emailChiffre` n'est jamais touché.
   */
  async statistiques(maintenant: Date = new Date()): Promise<StatistiquesComptes> {
    if (!this.configure) {
      return {
        configure: false,
        comptes: 0,
        sessionsActives: 0,
        creationsParJour: [],
        actifs30j: 0,
        bientotPurges: 0,
        premierCompteLe: null,
        dernierCompteLe: null,
      }
    }
    const fichier = await this.charger(maintenant)
    const jours = new Map<string, number>()
    for (const c of fichier.comptes) {
      const jour = c.inscritLe.slice(0, 10)
      jours.set(jour, (jours.get(jour) ?? 0) + 1)
    }
    const ms = maintenant.getTime()
    const ilYA = (n: number): string => new Date(ms - n * 86400_000).toISOString()
    const seuilActif = ilYA(30)
    // Purgé à PURGE_APRES_JOURS d'inactivité : « bientôt » veut donc dire
    // « vu pour la dernière fois il y a plus de (purge − 90) jours ».
    const seuilPurge = ilYA(PURGE_APRES_JOURS - 90)
    const dates = fichier.comptes.map((c) => c.inscritLe).sort()

    return {
      configure: true,
      comptes: fichier.comptes.length,
      sessionsActives: fichier.sessions.length,
      creationsParJour: [...jours.entries()]
        .map(([le, nombre]) => ({ le, nombre }))
        .sort((a, b) => a.le.localeCompare(b.le)),
      actifs30j: fichier.comptes.filter((c) => c.vuLe >= seuilActif).length,
      bientotPurges: fichier.comptes.filter((c) => c.vuLe < seuilPurge).length,
      premierCompteLe: dates[0]?.slice(0, 10) ?? null,
      dernierCompteLe: dates[dates.length - 1]?.slice(0, 10) ?? null,
    }
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
