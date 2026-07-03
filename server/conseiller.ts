import Anthropic from '@anthropic-ai/sdk'

/**
 * Conseiller d'orientation.
 *
 * Génère des conseils personnalisés à partir du profil de l'étudiant et de ses
 * meilleures formations simulées. Utilise l'API Claude quand une clé est
 * configurée (`ANTHROPIC_API_KEY`), sinon retombe sur un moteur de règles —
 * l'app reste fonctionnelle sans dépendance externe.
 */

export interface FormationResume {
  nom: string
  ville: string
  domaine: string
  probabilite: number
  selectivite: string
  prixAnnuel: number | null
}

export interface ProfilResume {
  meilleuresMatieres: string[]
  region: string | null
  mobilite: boolean
  passions: string[]
  motivation: number
  coherenceProjet: number
}

export interface Conseil {
  conseils: string[]
  source: 'ia' | 'regles'
}

/** Conseils déterministes (repli), indépendants de toute API. */
export function conseilRegles(
  profil: ProfilResume,
  formations: FormationResume[],
): string[] {
  const out: string[] = []
  if (profil.meilleuresMatieres.length)
    out.push(
      `Votre point fort est ${profil.meilleuresMatieres[0]} : privilégiez les formations où cette matière est déterminante.`,
    )
  const top = formations[0]
  if (top)
    out.push(
      `La formation la mieux placée pour votre profil est ${top.nom} à ${top.ville} (${top.probabilite}% estimés).`,
    )
  const ambitieux = formations.filter((f) => f.probabilite < 35)
  const sures = formations.filter((f) => f.probabilite >= 65)
  out.push(
    `Constituez une liste équilibrée : ${
      ambitieux.length ? `tentez ${ambitieux.length} vœu(x) ambitieux` : 'gardez une part d\'ambition'
    }, et sécurisez avec ${sures.length} valeur(s) sûre(s).`,
  )
  if (!profil.mobilite && profil.region)
    out.push(
      `Vous n'êtes pas mobile : les licences de votre région (${profil.region}) vous donnent la priorité de secteur.`,
    )
  const chers = formations.filter((f) => (f.prixAnnuel ?? 0) >= 5000)
  if (chers.length)
    out.push(
      `Anticipez le budget : ${chers.length} formation(s) dépassent 5 000 €/an, en plus du coût de la vie.`,
    )
  if (profil.motivation <= 4)
    out.push(
      'Travaillez votre projet motivé : une motivation clairement exprimée pèse dans l\'examen des vœux.',
    )
  return out
}

const SYSTEME = `Tu es un conseiller d'orientation post-bac français, expert de Parcoursup.
Tu donnes des conseils concrets, bienveillants et actionnables à un lycéen.
Règles :
- Réponds en français, en 3 à 5 conseils courts (une à deux phrases chacun).
- Appuie-toi sur les données fournies (résultats, région, passions, motivation, prix).
- Encourage une liste de vœux équilibrée (ambitieux / réalistes / valeurs sûres).
- Reste factuel : ce sont des estimations, jamais des garanties d'admission.
- N'invente pas de chiffres qui ne sont pas fournis.`

/** Conseils générés par l'API Claude. Peut lever une erreur (réseau, quota…). */
export async function conseilIA(
  profil: ProfilResume,
  formations: FormationResume[],
): Promise<string[]> {
  const client = new Anthropic()

  const contexte = {
    profil,
    formations: formations.slice(0, 8),
  }

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    output_config: { effort: 'low' },
    system: SYSTEME,
    messages: [
      {
        role: 'user',
        content: `Voici le profil de l'étudiant et ses formations simulées (JSON). Donne-lui tes conseils personnalisés sous forme d'une liste à puces, une puce par ligne commençant par "- ".\n\n${JSON.stringify(
          contexte,
          null,
          2,
        )}`,
      },
    ],
  })

  const texte = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  const conseils = texte
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((l) => l.length > 0)

  if (conseils.length === 0) throw new Error('Réponse IA vide')
  return conseils
}

/**
 * Point d'entrée : IA si une clé est configurée, sinon règles.
 * Toute erreur de l'IA retombe silencieusement sur les règles.
 */
export async function obtenirConseil(
  profil: ProfilResume,
  formations: FormationResume[],
): Promise<Conseil> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const conseils = await conseilIA(profil, formations)
      return { conseils, source: 'ia' }
    } catch {
      // Repli sur les règles en cas d'erreur API.
    }
  }
  return { conseils: conseilRegles(profil, formations), source: 'regles' }
}
