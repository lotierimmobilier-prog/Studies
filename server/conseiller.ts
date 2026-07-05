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
  classe?: 'seconde' | 'premiere' | 'terminale'
  souhaits?: string
  specialites?: string[]
  meilleuresMatieres: string[]
  /** Matières que l'élève a écartées de l'analyse (non prioritaires). */
  matieresExclues?: string[]
  region: string | null
  /** Villes visées en priorité (facultatif). */
  villes?: string[]
  mobilite: boolean
  passions: string[]
  motivation: number
  coherenceProjet: number
  /** Synthèse des appréciations du bulletin (si analysé). */
  appreciation?: string
  signaux?: { serieux: number; participation: number; progression: number }
  /** Réponses aux questions de ciblage (pour un conseil plus précis). */
  reponses?: { question: string; reponse: string }[]
}

export interface Conseil {
  conseils: string[]
  source: 'ia' | 'regles'
}

/** Correspondance passion/domaine → spécialités conseillées (pour la seconde). */
const SPECIALITES: Record<string, string[]> = {
  Santé: ['SVT', 'Physique-Chimie', 'Mathématiques'],
  Informatique: ['NSI', 'Mathématiques', 'Physique-Chimie'],
  Ingénierie: ['Mathématiques', 'Physique-Chimie', 'Sciences de l\'ingénieur'],
  Sciences: ['Mathématiques', 'Physique-Chimie', 'SVT'],
  'Économie / Gestion': ['SES', 'Mathématiques', 'HGGSP'],
  Commerce: ['SES', 'Mathématiques', 'LLCER'],
  Droit: ['HGGSP', 'SES', 'HLP (Humanités)'],
  Lettres: ['HLP (Humanités)', 'LLCER', 'HGGSP'],
  Langues: ['LLCER', 'HLP (Humanités)', 'HGGSP'],
  Arts: ['Arts', 'HLP (Humanités)', 'LLCER'],
  'Sciences sociales': ['SES', 'HGGSP', 'SVT'],
  'Sport (STAPS)': ['SVT', 'Mathématiques', 'EPS'],
  Communication: ['HLP (Humanités)', 'LLCER', 'SES'],
}

/** Conseils spécifiques à un élève de seconde : choix de spécialités. */
function conseilSeconde(profil: ProfilResume): string[] {
  const out: string[] = []
  const specs = new Set<string>()
  for (const p of profil.passions) {
    for (const s of SPECIALITES[p] ?? []) specs.add(s)
  }
  if (specs.size)
    out.push(
      `Vu vos centres d'intérêt, des spécialités cohérentes seraient : ${[...specs]
        .slice(0, 4)
        .join(', ')}.`,
    )
  else
    out.push(
      'Choisissez d\'abord 1 à 2 domaines qui vous plaisent : les spécialités en découleront.',
    )
  if (profil.meilleuresMatieres.length)
    out.push(
      `Vous réussissez en ${profil.meilleuresMatieres[0]} : gardez une spécialité qui valorise ce point fort.`,
    )
  out.push(
    'En première, on garde 3 spécialités puis 2 en terminale : privilégiez celles qui ouvrent le plus de portes vers votre projet.',
  )
  if (profil.souhaits && profil.souhaits.trim())
    out.push(
      'Reliez vos spécialités à votre souhait exprimé : c\'est la cohérence du parcours qui compte le plus.',
    )
  return out
}

/** Conseils déterministes (repli), indépendants de toute API. */
export function conseilRegles(
  profil: ProfilResume,
  formations: FormationResume[],
): string[] {
  if (profil.classe === 'seconde') return conseilSeconde(profil)
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

const SYSTEME = `Tu es un conseiller d'orientation français, expert de Parcoursup et du lycée.
Tu donnes des conseils concrets, bienveillants et actionnables à un élève.
Règles :
- Réponds en français, en 3 à 5 conseils courts (une à deux phrases chacun).
- Sois SPÉCIFIQUE, jamais généraliste : cite des formations PRÉCISES par leur nom et leur ville (parmi celles fournies), et justifie chaque recommandation par un élément du profil (une note, une spécialité, une passion, une réponse de ciblage).
- Adapte-toi à la classe de l'élève (champ "classe") :
  * Si "seconde" : conseille surtout les SPÉCIALITÉS de première/terminale à choisir, en fonction de ses notes, de l'analyse de ses appréciations et de ses souhaits. Les formations listées ne sont qu'un horizon.
  * Si "premiere" ou "terminale" : conseille une liste de vœux Parcoursup équilibrée (ambitieux / réalistes / valeurs sûres) en nommant des formations concrètes.
- Exploite EN PRIORITÉ les réponses de ciblage ("reponses") pour trancher entre les options (cursus court/long, alternance, priorité débouchés/passion/proximité/coût…) : c'est ce qui rend le conseil personnalisé.
- Tiens compte des villes visées ("villes") si présentes : mets en avant les formations qui s'y trouvent.
- Tiens compte des spécialités choisies ("specialites") : signale si elles sont bien alignées avec les formations visées, ou si un ajustement serait utile.
- Respecte les matières écartées par l'élève ("matieresExclues") : ne lui reproche pas ses notes dans ces matières, considère-les comme non prioritaires pour son projet.
- Exploite l'analyse du bulletin quand elle est fournie ("appreciation", "signaux") : sérieux, participation, progression.
- Relie les conseils aux souhaits exprimés par l'élève.
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
