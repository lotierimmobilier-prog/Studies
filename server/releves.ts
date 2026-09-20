/**
 * Stockage des relevés anonymes.
 *
 * Un fichier par MOIS. Deux raisons, et aucune n'est esthétique :
 *
 *   - les fichiers restent petits, donc lisibles d'un coup sans mémoire qui
 *     s'envole quand le site marchera ;
 *   - un mois écoulé n'est plus jamais réécrit, ce qui applique au stockage
 *     lui-même la règle « jamais de modification destructive d'un millésime
 *     existant » de CLAUDE.md.
 *
 * Ce qui n'est PAS stocké ici, et ne peut pas l'être : voir le paquet
 * statistiques, qui reconstruit chaque relevé à partir des seules valeurs
 * permises. Ce module écrit ce qu'il reçoit de lui, jamais ce qu'il reçoit du
 * navigateur.
 *
 * ── Sur l'absence d'adresse IP ───────────────────────────────────────────
 *
 * Elle n'est ni stockée, ni hachée, ni « conservée un instant pour limiter
 * les abus ». Une IP est une donnée personnelle, et un relevé qui en
 * porterait une — même hachée — cesserait d'être anonyme. La limitation de
 * débit se fait donc en amont, sur le serveur web, pas ici.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  agregerReleves,
  normaliserReleve,
  type AgregatReleves,
  type Releve,
} from '../kitetudiant/packages/statistiques/src/index.ts'

/** Le mois d'une date ISO : « 2026-09-20 » → « 2026-09 ». */
export function moisDe(jour: string): string {
  return jour.slice(0, 7)
}

interface FichierMois {
  readonly version: 1
  readonly mois: string
  readonly releves: readonly Releve[]
}

export class DepotReleves {
  constructor(private readonly dossier: string) {}

  private chemin(mois: string): string {
    return join(this.dossier, `releves-${mois}.json`)
  }

  private async lireMois(mois: string): Promise<Releve[]> {
    try {
      const brut = JSON.parse(await readFile(this.chemin(mois), 'utf8')) as FichierMois
      return Array.isArray(brut.releves) ? [...brut.releves] : []
    } catch {
      // Fichier absent ou illisible : un mois sans relevé est un mois sans
      // relevé. On ne fait pas échouer la lecture des autres mois pour ça.
      return []
    }
  }

  /**
   * Dépose un relevé. La date est celle du SERVEUR : c'est elle qui choisit
   * le fichier, et une date venue du navigateur serait falsifiable.
   */
  async deposer(brut: unknown, maintenant: Date = new Date()): Promise<Releve> {
    const jour = maintenant.toISOString().slice(0, 10)
    const releve = normaliserReleve(brut, jour)
    const mois = moisDe(jour)
    const existants = await this.lireMois(mois)
    const fichier: FichierMois = { version: 1, mois, releves: [...existants, releve] }
    await mkdir(dirname(this.chemin(mois)), { recursive: true })
    await writeFile(this.chemin(mois), JSON.stringify(fichier), 'utf8')
    return releve
  }

  /** Les mois pour lesquels un fichier existe, du plus ancien au plus récent. */
  async moisConnus(): Promise<string[]> {
    try {
      return (await readdir(this.dossier))
        .map((n) => /^releves-(\d{4}-\d{2})\.json$/.exec(n)?.[1])
        .filter((m): m is string => m !== undefined)
        .sort()
    } catch {
      return []
    }
  }

  /**
   * Tous les relevés d'une période, bornes comprises. Sans bornes, tout.
   *
   * Les bornes sont des MOIS et non des jours : elles servent à choisir les
   * fichiers à ouvrir. Un filtrage plus fin se fait ensuite sur la date de
   * chaque relevé.
   */
  async lire(depuis?: string, jusqua?: string): Promise<Releve[]> {
    const mois = (await this.moisConnus()).filter(
      (m) => (depuis === undefined || m >= moisDe(depuis)) && (jusqua === undefined || m <= moisDe(jusqua)),
    )
    const tout: Releve[] = []
    for (const m of mois) tout.push(...(await this.lireMois(m)))
    return tout.filter(
      (r) => (depuis === undefined || r.le >= depuis) && (jusqua === undefined || r.le <= jusqua),
    )
  }

  async agregat(depuis?: string, jusqua?: string): Promise<AgregatReleves> {
    return agregerReleves(await this.lire(depuis, jusqua))
  }
}
