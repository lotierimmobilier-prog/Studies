/**
 * Les offres d'emploi, via l'API France Travail.
 *
 * ── Ce qu'on affiche, et ce qu'on n'affiche pas ──────────────────────────
 *
 * Un COMPTEUR par métier, et un lien vers la recherche chez eux. Pas les
 * annonces elles-mêmes : une offre est pourvue en quelques jours, et une
 * annonce périmée affichée sur un site d'orientation trompe plus qu'elle
 * n'informe. Le compteur, lui, vieillit lentement et porte sa date.
 *
 * Deux échelles côte à côte, la France et la région. Ni l'une ni l'autre
 * seule : « 358 offres en France » ne dit rien du lieu où l'élève envisage
 * d'étudier, et « 1 offre en Haute-Vienne » se lit comme un verdict sur un
 * métier alors que c'est la photo d'un bassin d'emploi un jour donné. Le
 * département n'est jamais affiché, pour cette raison.
 *
 * ── Le secret ne quitte jamais ce serveur ───────────────────────────────
 *
 * L'identifiant et la clé vivent dans le coffre chiffré, aux côtés des
 * autres clés d'API. Le navigateur n'appelle jamais France Travail : il
 * appelle notre serveur, qui appelle France Travail. Sans cela, la clé
 * serait dans le paquet JavaScript, donc publique.
 *
 * ── Dix requêtes par seconde ────────────────────────────────────────────
 *
 * C'est la limite annoncée par l'API pour notre client
 * (`X-Ratelimit-Burst-Capacity-Clientidlimiter: 10`), mesurée le 20/09/2026.
 * Une page qui affiche huit métiers × deux échelles ferait seize appels :
 * elle saturerait le quota à deux visiteurs simultanés. D'où le cache, et
 * d'où le fait que les appels d'une même page sont faits en SÉRIE et non en
 * parallèle.
 */

import { nombre } from '../kitetudiant/packages/budget-engine/src/nombres.ts'
import { lienOffresFranceTravail } from '../kitetudiant/packages/metiers/src/index.ts'
import { Coffre } from './secrets.ts'

const OAUTH =
  'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire'
const API = 'https://api.francetravail.io/partenaire/offresdemploi/v2'
const PORTEE = 'api_offresdemploiv2 o2dsoffre'

/** Durée de vie d'un compteur en cache. Une offre ne naît ni ne meurt à la
 *  minute : six heures suffisent, et divisent les appels par cent. */
const CACHE_HEURES = 6

/** Marge de sécurité sur l'expiration du jeton, en secondes. */
const MARGE_JETON = 60

export const SOURCE_EMPLOI = 'Offres d’emploi, France Travail (API offresdemploi v2)'

/**
 * Le total d'un domaine professionnel entier.
 *
 * L'API accepte `domaine=M18` : neuf mille six cents offres rendues par UN
 * appel, là où compter les quatre-vingt-seize métiers du domaine en
 * coûterait quatre-vingt-seize. C'est ce total qui fait le chiffre de tête
 * — et c'est le seul qui décrive vraiment un secteur, alors qu'un métier
 * pris isolément n'en décrit qu'une tranche.
 */
export interface TotalDomaine {
  readonly domaine: string
  readonly enFrance: number | null
  readonly enRegion: number | null
}

export interface Comptage {
  readonly codeRome: string
  readonly libelle: string
  readonly enFrance: number | null
  readonly enRegion: number | null
  /** Code INSEE de la région comptée, quand il y en a une. */
  readonly region: string | null
  /** Date à laquelle le comptage a été relevé chez France Travail. */
  readonly releveLe: string
}

export interface Metier {
  readonly code: string
  readonly libelle: string
}

export class EmploiNonConfigure extends Error {
  constructor() {
    super('L’API France Travail n’est pas configurée sur ce serveur.')
  }
}

interface Jeton {
  readonly valeur: string
  readonly expireLe: number
}

export class ClientEmploi {
  private jeton: Jeton | null = null
  private referentiel: Metier[] | null = null
  private readonly comptes = new Map<string, { valeur: number | null; jusqua: number }>()
  private readonly annonces = new Map<string, { valeur: Offre[]; jusqua: number }>()

  constructor(
    private readonly coffre: Coffre,
    private readonly recuperer: typeof fetch = fetch,
    private readonly maintenant: () => number = Date.now,
  ) {}

  /**
   * Essaie vraiment la connexion, pour la console d'administration.
   *
   * Un jeton, puis un comptage : les deux étapes échouent pour des raisons
   * différentes, et l'exploitant doit savoir laquelle. Des identifiants
   * acceptés mais sans la bonne portée donnent un jeton et échouent ensuite.
   *
   * Ne lève jamais, et ne rend jamais le corps de la réponse de France
   * Travail : il peut répéter l'identifiant.
   */
  async essayer(): Promise<{ ok: boolean; etape: string; detail: string | null }> {
    if (!(await this.configure())) {
      return { ok: false, etape: 'identifiants', detail: 'Les deux clés ne sont pas posées.' }
    }
    try {
      await this.jetonValide()
    } catch (e) {
      return { ok: false, etape: 'authentification', detail: (e as Error).message }
    }
    try {
      const metiers = await this.metiers()
      // Un comptage réel : c'est la portée `api_offresdemploiv2` qui est
      // éprouvée ici, et elle peut manquer alors que le jeton est valable.
      const [total] = await this.totaux(['M18'], null)
      if (total?.enFrance === null) {
        return { ok: false, etape: 'comptage', detail: 'Le comptage n’a rien rendu.' }
      }
      return {
        ok: true,
        etape: 'comptage',
        // `nombre()` et non l'entier brut : « 1911 » au lieu de « 1 911 »
        // passerait pour un identifiant plutôt que pour un compte.
        detail: `${nombre(metiers.length)} métiers au référentiel, ${nombre(total?.enFrance ?? 0)} offres dans les systèmes d’information.`,
      }
    } catch (e) {
      return { ok: false, etape: 'référentiel', detail: (e as Error).message }
    }
  }

  async configure(): Promise<boolean> {
    const [id, secret] = await this.identifiants().catch(() => [null, null])
    return id !== null && secret !== null
  }

  private async identifiants(): Promise<[string, string]> {
    const id = await this.coffre.valeur('FRANCE_TRAVAIL_ID')
    const secret = await this.coffre.valeur('FRANCE_TRAVAIL_SECRET')
    if (!id || !secret) throw new EmploiNonConfigure()
    return [id, secret]
  }

  /**
   * Le jeton d'accès, renouvelé quand il approche de son terme.
   *
   * France Travail le donne pour vingt-cinq minutes. Le redemander à chaque
   * requête gaspillerait la moitié du quota ; le garder jusqu'à la seconde
   * près ferait échouer une requête sur cent au moment du basculement.
   */
  private async jetonValide(): Promise<string> {
    const j = this.jeton
    if (j !== null && j.expireLe > this.maintenant()) return j.valeur
    const [id, secret] = await this.identifiants()
    const reponse = await this.recuperer(OAUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: id,
        client_secret: secret,
        scope: PORTEE,
      }).toString(),
    })
    if (!reponse.ok) {
      // Surtout pas le corps de la réponse : il peut répéter l'identifiant.
      throw new Error(`France Travail a refusé l’authentification (${reponse.status}).`)
    }
    const corps = (await reponse.json()) as { access_token?: string; expires_in?: number }
    if (!corps.access_token) throw new Error('France Travail n’a pas rendu de jeton.')
    this.jeton = {
      valeur: corps.access_token,
      expireLe: this.maintenant() + ((corps.expires_in ?? 1500) - MARGE_JETON) * 1000,
    }
    return this.jeton.valeur
  }

  /** Les 1 911 métiers du ROME, chargés une fois pour la vie du processus. */
  async metiers(): Promise<Metier[]> {
    if (this.referentiel !== null) return this.referentiel
    const reponse = await this.recuperer(`${API}/referentiel/metiers`, {
      headers: { Authorization: `Bearer ${await this.jetonValide()}` },
    })
    if (!reponse.ok) throw new Error(`Référentiel des métiers indisponible (${reponse.status}).`)
    this.referentiel = (await reponse.json()) as Metier[]
    return this.referentiel
  }

  /**
   * Le nombre d'offres, lu dans l'en-tête `Content-Range`.
   *
   * On demande `range=0-0`, c'est-à-dire UNE offre : l'API rend alors le
   * total dans l'en-tête et presque rien dans le corps. Demander zéro offre
   * n'est pas accepté, et demander la première page entière téléchargerait
   * cinquante annonces dont on n'affiche aucune.
   *
   * `null` quand le compte n'a pas pu être lu — jamais zéro : « aucune
   * offre » et « on n'a pas pu compter » sont deux informations
   * différentes, et la seconde ne doit pas se faire passer pour la première.
   */
  private async compter(
    filtre: { readonly codeROME: string } | { readonly domaine: string },
    region: string | null,
  ): Promise<number | null> {
    const cle = `${'codeROME' in filtre ? filtre.codeROME : `d:${filtre.domaine}`}|${region ?? 'fr'}`
    const enCache = this.comptes.get(cle)
    if (enCache !== undefined && enCache.jusqua > this.maintenant()) return enCache.valeur

    const params = new URLSearchParams({ ...filtre, range: '0-0' })
    if (region !== null) params.set('region', region)
    let valeur: number | null = null
    try {
      const reponse = await this.recuperer(`${API}/offres/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${await this.jetonValide()}` },
      })
      // 204 : aucune offre. C'est un vrai zéro, pas une panne.
      if (reponse.status === 204) valeur = 0
      else if (reponse.ok || reponse.status === 206) {
        const entete = reponse.headers.get('content-range')
        const total = entete?.split('/')[1]
        valeur = total !== undefined && /^\d+$/.test(total) ? Number(total) : null
      }
    } catch {
      // Réseau ou quota : on ne sait pas compter, et on le dira.
      valeur = null
    }
    this.comptes.set(cle, {
      valeur,
      // Un échec n'est mis en cache que brièvement : sinon une panne d'une
      // minute rendrait la page muette pendant six heures.
      jusqua: this.maintenant() + (valeur === null ? 60_000 : CACHE_HEURES * 3600_000),
    })
    return valeur
  }

  /**
   * Compte les offres pour une liste de métiers.
   *
   * En SÉRIE, volontairement. Huit métiers × deux échelles font seize
   * appels ; lancés ensemble, ils dépassent la rafale de dix par seconde et
   * la moitié revient en erreur. En série, c'est plus lent d'une seconde et
   * ça n'échoue pas.
   */
  async comptages(metiers: readonly Metier[], region: string | null): Promise<Comptage[]> {
    const releveLe = new Date(this.maintenant()).toISOString().slice(0, 10)
    const resultats: Comptage[] = []
    for (const m of metiers) {
      const enFrance = await this.compter({ codeROME: m.code }, null)
      const enRegion =
        region === null ? null : await this.compter({ codeROME: m.code }, region)
      resultats.push({
        codeRome: m.code,
        libelle: m.libelle,
        enFrance,
        enRegion,
        region,
        releveLe,
      })
    }
    return resultats
  }

  /**
   * Le total de chaque domaine professionnel d'un thème.
   *
   * Un appel par domaine et par échelle — deux à six en tout pour un thème,
   * contre près de deux cents s'il fallait passer par les métiers. C'est ce
   * qui rend le chiffre de tête abordable à chaque visite.
   */
  /**
   * Un échantillon d'annonces, au plus près du lieu demandé.
   *
   * ── Pourquoi un appel par domaine ────────────────────────────────────
   *
   * `domaine` répété dans l'URL n'est PAS un OU : vérifié le 21/09/2026,
   * « domaine=M18&domaine=A12 » rend cinquante offres, toutes M18. Le
   * second est ignoré en silence — le pire des cas, puisque la requête
   * réussit et qu'on croirait couvrir les deux.
   *
   * On interroge donc les domaines un par un, en série comme les
   * comptages, et on s'arrête à trois : un thème en compte jusqu'à six, et
   * personne ne lit trente annonces sur une fiche de formation.
   *
   * ── La proximité ─────────────────────────────────────────────────────
   *
   * `commune` + `distance` filtrent autour d'un code INSEE. Sans commune,
   * on rend la France entière : c'est moins utile, mais honnête — plutôt
   * que de centrer sur Paris faute de mieux.
   */
  async offres(
    domaines: readonly string[],
    commune: string | null,
    distanceKm: number,
    combien: number,
  ): Promise<Offre[]> {
    const retenus = domaines.slice(0, DOMAINES_PAR_ECHANTILLON)
    const cle = `${retenus.join('+')}|${commune ?? 'fr'}|${distanceKm}`
    const enCache = this.annonces.get(cle)
    if (enCache !== undefined && enCache.jusqua > this.maintenant()) {
      return enCache.valeur.slice(0, combien)
    }

    // On demande un peu plus que nécessaire à chaque domaine : des annonces
    // se perdent au tri — sans lien, sans lieu — et il en faut assez pour
    // que la fusion ait le choix.
    const parDomaine = Math.max(2, Math.ceil(combien / retenus.length) + 2)
    const vues = new Map<string, Offre>()
    for (const domaine of retenus) {
      const params = new URLSearchParams({ domaine, range: `0-${parDomaine - 1}` })
      if (commune !== null) {
        params.set('commune', commune)
        params.set('distance', String(distanceKm))
      }
      try {
        const reponse = await this.recuperer(`${API}/offres/search?${params.toString()}`, {
          headers: { Authorization: `Bearer ${await this.jetonValide()}` },
        })
        // 204 : aucune offre dans ce domaine à cet endroit. Ce n'est pas une
        // panne, et les autres domaines ont peut-être quelque chose.
        if (reponse.status === 204) continue
        if (!reponse.ok && reponse.status !== 206) continue
        const corps = (await reponse.json()) as { resultats?: OffreBrute[] }
        for (const brute of corps.resultats ?? []) {
          const offre = lireOffre(brute)
          // Une même annonce peut relever de deux domaines du thème.
          if (offre !== null && !vues.has(offre.id)) vues.set(offre.id, offre)
        }
      } catch {
        // Réseau ou quota : ce domaine ne rendra rien, les autres peuvent.
        continue
      }
    }

    // La plus fraîche d'abord : sur des annonces qui se périment en quelques
    // jours, l'âge est le premier critère de pertinence.
    const triees = [...vues.values()].sort((a, b) =>
      b.actualiseeLe.localeCompare(a.actualiseeLe),
    )
    this.annonces.set(cle, {
      valeur: triees,
      jusqua: this.maintenant() + CACHE_OFFRES_MINUTES * 60_000,
    })
    return triees.slice(0, combien)
  }

  async totaux(domaines: readonly string[], region: string | null): Promise<TotalDomaine[]> {
    const resultats: TotalDomaine[] = []
    for (const domaine of domaines) {
      resultats.push({
        domaine,
        enFrance: await this.compter({ domaine }, null),
        enRegion: region === null ? null : await this.compter({ domaine }, region),
      })
    }
    return resultats
  }
}

/* ─────────────────────────────────────────────── les annonces elles-mêmes

   D15 avait tranché l'inverse : le compteur, pas les annonces. Le motif
   était juste — une offre est pourvue en quelques jours, et une annonce
   périmée sur un site d'orientation trompe plus qu'elle n'informe.

   Ce motif ne disparaît pas parce qu'on affiche les annonces : il dicte
   comment. D'où un cache d'UNE heure et non six, la date de mise à jour
   portée par chaque annonce, et un lien vers l'offre d'origine sur chaque
   carte — c'est là, et seulement là, qu'on voit qu'un poste est pourvu. */

/** Durée de vie d'une liste d'annonces. Bien plus courte que les compteurs. */
const CACHE_OFFRES_MINUTES = 60

/** Combien de domaines d'un thème on interroge pour composer un échantillon. */
const DOMAINES_PAR_ECHANTILLON = 3

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

const PERIODES: Readonly<Record<string, SalaireMinimum['periode']>> = {
  annuel: 'an',
  mensuel: 'mois',
  horaire: 'heure',
}

/**
 * Le salaire MINIMUM publié, lu dans le libellé de France Travail.
 *
 * ── Pourquoi une lecture, et pas une estimation ──────────────────────────
 *
 * La règle 1 de CLAUDE.md interdit tout montant qui ne remonte pas à une
 * source. Ici, rien n'est estimé : le chiffre est celui que l'employeur a
 * publié, et cette fonction ne fait que le détacher du texte qui l'entoure.
 * Un libellé qu'elle ne reconnaît pas ne devient PAS un montant approché —
 * il devient `null`, et la carte dit « salaire non publié ».
 *
 * ── Les formes réellement rencontrées ────────────────────────────────────
 *
 * Relevé sur 150 offres du domaine M18 le 21/09/2026 : deux tiers portent un
 * libellé, et il commence toujours par la période puis le premier montant.
 *
 *     Annuel de 24000.00 Euros à 28000.00 Euros
 *     Annuel de 32000.0 Euros - Selon compétences et profil
 *     Mensuel de 2450.0 Euros - Voiture, téléphone,
 *     Horaire de 12.5 Euros
 *
 * C'est le PREMIER montant qui est retenu : dans une fourchette, c'est le
 * plancher — ce que l'employeur s'engage à verser. Annoncer le haut de la
 * fourchette ferait passer une possibilité pour une promesse.
 */
export function salaireMinimum(libelle: string | null | undefined): SalaireMinimum | null {
  if (typeof libelle !== 'string') return null
  const m = /^\s*(Annuel|Mensuel|Horaire)\s+de\s+([0-9]+(?:[.,][0-9]+)?)\s*Euros/i.exec(libelle)
  if (m === null) return null
  const periode = PERIODES[m[1]!.toLowerCase()]
  const montant = Number(m[2]!.replace(',', '.'))
  // Un zéro ou un négatif n'est pas un salaire : c'est un champ mal rempli,
  // et l'afficher donnerait « à partir de 0 € ».
  if (periode === undefined || !Number.isFinite(montant) || montant <= 0) return null
  return { montant, periode }
}

/** Ce que l'API rend, réduit à ce qu'on en lit. */
interface OffreBrute {
  readonly id?: string
  readonly intitule?: string
  readonly dateActualisation?: string
  readonly dateCreation?: string
  readonly typeContratLibelle?: string
  readonly lieuTravail?: { readonly libelle?: string }
  readonly salaire?: { readonly libelle?: string }
  readonly origineOffre?: { readonly urlOrigine?: string }
}

/**
 * Une annonce utilisable, ou `null`.
 *
 * Sans identifiant, sans intitulé, sans lieu ou sans lien, la carte serait
 * un cadre vide ou un cul-de-sac. Mieux vaut une annonce de moins.
 */
function lireOffre(brute: OffreBrute): Offre | null {
  const id = brute.id
  const intitule = brute.intitule
  const lieu = brute.lieuTravail?.libelle
  const url = brute.origineOffre?.urlOrigine
  if (!id || !intitule || !lieu || !url) return null
  return {
    id,
    intitule,
    lieu,
    contrat: brute.typeContratLibelle ?? null,
    salaireMin: salaireMinimum(brute.salaire?.libelle),
    url,
    actualiseeLe: brute.dateActualisation ?? brute.dateCreation ?? '',
  }
}

/**
 * Additionne des totaux dont certains peuvent manquer.
 *
 * `null` dès qu'un seul manque : additionner ce qu'on a en faisant comme si
 * le reste valait zéro donnerait un total faux, plus petit que la réalité,
 * et rien à l'écran ne le signalerait.
 */
export function somme(valeurs: readonly (number | null)[]): number | null {
  if (valeurs.length === 0 || valeurs.some((v) => v === null)) return null
  return valeurs.reduce((t: number, v) => t + (v as number), 0)
}

/**
 * L'adresse de la recherche France Travail pour un métier.
 *
 * Un lien vers leur site, et non les annonces chez nous : c'est la décision
 * D15. Le paramètre `motsCles` est celui de leur site public, distinct de
 * l'API.
 */
export function lienOffres(libelle: string, region: string | null): string {
  return lienOffresFranceTravail(libelle, region)
}
