import type { Domaine, Formation, Matiere, Region } from '../types'
import { REGIONS } from './labels'

/**
 * Intégration de l'open data officiel Parcoursup (Ministère de l'Enseignement
 * Supérieur et de la Recherche), interrogé **en direct** via l'API Opendatasoft.
 *
 * Jeu de données : `fr-esr-parcoursup`
 * https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-parcoursup/
 *
 * Champs utilisés (cf. méthodologie officielle) :
 *   - taux_acces_ens ......... taux d'accès (%)
 *   - lib_for_voe_ins / form_lib_voe_acc ... intitulé de la formation
 *   - g_ea_lib_vx ............ nom de l'établissement
 *   - ville_etab / region_etab_aff / dep_lib ... localisation
 *   - fili ................... filière très agrégée (ex. 4_BUT, 6_CPGE)
 *   - select_form ............ sélectivité
 *   - contrat_etab ........... statut (Public / Privé…)
 *   - capa_fin ............... capacité d'accueil
 *   - lien_form_psup ......... lien fiche Parcoursup
 *   - g_olocalisation_des_formations ... coordonnées GPS
 *
 * ⚠️ Le jeu de données ne contient PAS les frais de scolarité : le prix est
 * estimé de façon indicative à partir du statut (public/privé). Une donnée de
 * prix précise nécessiterait une source complémentaire (ONISEP).
 */

const DATASET = 'fr-esr-parcoursup'
const BASE_URL = `https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/${DATASET}/records`

/** Forme (souple) d'un enregistrement renvoyé par l'API Opendatasoft. */
interface RecordODS {
  taux_acces_ens?: number | string | null
  lib_for_voe_ins?: string | null
  form_lib_voe_acc?: string | null
  fil_lib_voe_acc?: string | null
  lib_comp_voe_ins?: string | null
  g_ea_lib_vx?: string | null
  ville_etab?: string | null
  region_etab_aff?: string | null
  dep_lib?: string | null
  fili?: string | null
  select_form?: string | number | null
  contrat_etab?: string | null
  capa_fin?: number | string | null
  lien_form_psup?: string | null
  cod_uai?: string | null
  g_olocalisation_des_formations?:
    | { lat: number; lon: number }
    | [number, number]
    | string
    | null
}

/** Normalise une chaîne (minuscules, sans accents) pour comparer libellés/régions. */
function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Mots-clés → domaine, appliqués à l'intitulé de la formation. */
const REGLES_DOMAINE: { motifs: string[]; domaine: Domaine }[] = [
  { motifs: ['pass', 'las', 'medecine', 'sante', 'infirm', 'ifsi', 'paramedic', 'pharmac'], domaine: 'sante' },
  { motifs: ['droit', 'juri'], domaine: 'droit' },
  { motifs: ['informatique', 'numerique', 'reseaux', 'nsi', 'data', 'mmi'], domaine: 'informatique' },
  { motifs: ['ingenieur', 'mpsi', 'pcsi', 'ptsi', 'mp2i', 'polytech', 'prepa des inp', 'cpge - mp', 'cpge - pc', 'cpge - psi'], domaine: 'ingenieur' },
  { motifs: ['commerce', 'ecg', 'ece', 'management', 'gestion des entreprises', 'gea', 'tech de co', 'techniques de commercialisation'], domaine: 'commerce' },
  { motifs: ['economie', 'eco-gestion', 'ses', 'aes'], domaine: 'economie' },
  { motifs: ['staps', 'sport'], domaine: 'staps' },
  { motifs: ['psycho', 'sociolog', 'social', 'carrieres sociales'], domaine: 'social' },
  { motifs: ['langue', 'llcer', 'lea', 'anglais', 'espagnol', 'allemand'], domaine: 'langues' },
  { motifs: ['lettres', 'philo', 'histoire', 'geographie', 'humanites', 'litterature'], domaine: 'lettres' },
  { motifs: ['art', 'design', 'dnmade', 'dna', 'spectacle', 'musique', 'cinema', 'audiovisuel'], domaine: 'arts' },
  { motifs: ['communication', 'info-com', 'information communication', 'journalisme', 'edition'], domaine: 'communication' },
  { motifs: ['math', 'physique', 'chimie', 'biolog', 'svt', 'geosci', 'sciences de la vie', 'science'], domaine: 'sciences' },
]

/** Déduit le domaine d'études à partir de l'intitulé de la formation. */
export function domaineDepuisLibelle(libelle: string): Domaine {
  const n = normaliser(libelle)
  for (const { motifs, domaine } of REGLES_DOMAINE) {
    if (motifs.some((m) => n.includes(m))) return domaine
  }
  return 'sciences' // domaine par défaut, neutre
}

/** Matières clés par défaut selon le domaine (l'open data ne les fournit pas). */
const MATIERES_CLES_PAR_DOMAINE: Record<Domaine, Partial<Record<Matiere, number>>> = {
  sante: { svt: 3, physique_chimie: 3, mathematiques: 2 },
  droit: { francais: 2, histoire_geo: 2, philosophie: 2, ses: 1 },
  informatique: { mathematiques: 3, informatique: 3, physique_chimie: 1 },
  ingenieur: { mathematiques: 4, physique_chimie: 3, informatique: 1 },
  sciences: { mathematiques: 3, physique_chimie: 2, svt: 1 },
  commerce: { mathematiques: 2, ses: 2, langues: 2, histoire_geo: 1 },
  economie: { ses: 3, mathematiques: 2, francais: 1 },
  lettres: { francais: 4, philosophie: 2, histoire_geo: 1 },
  langues: { langues: 4, francais: 2 },
  arts: { arts: 4, francais: 1 },
  social: { svt: 2, ses: 2, francais: 2, philosophie: 1 },
  staps: { eps: 3, svt: 2, ses: 1 },
  communication: { francais: 3, langues: 2, ses: 1 },
}

/** Normalise un nom de région de l'open data vers le type `Region`. */
export function normaliserRegion(brut: string | null | undefined): Region | null {
  if (!brut) return null
  const n = normaliser(brut).replace(/-/g, ' ')
  const match = REGIONS.find((r) => normaliser(r).replace(/-/g, ' ') === n)
  return match ?? null
}

/** Extrait des coordonnées GPS depuis les formes possibles du champ. */
function parseCoords(
  geo: RecordODS['g_olocalisation_des_formations'],
): [number, number] | undefined {
  if (!geo) return undefined
  if (Array.isArray(geo) && geo.length === 2) return [geo[0], geo[1]]
  if (typeof geo === 'object' && 'lat' in geo && 'lon' in geo)
    return [geo.lat, geo.lon]
  if (typeof geo === 'string') {
    const parts = geo.split(',').map((x) => Number(x.trim()))
    if (parts.length === 2 && parts.every((x) => !Number.isNaN(x)))
      return [parts[0], parts[1]]
  }
  return undefined
}

/** Détermine la sélectivité à partir du champ `select_form` (texte ou 0/1). */
function parseSelectivite(v: RecordODS['select_form']): Formation['selectivite'] {
  if (typeof v === 'number') return v === 1 ? 'selective' : 'non-selective'
  if (typeof v === 'string') {
    const n = normaliser(v)
    if (n.includes('non')) return 'non-selective'
    if (n.includes('select') || n === '1') return 'selective'
  }
  return 'non-selective'
}

/** Estimation indicative des frais selon le statut de l'établissement. */
function prixIndicatif(statut: string | null | undefined): string {
  const n = normaliser(statut ?? '')
  if (n.includes('public'))
    return 'Public : droits d\'inscription réduits (~170–250 €/an)'
  if (n.includes('prive'))
    return 'Privé : frais variables selon l\'école (voir la fiche)'
  return 'Frais : voir la fiche formation'
}

function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Convertit un enregistrement open data en `Formation` exploitable, ou null. */
export function mapRecord(rec: RecordODS): Formation | null {
  const nom =
    rec.lib_for_voe_ins || rec.form_lib_voe_acc || rec.lib_comp_voe_ins || ''
  const etablissement = rec.g_ea_lib_vx || ''
  if (!nom || !etablissement) return null

  const region = normaliserRegion(rec.region_etab_aff)
  if (!region) return null // hors métropole ou région non reconnue

  const taux = toNumber(rec.taux_acces_ens)
  if (taux === undefined) return null // sans taux d'accès, pas de simulation fiable

  const domaine = domaineDepuisLibelle(
    `${nom} ${rec.form_lib_voe_acc ?? ''} ${rec.fil_lib_voe_acc ?? ''}`,
  )

  return {
    id: `${rec.cod_uai ?? 'x'}-${normaliser(nom).replace(/\s+/g, '-').slice(0, 40)}`,
    nom,
    etablissement,
    ville: rec.ville_etab || rec.dep_lib || '',
    region,
    domaine,
    selectivite: parseSelectivite(rec.select_form),
    tauxAccesBase: Math.min(99, Math.max(1, Math.round(taux))),
    matieresCles: MATIERES_CLES_PAR_DOMAINE[domaine],
    attendus: rec.lib_comp_voe_ins || nom,
    statut: rec.contrat_etab || undefined,
    capacite: toNumber(rec.capa_fin),
    coords: parseCoords(rec.g_olocalisation_des_formations),
    lienParcoursup: rec.lien_form_psup || undefined,
    prixIndicatif: prixIndicatif(rec.contrat_etab),
  }
}

export interface OptionsChargement {
  /** Filtrer par région d'établissement. */
  region?: Region | null
  /** Recherche plein texte (intitulé de formation, établissement, ville…). */
  recherche?: string
  /** Nombre maximum de formations à récupérer (l'API pagine par 100). */
  limite?: number
  /** Permet d'injecter un fetch personnalisé (tests). */
  fetchImpl?: typeof fetch
}

/** Construit l'URL de requête Opendatasoft (API Explore v2.1). */
export function construireUrl(options: OptionsChargement, offset: number, pageSize: number): string {
  const params = new URLSearchParams()
  params.set('limit', String(pageSize))
  params.set('offset', String(offset))
  params.set(
    'select',
    [
      'taux_acces_ens',
      'lib_for_voe_ins',
      'form_lib_voe_acc',
      'fil_lib_voe_acc',
      'lib_comp_voe_ins',
      'g_ea_lib_vx',
      'ville_etab',
      'region_etab_aff',
      'dep_lib',
      'fili',
      'select_form',
      'contrat_etab',
      'capa_fin',
      'lien_form_psup',
      'cod_uai',
      'g_olocalisation_des_formations',
    ].join(','),
  )
  const clauses: string[] = ['taux_acces_ens IS NOT NULL']
  if (options.region) clauses.push(`region_etab_aff LIKE "${options.region.replace(/"/g, '')}"`)
  params.set('where', clauses.join(' AND '))
  if (options.recherche && options.recherche.trim())
    params.set('q', options.recherche.trim())
  return `${BASE_URL}?${params.toString()}`
}

/**
 * Charge les formations depuis l'open data officiel, en direct.
 * Pagine par lots de 100 (limite de l'API) jusqu'à `limite`.
 */
export async function chargerFormations(
  options: OptionsChargement = {},
): Promise<Formation[]> {
  const doFetch = options.fetchImpl ?? fetch
  const limite = options.limite ?? 200
  const pageSize = 100
  const formations: Formation[] = []

  for (let offset = 0; offset < limite; offset += pageSize) {
    const url = construireUrl(options, offset, Math.min(pageSize, limite - offset))
    const res = await doFetch(url)
    if (!res.ok) throw new Error(`Erreur API Opendatasoft : ${res.status}`)
    const data = (await res.json()) as { results?: RecordODS[] }
    const results = data.results ?? []
    for (const rec of results) {
      const f = mapRecord(rec)
      if (f) formations.push(f)
    }
    if (results.length < pageSize) break // dernière page
  }

  return formations
}
