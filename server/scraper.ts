/**
 * Extraction des frais de scolarité depuis le HTML d'une page d'école.
 *
 * Le scraping web est intrinsèquement fragile (chaque site a sa mise en page).
 * On adopte une stratégie robuste et prudente : repérer les montants en euros
 * proches de mots-clés pertinents (« frais de scolarité », « scolarité »,
 * « par an »…), écarter les montants aberrants, et renvoyer le candidat le plus
 * plausible — ou null si rien de fiable n'est trouvé.
 */

const MOTS_CLES_PRIX = [
  'frais de scolarite',
  'frais de scolarité',
  'scolarite',
  'scolarité',
  'tarif',
  'cout de la formation',
  'coût de la formation',
  'droits de scolarite',
  'droits de scolarité',
  'tuition',
]

const MOTS_CLES_ANNUEL = ['/an', 'par an', 'annuel', 'année', 'annee', '/année']

/** Retire les balises HTML et normalise les espaces. */
export function htmlVersTexte(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€')
    .replace(/&#8364;/g, '€')
    .replace(/\s+/g, ' ')
    .trim()
}

interface MontantTrouve {
  valeur: number
  index: number
}

/** Repère tous les montants en euros dans un texte, avec leur position. */
export function trouverMontantsEuros(texte: string): MontantTrouve[] {
  const montants: MontantTrouve[] = []
  // Ex. « 9 500 € », « 9500€ », « 9.500 EUR », « 12 000 euros »
  const regex = /(\d[\d .]{1,9}\d|\d)\s*(€|eur\b|euros?)/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(texte)) !== null) {
    const brut = m[1].replace(/[ .]/g, '')
    const valeur = Number(brut)
    if (Number.isFinite(valeur)) montants.push({ valeur, index: m.index })
  }
  return montants
}

/** Distance (en caractères) entre un index et le mot-clé le plus proche. */
function distanceMotCle(texteNorm: string, index: number, mots: string[]): number {
  let min = Infinity
  for (const mot of mots) {
    let from = 0
    let pos = texteNorm.indexOf(mot, from)
    while (pos !== -1) {
      min = Math.min(min, Math.abs(pos - index))
      from = pos + 1
      pos = texteNorm.indexOf(mot, from)
    }
  }
  return min
}

export interface OptionsExtraction {
  /** Bornes plausibles d'un montant annuel de scolarité (€). */
  min?: number
  max?: number
  /** Distance max (caractères) à un mot-clé « prix » pour retenir un montant. */
  distanceMax?: number
}

/**
 * Extrait le montant annuel le plus plausible d'une page HTML, ou null.
 * On privilégie les montants proches d'un mot-clé de prix ; à défaut, un
 * montant proche d'un mot-clé « annuel » ; sinon on renonce (prudence).
 */
export function extrairePrix(
  html: string,
  options: OptionsExtraction = {},
): number | null {
  const { min = 300, max = 25000, distanceMax = 120 } = options
  const texte = htmlVersTexte(html)
  const texteNorm = texte.toLowerCase()
  const montants = trouverMontantsEuros(texte).filter(
    (x) => x.valeur >= min && x.valeur <= max,
  )
  if (montants.length === 0) return null

  const scored = montants.map((x) => {
    const dPrix = distanceMotCle(texteNorm, x.index, MOTS_CLES_PRIX)
    const dAn = distanceMotCle(texteNorm, x.index, MOTS_CLES_ANNUEL)
    // Score : plus le montant est proche d'un mot-clé, mieux c'est.
    const score = Math.min(dPrix, dAn + 40)
    return { ...x, score, dPrix }
  })

  // On ne retient un montant que s'il est suffisamment proche d'un indice.
  const candidats = scored
    .filter((x) => x.score <= distanceMax)
    .sort((a, b) => a.score - b.score)

  return candidats.length > 0 ? candidats[0].valeur : null
}
