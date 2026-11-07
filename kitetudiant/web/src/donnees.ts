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
// Une seule définition, partagée avec la console d'administration.
export { nomCommune } from './communes.ts'
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

export interface Coordonnees {
  readonly lat: number
  readonly lon: number
}

export interface Formation {
  readonly id: string
  /** Code UAI de l'établissement : la clé pivot, jamais son nom. */
  readonly uai: string | null
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
  /**
   * Statut de l'établissement, TEL QUE PUBLIÉ : « Public », « Privé sous
   * contrat d'association », « Privé enseignement supérieur », « Privé hors
   * contrat ». Quatre valeurs, relevées le 20/09/2026 sur le jeu du
   * ministère. `null` quand le champ est absent — jamais « Public » par
   * défaut : ce serait exactement la valeur de repli silencieuse que
   * CLAUDE.md interdit, et elle tromperait sur le coût de la scolarité.
   */
  readonly statutEtablissement: string | null
  /**
   * Position publiée de la formation. `null` pour 0,27 % du jeu, et dans ce
   * cas la carte ne s'affiche pas : elle dit que la position n'est pas
   * publiée, plutôt que de montrer le centre de la commune comme si c'était
   * l'adresse de l'école.
   */
  readonly coordonnees: Coordonnees | null
  /** Statistiques publiées, telles quelles : aucune n'est recalculée. */
  readonly stats: StatsFormation
}

import type { StatsFormation } from '../../packages/admissibilite/src/types.ts'

interface EnregistrementEsr {
  readonly cod_aff_form?: string
  readonly cod_uai?: string
  /** « lat, lon » ou { lat, lon } selon la forme du champ geo_point_2d. */
  readonly g_olocalisation_des_formations?: { lat?: number; lon?: number } | string
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
  readonly contrat_etab?: string
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

/**
 * Position d'une formation, quelle que soit la forme rendue par l'API.
 *
 * L'export CSV écrit « 44.35624, 2.56417 » — latitude d'abord. L'API JSON
 * rend un objet { lon, lat }. Les deux existent, et confondre l'ordre place
 * toutes les écoles françaises en Somalie sans qu'aucune vérification ne
 * proteste : les coordonnées restent parfaitement valides.
 */
function coordonneesDe(brut: EnregistrementEsr['g_olocalisation_des_formations']): Coordonnees | null {
  if (brut === undefined || brut === null) return null
  if (typeof brut === 'string') {
    const [a, b] = brut.split(',')
    const lat = Number(a)
    const lon = Number(b)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return dansLesBornes(lat, lon)
  }
  if (typeof brut.lat !== 'number' || typeof brut.lon !== 'number') return null
  return dansLesBornes(brut.lat, brut.lon)
}

function dansLesBornes(lat: number, lon: number): Coordonnees | null {
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
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


function convertir(e: EnregistrementEsr): Formation | null {
  const id = e.cod_aff_form
  const libelle = e.lib_for_voe_ins
  const ville = e.ville_etab
  const dep = e.dep
  if (!id || !libelle || !ville || !dep) return null
  return {
    id,
    uai: e.cod_uai ?? null,
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
    statutEtablissement: e.contrat_etab ?? null,
    coordonnees: coordonneesDe(e.g_olocalisation_des_formations),
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
  /**
   * Ville de l'établissement. Cherchée et non comparée : « saint etienne »
   * doit trouver « Saint-Étienne », et personne ne tape les accents ni les
   * traits d'union sur un téléphone.
   */
  readonly ville?: string
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
  if (filtre.ville) conditions.push(`search(ville_etab, "${filtre.ville.replace(/"/g, '')}")`)
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

/**
 * Une formation, par sa clé pivot.
 *
 * `null` veut dire « ce code n'existe pas dans ce millésime », et la page le
 * dit — elle ne retombe pas sur une formation approchante. Une adresse
 * partagée qui ouvre la mauvaise école est pire qu'une adresse qui ne s'ouvre
 * pas : personne ne s'en aperçoit.
 */
export async function formationParCode(
  code: string,
  recuperer: typeof fetch = fetch,
): Promise<Formation | null> {
  const params = new URLSearchParams({
    limit: '1',
    where: `cod_aff_form = "${code.replace(/"/g, '')}"`,
  })
  const reponse = await avecUneRelance(`${ESR}?${params.toString()}`, recuperer)
  if (!reponse.ok) {
    throw new Error(`L'open data du ministère a répondu ${reponse.status}.`)
  }
  const corps = (await reponse.json()) as { results?: EnregistrementEsr[] }
  const premier = (corps.results ?? [])[0]
  if (premier === undefined) return null
  return convertir(premier)
}

/**
 * Toutes les formations d'un établissement, par son code UAI.
 *
 * Jamais par son nom : deux établissements peuvent porter le même, et un nom
 * se réécrit d'une session à l'autre. La limite de cent est celle de l'API ;
 * au-delà, la page dit qu'elle n'affiche pas tout, plutôt que de laisser
 * croire que l'établissement n'a que cent formations.
 */
export async function formationsDeLEtablissement(
  uai: string,
  recuperer: typeof fetch = fetch,
): Promise<Formation[]> {
  const params = new URLSearchParams({
    limit: '100',
    order_by: 'voe_tot DESC',
    where: `cod_uai = "${uai.replace(/"/g, '')}"`,
  })
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

/* ------------------------------------------------------------- emploi */

export interface OffresParMetier {
  readonly theme: string
  /** Ce que vaut le rapprochement formation → métiers. Jamais implicite. */
  readonly note: string
  readonly region: string | null
  readonly source: string
  readonly releveLe: string
  readonly total: { readonly enFrance: number | null; readonly enRegion: number | null }
}

/** Levée quand France Travail n'est pas configuré sur ce serveur. */
export class EmploiIndisponible extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmploiIndisponible'
  }
}

/**
 * Les offres d'emploi d'un thème.
 *
 * Le navigateur n'appelle jamais France Travail : il appelle notre serveur,
 * qui détient la clé. Sans cela, la clé serait dans le paquet JavaScript.
 */
export async function chercherEmploi(
  theme: string,
  codeInsee: string | null,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<OffresParMetier> {
  const p = new URLSearchParams({ theme })
  if (codeInsee !== null) p.set('insee', codeInsee)
  const reponse = await recuperer(`${base}/emploi?${p.toString()}`)
  const corps = (await reponse.json().catch(() => ({}))) as
    | OffresParMetier
    | { erreur?: string }
  if (reponse.status === 503) {
    throw new EmploiIndisponible(
      ('erreur' in corps && corps.erreur) || 'Offres d’emploi indisponibles.',
    )
  }
  if (!reponse.ok) {
    throw new Error(('erreur' in corps && corps.erreur) || `Erreur ${reponse.status}`)
  }
  return corps as OffresParMetier
}

/** Une spécialité de l'école, et ce que son secteur publie comme offres. */
export interface SpecialiteEmploi {
  readonly cle: string
  /** Ce que vaut le rapprochement spécialité → métiers. Jamais implicite. */
  readonly note: string
  readonly enFrance: number | null
  readonly enRegion: number | null
}

export interface DebouchesEtablissement {
  readonly region: string | null
  readonly source: string
  readonly releveLe: string
  /** Spécialités demandées, avant plafonnement. L'écran dit ce qu'il tait. */
  readonly demandees: number
  readonly specialites: readonly SpecialiteEmploi[]
}

/**
 * Les débouchés d'un établissement, spécialité par spécialité.
 *
 * Une seule requête pour toute l'école : chaque spécialité coûte des appels à
 * France Travail, dont le quota est serré. Les demander une par une depuis le
 * navigateur multiplierait les allers-retours sans rien gagner.
 *
 * Le serveur plafonne le nombre de spécialités comptées et renvoie combien
 * avaient été demandées, pour que l'écran puisse le dire.
 */
export async function chercherDebouches(
  themes: readonly string[],
  codeInsee: string | null,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<DebouchesEtablissement> {
  const p = new URLSearchParams({ themes: themes.join(',') })
  if (codeInsee !== null) p.set('insee', codeInsee)
  const reponse = await recuperer(`${base}/emploi/etablissement?${p.toString()}`)
  const corps = (await reponse.json().catch(() => ({}))) as
    | DebouchesEtablissement
    | { erreur?: string }
  if (reponse.status === 503) {
    throw new EmploiIndisponible(
      ('erreur' in corps && corps.erreur) || 'Offres d’emploi indisponibles.',
    )
  }
  if (!reponse.ok) {
    throw new Error(('erreur' in corps && corps.erreur) || `Erreur ${reponse.status}`)
  }
  return corps as DebouchesEtablissement
}

/** Le salaire plancher publié par l'employeur, jamais une estimation. */
export interface SalaireMinimum {
  readonly montant: number
  readonly periode: 'an' | 'mois' | 'heure'
}

export interface Offre {
  readonly id: string
  readonly intitule: string
  /** Tel que publié : « 76 - ROUEN ». */
  readonly lieu: string
  readonly contrat: string | null
  readonly salaireMin: SalaireMinimum | null
  readonly url: string
  readonly actualiseeLe: string
}

export interface OffresProches {
  readonly theme: string
  /** Le code INSEE réellement interrogé, ou `null` pour la France entière. */
  readonly autour: string | null
  readonly distanceKm: number | null
  readonly source: string
  readonly releveLe: string
  readonly offres: readonly Offre[]
}

/**
 * Les annonces d'un thème, autour d'une commune.
 *
 * `commune` peut être celle de l'école ou celle que l'élève a saisie dans son
 * parcours. Dans le second cas, elle traverse notre serveur sans y être
 * écrite : elle ne sert qu'à filtrer la requête envoyée à France Travail.
 */
export async function chercherOffres(
  theme: string,
  commune: string | null,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<OffresProches> {
  const p = new URLSearchParams({ theme })
  if (commune !== null) p.set('commune', commune)
  const reponse = await recuperer(`${base}/emploi/offres?${p.toString()}`)
  const corps = (await reponse.json().catch(() => ({}))) as OffresProches | { erreur?: string }
  if (reponse.status === 503) {
    throw new EmploiIndisponible(
      ('erreur' in corps && corps.erreur) || 'Offres d’emploi indisponibles.',
    )
  }
  if (!reponse.ok) {
    throw new Error(('erreur' in corps && corps.erreur) || `Erreur ${reponse.status}`)
  }
  return corps as OffresProches
}

/**
 * Le code INSEE d'une commune saisie à la main, ou `null`.
 *
 * ── Pourquoi elle refuse plus souvent qu'elle n'accepte ──────────────────
 *
 * La table ne porte que les 1 246 communes dont le loyer est publié : un
 * élève d'un village n'y figure pas, et c'est normal. Elle contient aussi
 * sept noms portés par deux communes — Valence, Saint-Denis, Sainte-Marie…
 *
 * Dans les deux cas on rend `null`. Choisir au hasard entre Valence dans la
 * Drôme et Valence en Tarn-et-Garonne placerait l'élève à six cents
 * kilomètres de chez lui sans que rien ne le signale.
 */
export function communeDuNom(nom: string): string | null {
  const cherche = normaliserNom(nom)
  if (cherche === '') return null
  const table = communes.communes as Record<string, { nom?: string }>
  const trouves: string[] = []
  for (const [insee, valeur] of Object.entries(table)) {
    if (normaliserNom(valeur.nom ?? '') === cherche) {
      trouves.push(insee)
      // Deux suffisent à savoir que c'est ambigu.
      if (trouves.length > 1) return null
    }
  }
  return trouves[0] ?? null
}

/** Minuscules, sans accent, ponctuation réduite à des espaces. */
function normaliserNom(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/* -------------------------------------------------------------------- vœux */

export interface Voeu {
  readonly rang: number
  readonly codeFormation: string
  readonly session: number
  readonly signalement: string | null
  readonly ajouteLe: string
}

/**
 * Levée quand le serveur ne sait pas encore enregistrer de vœux.
 *
 * Distincte d'une session finie, et c'est tout l'intérêt : une session finie
 * se répare en se reconnectant, une base absente ne se répare pas par
 * l'élève. Lui proposer de se reconnecter en boucle serait lui faire perdre
 * son temps sur un problème qui n'est pas le sien.
 */
export class VoeuxIndisponibles extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VoeuxIndisponibles'
  }
}

/**
 * Un appel à l'API des vœux.
 *
 * Chaque modification renvoie la liste À JOUR : l'écran ne recompose jamais
 * son état à partir de ce qu'il croit avoir demandé, il affiche ce que le
 * serveur dit. C'est ce qui évite qu'un rang affiché diverge du rang stocké
 * après un aller-retour raté.
 */
async function appelerVoeux(
  options: RequestInit,
  recherche = '',
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<Voeu[]> {
  const jeton = jetonSession()
  if (jeton === '') throw new InscriptionRequise('Connecte-toi pour retrouver tes vœux.')
  const reponse = await recuperer(`${base}/voeux${recherche}`, {
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers ?? {}),
      Authorization: `Bearer ${jeton}`,
    },
  })
  const corps = (await reponse.json().catch(() => ({}))) as {
    voeux?: Voeu[]
    erreur?: string
  }
  if (reponse.status === 401) throw new InscriptionRequise(corps.erreur ?? 'Session expirée.')
  if (reponse.status === 503) {
    throw new VoeuxIndisponibles(corps.erreur ?? 'Enregistrement des vœux indisponible.')
  }
  if (!reponse.ok) throw new Error(corps.erreur ?? `Erreur ${reponse.status}`)
  return corps.voeux ?? []
}

export function chercherVoeux(base = BASE_API, recuperer: typeof fetch = fetch): Promise<Voeu[]> {
  return appelerVoeux({ method: 'GET' }, '', base, recuperer)
}

export function ajouterVoeu(
  code: string,
  session: number,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<Voeu[]> {
  return appelerVoeux(
    { method: 'POST', body: JSON.stringify({ code, session }) },
    '',
    base,
    recuperer,
  )
}

export function retirerVoeu(
  rang: number,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<Voeu[]> {
  return appelerVoeux({ method: 'DELETE' }, `?rang=${rang}`, base, recuperer)
}

export function deplacerVoeu(
  rang: number,
  vers: 'haut' | 'bas',
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<Voeu[]> {
  return appelerVoeux(
    { method: 'PATCH', body: JSON.stringify({ rang, vers }) },
    '',
    base,
    recuperer,
  )
}

export function signalerVoeu(
  rang: number,
  signalement: string | null,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<Voeu[]> {
  return appelerVoeux(
    { method: 'PATCH', body: JSON.stringify({ rang, signalement }) },
    '',
    base,
    recuperer,
  )
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

/**
 * Ce que le site sait de l'élève, et rien de plus.
 *
 * Quatre champs. Pas de nom, pas d'adresse postale, pas de téléphone : ce
 * n'est pas un oubli, c'est la règle 3 de CLAUDE.md — les titulaires sont
 * mineurs, et rien dans le calcul n'a besoin de ces données. L'écran de
 * l'espace personnel le dit noir sur blanc, parce qu'une absence que
 * personne n'explique se lit comme une fonctionnalité manquante.
 */
export interface ProfilCompte {
  readonly email: string
  readonly inscritLe: string
  readonly vuLe: string
  readonly sessionExpireLe: string
  /**
   * L'adresse figure-t-elle dans ADMIN_EMAILS ? Sert UNIQUEMENT à montrer le
   * lien vers la console dans l'espace personnel. La console elle-même est
   * gardée côté serveur, qui refait la vérification à chaque appel : un
   * navigateur qui renverrait `true` ici n'obtiendrait rien de plus.
   */
  readonly administrateur: boolean
}

/** Le profil du titulaire de la session, ou `null` si elle n'est plus valide. */
export async function profilCompte(
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<ProfilCompte | null> {
  const jeton = jetonSession()
  if (jeton === '') return null
  const reponse = await recuperer(`${base}/comptes/profil`, {
    headers: { Authorization: `Bearer ${jeton}` },
  }).catch(() => null)
  if (reponse === null || !reponse.ok) return null
  return (await reponse.json().catch(() => null)) as ProfilCompte | null
}

/**
 * Change le mot de passe. L'ancien est exigé par le serveur, et le message
 * d'erreur qu'il renvoie est affiché TEL QUEL : il distingue « ancien mot de
 * passe faux » de « nouveau trop court », ce que l'interface ne saurait pas
 * deviner sans refaire la validation de son côté — et donc sans risquer d'en
 * diverger.
 */
export async function changerMotDePasse(
  ancien: string,
  nouveau: string,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<void> {
  const jeton = jetonSession()
  if (jeton === '') throw new CompteRefuse('Tu n’es pas connecté.')
  const reponse = await recuperer(`${base}/comptes/mot-de-passe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ ancien, nouveau }),
  })
  if (!reponse.ok) {
    const donnees = (await reponse.json().catch(() => ({}))) as { erreur?: string }
    throw new CompteRefuse(donnees.erreur ?? `le service a répondu ${reponse.status}`)
  }
}

/**
 * Efface le compte. Le jeton local est oublié quoi qu'il arrive : rester
 * « connecté » à un compte qui n'existe plus n'aurait aucun sens, et si
 * l'appel a échoué, la reconnexion le dira.
 */
export async function supprimerCompte(
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<void> {
  const jeton = jetonSession()
  if (jeton === '') throw new CompteRefuse('Tu n’es pas connecté.')
  const reponse = await recuperer(`${base}/comptes/moi`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jeton}` },
  })
  oublierJeton()
  if (!reponse.ok) {
    const donnees = (await reponse.json().catch(() => ({}))) as { erreur?: string }
    throw new CompteRefuse(donnees.erreur ?? `le service a répondu ${reponse.status}`)
  }
}

/**
 * Dépose un relevé ANONYME d'usage.
 *
 * ── Ce que cet appel n'envoie pas ────────────────────────────────────────
 *
 * Le jeton de session n'est PAS joint, et c'est délibéré : l'envoyer
 * rattacherait le relevé à un compte, et il cesserait d'être anonyme. Le
 * serveur reconstruit d'ailleurs chaque champ à partir des seules valeurs
 * permises, donc rien d'autre ne peut entrer même si cet appel changeait.
 *
 * ── Pourquoi il n'échoue jamais bruyamment ───────────────────────────────
 *
 * C'est une mesure d'usage, pas une étape du parcours de l'élève. Un serveur
 * de statistiques indisponible ne doit pas produire un message d'erreur sur
 * l'écran de quelqu'un qui cherche son école. L'erreur est donc avalée —
 * c'est l'un des très rares endroits du code où c'est la bonne conduite.
 */
export function envoyerReleve(
  releve: Record<string, unknown>,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): void {
  void recuperer(`${base}/releves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(releve),
    // « keepalive » : la requête survit si l'élève quitte la page dans la
    // foulée. Sans lui, un relevé sur deux se perdrait au moment précis où
    // la page change.
    keepalive: true,
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
  /**
   * La lecture rédigée des appréciations, ou `null` si rien d'exploitable.
   * C'est une SYNTHÈSE, jamais le texte brut des professeurs — celui-ci ne
   * quitte pas l'appel d'analyse (règle 3 de CLAUDE.md).
   */
  readonly avis: {
    readonly texte: string
    readonly pointsForts: readonly string[]
    readonly aTravailler: readonly string[]
    readonly auteur: string
  } | null
  readonly source: string
}

/**
 * Envoie un bulletin au serveur, qui n'en fait ressortir que des nombres et
 * une synthèse. Le texte brut des appréciations ne revient jamais ici.
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


/* ------------------------------------------------------- connexion Google */

/**
 * Les moyens de connexion que ce serveur propose.
 *
 * On le demande plutôt que de le deviner : la connexion Google dépend
 * d'identifiants posés dans l'environnement du serveur, et afficher un bouton
 * qui mène à un mur est pire que de ne pas l'afficher du tout.
 */
export async function moyensDeConnexion(
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<{ readonly google: boolean }> {
  try {
    const reponse = await recuperer(`${base}/comptes/moi`)
    if (!reponse.ok) return { google: false }
    const corps = (await reponse.json()) as { google?: unknown }
    return { google: corps.google === true }
  } catch {
    // Le serveur ne répond pas : on n'affiche pas de bouton, le formulaire
    // par mot de passe reste disponible.
    return { google: false }
  }
}

/**
 * L'adresse du départ vers Google.
 *
 * C'est un LIEN, pas un appel : aucun script de Google n'est chargé sur le
 * site, donc Google n'apprend l'existence d'un élève qu'au moment où celui-ci
 * clique. Sur un site qui s'adresse à des mineurs, la différence n'est pas
 * cosmétique.
 */
export function departGoogle(retour: string, base = BASE_API): string {
  return `${base}/comptes/google/debut?retour=${encodeURIComponent(retour)}`
}

/**
 * Échange le ticket rapporté de Google contre le vrai jeton de session.
 *
 * Le ticket voyage dans l'adresse, donc dans l'historique et les journaux :
 * il ne vit qu'une minute, ne sert qu'une fois, et ne donne accès à rien par
 * lui-même. L'appelant efface ensuite le paramètre de la barre d'adresse.
 */
export async function sessionDepuisTicket(
  ticket: string,
  base = BASE_API,
  recuperer: typeof fetch = fetch,
): Promise<void> {
  const reponse = await recuperer(`${base}/comptes/google/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
  })
  const corps = (await reponse.json().catch(() => ({}))) as { jeton?: string; erreur?: string }
  if (!reponse.ok || typeof corps.jeton !== 'string') {
    throw new CompteRefuse(corps.erreur ?? 'Connexion Google impossible.')
  }
  poserJeton(corps.jeton)
}
