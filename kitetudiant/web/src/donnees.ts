/**
 * Accès aux données réelles. Rien n'est simulé ici.
 *
 * - Les formations viennent en direct de l'open data du ministère.
 * - Les loyers et la correspondance ville → code INSEE viennent d'un fichier
 *   généré par `scripts/exploration/generer_communes.py`, versionné pour que le
 *   front ne devine aucune jointure à l'exécution.
 * - L'aide au logement est calculée par notre serveur, qui appelle OpenFisca.
 */

import communes from '../donnees/communes.json'
import type { LoyerCommune, MontantSource } from '../../packages/budget-engine/src/types.ts'

/**
 * Racine de notre API, telle que le navigateur doit l'appeler.
 *
 * Le site est servi sous un SOUS-CHEMIN sur le VPS (« /kitetudiant/ »), et
 * nginx n'expose l'API que sous ce même préfixe. Écrire « /api/… » en dur
 * visait donc la racine du serveur, où il n'y a rien : en production, TOUS les
 * appels revenaient en 404 — comptes, aide au logement, retours — alors que le
 * serveur, lui, répondait parfaitement sur « /kitetudiant/api/… ».
 *
 * `import.meta.env.BASE_URL` vaut « / » en développement et « /kitetudiant/ »
 * dans le build de production : la même expression donne donc le bon chemin
 * dans les deux cas, sans rien à configurer.
 */
export const BASE_API = `${import.meta.env.BASE_URL}api`.replace(/\/{2,}/g, '/')

const ESR =
  'https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-parcoursup/records'

/**
 * Une seule relance en cas de coupure réseau. L'open data répond bien, mais un
 * élève sur un réseau mobile capricieux ne doit pas perdre son parcours pour
 * une requête perdue. Au-delà d'un échec, on le dit plutôt que de s'entêter.
 */
async function avecUneRelance(url: string, recuperer: typeof fetch): Promise<Response> {
  try {
    return await recuperer(url)
  } catch {
    return await recuperer(url)
  }
}

export const SOURCE_LOYERS = communes.source
export const MILLESIME_LOYERS = communes.millesimeLoyers
export const TYPOLOGIE_LOYERS = communes.typologie
/** Date de génération du jeu de communes, à afficher avec les chiffres qui en viennent. */
export const GENERE_LE = communes.genereLe
/** Communes pour lesquelles un loyer est disponible. Compté, jamais écrit en dur. */
export const NOMBRE_COMMUNES_AVEC_LOYER = Object.keys(communes.communes).length

/**
 * Position du chef-lieu d'une commune, ou null si elle est inconnue.
 * Fonction à part plutôt qu'un champ de `loyerDe` : les loyers et les
 * positions répondent à deux questions différentes, et `LoyerCommune` ne doit
 * pas se mettre à transporter de la géographie.
 */
export function positionDe(codeInsee: string | null): { lat: number; lon: number } | null {
  if (codeInsee === null) return null
  const brut = (communes.communes as Record<string, { lat?: number; lon?: number }>)[codeInsee]
  if (brut === undefined) return null
  if (typeof brut.lat !== 'number' || typeof brut.lon !== 'number') return null
  return { lat: brut.lat, lon: brut.lon }
}

/**
 * Surface du logement type servant à convertir un €/m² en loyer mensuel.
 *
 * Exportée plutôt que recopiée : la page d'accueil et la collection de cartes
 * affichent le même loyer pour la même ville. Deux constantes séparées se
 * seraient désaccordées au premier changement, et deux chiffres différents
 * pour une même commune ruineraient la confiance que tout le site cherche.
 */
export const SURFACE_TYPE = 25

/**
 * Loyers centraux de toutes les communes couvertes, en €/m², triés croissant.
 *
 * Sert à situer une commune parmi les autres — savoir si son loyer est
 * ordinaire ou extrême — sans exposer le jeu brut. Calculé au premier appel
 * puis gardé : 1 246 communes, un tri, une seule fois.
 */
let loyersTries: readonly number[] | null = null
export function loyersCentrauxTries(): readonly number[] {
  if (loyersTries === null) {
    loyersTries = Object.values(communes.communes)
      .map((c) => (c as { central: number }).central)
      .sort((a, b) => a - b)
  }
  return loyersTries
}

export interface CommunePositionnee {
  readonly codeInsee: string
  readonly nom: string
  readonly lat: number
  readonly lon: number
}

/**
 * Communes dont on connaît la position, pour trouver la plus proche d'un élève
 * sans envoyer sa position à quiconque. Une commune sans coordonnées est
 * simplement absente : on n'invente pas de position de repli.
 */
export function communesPositionnees(): CommunePositionnee[] {
  const liste: CommunePositionnee[] = []
  for (const [codeInsee, c] of Object.entries(communes.communes)) {
    const brut = c as { nom: string; lat?: number; lon?: number }
    if (typeof brut.lat === 'number' && typeof brut.lon === 'number') {
      liste.push({ codeInsee, nom: brut.nom, lat: brut.lat, lon: brut.lon })
    }
  }
  return liste
}

export interface Formation {
  readonly id: string
  readonly libelle: string
  readonly etablissement: string
  readonly ville: string
  readonly departement: string
  readonly academie: string
  readonly filiere: string
  readonly selective: boolean
  readonly capacite: number | null
  readonly admis: number | null
  readonly tauxAcces: number | null
  readonly partBoursiers: number | null
  readonly lien: string | null
  readonly session: string
  readonly codeInsee: string | null
  /** Statistiques publiées, telles quelles : aucune n'est recalculée. */
  readonly stats: StatsFormation
}

import type { StatsFormation } from '../../packages/admissibilite/src/types.ts'

interface EnregistrementEsr {
  readonly cod_aff_form?: string
  readonly lib_for_voe_ins?: string
  readonly g_ea_lib_vx?: string
  readonly ville_etab?: string
  readonly dep?: string
  readonly dep_lib?: string
  readonly acad_mies?: string
  readonly fili?: string
  readonly select_form?: string
  readonly capa_fin?: number
  readonly acc_tot?: number
  readonly taux_acces_ens?: number
  readonly pct_bours?: number
  readonly lien_form_psup?: string
  readonly session?: string
  readonly acc_bg?: number
  readonly acc_bt?: number
  readonly acc_bp?: number
  readonly acc_at?: number
  readonly acc_brs?: number
  readonly acc_aca_orig?: number
  readonly acc_sansmention?: number
  readonly acc_ab?: number
  readonly acc_b?: number
  readonly acc_tb?: number
  readonly acc_tbf?: number
}

function nombreOuNul(v: number | undefined): number | null {
  return typeof v === 'number' ? v : null
}

/** Normalisation identique à celle du script de génération. */
export function normaliser(valeur: string): string {
  return valeur
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bst\b/g, 'saint')
    .replace(/\bste\b/g, 'sainte')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function departement(brut: string): string {
  return /^\d{1,2}$/.test(brut) ? brut.padStart(2, '0') : brut
}

/** Code INSEE de la commune d'une formation, ou null si la ville est inconnue. */
export function codeInseeDe(ville: string, dep: string): string | null {
  const cle = `${normaliser(ville)}|${departement(dep)}`
  return (communes.villes as Record<string, string>)[cle] ?? null
}

/** Loyer de référence d'une commune, ou null quand l'indicateur ne la couvre pas. */
export function loyerDe(codeInsee: string | null): LoyerCommune | null {
  if (codeInsee === null) return null
  const brut = (communes.communes as Record<string, {
    nom: string; bas: number; central: number; haut: number; maille: string
  }>)[codeInsee]
  if (brut === undefined) return null
  return {
    euroParM2: { bas: brut.bas, central: brut.central, haut: brut.haut },
    millesime: communes.millesimeLoyers,
    source: communes.source,
    qualite: brut.maille as LoyerCommune['qualite'],
  }
}

export function nomCommune(codeInsee: string): string | null {
  const brut = (communes.communes as Record<string, { nom: string }>)[codeInsee]
  return brut?.nom ?? null
}

function convertir(e: EnregistrementEsr): Formation | null {
  const id = e.cod_aff_form
  const libelle = e.lib_for_voe_ins
  const ville = e.ville_etab
  const dep = e.dep
  if (!id || !libelle || !ville || !dep) return null
  return {
    id,
    libelle,
    etablissement: e.g_ea_lib_vx ?? '',
    ville,
    departement: e.dep_lib ?? dep,
    academie: e.acad_mies ?? '',
    filiere: e.fili ?? '',
    selective: e.select_form !== 'formation non sélective',
    capacite: e.capa_fin ?? null,
    admis: e.acc_tot ?? null,
    tauxAcces: e.taux_acces_ens ?? null,
    partBoursiers: e.pct_bours ?? null,
    lien: e.lien_form_psup ?? null,
    session: e.session ?? '',
    codeInsee: codeInseeDe(ville, dep),
    stats: {
      session: e.session ?? '',
      capacite: nombreOuNul(e.capa_fin),
      admisTotal: nombreOuNul(e.acc_tot),
      tauxAcces: nombreOuNul(e.taux_acces_ens),
      admisBacGeneral: nombreOuNul(e.acc_bg),
      admisBacTechno: nombreOuNul(e.acc_bt),
      admisBacPro: nombreOuNul(e.acc_bp),
      admisAutres: nombreOuNul(e.acc_at),
      admisBoursiers: nombreOuNul(e.acc_brs),
      admisMemeAcademie: nombreOuNul(e.acc_aca_orig),
      admisSansMention: nombreOuNul(e.acc_sansmention),
      admisMentionAB: nombreOuNul(e.acc_ab),
      admisMentionB: nombreOuNul(e.acc_b),
      admisMentionTB: nombreOuNul(e.acc_tb),
      admisMentionTBF: nombreOuNul(e.acc_tbf),
      selective: e.select_form !== 'formation non sélective',
    },
  }
}

export const SOURCE_PARCOURSUP =
  'Parcoursup, open data du ministère de l’Enseignement supérieur (jeu fr-esr-parcoursup), Licence Ouverte'

export interface FiltreFormations {
  readonly filiere?: string
  readonly academie?: string
  /** Mots-clés cherchés dans l'intitulé de la formation, en OU. */
  readonly motsCles?: readonly string[]
  readonly limite?: number
}

/**
 * Interroge l'open data du ministère. Les libellés de filière viennent du jeu
 * lui-même : aucune liste n'est recopiée en dur ici.
 */
export async function chercherFormations(
  filtre: FiltreFormations,
  recuperer: typeof fetch = fetch,
): Promise<Formation[]> {
  const params = new URLSearchParams({
    limit: String(Math.min(filtre.limite ?? 60, 100)),
    order_by: 'voe_tot DESC',
  })
  const conditions: string[] = []
  if (filtre.filiere) conditions.push(`fili = "${filtre.filiere.replace(/"/g, '')}"`)
  if (filtre.academie) conditions.push(`acad_mies = "${filtre.academie.replace(/"/g, '')}"`)
  if (filtre.motsCles && filtre.motsCles.length > 0) {
    const recherche = filtre.motsCles
      .map((mot) => `search(lib_for_voe_ins, "${mot.replace(/"/g, '')}")`)
      .join(' OR ')
    conditions.push(`(${recherche})`)
  }
  if (conditions.length > 0) params.set('where', conditions.join(' AND '))

  const reponse = await avecUneRelance(`${ESR}?${params.toString()}`, recuperer)
  if (!reponse.ok) {
    throw new Error(`L'open data du ministère a répondu ${reponse.status}.`)
  }
  const corps = (await reponse.json()) as { results?: EnregistrementEsr[] }
  return (corps.results ?? []).map(convertir).filter((f): f is Formation => f !== null)
}

/** Les filières présentes dans le jeu, avec leur nombre de formations. */
export async function listerFilieres(
  recuperer: typeof fetch = fetch,
): Promise<{ libelle: string; nombre: number }[]> {
  const params = new URLSearchParams({
    select: 'fili, count(*) as nombre',
    group_by: 'fili',
    order_by: 'nombre DESC',
    limit: '30',
  })
  const reponse = await avecUneRelance(`${ESR}?${params.toString()}`, recuperer)
  if (!reponse.ok) throw new Error(`L'open data du ministère a répondu ${reponse.status}.`)
  const corps = (await reponse.json()) as { results?: { fili?: string; nombre?: number }[] }
  return (corps.results ?? [])
    .filter((r): r is { fili: string; nombre: number } => Boolean(r.fili))
    .map((r) => ({ libelle: r.fili, nombre: r.nombre ?? 0 }))
}

/* ------------------------------------------------------------------ comptes */

/**
 * Jeton de session. Il vit dans le navigateur de l'élève, jamais ailleurs.
 * localStorage peut lever (navigation privée, stockage bloqué) : chaque accès
 * est donc gardé, et l'absence de jeton se traite comme une déconnexion.
 */
const CLE_SESSION = 'kitetudiant.session'

export function jetonSession(): string {
  try {
    return window.localStorage.getItem(CLE_SESSION) ?? ''
  } catch {
    return ''
  }
}

function poserJeton(jeton: string): void {
  try {
    window.localStorage.setItem(CLE_SESSION, jeton)
  } catch {
    // Stockage refusé : la session ne survivra pas au rechargement. Ce n'est
    // pas une erreur à remonter à l'élève, il est connecté pour cette visite.
  }
}

function oublierJeton(): void {
  try {
    window.localStorage.removeItem(CLE_SESSION)
  } catch {
    /* rien à faire */
  }
}

/** Levée quand le serveur réclame un compte pour aller plus loin. */
export class InscriptionRequise extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InscriptionRequise'
  }
}

/** Erreur d'inscription ou de connexion, telle que le serveur la formule. */
export class CompteRefuse extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompteRefuse'
  }
}

async function appelCompte(
  chemin: string,
  corps: { email: string; motDePasse: string },
  base: string,
  recuperer: typeof fetch,
): Promise<void> {
  const reponse = await recuperer(`${base}/comptes/${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  const donnees = (await reponse.json().catch(() => ({}))) as {
    jeton?: string
    erreur?: string
  }
  if (!reponse.ok || typeof donnees.jeton !== 'string') {
    throw new CompteRefuse(donnees.erreur ?? `le service a répondu ${reponse.status}`)
  }
  poserJeton(donnees.jeton)
}

export function inscrire(
  email: string,
  motDePasse: string,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<void> {
  return appelCompte('inscription', { email, motDePasse }, base, recuperer)
}

export function connecter(
  email: string,
  motDePasse: string,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<void> {
  return appelCompte('connexion', { email, motDePasse }, base, recuperer)
}

export async function deconnecter(base = BASE_API, recuperer: typeof fetch = fetch): Promise<void> {
  const jeton = jetonSession()
  oublierJeton()
  if (jeton === '') return
  // La session est fermée côté serveur aussi : oublier le jeton localement
  // laisserait une session ouverte jusqu'à son expiration.
  await recuperer(`${base}/comptes/deconnexion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
  }).catch(() => undefined)
}

export interface DemandeAide {
  readonly ref: string
  readonly codeInsee: string
  readonly loyerMensuel: number
  readonly anneeNaissance: number
}

export type AideLogement =
  | { readonly ref: string; readonly aide: MontantSource }
  | { readonly ref: string; readonly raison: string }

/**
 * Demande au serveur les aides au logement. En cas d'indisponibilité, chaque
 * situation revient avec sa raison : le front affichera « donnée manquante »,
 * jamais une aide approchée.
 */
export async function chercherAidesLogement(
  demandes: readonly DemandeAide[],
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<AideLogement[]> {
  if (demandes.length === 0) return []
  let reponse: Response
  try {
    const jeton = jetonSession()
    reponse = await recuperer(`${base}/aide-logement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jeton === '' ? {} : { Authorization: `Bearer ${jeton}` }),
      },
      body: JSON.stringify(demandes),
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return demandes.map((d) => ({ ref: d.ref, raison: `Service d'aide au logement injoignable : ${detail}` }))
  }
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => ({}))) as {
      erreur?: string
      inscriptionRequise?: boolean
    }
    const raison = corps.erreur ?? `le service a répondu ${reponse.status}`
    // Un compte manquant n'est pas une donnée manquante : on le distingue pour
    // que l'affichage propose l'inscription au lieu d'annoncer une panne.
    if (reponse.status === 401 && corps.inscriptionRequise === true) {
      oublierJeton()
      throw new InscriptionRequise(raison)
    }
    return demandes.map((d) => ({ ref: d.ref, raison: `Aide au logement non calculée : ${raison}` }))
  }
  const corps = (await reponse.json()) as (
    | { ref: string; montant: number; source: string; millesime: string; hypothese: string }
    | { ref: string; raison: string }
  )[]
  return corps.map((r) =>
    'raison' in r
      ? { ref: r.ref, raison: r.raison }
      : {
          ref: r.ref,
          aide: {
            montant: r.montant,
            source: r.source,
            millesime: r.millesime,
            hypothese: r.hypothese,
          },
        },
  )
}

export interface BulletinExtrait {
  readonly notes: Readonly<Record<string, number>>
  readonly signaux: { readonly serieux: number; readonly participation: number; readonly progression: number }
  readonly matieresLues: number
  readonly source: string
}

/**
 * Envoie un bulletin au serveur, qui n'en fait ressortir que des nombres.
 * Le texte des appréciations ne revient jamais ici.
 */
export async function lireBulletin(
  fichierBase64: string,
  mediaType: string,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<BulletinExtrait> {
  const reponse = await recuperer(`${base}/bulletin-scolaire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fichier: fichierBase64, mediaType }),
  })
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => ({}))) as { erreur?: string }
    throw new Error(corps.erreur ?? `Lecture du bulletin impossible (${reponse.status}).`)
  }
  return (await reponse.json()) as BulletinExtrait
}

// ------------------------------------------------------------------ retours

export type { Agregat as AgregatRetours } from '../../packages/retours/src/index.ts'

/**
 * Jeton de contributeur, propre au navigateur. Il n'identifie personne : il
 * sert seulement à n'accepter qu'un retour par formation et par an, et il est
 * haché côté serveur avant d'être stocké. Le stockage local peut être refusé
 * (navigation privée, cookies bloqués) : on retombe alors sur un jeton de
 * session, quitte à autoriser un doublon plutôt que de bloquer la personne.
 */
export function jetonContributeur(): string {
  const cle = 'kitetudiant.contributeur'
  try {
    const existant = localStorage.getItem(cle)
    if (existant) return existant
    const neuf = crypto.randomUUID()
    localStorage.setItem(cle, neuf)
    return neuf
  } catch {
    return crypto.randomUUID()
  }
}

export interface DepotRetour {
  readonly codFormation: string
  readonly coutReelMensuel: number
  readonly faciliteLogement: number
  readonly ambiance: number
  readonly anneeEtudes: number
}

export async function deposerRetour(
  retour: DepotRetour,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<void> {
  const reponse = await recuperer(`${base}/retours`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...retour, jetonContributeur: jetonContributeur() }),
  })
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => ({}))) as { erreur?: string }
    throw new Error(corps.erreur ?? `Retour non enregistré (${reponse.status}).`)
  }
}

/** Agrégats de l'année en cours, pour plusieurs formations d'un coup. */
export async function chercherAgregatsRetours(
  codFormations: readonly string[],
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<Map<string, import('../../packages/retours/src/index.ts').Agregat>> {
  if (codFormations.length === 0) return new Map()
  try {
    const reponse = await recuperer(`${base}/retours/agregats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(codFormations),
    })
    if (!reponse.ok) return new Map()
    const liste = (await reponse.json()) as import('../../packages/retours/src/index.ts').Agregat[]
    return new Map(liste.map((a) => [a.codFormation, a]))
  } catch {
    // Les retours enrichissent l'affichage ; leur absence ne doit rien casser.
    return new Map()
  }
}

export async function chercherArchiveRetours(
  codFormation: string,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<import('../../packages/retours/src/index.ts').Agregat[]> {
  try {
    const reponse = await recuperer(`${base}/retours?formation=${encodeURIComponent(codFormation)}`)
    if (!reponse.ok) return []
    const corps = (await reponse.json()) as {
      archives?: import('../../packages/retours/src/index.ts').Agregat[]
    }
    return corps.archives ?? []
  } catch {
    return []
  }
}

// -------------------------------------------------------- note publique du lieu

export interface AvisLieu {
  readonly ref: string
  readonly note: number
  readonly nombreAvis: number
  readonly urlMaps: string | null
  readonly source: string
  readonly collecteLe: string
  readonly miseEnGarde: string
}

export interface AvisLieuIndisponible {
  readonly ref: string
  readonly raison: string
}

/**
 * Note publique du LIEU, à n'afficher que dans le détail d'une fiche.
 *
 * Elle ne revient jamais dans `ResultatFormation` : le tri et les deux axes
 * n'y ont structurellement pas accès, ce qui est la seule façon sûre de tenir
 * la règle « aucune note globale d'établissement dans les critères ».
 */
export async function chercherAvisLieu(
  etablissement: string,
  ville: string,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<AvisLieu | AvisLieuIndisponible> {
  const demande = { ref: 'lieu', etablissement, ville }
  try {
    const reponse = await recuperer(`${base}/avis-lieu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([demande]),
    })
    if (!reponse.ok) return { ref: 'lieu', raison: `Service indisponible (${reponse.status}).` }
    const liste = (await reponse.json()) as (AvisLieu | AvisLieuIndisponible)[]
    return liste[0] ?? { ref: 'lieu', raison: 'Aucune réponse du service.' }
  } catch (e) {
    return { ref: 'lieu', raison: `Service injoignable : ${(e as Error).message}` }
  }
}

// ------------------------------------------------------------------- articles

import type { Article as ArticlePublie } from '../../packages/articles/src/index.ts'

export type { ArticlePublie }

/**
 * Les articles écrits depuis la console d'administration.
 *
 * Ceux du dépôt sont déjà dans le paquet : cette liste ne contient que les
 * ajouts faits après le déploiement. Le front les fusionne, la console
 * l'emportant à slug égal — c'est ainsi qu'on corrige un texte publié sans
 * attendre une mise en ligne.
 *
 * En cas d'échec, on rend une liste vide plutôt qu'une erreur : le blog doit
 * rester lisible même API éteinte, puisque l'essentiel est déjà embarqué.
 */
export async function chercherArticles(
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<ArticlePublie[]> {
  try {
    const reponse = await recuperer(`${base}/articles`)
    if (!reponse.ok) return []
    const lu: unknown = await reponse.json()
    return Array.isArray(lu) ? (lu as ArticlePublie[]) : []
  } catch {
    return []
  }
}

