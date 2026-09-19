/**
 * Aide au logement (APL / ALS / ALF), calculée par OpenFisca France.
 *
 * Règle 1 de CLAUDE.md : aucun euro affiché ne vient d'un modèle de langage.
 * L'aide au logement est un calcul réglementaire ; elle est donc déléguée à
 * OpenFisca, qui applique le code de la construction et de l'habitation.
 *
 * Ce module appelle l'instance PUBLIQUE d'OpenFisca France. C'est un choix
 * provisoire : CLAUDE.md prévoit une instance conteneurisée hébergée en France.
 * Tant que ce n'est pas fait, seuls des paramètres anonymes sortent d'ici —
 * commune, loyer, année de naissance, revenu — jamais un nom, jamais un
 * identifiant. Le calcul reste côté serveur, le navigateur de l'élève ne parle
 * pas à OpenFisca.
 */

const OPENFISCA_URL = process.env.OPENFISCA_URL ?? 'https://api.fr.openfisca.org/latest'
const DELAI_MS = Number(process.env.OPENFISCA_TIMEOUT_MS ?? 25_000)

export interface DemandeAideLogement {
  /** Référence libre renvoyée telle quelle, pour réapparier côté appelant. */
  readonly ref: string
  /** Code INSEE de la commune du logement. */
  readonly codeInsee: string
  /** Loyer mensuel hors charges, en euros. */
  readonly loyerMensuel: number
  /** Charges locatives mensuelles, en euros. */
  readonly chargesMensuelles?: number
  /** Année de naissance de l'élève. Le jour et le mois ne sont pas demandés. */
  readonly anneeNaissance: number
  /** Revenu imposable annuel de l'élève, en euros. */
  readonly revenuAnnuel?: number
}

export interface AideLogementCalculee {
  readonly ref: string
  readonly montant: number
  readonly source: string
  readonly millesime: string
  readonly hypothese: string
}

export interface AideLogementIndisponible {
  readonly ref: string
  readonly raison: string
}

export type ResultatAideLogement = AideLogementCalculee | AideLogementIndisponible

export class AideLogementIndisponibleErreur extends Error {}

/** Mois de référence du calcul : la rentrée de l'année universitaire. */
function moisDeReference(aujourdHui: Date = new Date()): string {
  const annee = aujourdHui.getMonth() + 1 >= 9 ? aujourdHui.getFullYear() : aujourdHui.getFullYear() - 1
  return `${annee}-09`
}

interface SituationOpenFisca {
  individus: Record<string, unknown>
  familles: Record<string, unknown>
  foyers_fiscaux: Record<string, unknown>
  menages: Record<string, unknown>
}

function construireSituation(
  demandes: readonly DemandeAideLogement[],
  mois: string,
): SituationOpenFisca {
  const annee = mois.slice(0, 4)
  const situation: SituationOpenFisca = {
    individus: {},
    familles: {},
    foyers_fiscaux: {},
    menages: {},
  }
  demandes.forEach((d, i) => {
    const ind = `i${i}`
    situation.individus[ind] = {
      date_naissance: { ETERNITY: `${d.anneeNaissance}-09-01` },
      salaire_imposable: { [annee]: d.revenuAnnuel ?? 0 },
      etudiant: { [mois]: true },
    }
    situation.familles[`f${i}`] = { parents: [ind], aide_logement: { [mois]: null } }
    situation.foyers_fiscaux[`ff${i}`] = { declarants: [ind] }
    situation.menages[`m${i}`] = {
      personne_de_reference: [ind],
      depcom: { [mois]: d.codeInsee },
      loyer: { [mois]: d.loyerMensuel },
      charges_locatives: { [mois]: d.chargesMensuelles ?? 0 },
      statut_occupation_logement: { [mois]: 'locataire_vide' },
    }
  })
  return situation
}

/**
 * Calcule l'aide au logement de plusieurs situations en un seul appel.
 *
 * Une situation sans résultat n'est jamais remplacée par une estimation : elle
 * revient en indisponibilité motivée, et le reste-à-vivre ne sera pas calculé.
 */
export async function calculerAidesLogement(
  demandes: readonly DemandeAideLogement[],
  aujourdHui: Date = new Date(),
): Promise<ResultatAideLogement[]> {
  if (demandes.length === 0) return []
  const mois = moisDeReference(aujourdHui)
  const situation = construireSituation(demandes, mois)

  const controle = new AbortController()
  const minuteur = setTimeout(() => controle.abort(), DELAI_MS)
  let reponse: Response
  try {
    reponse = await fetch(`${OPENFISCA_URL}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(situation),
      signal: controle.signal,
    })
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)
    throw new AideLogementIndisponibleErreur(`OpenFisca injoignable : ${detail}`)
  } finally {
    clearTimeout(minuteur)
  }

  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '')
    throw new AideLogementIndisponibleErreur(
      `OpenFisca a répondu ${reponse.status} : ${corps.slice(0, 300)}`,
    )
  }

  const calcul = (await reponse.json()) as {
    familles?: Record<string, { aide_logement?: Record<string, number | null> }>
  }

  return demandes.map((d, i) => {
    const montant = calcul.familles?.[`f${i}`]?.aide_logement?.[mois]
    if (typeof montant !== 'number' || Number.isNaN(montant)) {
      return {
        ref: d.ref,
        raison: `OpenFisca n'a pas rendu d'aide au logement pour la commune ${d.codeInsee}.`,
      }
    }
    return {
      ref: d.ref,
      montant: Math.round(montant * 100) / 100,
      source: `OpenFisca France — ${OPENFISCA_URL}`,
      millesime: mois,
      hypothese:
        `Étudiant locataire d'un logement vide à ${d.codeInsee}, loyer ${d.loyerMensuel} € ` +
        `hors charges, revenu annuel ${d.revenuAnnuel ?? 0} €, situation de ${mois}`,
    }
  })
}

export function estIndisponible(r: ResultatAideLogement): r is AideLogementIndisponible {
  return 'raison' in r
}
