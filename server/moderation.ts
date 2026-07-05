import Anthropic from '@anthropic-ai/sdk'
import type { StatutTemoignage } from './types'

/**
 * Modération des témoignages étudiants.
 *
 * Deux niveaux :
 *  1. Règles (toujours actives) : longueur, insultes/haine, coordonnées
 *     personnelles (anti-spam / anti-doxxing). Rapide et déterministe.
 *  2. IA (si ANTHROPIC_API_KEY) : jugement plus fin du caractère acceptable.
 *
 * Verdict :
 *  - 'rejete'     : contenu clairement inacceptable → non publié.
 *  - 'approuve'   : contenu jugé sain → publié.
 *  - 'en_attente' : douteux → mis en attente de validation humaine.
 */

export interface Verdict {
  statut: StatutTemoignage
  raison?: string
}

export const LONGUEUR_MIN = 4
export const LONGUEUR_MAX = 1000

// Termes clairement injurieux / haineux (liste volontairement courte et sobre).
// La comparaison se fait sur le texte normalisé, avec limites de mots.
const TERMES_INTERDITS = [
  'connard',
  'connasse',
  'salope',
  'enculé',
  'encule',
  'pute',
  'putain de merde',
  'ferme ta gueule',
  'sale juif',
  'sale arabe',
  'sale noir',
  'pédé',
  'pede',
  'négro',
  'negro',
  'bougnoule',
]

const MOTIF_EMAIL = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i
const MOTIF_URL = /(https?:\/\/|www\.)\S+/i
const MOTIF_TEL = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Modération par règles — déterministe, testable, sans réseau. */
export function moderationRegles(commentaire: string): Verdict {
  const texte = commentaire.trim()
  if (texte.length < LONGUEUR_MIN)
    return { statut: 'rejete', raison: 'Commentaire trop court.' }
  if (texte.length > LONGUEUR_MAX)
    return { statut: 'rejete', raison: 'Commentaire trop long.' }

  const norm = normaliser(texte)
  for (const terme of TERMES_INTERDITS) {
    // s? tolère le pluriel (« connards »), les limites de mots évitent les
    // faux positifs (« pute » dans « réputation »).
    const motif = new RegExp(`(^|[^\\p{L}])${terme}s?([^\\p{L}]|$)`, 'u')
    if (motif.test(norm))
      return { statut: 'rejete', raison: 'Propos injurieux ou haineux.' }
  }

  if (MOTIF_EMAIL.test(texte) || MOTIF_URL.test(texte) || MOTIF_TEL.test(texte))
    return {
      statut: 'rejete',
      raison: 'Les coordonnées et liens ne sont pas autorisés.',
    }

  return { statut: 'approuve' }
}

const SYSTEME_MODERATION = `Tu es un modérateur d'avis d'étudiants sur des établissements d'enseignement supérieur, sur une plateforme destinée à des lycéens.
Juge si un commentaire est PUBLIABLE. Refuse : insultes, harcèlement, propos haineux/discriminatoires, diffamation nominative, contenu sexuel, spam/publicité, coordonnées personnelles.
Autorise la critique NÉGATIVE mais argumentée et respectueuse (c'est le but d'un avis).
Réponds uniquement par l'objet JSON demandé.`

const SCHEMA_MODERATION = {
  type: 'object',
  properties: {
    acceptable: { type: 'boolean' },
    raison: { type: 'string' },
  },
  required: ['acceptable'],
  additionalProperties: false,
} as const

/** Modération IA (si clé configurée). Peut lever une erreur (réseau/quota). */
export async function moderationIA(commentaire: string): Promise<Verdict> {
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 256,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: SCHEMA_MODERATION },
    },
    system: SYSTEME_MODERATION,
    messages: [
      {
        role: 'user',
        content: `Commentaire à modérer :\n"""${commentaire}"""`,
      },
    ],
  })
  const texte = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const verdict = JSON.parse(texte) as { acceptable: boolean; raison?: string }
  return verdict.acceptable
    ? { statut: 'approuve' }
    : { statut: 'rejete', raison: verdict.raison ?? 'Contenu non conforme.' }
}

export interface OptionsModeration {
  /** Force l'usage (ou non) de l'IA ; défaut : présence de la clé API. */
  utiliserIA?: boolean
}

/**
 * Modération complète : règles d'abord (bloc immédiat), puis IA si disponible.
 * Un rejet par les règles est définitif ; l'IA affine les cas que les règles
 * laissent passer. Toute erreur IA retombe sur le verdict des règles.
 */
export async function moderer(
  commentaire: string,
  options: OptionsModeration = {},
): Promise<Verdict> {
  const regles = moderationRegles(commentaire)
  if (regles.statut === 'rejete') return regles

  const utiliserIA = options.utiliserIA ?? Boolean(process.env.ANTHROPIC_API_KEY)
  if (!utiliserIA) return regles

  try {
    return await moderationIA(commentaire)
  } catch {
    return regles
  }
}
