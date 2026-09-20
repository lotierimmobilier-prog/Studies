/**
 * Lecture d'un bulletin pour KITETUDIANT.
 *
 * Règle 3 de CLAUDE.md : les données concernent des mineurs, et le texte brut
 * des appréciations est purgé après extraction. Ce module enveloppe l'analyse
 * existante et ne laisse sortir que deux choses :
 *
 *   - les moyennes par matière, des nombres ;
 *   - trois signaux chiffrés tirés des appréciations : sérieux, participation,
 *     progression.
 *
 * ── L'avis de Jean-Paul ──────────────────────────────────────────────────
 *
 * S'y ajoute une lecture rédigée des appréciations des professeurs, signée
 * « Jean-Paul », l'assistant du site. Deux choses doivent rester parfaitement
 * claires, et le sont partout où cet avis s'affiche :
 *
 *   1. JEAN-PAUL EST UNE MACHINE. Ce site s'adresse à des mineurs ; laisser
 *      croire qu'un adulte a lu leur bulletin serait un mensonge, et un
 *      mensonge qui donnerait à l'avis un poids qu'il n'a pas.
 *   2. CE N'EST PAS UNE NOTE. L'avis ne se chiffre pas, n'entre dans aucun
 *      calcul, ne trie aucune formation. La règle 5 de CLAUDE.md interdit de
 *      fondre des critères en un score unique, et un « avis global » chiffré
 *      en serait un par la porte de service.
 *
 * Ce qui reste écarté, en revanche : le TEXTE BRUT des appréciations. L'avis
 * est une synthèse, jamais une recopie, et rien n'est écrit sur disque — le
 * bulletin n'existe que le temps de l'appel (règle 3).
 */

import { analyserBulletin, type MediaType } from './bulletin'

/** Ce que KITETUDIANT accepte de recevoir d'un bulletin. */
export interface BulletinExtrait {
  /** Moyennes sur 20, par matière reconnue. Les matières absentes ne sont pas listées. */
  readonly notes: Readonly<Record<string, number>>
  readonly signaux: {
    readonly serieux: number
    readonly participation: number
    readonly progression: number
  }
  /** Nombre de matières effectivement lues, pour que l'élève puisse vérifier. */
  readonly matieresLues: number
  /**
   * La lecture rédigée des appréciations. `null` quand rien d'exploitable
   * n'en est ressorti — une absence s'affiche comme une absence, jamais
   * remplacée par une phrase creuse.
   */
  readonly avis: Avis | null
  readonly source: string
}

/** Ce que Jean-Paul renvoie après avoir lu les appréciations. */
export interface Avis {
  readonly texte: string
  readonly pointsForts: readonly string[]
  readonly aTravailler: readonly string[]
  /** Toujours affiché avec l'avis : il dit qui parle, et ce que ça vaut. */
  readonly auteur: string
}

export const AUTEUR_AVIS =
  'Jean-Paul, l’assistant automatique de KitEtudiant.fr — une machine, pas un professeur'

/**
 * Formules qu'un avis ne doit jamais contenir.
 *
 * Deux familles, pour deux règles du projet :
 *
 *   - un MONTANT en euros. Règle 1 : aucun euro affiché ne peut venir d'un
 *     modèle de langage. Un avis qui chiffrerait un budget contournerait
 *     toute la chaîne de calcul sourcée ;
 *   - une formule ANXIOGÈNE. Le site parle à des lycéens qui décident de leur
 *     année ; « aucune chance » est proscrit noir sur blanc.
 */
const INTERDITS: readonly RegExp[] = [
  /\d[\d  ]*(€|euros?\b)/i,
  /aucune chance/i,
  /c'est fichu|c’est fichu/i,
  /trop tard pour (toi|vous)/i,
  /tu n'y arriveras|tu n’y arriveras/i,
  /niveau (catastrophique|désastreux|lamentable)/i,
]

/** Vrai si le texte est publiable tel quel. */
export function avisAcceptable(texte: string): boolean {
  return texte.trim() !== '' && !INTERDITS.some((r) => r.test(texte))
}

/**
 * Ne garde que les phrases publiables.
 *
 * On écarte plutôt qu'on ne réécrit : réécrire une phrase refusée, c'est
 * décider à la place du modèle ce qu'il voulait dire, et risquer de lui faire
 * dire autre chose. Une liste vide vaut mieux qu'une liste retouchée.
 */
function filtrer(lignes: unknown): string[] {
  if (!Array.isArray(lignes)) return []
  return lignes
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.trim())
    .filter((l) => l !== '' && avisAcceptable(l))
    .slice(0, 4)
}

function borner(valeur: unknown, max: number): number {
  return typeof valeur === 'number' && Number.isFinite(valeur)
    ? Math.min(max, Math.max(0, valeur))
    : 0
}

export async function extraireBulletin(
  base64: string,
  mediaType: MediaType,
): Promise<BulletinExtrait> {
  const analyse = await analyserBulletin(base64, mediaType)

  const notes: Record<string, number> = {}
  for (const [matiere, valeur] of Object.entries(analyse.notes)) {
    if (typeof valeur === 'number' && Number.isFinite(valeur)) {
      notes[matiere] = Math.round(Math.min(20, Math.max(0, valeur)) * 100) / 100
    }
  }

  // Tout le reste de l'analyse — synthèse rédigée, points forts, points à
  // améliorer — s'arrête ici. Ne jamais l'ajouter au retour.
  return {
    notes,
    signaux: {
      serieux: borner(analyse.signaux?.serieux, 10),
      participation: borner(analyse.signaux?.participation, 10),
      progression: borner(analyse.signaux?.progression, 10),
    },
    matieresLues: Object.keys(notes).length,
    avis: avisDe(analyse),
    source: 'Lecture du bulletin fourni par l’élève, texte des appréciations non conservé',
  }
}

/**
 * Compose l'avis à partir de l'analyse, ou rend `null`.
 *
 * `null` plutôt qu'un texte de remplacement : un bulletin sans appréciations
 * exploitables doit se voir comme tel. Fabriquer « Continue comme ça ! »
 * reviendrait à inventer une valeur de repli, ce que CLAUDE.md interdit.
 */
function avisDe(analyse: {
  appreciationGlobale?: unknown
  pointsForts?: unknown
  pointsAmeliorer?: unknown
}): Avis | null {
  const texte = typeof analyse.appreciationGlobale === 'string'
    ? analyse.appreciationGlobale.trim()
    : ''
  if (!avisAcceptable(texte)) return null
  return {
    texte,
    pointsForts: filtrer(analyse.pointsForts),
    aTravailler: filtrer(analyse.pointsAmeliorer),
    auteur: AUTEUR_AVIS,
  }
}
