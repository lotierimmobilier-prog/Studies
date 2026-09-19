import Anthropic from '@anthropic-ai/sdk'

/**
 * Analyse de bulletins scolaires (PDF ou image) via l'API Claude.
 *
 * Extrait les moyennes par matière ET analyse les appréciations des
 * professeurs (sérieux, participation, progression, points forts / à
 * améliorer). Ces éléments pré-remplissent le simulateur et enrichissent
 * le conseil d'orientation.
 *
 * Nécessite une clé `ANTHROPIC_API_KEY` : sans vision, on ne peut pas lire
 * un bulletin. En son absence, l'appelant reçoit une erreur explicite.
 */

/** Clés de matières reconnues par le simulateur. */
const MATIERES = [
  'mathematiques',
  'physique_chimie',
  'svt',
  'francais',
  'philosophie',
  'histoire_geo',
  'ses',
  'langues',
  'informatique',
  'eps',
  'arts',
] as const

export interface AnalyseBulletin {
  /** Moyennes sur 20 par matière reconnue (null si absente du bulletin). */
  notes: Record<string, number | null>
  /** Synthèse lisible des appréciations des professeurs. */
  appreciationGlobale: string
  /** Signaux qualitatifs déduits des appréciations (0-10). */
  signaux: { serieux: number; participation: number; progression: number }
  pointsForts: string[]
  pointsAmeliorer: string[]
}

export class BulletinNonConfigure extends Error {
  constructor() {
    super("Analyse de bulletin indisponible : ANTHROPIC_API_KEY non configurée")
    this.name = 'BulletinNonConfigure'
  }
}

const nullableNombre = { anyOf: [{ type: 'number' }, { type: 'null' }] }

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    notes: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(MATIERES.map((m) => [m, nullableNombre])),
      required: [...MATIERES],
    },
    appreciationGlobale: { type: 'string' },
    signaux: {
      type: 'object',
      additionalProperties: false,
      properties: {
        serieux: { type: 'integer' },
        participation: { type: 'integer' },
        progression: { type: 'integer' },
      },
      required: ['serieux', 'participation', 'progression'],
    },
    pointsForts: { type: 'array', items: { type: 'string' } },
    pointsAmeliorer: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'notes',
    'appreciationGlobale',
    'signaux',
    'pointsForts',
    'pointsAmeliorer',
  ],
}

const SYSTEME = `Tu analyses le bulletin scolaire d'un lycéen pour l'aider dans son orientation Parcoursup.
- Extrais la moyenne sur 20 de chaque matière, en la rattachant à l'une des clés fournies (null si la matière n'apparaît pas).
- Regroupe les intitulés proches : "Mathématiques"/"Maths"/"Spé Maths" -> mathematiques ; "Anglais"/"LV1"/"Espagnol" -> langues ; "NSI"/"Informatique" -> informatique ; "SVT" -> svt ; "Physique-Chimie" -> physique_chimie ; "Histoire-Géographie"/"HGGSP" -> histoire_geo ; "SES" -> ses ; "EPS" -> eps ; "Arts plastiques"/"Musique" -> arts ; "Philosophie" -> philosophie ; "Français" -> francais.
- Analyse les appréciations des professeurs : déduis des scores 0-10 pour le sérieux, la participation et la progression.
- Rédige une synthèse honnête et des points forts / points à améliorer en français.
Ne renvoie que des informations présentes dans le bulletin ; n'invente pas de notes.`

/** Type de média accepté pour un bulletin. */
export type MediaType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'

/** Analyse un bulletin encodé en base64. */
export async function analyserBulletin(
  base64: string,
  mediaType: MediaType,
): Promise<AnalyseBulletin> {
  if (!process.env.ANTHROPIC_API_KEY) throw new BulletinNonConfigure()

  const client = new Anthropic()

  const document =
    mediaType === 'application/pdf'
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: base64 },
        }
      : {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: base64 },
        }

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEME,
    messages: [
      {
        role: 'user',
        content: [
          document,
          { type: 'text', text: "Analyse ce bulletin et renvoie l'objet JSON demandé." },
        ],
      },
    ],
  })

  const texte = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const brut = JSON.parse(texte) as AnalyseBulletin

  // On ne conserve que les matières reconnues, notes bornées à [0,20].
  const notes: Record<string, number | null> = {}
  for (const m of MATIERES) {
    const v = brut.notes?.[m]
    notes[m] = typeof v === 'number' ? Math.min(20, Math.max(0, v)) : null
  }

  return { ...brut, notes }
}
