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
}

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
  }
}

export interface FiltreFormations {
  readonly filiere?: string
  readonly academie?: string
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
  base = '/api',
  recuperer: typeof fetch = fetch,
): Promise<AideLogement[]> {
  if (demandes.length === 0) return []
  let reponse: Response
  try {
    reponse = await recuperer(`${base}/aide-logement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demandes),
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return demandes.map((d) => ({ ref: d.ref, raison: `Service d'aide au logement injoignable : ${detail}` }))
  }
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => ({}))) as { erreur?: string }
    const raison = corps.erreur ?? `le service a répondu ${reponse.status}`
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
