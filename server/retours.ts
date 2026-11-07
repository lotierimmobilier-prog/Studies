/**
 * Retours d'étudiants : collecte, archivage par année, agrégats.
 *
 * Un fichier par millésime. Écrire ne touche jamais qu'au fichier de l'année
 * en cours : les années passées sont structurellement immuables, ce qui est la
 * règle « jamais de modification destructive d'un millésime existant » de
 * CLAUDE.md appliquée au stockage lui-même.
 *
 * Aucun texte libre n'est collecté — trois axes chiffrés et une année d'études,
 * comme le fixe le module M10. Il n'y a donc rien à modérer, rien à purger, et
 * aucune note globale d'établissement à défendre devant un tribunal.
 */

import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  agreger,
  archive,
  type Agregat,
  type Millesime,
  type Retour,
} from '../kitetudiant/packages/retours/src/index.ts'

export class RetourInvalide extends Error {
  constructor(raison: string) {
    super(raison)
    this.name = 'RetourInvalide'
  }
}

export class RetourEnDouble extends Error {
  constructor() {
    super('Un retour a déjà été déposé pour cette formation cette année.')
    this.name = 'RetourEnDouble'
  }
}

/** Année universitaire en cours : elle bascule le 1er septembre. */
export function millesimeCourant(aujourdHui: Date = new Date()): Millesime {
  const annee = aujourdHui.getMonth() + 1 >= 9 ? aujourdHui.getFullYear() : aujourdHui.getFullYear() - 1
  return `${annee}-${annee + 1}`
}

export interface RequeteRetour {
  readonly codFormation: string
  readonly coutReelMensuel: number
  readonly faciliteLogement: number
  readonly ambiance: number
  readonly anneeEtudes: number
  /**
   * Jeton opaque propre au navigateur, pour ne compter qu'un retour par
   * formation et par an. Il n'identifie personne : il est haché avant d'être
   * stocké, et ne sert qu'à cette comparaison.
   */
  readonly jetonContributeur: string
}

/** Un retour tel qu'il est stocké : le jeton n'y figure que haché. */
interface RetourStocke extends Retour {
  readonly empreinteContributeur: string
}

const BORNES = {
  coutReelMensuel: [0, 3000],
  faciliteLogement: [1, 5],
  ambiance: [1, 5],
  anneeEtudes: [1, 8],
} as const

function valider(requete: RequeteRetour): void {
  if (!requete.codFormation || requete.codFormation.length > 32) {
    throw new RetourInvalide('Code de formation absent ou invalide.')
  }
  if (!requete.jetonContributeur || requete.jetonContributeur.length < 8) {
    throw new RetourInvalide('Jeton de contributeur absent.')
  }
  for (const [champ, [min, max]] of Object.entries(BORNES) as [
    keyof typeof BORNES,
    readonly [number, number],
  ][]) {
    const valeur = requete[champ]
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < min || valeur > max) {
      throw new RetourInvalide(`Le champ « ${champ} » doit être un nombre entre ${min} et ${max}.`)
    }
  }
}

function empreinte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex').slice(0, 32)
}

export class DepotRetours {
  private cache = new Map<Millesime, RetourStocke[]>()

  constructor(private dossier: string) {}

  private fichier(millesime: Millesime): string {
    return join(this.dossier, `retours-${millesime}.json`)
  }

  async charger(millesime: Millesime): Promise<RetourStocke[]> {
    const dejaLu = this.cache.get(millesime)
    if (dejaLu) return dejaLu
    let liste: RetourStocke[] = []
    try {
      const brut = await readFile(this.fichier(millesime), 'utf8')
      const parse: unknown = JSON.parse(brut)
      if (Array.isArray(parse)) liste = parse as RetourStocke[]
    } catch {
      liste = []
    }
    this.cache.set(millesime, liste)
    return liste
  }

  /** Millésimes présents sur le disque, du plus récent au plus ancien. */
  async millesimes(): Promise<Millesime[]> {
    try {
      const fichiers = await readdir(this.dossier)
      return fichiers
        .map((f) => /^retours-(\d{4}-\d{4})\.json$/.exec(f)?.[1])
        .filter((m): m is string => Boolean(m))
        .sort()
        .reverse()
    } catch {
      return []
    }
  }

  async tous(): Promise<RetourStocke[]> {
    const millesimes = await this.millesimes()
    const listes = await Promise.all(millesimes.map((m) => this.charger(m)))
    return listes.flat()
  }

  async ajouter(requete: RequeteRetour, aujourdHui: Date = new Date()): Promise<Retour> {
    valider(requete)
    const millesime = millesimeCourant(aujourdHui)
    const liste = await this.charger(millesime)
    const marque = empreinte(requete.jetonContributeur)
    if (liste.some((r) => r.codFormation === requete.codFormation && r.empreinteContributeur === marque)) {
      throw new RetourEnDouble()
    }
    const retour: RetourStocke = {
      id: randomUUID(),
      codFormation: requete.codFormation,
      millesime,
      coutReelMensuel: Math.round(requete.coutReelMensuel * 100) / 100,
      faciliteLogement: Math.round(requete.faciliteLogement),
      ambiance: Math.round(requete.ambiance),
      anneeEtudes: Math.round(requete.anneeEtudes),
      collecteLe: aujourdHui.toISOString(),
      empreinteContributeur: marque,
    }
    liste.push(retour)
    await mkdir(dirname(this.fichier(millesime)), { recursive: true })
    await writeFile(this.fichier(millesime), JSON.stringify(liste, null, 2), 'utf8')
    const { empreinteContributeur: _, ...public_ } = retour
    return public_
  }

  /** Archive complète d'une formation : un agrégat par année. */
  async archiveDe(codFormation: string, aujourdHui: Date = new Date()): Promise<Agregat[]> {
    return archive(codFormation, await this.tous(), aujourdHui.toISOString())
  }

  /** Agrégat de l'année en cours pour plusieurs formations d'un coup. */
  async agregatsCourants(
    codFormations: readonly string[],
    aujourdHui: Date = new Date(),
  ): Promise<Agregat[]> {
    const millesime = millesimeCourant(aujourdHui)
    const retours = await this.charger(millesime)
    return codFormations.map((c) => agreger(c, millesime, retours, aujourdHui.toISOString()))
  }
}
