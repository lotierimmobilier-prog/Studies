/**
 * État du système, pour la console d'administration.
 *
 * Ce que l'exploitant doit pouvoir vérifier d'un coup d'œil : quelles clés sont
 * configurées et d'où elles viennent, quels barèmes ont dépassé leur date de
 * dernière vérification, et combien de retours d'étudiants chaque année
 * universitaire a recueillis.
 *
 * Un barème périmé n'est pas une erreur : c'est une information à afficher, et
 * ici un rappel qu'il faut relancer l'extraction depuis OpenFisca ou vérifier
 * la source officielle.
 */

import { BAREMES, estIndisponible, valeurApplicable } from '../kitetudiant/packages/baremes/src/index.ts'
import type { DepotRetours } from './retours'
import type { Coffre, EtatSecret } from './secrets'
import type { DepotComptes, EtatComptes } from './comptes.ts'
import { etat as etatBaseDeDonnees, type EtatBd } from './bd.ts'

export interface EtatBareme {
  readonly cle: string
  readonly libelle: string
  readonly millesime: string | null
  readonly verifieLe: string | null
  readonly perime: boolean
  readonly vide: boolean
}

export interface EtatMillesime {
  readonly millesime: string
  readonly retours: number
}

export interface EtatSysteme {
  readonly le: string
  readonly secrets: readonly EtatSecret[]
  readonly baremes: readonly EtatBareme[]
  readonly millesimes: readonly EtatMillesime[]
  /**
   * État des comptes élèves. « configure: false » signifie que
   * COMPTES_MASTER_KEY manque : l'inscription est alors impossible et le
   * détail du résultat reste ouvert à tous. Il faut que l'administrateur le
   * voie, sinon le verrou peut être absent sans que personne le sache.
   */
  readonly comptes: EtatComptes
  /**
   * État de la base PostgreSQL.
   *
   * « configuree: false » n'est PAS une panne : tant que la bascule n'est pas
   * faite, le site tourne sur le fichier chiffré et l'open data du ministère,
   * exactement comme avant. C'est le mode normal, et la console doit le dire
   * comme tel — sinon l'exploitant cherche une panne qui n'existe pas.
   *
   * « configuree: true » avec « repond: false », en revanche, est une panne :
   * quelqu'un a posé une adresse et la base ne répond pas.
   */
  readonly base: EtatBd
}

export function etatDesBaremes(aLaDate: string): EtatBareme[] {
  return Object.entries(BAREMES).map(([cle, bareme]) => {
    const resultat = valeurApplicable(cle as keyof typeof BAREMES, aLaDate)
    if (estIndisponible(resultat)) {
      return {
        cle,
        libelle: bareme.libelle,
        millesime: null,
        verifieLe: bareme.derniere_valeur_encore_valide_le,
        perime: false,
        vide: true,
      }
    }
    return {
      cle,
      libelle: bareme.libelle,
      millesime: resultat.millesime,
      verifieLe: resultat.verifieLe,
      perime: resultat.verifieLe !== null && resultat.verifieLe < aLaDate,
      vide: false,
    }
  })
}

export async function etatSysteme(
  coffre: Coffre,
  depotRetours: DepotRetours,
  depotComptes: DepotComptes,
  maintenant = new Date(),
): Promise<EtatSysteme> {
  const aLaDate = maintenant.toISOString().slice(0, 10)
  const millesimes = await depotRetours.millesimes()
  const comptes = await Promise.all(
    millesimes.map(async (m) => ({ millesime: m, retours: (await depotRetours.charger(m)).length })),
  )
  return {
    le: maintenant.toISOString(),
    secrets: await coffre.etat(),
    baremes: etatDesBaremes(aLaDate),
    millesimes: comptes,
    comptes: await depotComptes.etat(maintenant),
    // `etat()` ne lève jamais : une base injoignable est un état à montrer,
    // pas une erreur qui ferait échouer la page qui doit justement le dire.
    base: await etatBaseDeDonnees(),
  }
}
