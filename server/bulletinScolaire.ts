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
 * La synthèse rédigée, les points forts et les points à améliorer sont écartés
 * ici et ne quittent jamais le serveur. Rien n'est écrit sur disque : le
 * bulletin n'existe que le temps de l'appel.
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
  readonly source: string
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
    source: 'Lecture du bulletin fourni par l’élève, texte des appréciations non conservé',
  }
}
