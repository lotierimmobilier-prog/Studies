/**
 * Relevés anonymes d'usage, et leurs agrégats.
 *
 * ══ La règle qui commande tout ce fichier ════════════════════════════════
 *
 * La page d'accueil promet, noir sur blanc : « Il n'enregistre aucune donnée
 * scolaire. Même inscrit, tes notes, tes bulletins et tes vœux restent dans
 * ton navigateur. » Cette promesse doit rester VRAIE après ce module.
 *
 * Elle le reste parce qu'un relevé ne contient, par construction :
 *
 *   - AUCUN identifiant. Ni compte, ni jeton de session, ni adresse, ni
 *     identifiant d'appareil, ni numéro tiré au hasard qui suivrait quelqu'un
 *     d'une visite à l'autre. Deux relevés du même élève sont donc
 *     indistinguables de deux relevés d'élèves différents — et c'est
 *     exactement ce qu'on veut.
 *   - AUCUNE note exacte. Une moyenne devient une TRANCHE. « 14,3 » associé à
 *     une académie et à une commune peu peuplée désigne parfois une seule
 *     personne ; « entre 14 et 16 » ne désigne personne.
 *   - AUCUN vœu, AUCUNE formation demandée. Les communes chiffrées sont
 *     gardées parce qu'elles disent où le coût de la vie intéresse les
 *     lycéens — ce qui est le sujet du site —, pas ce que tel élève veut
 *     faire de sa vie.
 *   - AUCUNE heure. La date seule. Un horodatage à la seconde, croisé avec
 *     une commune rare, redevient un identifiant.
 *
 * Ces relevés ne sont donc pas des données personnelles rattachables : ce
 * sont des événements. On ne peut ni les rendre à quelqu'un, ni les effacer
 * pour quelqu'un, et il n'y a rien à rendre ni à effacer.
 *
 * ══ Ce qu'ils servent à savoir ═══════════════════════════════════════════
 *
 * Quelles villes intéressent, quelles filières, quel profil de bac, et à quel
 * reste-à-vivre les simulations aboutissent. C'est ce qui permet de savoir où
 * le site est utile et où il ne l'est pas.
 */

export const TYPES_BAC = ['general', 'technologique', 'professionnel', 'autre'] as const
export type TypeBacReleve = (typeof TYPES_BAC)[number]

export const MOBILITES = ['meme_ville', 'meme_region', 'france'] as const
export type MobiliteReleve = (typeof MOBILITES)[number]

/**
 * Les tranches de moyenne. Bornes inférieures incluses, supérieures exclues,
 * sauf la dernière. « inconnue » quand aucune note n'a été saisie — une
 * absence s'affiche comme une absence, jamais comme un zéro.
 */
export const TRANCHES_MOYENNE = [
  'moins de 10',
  '10 à 12',
  '12 à 14',
  '14 à 16',
  '16 et plus',
  'inconnue',
] as const
export type TrancheMoyenne = (typeof TRANCHES_MOYENNE)[number]

export function trancheMoyenne(moyenne: number | null): TrancheMoyenne {
  if (moyenne === null || !Number.isFinite(moyenne)) return 'inconnue'
  if (moyenne < 10) return 'moins de 10'
  if (moyenne < 12) return '10 à 12'
  if (moyenne < 14) return '12 à 14'
  if (moyenne < 16) return '14 à 16'
  return '16 et plus'
}

/**
 * Les tranches de reste-à-vivre, en euros par mois. Le négatif a sa tranche
 * propre : c'est le cas qui compte le plus — celui où l'année n'est pas
 * finançable — et le noyer dans « moins de 200 » le rendrait invisible.
 */
export const TRANCHES_RESTE = [
  'négatif',
  '0 à 200',
  '200 à 400',
  '400 à 600',
  '600 à 900',
  '900 et plus',
  'non calculé',
] as const
export type TrancheReste = (typeof TRANCHES_RESTE)[number]

export function trancheReste(euros: number | null): TrancheReste {
  if (euros === null || !Number.isFinite(euros)) return 'non calculé'
  if (euros < 0) return 'négatif'
  if (euros < 200) return '0 à 200'
  if (euros < 400) return '200 à 400'
  if (euros < 600) return '400 à 600'
  if (euros < 900) return '600 à 900'
  return '900 et plus'
}

/** Un relevé, tel qu'il est stocké. Rien de plus n'a le droit d'y figurer. */
export interface Releve {
  /** Date SEULE, sans heure. Format ISO court. */
  readonly le: string
  readonly typeBac: TypeBacReleve
  /** Académie de l'élève, ou null si non renseignée. */
  readonly academie: string | null
  readonly trancheMoyenne: TrancheMoyenne
  /** Boursier déclaré : vrai, faux, ou null quand l'échelon est inconnu. */
  readonly boursier: boolean | null
  readonly mobilite: MobiliteReleve
  /** Filière demandée, telle que publiée par le ministère. */
  readonly filiere: string | null
  /** Codes INSEE des communes dont le reste-à-vivre a été chiffré. */
  readonly communes: readonly string[]
  /** Tranche du meilleur reste-à-vivre obtenu. */
  readonly trancheReste: TrancheReste
  /** Nombre de bulletins déposés. Un compte, jamais leur contenu. */
  readonly bulletins: number
  /** Nombre de formations proposées par la recherche. */
  readonly formations: number
}

/**
 * Les clés qu'un relevé a le droit de porter. Tout ce qui arrive en plus est
 * jeté : c'est la barrière qui empêche un identifiant de se glisser dans le
 * relevé parce que quelqu'un l'aurait ajouté côté navigateur.
 */
export const CLES_RELEVE: readonly (keyof Releve)[] = [
  'le',
  'typeBac',
  'academie',
  'trancheMoyenne',
  'boursier',
  'mobilite',
  'filiere',
  'communes',
  'trancheReste',
  'bulletins',
  'formations',
]

export class ReleveInvalide extends Error {
  constructor(raison: string) {
    super(raison)
    this.name = 'ReleveInvalide'
  }
}

function texteBorne(v: unknown, maximum: number): string | null {
  if (typeof v !== 'string') return null
  const net = v.trim().slice(0, maximum)
  return net === '' ? null : net
}

function entierBorne(v: unknown, maximum: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(Math.floor(v), maximum))
}

/**
 * Normalise ce qui arrive du navigateur.
 *
 * Rien n'est accepté sur parole. Chaque champ est reconstruit à partir des
 * valeurs permises, et tout le reste est ignoré — un champ inconnu ne peut
 * donc pas voyager jusqu'au disque, même si le front est modifié ou si
 * quelqu'un poste directement sur l'adresse.
 *
 * La DATE est imposée par le serveur, jamais reprise du navigateur : une
 * date venue du client serait à la fois falsifiable et, avec une heure, un
 * quasi-identifiant.
 */
export function normaliserReleve(brut: unknown, aujourdHui: string): Releve {
  if (typeof brut !== 'object' || brut === null) {
    throw new ReleveInvalide('Un objet est attendu.')
  }
  const o = brut as Record<string, unknown>

  const typeBac = TYPES_BAC.find((t) => t === o.typeBac) ?? 'autre'
  const mobilite = MOBILITES.find((m) => m === o.mobilite) ?? 'france'
  const tranche = TRANCHES_MOYENNE.find((t) => t === o.trancheMoyenne) ?? 'inconnue'
  const reste = TRANCHES_RESTE.find((t) => t === o.trancheReste) ?? 'non calculé'

  // Codes INSEE : cinq caractères, chiffres et lettres (la Corse a 2A/2B).
  // Vingt au plus — au-delà, ce n'est plus une simulation, c'est un balayage.
  const communes = Array.isArray(o.communes)
    ? [...new Set(o.communes.filter((c): c is string => typeof c === 'string' && /^[0-9AB]{5}$/i.test(c)))]
        .map((c) => c.toUpperCase())
        .sort()
        .slice(0, 20)
    : []

  return {
    le: aujourdHui,
    typeBac,
    academie: texteBorne(o.academie, 60),
    trancheMoyenne: tranche,
    boursier: typeof o.boursier === 'boolean' ? o.boursier : null,
    mobilite,
    filiere: texteBorne(o.filiere, 120),
    communes,
    trancheReste: reste,
    bulletins: entierBorne(o.bulletins, 20),
    formations: entierBorne(o.formations, 200),
  }
}

/* ------------------------------------------------------------- agrégats */

export interface Comptage {
  readonly valeur: string
  readonly nombre: number
}

export interface AgregatReleves {
  readonly total: number
  readonly duPremier: string | null
  readonly auDernier: string | null
  readonly parJour: readonly Comptage[]
  readonly parTypeBac: readonly Comptage[]
  readonly parAcademie: readonly Comptage[]
  readonly parTrancheMoyenne: readonly Comptage[]
  readonly parTrancheReste: readonly Comptage[]
  readonly parMobilite: readonly Comptage[]
  readonly parFiliere: readonly Comptage[]
  /** Communes les plus simulées. Ce sont elles qui disent où le sujet porte. */
  readonly communes: readonly Comptage[]
  readonly boursiers: { readonly oui: number; readonly non: number; readonly inconnu: number }
}

function compter(valeurs: readonly (string | null)[], limite = 0): Comptage[] {
  const par = new Map<string, number>()
  for (const v of valeurs) {
    const cle = v === null || v === '' ? 'non renseigné' : v
    par.set(cle, (par.get(cle) ?? 0) + 1)
  }
  const liste = [...par.entries()]
    .map(([valeur, nombre]) => ({ valeur, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.valeur.localeCompare(b.valeur, 'fr'))
  return limite > 0 ? liste.slice(0, limite) : liste
}

export function agregerReleves(releves: readonly Releve[]): AgregatReleves {
  const dates = releves.map((r) => r.le).sort()
  return {
    total: releves.length,
    duPremier: dates[0] ?? null,
    auDernier: dates[dates.length - 1] ?? null,
    // Par jour, en ordre CHRONOLOGIQUE : c'est une série, pas un palmarès.
    parJour: compter(dates).sort((a, b) => a.valeur.localeCompare(b.valeur)),
    parTypeBac: compter(releves.map((r) => r.typeBac)),
    parAcademie: compter(releves.map((r) => r.academie), 30),
    parTrancheMoyenne: compter(releves.map((r) => r.trancheMoyenne)),
    parTrancheReste: compter(releves.map((r) => r.trancheReste)),
    parMobilite: compter(releves.map((r) => r.mobilite)),
    parFiliere: compter(releves.map((r) => r.filiere), 30),
    communes: compter(releves.flatMap((r) => [...r.communes]), 40),
    boursiers: {
      oui: releves.filter((r) => r.boursier === true).length,
      non: releves.filter((r) => r.boursier === false).length,
      inconnu: releves.filter((r) => r.boursier === null).length,
    },
  }
}

/**
 * Les relevés en CSV, une ligne par relevé.
 *
 * Exportables tels quels PARCE QU'ils sont anonymes : il n'y a rien à
 * caviarder, et c'est bien la preuve que la conception tient. Un export qui
 * demanderait de masquer des colonnes signalerait que le relevé n'aurait
 * jamais dû contenir ces colonnes.
 */
export function relevesEnCsv(releves: readonly Releve[]): string {
  const colonnes = CLES_RELEVE
  const echapper = (v: unknown): string => {
    const t = Array.isArray(v) ? v.join(' ') : v === null ? '' : String(v)
    // Le point-virgule sépare : c'est ce qu'attend un tableur français, où la
    // virgule est le séparateur DÉCIMAL.
    return /[";\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t
  }
  return [
    colonnes.join(';'),
    ...releves.map((r) => colonnes.map((c) => echapper(r[c])).join(';')),
  ].join('\n')
}
