import Anthropic from '@anthropic-ai/sdk'
import type { FormationResume, ProfilResume } from './conseiller'

/**
 * Génère des questions de CIBLAGE pour affiner le projet d'orientation.
 *
 * Objectif : sortir du conseil « généraliste ». On pose 3-4 questions à choix
 * multiple courtes ; les réponses sont ensuite transmises au conseiller pour
 * des recommandations vraiment personnalisées.
 *
 * IA (Anthropic) si `ANTHROPIC_API_KEY`, sinon jeu de questions curé.
 */

export interface QuestionCiblage {
  id: string
  question: string
  /** 2 à 4 options concrètes et mutuellement exclusives. */
  options: string[]
}

export interface OptionsQuestions {
  utiliserIA?: boolean
}

/** Questions de repli, adaptées à la classe. Déterministes, sans réseau. */
export function questionsRegles(profil: ProfilResume): QuestionCiblage[] {
  if (profil.classe === 'seconde') {
    return [
      {
        id: 'seconde_direction',
        question: 'Vers quel type d’études te vois-tu plutôt aller ?',
        options: ['Scientifique / technique', 'Économie / droit / commerce', 'Lettres / langues / arts', 'Encore indécis·e'],
      },
      {
        id: 'seconde_effort',
        question: 'Quelle matière es-tu prêt·e à travailler davantage ?',
        options: ['Les maths', 'Les sciences (physique/SVT)', 'Les matières littéraires', 'Aucune en particulier'],
      },
      {
        id: 'seconde_horizon',
        question: 'Ce qui compte le plus pour toi à terme :',
        options: ['Un métier précis', 'Garder un maximum de portes ouvertes', 'Suivre ma passion'],
      },
    ]
  }
  return [
    {
      id: 'type_cursus',
      question: 'Quel type de cursus te correspond le mieux ?',
      options: ['Court et professionnalisant (BTS/BUT)', 'Long et théorique (licence/prépa)', 'Peu importe si le projet colle'],
    },
    {
      id: 'cadre',
      question: 'Dans quel cadre te sens-tu le mieux ?',
      options: ['Grande fac autonome', 'Encadrement rapproché (petite structure/prépa)', 'Indifférent'],
    },
    {
      id: 'priorite',
      question: 'Ta priorité n°1 dans ce choix :',
      options: ['Les débouchés / l’emploi', 'La passion / la matière', 'La proximité géographique', 'Le coût des études'],
    },
    {
      id: 'alternance',
      question: 'L’alternance (études + entreprise rémunérée) t’intéresse ?',
      options: ['Oui, clairement', 'Plutôt non', 'À voir selon la formation'],
    },
  ]
}

const SYSTEME = `Tu aides un·e lycéen·ne à préciser son projet d'orientation Parcoursup.
Génère des questions à choix multiple COURTES pour cerner ses préférences et sortir d'un conseil trop généraliste.
Règles :
- 3 à 4 questions maximum, en français, tutoiement.
- Chaque question a 2 à 4 options concrètes, mutuellement exclusives, courtes.
- Adapte au profil fourni (classe, passions, souhaits, spécialités). En seconde, oriente vers le choix de spécialités.
- Évite les questions dont la réponse est déjà connue (région, notes déjà fournies).
- Ne pose pas de question ouverte. Réponds uniquement par l'objet JSON demandé.`

const SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
        },
        required: ['id', 'question', 'options'],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 4,
    },
  },
  required: ['questions'],
  additionalProperties: false,
} as const

/** Questions générées par l'IA. Peut lever une erreur (réseau/quota). */
export async function questionsIA(
  profil: ProfilResume,
  formations: FormationResume[],
): Promise<QuestionCiblage[]> {
  const client = new Anthropic()
  const contexte = { profil, formations: formations.slice(0, 6) }
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEME,
    messages: [
      {
        role: 'user',
        content: `Profil et formations simulées (JSON) :\n${JSON.stringify(contexte, null, 2)}`,
      },
    ],
  })
  const texte = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const parse = JSON.parse(texte) as { questions?: QuestionCiblage[] }
  const questions = (parse.questions ?? []).filter(
    (q) => q && q.question && Array.isArray(q.options) && q.options.length >= 2,
  )
  if (questions.length === 0) throw new Error('Réponse IA vide')
  return questions.slice(0, 4)
}

export interface ResultatQuestions {
  questions: QuestionCiblage[]
  source: 'ia' | 'regles'
}

/** Point d'entrée : IA si disponible, sinon règles. */
export async function obtenirQuestions(
  profil: ProfilResume,
  formations: FormationResume[],
  options: OptionsQuestions = {},
): Promise<ResultatQuestions> {
  const utiliserIA = options.utiliserIA ?? Boolean(process.env.ANTHROPIC_API_KEY)
  if (utiliserIA) {
    try {
      return { questions: await questionsIA(profil, formations), source: 'ia' }
    } catch {
      // Repli sur les règles.
    }
  }
  return { questions: questionsRegles(profil), source: 'regles' }
}
