/**
 * Les résultats publiés d'un lycée.
 *
 * ── D'où viennent ces chiffres ───────────────────────────────────────────
 *
 * Du jeu « Indicateurs de résultat des lycées d'enseignement général et
 * technologique », publié par le ministère de l'Éducation nationale. Ils ne
 * sont ni estimés, ni recalculés : les nombres de mentions sont ceux du
 * fichier, et le seul calcul fait ici est une soustraction — les admis sans
 * mention, qui ne sont pas publiés en tant que tels.
 *
 * La jointure se fait sur le CODE UAI, qui est la clé pivot des
 * établissements dans ce projet. Jamais sur le libellé : deux lycées peuvent
 * porter le même nom dans deux communes, et un nom se réécrit d'une année
 * sur l'autre.
 *
 * ── Pourquoi le millésime compte ici plus qu'ailleurs ────────────────────
 *
 * Le dernier millésime publié n'est pas celui de l'année en cours. Au moment
 * où ces lignes sont écrites, 2023 est le plus récent — la session suivante
 * n'a pas encore été consolidée. Afficher « ton lycée » sans dire de quelle
 * année il s'agit laisserait croire à des résultats de l'an dernier.
 *
 * ── Ce que ces chiffres ne disent PAS ────────────────────────────────────
 *
 * Ils décrivent une promotion, pas un élève. Un lycée où 43 % sortent sans
 * mention n'empêche personne d'avoir une mention très bien, et un lycée à
 * forts résultats n'en garantit aucune. Ils servent à SE SITUER, ce qui est
 * utile, et à rien d'autre — ils n'entrent dans aucun des trois scores du
 * site (règle 5 de CLAUDE.md).
 */

const JEU =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/' +
  'fr-en-indicateurs-de-resultat-des-lycees-denseignement-general-et-technologique/records'

export const SOURCE_LYCEES =
  'Indicateurs de résultat des lycées, ministère de l’Éducation nationale'

export interface Lycee {
  /** Code UAI. La clé pivot : aucune jointure sur le libellé. */
  readonly uai: string
  readonly nom: string
  /** Code INSEE de la commune. */
  readonly commune: string
  /** Nom de la ville, tel que publié puis remis en casse française. */
  readonly ville: string
  /** Nom du département, même traitement. Départage deux villes homonymes. */
  readonly departement: string
  readonly annee: string
}

export interface MentionsLycee extends Lycee {
  /** Candidats présents à la session, voie générale. */
  readonly presents: number
  /** Taux de réussite publié, en pourcentage. */
  readonly tauxReussite: number
  readonly felicitations: number
  readonly tresBien: number
  readonly bien: number
  readonly assezBien: number
  /**
   * Admis sans mention. SEUL chiffre calculé ici : admis moins mentions.
   * `null` quand un des termes manque — une soustraction avec un trou donne
   * un nombre, pas une information.
   */
  readonly sansMention: number | null
}

/**
 * Une ligne du jeu, telle qu'elle arrive.
 *
 * Chaque champ accepte `null` ET `undefined` : le jeu publie littéralement
 * `null` pour une série absente d'un lycée — un établissement sans filière
 * technologique n'a pas de taux pour celle-ci — et `exactOptionalPropertyTypes`
 * distingue « absent » de « présent et nul ». Les deux existent ici, donc le
 * type doit dire les deux.
 */
interface LigneLycee {
  readonly code_etablissement?: string | null | undefined
  readonly etablissement?: string | null | undefined
  readonly commune?: string | null | undefined
  readonly ville?: string | null | undefined
  readonly departement?: string | null | undefined
  readonly annee?: string | null | undefined
  readonly presents_gnle?: number | null | undefined
  readonly taux_reu_brut_gnle?: string | number | null | undefined
  readonly nombre_de_mentions_tb_avec_felicitations_g?: number | null | undefined
  readonly nombre_de_mentions_tb_sans_felicitations_g?: number | null | undefined
  readonly nombre_de_mentions_b_g?: number | null | undefined
  readonly nombre_de_mentions_ab_g?: number | null | undefined
}

/* Les mots qui restent en bas de casse à l'intérieur d'un nom de lieu. Hors
   première position : « Le Havre » garde sa majuscule, « Saint-Jean-de-Luz »
   non. La liste est fermée — inventer une règle générale sur les mots courts
   donnerait « Aix-En-Provence » ou « Val D'oise ». */
const MOTS_BAS = new Set([
  'a', 'au', 'aux', 'd', 'de', 'des', 'du', 'en', 'et', 'l', 'la', 'le', 'les',
  'lès', 'sous', 'sur', 'un', 'une',
])

/**
 * « CARCASSONNE » → « Carcassonne », « SAINT-ETIENNE-DU-ROUVRAY » →
 * « Saint-Etienne-du-Rouvray », « AIX-EN-PROVENCE » → « Aix-en-Provence ».
 *
 * L'open data des lycées publie tout en capitales. Le laisser tel quel donnait
 * une ligne qui crie au milieu d'une phrase, et l'élève lit d'abord la ville.
 *
 * Les accents ne sont pas restitués : le jeu ne les publie pas, et les
 * inventer produirait « Nîmes » sur une source qui écrit « NIMES ». On remet
 * la casse, jamais ce qui n'est pas là.
 */
export function casseDeLieu(brut: string): string {
  const net = brut.trim()
  if (net === '') return ''
  let debutDeMot = true
  return [...net.toLowerCase()]
    .map((c) => {
      if (/[\s'’-]/.test(c)) {
        debutDeMot = true
        return c
      }
      const premier = debutDeMot
      debutDeMot = false
      return premier ? c.toLocaleUpperCase('fr-FR') : c
    })
    .join('')
    .replace(/(?<=[\s'’-])([^\s'’-]+)/g, (mot, _m, decalage: number) =>
      decalage > 0 && MOTS_BAS.has(mot.toLocaleLowerCase('fr-FR'))
        ? mot.toLocaleLowerCase('fr-FR')
        : mot,
    )
}

function entier(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? Math.round(n) : 0
}

/**
 * Cherche un lycée par son nom. Le millésime le plus récent d'abord : un même
 * établissement figure une fois par année, et on ne veut pas proposer six
 * fois le même lycée.
 */
export async function chercherLycees(
  nom: string,
  recuperer: typeof fetch = fetch,
): Promise<Lycee[]> {
  const net = nom.trim()
  if (net.length < 3) return []
  const params = new URLSearchParams({
    where: `search(etablissement, "${net.replace(/"/g, '')}")`,
    select: 'code_etablissement, etablissement, commune, ville, departement, annee',
    order_by: 'annee DESC',
    limit: '40',
  })
  const reponse = await recuperer(`${JEU}?${params.toString()}`)
  if (!reponse.ok) {
    throw new Error(`L’open data de l’Éducation nationale a répondu ${reponse.status}.`)
  }
  const corps = (await reponse.json()) as { results?: LigneLycee[] }

  // Un UAI n'apparaît qu'une fois, avec son millésime le plus récent.
  const vus = new Map<string, Lycee>()
  for (const l of corps.results ?? []) {
    const uai = l.code_etablissement
    if (typeof uai !== 'string' || uai === '' || vus.has(uai)) continue
    vus.set(uai, {
      uai,
      nom: l.etablissement ?? uai,
      commune: l.commune ?? '',
      ville: casseDeLieu(l.ville ?? ''),
      departement: casseDeLieu(l.departement ?? ''),
      annee: l.annee ?? '',
    })
  }
  return [...vus.values()]
}

/**
 * Les mentions d'un lycée, sur son millésime publié le plus récent.
 *
 * `null` quand l'établissement n'a aucune ligne exploitable : une absence
 * s'affiche comme une absence, jamais comme une série de zéros.
 */
export async function mentionsDuLycee(
  uai: string,
  recuperer: typeof fetch = fetch,
): Promise<MentionsLycee | null> {
  const params = new URLSearchParams({
    where: `code_etablissement = "${uai.replace(/"/g, '')}"`,
    order_by: 'annee DESC',
    limit: '1',
  })
  const reponse = await recuperer(`${JEU}?${params.toString()}`)
  if (!reponse.ok) return null
  const corps = (await reponse.json()) as { results?: LigneLycee[] }
  const l = corps.results?.[0]
  if (l === undefined) return null
  return depuisLigne(l)
}

/** Construit les mentions à partir d'une ligne brute. Exporté pour les tests. */
export function depuisLigne(l: LigneLycee): MentionsLycee {
  const presents = entier(l.presents_gnle)
  const tauxReussite = entier(l.taux_reu_brut_gnle)
  const felicitations = entier(l.nombre_de_mentions_tb_avec_felicitations_g)
  const tresBien = entier(l.nombre_de_mentions_tb_sans_felicitations_g)
  const bien = entier(l.nombre_de_mentions_b_g)
  const assezBien = entier(l.nombre_de_mentions_ab_g)

  // Les admis sans mention ne sont pas publiés : on les déduit. La
  // soustraction n'a de sens que si les deux termes existent — sinon on rend
  // `null`, et l'écran dit que le chiffre manque.
  const mentions = felicitations + tresBien + bien + assezBien
  const admis = presents > 0 && tauxReussite > 0 ? Math.round((presents * tauxReussite) / 100) : 0
  const sansMention = admis > 0 && mentions > 0 ? Math.max(0, admis - mentions) : null

  return {
    uai: l.code_etablissement ?? '',
    nom: l.etablissement ?? '',
    commune: l.commune ?? '',
    ville: casseDeLieu(l.ville ?? ''),
    departement: casseDeLieu(l.departement ?? ''),
    annee: l.annee ?? '',
    presents,
    tauxReussite,
    felicitations,
    tresBien,
    bien,
    assezBien,
    sansMention,
  }
}

export interface PartMention {
  readonly libelle: string
  readonly nombre: number
  /** Part des ADMIS, en pourcentage arrondi. */
  readonly pourcentage: number
}

/**
 * La répartition, en pourcentage des admis.
 *
 * Des admis et non des présents : une mention se compte parmi ceux qui ont
 * eu le bac. Rapporter les mentions aux présents ferait un total qui ne
 * tombe pas à cent, et personne ne saurait pourquoi.
 */
export function repartition(m: MentionsLycee): PartMention[] {
  const total =
    m.felicitations + m.tresBien + m.bien + m.assezBien + (m.sansMention ?? 0)
  if (total === 0) return []
  const part = (n: number): number => Math.round((n / total) * 100)
  const lignes: PartMention[] = [
    { libelle: 'Félicitations', nombre: m.felicitations, pourcentage: part(m.felicitations) },
    { libelle: 'Mention très bien', nombre: m.tresBien, pourcentage: part(m.tresBien) },
    { libelle: 'Mention bien', nombre: m.bien, pourcentage: part(m.bien) },
    { libelle: 'Mention assez bien', nombre: m.assezBien, pourcentage: part(m.assezBien) },
  ]
  if (m.sansMention !== null) {
    lignes.push({
      libelle: 'Sans mention',
      nombre: m.sansMention,
      pourcentage: part(m.sansMention),
    })
  }
  return lignes
}
