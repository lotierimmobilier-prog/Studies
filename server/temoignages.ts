import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import type {
  RequeteTemoignage,
  StatutTemoignage,
  SyntheseTemoignages,
  TemoignageEtudiant,
} from './types'
import { moderer, type OptionsModeration, type Verdict } from './moderation'

/**
 * Dépôt persistant (fichier JSON) des témoignages étudiants.
 *
 * Volume attendu faible : on charge la liste en mémoire et on réécrit le fichier
 * à chaque modification (best-effort), comme le cache de prix.
 */
export class DepotTemoignages {
  private liste: TemoignageEtudiant[] | null = null

  constructor(private fichier: string) {}

  async charger(): Promise<TemoignageEtudiant[]> {
    if (this.liste) return this.liste
    try {
      const brut = await readFile(this.fichier, 'utf8')
      const parse = JSON.parse(brut)
      this.liste = Array.isArray(parse) ? (parse as TemoignageEtudiant[]) : []
    } catch {
      this.liste = []
    }
    return this.liste
  }

  async ajouter(t: TemoignageEtudiant): Promise<void> {
    const liste = await this.charger()
    liste.push(t)
    await this.persister()
  }

  async majStatut(id: string, statut: StatutTemoignage): Promise<boolean> {
    const liste = await this.charger()
    const t = liste.find((x) => x.id === id)
    if (!t) return false
    t.statut = statut
    await this.persister()
    return true
  }

  private async persister(): Promise<void> {
    try {
      await mkdir(dirname(this.fichier), { recursive: true })
      await writeFile(this.fichier, JSON.stringify(this.liste ?? []), 'utf8')
    } catch {
      // Persistance best-effort.
    }
  }
}

export interface OptionsTemoignage extends OptionsModeration {
  depot: DepotTemoignages
  /** Horloge injectable (tests). */
  now?: () => number
  /** Générateur d'identifiant injectable (tests). */
  id?: () => string
  /** Fonction de modération injectable (tests). */
  moderer?: (c: string, o?: OptionsModeration) => Promise<Verdict>
}

export type ResultatSoumission =
  | { ok: true; temoignage: TemoignageEtudiant }
  | { ok: false; statut: 'rejete'; raison: string }

const ANNEE_MIN = 1990

/** Valide et borne l'année d'études (sinon undefined). */
function normaliserAnnee(annee: unknown, maintenant: number): number | undefined {
  const anneeCourante = new Date(maintenant).getUTCFullYear()
  if (typeof annee !== 'number' || !Number.isFinite(annee)) return undefined
  const a = Math.round(annee)
  return a >= ANNEE_MIN && a <= anneeCourante + 1 ? a : undefined
}

/**
 * Soumet un témoignage : valide la note, modère le commentaire, puis stocke.
 *  - rejeté par la modération → non stocké, raison renvoyée.
 *  - accepté → stocké « approuve » (visible).
 *  - douteux → stocké « en_attente » (invisible tant qu'un modérateur ne valide pas).
 */
export async function soumettreTemoignage(
  req: RequeteTemoignage,
  options: OptionsTemoignage,
): Promise<ResultatSoumission> {
  const now = options.now ?? Date.now
  const genId = options.id ?? randomUUID
  const modererFn = options.moderer ?? moderer
  const maintenant = now()

  const etablissement = (req.etablissement ?? '').trim()
  if (!etablissement)
    return { ok: false, statut: 'rejete', raison: 'Établissement manquant.' }

  const note = Math.round(Number(req.note))
  if (!Number.isFinite(note) || note < 1 || note > 5)
    return { ok: false, statut: 'rejete', raison: 'Note invalide (1 à 5).' }

  const commentaire = (req.commentaire ?? '').trim()
  const verdict = await modererFn(commentaire, { utiliserIA: options.utiliserIA })
  if (verdict.statut === 'rejete')
    return { ok: false, statut: 'rejete', raison: verdict.raison ?? 'Commentaire refusé.' }

  const temoignage: TemoignageEtudiant = {
    id: genId(),
    etablissement,
    note,
    commentaire,
    annee: normaliserAnnee(req.annee, maintenant),
    statut: verdict.statut, // 'approuve' ou 'en_attente'
    dateMaj: new Date(maintenant).toISOString(),
  }
  await options.depot.ajouter(temoignage)
  return { ok: true, temoignage }
}

/** Synthèse publique : témoignages approuvés d'un établissement + moyenne. */
export async function synthese(
  etablissement: string,
  depot: DepotTemoignages,
): Promise<SyntheseTemoignages> {
  const cible = etablissement.trim().toLowerCase()
  const liste = (await depot.charger()).filter(
    (t) => t.statut === 'approuve' && t.etablissement.toLowerCase() === cible,
  )
  // Plus récents d'abord.
  liste.sort((a, b) => b.dateMaj.localeCompare(a.dateMaj))
  const nombre = liste.length
  const moyenne =
    nombre === 0
      ? null
      : Math.round((liste.reduce((s, t) => s + t.note, 0) / nombre) * 10) / 10
  return { etablissement, moyenne, nombre, temoignages: liste }
}

/** Liste complète (modération) — tous statuts. */
export async function listerTous(
  depot: DepotTemoignages,
  statut?: StatutTemoignage,
): Promise<TemoignageEtudiant[]> {
  const liste = await depot.charger()
  return statut ? liste.filter((t) => t.statut === statut) : liste
}
