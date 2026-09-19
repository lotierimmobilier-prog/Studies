/**
 * Coffre de secrets chiffré au repos.
 *
 * Les clés d'API peuvent venir de deux endroits :
 *   1. l'environnement — c'est la voie recommandée, rien n'est écrit sur disque ;
 *   2. ce coffre, alimenté par la console d'administration.
 *
 * L'environnement gagne toujours : une clé posée par l'hébergeur ne peut pas
 * être remplacée depuis le web.
 *
 * Le fichier est chiffré en AES-256-GCM avec une clé dérivée par scrypt d'un
 * secret maître, `ADMIN_MASTER_KEY`, qui reste dans l'environnement et n'est
 * jamais écrit. Voler le fichier seul ne donne donc rien. Le fichier est créé
 * en 0600, et une valeur enregistrée n'est jamais relue vers l'extérieur :
 * l'interface n'en voit que les quatre derniers caractères.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Clés que l'administration a le droit de gérer. Liste fermée. */
export const SECRETS_GERES = ['ANTHROPIC_API_KEY', 'GOOGLE_MAPS_API_KEY'] as const
export type NomSecret = (typeof SECRETS_GERES)[number]

export function estSecretGere(nom: string): nom is NomSecret {
  return (SECRETS_GERES as readonly string[]).includes(nom)
}

export class CoffreNonConfigure extends Error {
  constructor() {
    super(
      'Coffre de secrets indisponible : la variable d’environnement ADMIN_MASTER_KEY n’est pas définie.',
    )
    this.name = 'CoffreNonConfigure'
  }
}

interface Entree {
  readonly valeurChiffree: string
  readonly nonce: string
  readonly baliseAuth: string
  readonly enregistreLe: string
  /** Quatre derniers caractères, pour que l'humain reconnaisse sa clé. */
  readonly fin: string
}

interface FichierCoffre {
  readonly version: 1
  readonly sel: string
  readonly entrees: Record<string, Entree>
}

export interface EtatSecret {
  readonly nom: NomSecret
  readonly configure: boolean
  /** `environnement` l'emporte toujours sur `coffre`. */
  readonly provenance: 'environnement' | 'coffre' | 'aucune'
  readonly fin: string | null
  readonly enregistreLe: string | null
}

const LONGUEUR_CLE = 32

function deriver(secretMaitre: string, sel: Buffer): Buffer {
  return scryptSync(secretMaitre, sel, LONGUEUR_CLE)
}

export class Coffre {
  private cache: FichierCoffre | null = null
  /** Clés que ce coffre a recopiées dans l'environnement du processus. */
  private hydratees = new Set<NomSecret>()

  constructor(private fichier: string) {}

  /**
   * Recopie dans `process.env` les clés du coffre, pour que les modules
   * existants continuent de lire l'environnement sans rien savoir d'ici. Une
   * clé posée par l'hébergeur n'est jamais écrasée, et le coffre retient ce
   * qu'il a hydraté pour ne pas le présenter ensuite comme venant de
   * l'hébergeur.
   */
  async hydraterEnvironnement(): Promise<void> {
    for (const nom of SECRETS_GERES) {
      if (process.env[nom] && !this.hydratees.has(nom)) continue
      try {
        const coffre = await this.charger()
        const entree = coffre.entrees[nom]
        if (!entree) continue
        const valeur = await this.dechiffrer(coffre, entree)
        if (valeur) {
          process.env[nom] = valeur
          this.hydratees.add(nom)
        }
      } catch {
        // Coffre non configuré : les fonctions concernées se taisent.
      }
    }
  }

  /** Retire du processus une clé qui venait du coffre. */
  deshydrater(nom: NomSecret): void {
    if (this.hydratees.delete(nom)) delete process.env[nom]
  }

  private secretMaitre(): string {
    const brut = process.env.ADMIN_MASTER_KEY
    if (!brut || brut.length < 16) throw new CoffreNonConfigure()
    return brut
  }

  private async charger(): Promise<FichierCoffre> {
    if (this.cache) return this.cache
    try {
      const brut = await readFile(this.fichier, 'utf8')
      const parse = JSON.parse(brut) as FichierCoffre
      if (parse.version === 1 && typeof parse.sel === 'string') {
        this.cache = parse
        return parse
      }
    } catch {
      // Coffre absent ou illisible : on en repart d'un neuf plutôt que de
      // refuser de démarrer. Aucune valeur n'est perdue silencieusement, car
      // un coffre illisible ne contenait rien d'exploitable de toute façon.
    }
    const neuf: FichierCoffre = {
      version: 1,
      sel: randomBytes(16).toString('base64'),
      entrees: {},
    }
    this.cache = neuf
    return neuf
  }

  private async persister(coffre: FichierCoffre): Promise<void> {
    await mkdir(dirname(this.fichier), { recursive: true })
    await writeFile(this.fichier, JSON.stringify(coffre, null, 2), { encoding: 'utf8', mode: 0o600 })
    await chmod(this.fichier, 0o600)
    this.cache = coffre
  }

  /** Enregistre un secret. La valeur ne ressort jamais de cette méthode. */
  async enregistrer(nom: NomSecret, valeur: string, maintenant = new Date()): Promise<EtatSecret> {
    if (valeur.trim().length < 8) {
      throw new Error('Une clé d’au moins 8 caractères est attendue.')
    }
    const coffre = await this.charger()
    const cle = deriver(this.secretMaitre(), Buffer.from(coffre.sel, 'base64'))
    const nonce = randomBytes(12)
    const chiffreur = createCipheriv('aes-256-gcm', cle, nonce)
    const chiffre = Buffer.concat([chiffreur.update(valeur, 'utf8'), chiffreur.final()])
    const entree: Entree = {
      valeurChiffree: chiffre.toString('base64'),
      nonce: nonce.toString('base64'),
      baliseAuth: chiffreur.getAuthTag().toString('base64'),
      enregistreLe: maintenant.toISOString(),
      fin: valeur.slice(-4),
    }
    await this.persister({ ...coffre, entrees: { ...coffre.entrees, [nom]: entree } })
    return {
      nom,
      configure: true,
      provenance: process.env[nom] && !this.hydratees.has(nom) ? 'environnement' : 'coffre',
      fin: entree.fin,
      enregistreLe: entree.enregistreLe,
    }
  }

  async oublier(nom: NomSecret): Promise<void> {
    const coffre = await this.charger()
    const entrees = { ...coffre.entrees }
    delete entrees[nom]
    await this.persister({ ...coffre, entrees })
  }

  private async dechiffrer(coffre: FichierCoffre, entree: Entree): Promise<string | null> {
    try {
      const cle = deriver(this.secretMaitre(), Buffer.from(coffre.sel, 'base64'))
      const dechiffreur = createDecipheriv('aes-256-gcm', cle, Buffer.from(entree.nonce, 'base64'))
      dechiffreur.setAuthTag(Buffer.from(entree.baliseAuth, 'base64'))
      return Buffer.concat([
        dechiffreur.update(Buffer.from(entree.valeurChiffree, 'base64')),
        dechiffreur.final(),
      ]).toString('utf8')
    } catch {
      // Balise d'authentification invalide : fichier altéré ou secret maître
      // changé. On refuse la valeur plutôt que de rendre n'importe quoi.
      return null
    }
  }

  /**
   * Valeur utilisable d'un secret, ou null. L'environnement l'emporte, sauf
   * s'il ne contient que ce que ce coffre y a recopié.
   * Réservé au code serveur : ne jamais renvoyer ce résultat à un client.
   */
  async valeur(nom: NomSecret): Promise<string | null> {
    const depuisEnv = process.env[nom]
    if (depuisEnv && !this.hydratees.has(nom)) return depuisEnv
    const coffre = await this.charger()
    const entree = coffre.entrees[nom]
    if (!entree) return depuisEnv ?? null
    return this.dechiffrer(coffre, entree)
  }

  /** État de tous les secrets gérés, sans jamais exposer une valeur. */
  async etat(): Promise<EtatSecret[]> {
    const coffre = await this.charger()
    return SECRETS_GERES.map((nom) => {
      const entree = coffre.entrees[nom]
      // Une clé que ce coffre a recopiée dans l'environnement vient du coffre,
      // pas de l'hébergeur : le dire autrement tromperait l'exploitant.
      const depuisEnv = this.hydratees.has(nom) ? undefined : process.env[nom]
      if (depuisEnv) {
        return {
          nom,
          configure: true,
          provenance: 'environnement' as const,
          fin: depuisEnv.slice(-4),
          enregistreLe: null,
        }
      }
      if (entree) {
        return {
          nom,
          configure: true,
          provenance: 'coffre' as const,
          fin: entree.fin,
          enregistreLe: entree.enregistreLe,
        }
      }
      return { nom, configure: false, provenance: 'aucune' as const, fin: null, enregistreLe: null }
    })
  }
}

/** Comparaison à temps constant, pour ne rien révéler par la durée. */
export function jetonValide(fourni: string, attendu: string): boolean {
  const a = Buffer.from(fourni)
  const b = Buffer.from(attendu)
  if (a.length !== b.length) {
    // On compare quand même, pour que la durée ne dépende pas de la longueur.
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}
