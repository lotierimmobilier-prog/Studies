/**
 * Les enseignements de spécialité et les options du baccalauréat général.
 *
 * ── À quoi ils servent ici ───────────────────────────────────────────────
 *
 * Deux usages, et il faut les distinguer parce qu'ils n'ont pas la même
 * solidité.
 *
 * 1. Ils affinent l'adéquation au profil. Un élève qui a gardé mathématiques
 *    et physique-chimie n'a pas le même dossier qu'un élève qui a gardé
 *    humanités et langues, à moyennes égales. C'est une déduction du site,
 *    assumée comme telle.
 *
 * 2. Ils se COMPARENT à ce que les admis avaient réellement. Le ministère
 *    publie, par doublette de spécialités et par grande famille de formation,
 *    le nombre de vœux, de propositions et d'acceptations — jeu
 *    « fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-2 »,
 *    4 810 lignes pour la session 2024, relevé le 20/09/2026. Là, ce n'est
 *    plus une déduction : c'est un chiffre publié.
 *
 * ── Ce que ces listes ne font pas ────────────────────────────────────────
 *
 * Elles ne ferment aucune porte. Une spécialité manquante ne retire jamais
 * une formation de la liste (règle 4 de CLAUDE.md) : elle peut expliquer un
 * écart, jamais le sanctionner. Les attendus des formations décrivent le
 * travail à venir, pas une condition d'entrée — c'est ce que dit déjà
 * l'article « Lire une fiche de formation sans se raconter d'histoires ».
 */

const JEU_DOUBLETTES =
  'https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/' +
  'fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-2/records'

export const SOURCE_DOUBLETTES =
  'Enseignements de spécialité des bacheliers généraux, ministère de ' +
  'l’Enseignement supérieur (open data Parcoursup)'

/**
 * Les treize spécialités du baccalauréat général.
 *
 * L'ordre est celui du sigle usuel, pas un classement. Les libellés sont
 * ceux que les élèves emploient — « HGGSP » plutôt que le nom complet, qui
 * tient sur deux lignes et que personne ne dit à voix haute.
 */
export interface Specialite {
  readonly cle: string
  readonly libelle: string
  /** Nom complet, pour l'infobulle et les lecteurs d'écran. */
  readonly complet: string
}

export const SPECIALITES: readonly Specialite[] = [
  { cle: 'maths', libelle: 'Mathématiques', complet: 'Mathématiques' },
  { cle: 'pc', libelle: 'Physique-chimie', complet: 'Physique-chimie' },
  { cle: 'svt', libelle: 'SVT', complet: 'Sciences de la vie et de la Terre' },
  { cle: 'ses', libelle: 'SES', complet: 'Sciences économiques et sociales' },
  {
    cle: 'hggsp',
    libelle: 'HGGSP',
    complet: 'Histoire-géographie, géopolitique et sciences politiques',
  },
  { cle: 'hlp', libelle: 'HLP', complet: 'Humanités, littérature et philosophie' },
  {
    cle: 'llcer',
    libelle: 'LLCER',
    complet: 'Langues, littératures et cultures étrangères et régionales',
  },
  { cle: 'nsi', libelle: 'NSI', complet: 'Numérique et sciences informatiques' },
  { cle: 'si', libelle: 'Sciences de l’ingénieur', complet: 'Sciences de l’ingénieur' },
  {
    cle: 'llca',
    libelle: 'LLCA',
    complet: 'Littérature, langues et cultures de l’Antiquité',
  },
  { cle: 'arts', libelle: 'Arts', complet: 'Arts' },
  { cle: 'bioeco', libelle: 'Biologie-écologie', complet: 'Biologie-écologie' },
  {
    cle: 'eppcs',
    libelle: 'EPPCS',
    complet: 'Éducation physique, pratiques et culture sportives',
  },
]

/** Les options, prises en plus des spécialités. */
export const OPTIONS: readonly Specialite[] = [
  { cle: 'maths-expertes', libelle: 'Maths expertes', complet: 'Mathématiques expertes' },
  {
    cle: 'maths-comp',
    libelle: 'Maths complémentaires',
    complet: 'Mathématiques complémentaires',
  },
  { cle: 'dgemc', libelle: 'DGEMC', complet: 'Droit et grands enjeux du monde contemporain' },
  { cle: 'lvc', libelle: 'Langue vivante C', complet: 'Langue vivante C' },
  { cle: 'lca', libelle: 'Latin ou grec', complet: 'Langues et cultures de l’Antiquité' },
  { cle: 'arts-option', libelle: 'Arts', complet: 'Arts, en option' },
  { cle: 'eps', libelle: 'EPS', complet: 'Éducation physique et sportive, en option' },
]

/** Le libellé d'une spécialité ou d'une option, ou sa clé si elle est inconnue. */
export function libelleDe(cle: string): string {
  return (
    SPECIALITES.find((s) => s.cle === cle)?.libelle ??
    OPTIONS.find((o) => o.cle === cle)?.libelle ??
    cle
  )
}

/* ------------------------------------------- ce que les admis avaient */

export interface DoubletteAdmise {
  /** Les deux spécialités, telles que publiées. */
  readonly specialites: readonly string[]
  readonly acceptations: number
  /** Part des acceptations de cette famille de formation, en pourcentage. */
  readonly pourcentage: number
  readonly annee: string
}

interface LigneDoublette {
  readonly annee_du_bac?: string
  readonly doublette?: readonly string[]
  readonly acceptations?: number
}

/**
 * Les doublettes de spécialités les plus représentées parmi les admis d'une
 * famille de formation.
 *
 * Le jeu ne descend PAS à la formation précise : il travaille sur de grandes
 * familles — « Licence Droit », « BUT Informatique ». On ne peut donc pas
 * dire « les admis de CETTE licence-là », et l'écran ne le prétend pas.
 *
 * Liste vide quand rien n'est publié pour cette famille : une absence
 * s'affiche comme une absence.
 */
export async function doublettesAdmises(
  famille: string,
  recuperer: typeof fetch = fetch,
  combien = 5,
): Promise<DoubletteAdmise[]> {
  const net = famille.trim()
  if (net.length < 3) return []
  const params = new URLSearchParams({
    where: `search(formation, "${net.replace(/"/g, '')}")`,
    select: 'annee_du_bac, doublette, acceptations',
    order_by: 'annee_du_bac DESC, acceptations DESC',
    limit: '120',
  })
  const reponse = await recuperer(`${JEU_DOUBLETTES}?${params.toString()}`)
  if (!reponse.ok) return []
  const corps = (await reponse.json()) as { results?: LigneDoublette[] }
  const lignes = corps.results ?? []
  if (lignes.length === 0) return []

  // Le millésime le plus récent SEULEMENT. Mélanger deux sessions ferait des
  // parts qui ne veulent rien dire, et l'écran ne pourrait plus dater ce
  // qu'il affiche (règle 6).
  const annee = lignes[0]?.annee_du_bac ?? ''
  const recentes = lignes.filter((l) => l.annee_du_bac === annee)
  const total = recentes.reduce((t, l) => t + (l.acceptations ?? 0), 0)
  if (total === 0) return []

  return recentes
    .filter((l) => (l.acceptations ?? 0) > 0)
    .slice(0, combien)
    .map((l) => ({
      specialites: (l.doublette ?? []).map(nettoyer),
      acceptations: l.acceptations ?? 0,
      pourcentage: Math.round(((l.acceptations ?? 0) / total) * 100),
      annee,
    }))
}

/**
 * Allège un libellé publié. Le jeu écrit « Mathématiques Spécialité » ;
 * le mot « Spécialité » répété sur chaque ligne n'apprend rien et double la
 * longueur de l'affichage.
 */
function nettoyer(libelle: string): string {
  return libelle.replace(/\s*Spécialité\s*$/i, '').trim()
}
