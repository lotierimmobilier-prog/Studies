/**
 * Les trois choix mis en tête de liste.
 *
 * Un lycéen ne tranche pas en lisant quarante cartes. Il lui faut trois
 * entrées, et surtout trois entrées QUI NE SE MÉLANGENT PAS — c'est la règle 5
 * de CLAUDE.md appliquée à l'interface : trois critères tenus séparés, jamais
 * de note globale qui les écraserait en un classement unique.
 *
 *   1. Le choix géographique  — la plus proche de chez toi.
 *   2. Le choix stratégique   — celle qui colle le mieux à tes résultats,
 *                               parmi celles où ton dossier a des chances.
 *   3. Le choix économique    — celle où il te restera le plus pour vivre.
 *
 * Ces trois cartes MISENT EN AVANT, elles ne filtrent pas : la liste complète
 * reste affichée en dessous, sans qu'aucun vœu n'en soit retiré (règle 4).
 *
 * Chaque choix peut être absent, et l'absence a toujours une raison nommée :
 * pas de position communiquée, pas de statistique publiée, pas de compte pour
 * le reste-à-vivre. On ne propose jamais un « meilleur » par défaut.
 */

import type { ResultatFormation } from './calcul.ts'
import { distanceKm } from './geo.ts'
import { positionDe } from './donnees.ts'

export type Critere = 'geographique' | 'strategique' | 'economique'

export interface Choix {
  readonly critere: Critere
  readonly resultat: ResultatFormation
  /** Le chiffre qui justifie ce choix, déjà mis en forme. */
  readonly valeur: string
  /** Ce sur quoi ce choix repose, dit à l'élève sans détour. */
  readonly pourquoi: string
}

export interface Absence {
  readonly critere: Critere
  readonly raison: string
}

export type Proposition = Choix | Absence

export function estUnChoix(p: Proposition): p is Choix {
  return 'resultat' in p
}

/** Position de l'élève, telle que `geo.ts` l'a établie localement. */
export interface PositionEleve {
  readonly lat: number
  readonly lon: number
}

/**
 * Distance entre l'élève et une formation, en kilomètres. null si la commune
 * de la formation n'a pas de position connue : on ne devine pas.
 */
export function distanceDe(
  resultat: ResultatFormation,
  eleve: PositionEleve,
): number | null {
  const position = positionDe(resultat.formation.codeInsee)
  if (position === null) return null
  return distanceKm(eleve.lat, eleve.lon, position.lat, position.lon)
}

/** Le plus proche de l'élève. */
function geographique(
  resultats: readonly ResultatFormation[],
  eleve: PositionEleve | null,
): Proposition {
  if (eleve === null) {
    return {
      critere: 'geographique',
      raison: 'Indique ta position pour voir la formation la plus proche de chez toi.',
    }
  }
  let meilleur: { r: ResultatFormation; d: number } | null = null
  for (const r of resultats) {
    const d = distanceDe(r, eleve)
    if (d === null) continue
    if (meilleur === null || d < meilleur.d) meilleur = { r, d }
  }
  if (meilleur === null) {
    return {
      critere: 'geographique',
      raison: 'Aucune de ces formations n’est dans une commune dont on connaît la position.',
    }
  }
  const km = Math.round(meilleur.d)
  return {
    critere: 'geographique',
    resultat: meilleur.r,
    valeur: km <= 1 ? 'dans ta commune' : `à ${km} km`,
    pourquoi:
      'Distance à vol d’oiseau depuis la position que ton navigateur a donnée. ' +
      'Cette position n’a été envoyée nulle part : le calcul s’est fait sur ton appareil.',
  }
}

/**
 * Celle qui colle le mieux à tes résultats, parmi celles où ton dossier a des
 * chances réelles.
 *
 * Ce que ce choix N'EST PAS : une prédiction de carrière. Nous n'avons pas de
 * donnée d'insertion professionnelle pour l'immense majorité des formations
 * (le jeu InserSup du ministère ne couvre que 7 % des établissements les plus
 * demandés, mesuré le 19/09/2026). Promettre un « avenir professionnel »
 * chiffré serait inventer, ce que la règle 1 interdit. Le libellé dit donc
 * exactement ce sur quoi il repose.
 */
function strategique(resultats: readonly ResultatFormation[]): Proposition {
  const candidats = resultats.filter(
    (r) => r.admissibilite.statut === 'fourchette' && !r.affinite.domaineInconnu,
  )
  if (candidats.length === 0) {
    return {
      critere: 'strategique',
      raison:
        'Aucune de ces formations ne publie à la fois des statistiques d’admission et ' +
        'un domaine reconnu : impossible de dire laquelle te correspond le mieux.',
    }
  }
  const trie = [...candidats].sort((a, b) => {
    if (b.affinite.score !== a.affinite.score) return b.affinite.score - a.affinite.score
    // À affinité égale, celle où le dossier passe le plus souvent.
    const ha = a.admissibilite.statut === 'fourchette' ? a.admissibilite.haut : 0
    const hb = b.admissibilite.statut === 'fourchette' ? b.admissibilite.haut : 0
    return hb - ha
  })
  const meilleur = trie[0]!
  const adm = meilleur.admissibilite
  const taux = adm.statut === 'fourchette' ? adm.tauxAccesPublie : null
  return {
    critere: 'strategique',
    resultat: meilleur,
    valeur: `${meilleur.affinite.score}/100 de correspondance`,
    pourquoi:
      'Calculé à partir de tes notes par matière et du domaine de la formation, ' +
      `parmi celles qui publient leurs statistiques d’admission${
        taux === null ? '' : ` (taux d’accès publié : ${taux} %)`
      }. Ce n’est pas une prévision de carrière : nous n’avons pas de données ` +
      'd’insertion professionnelle pour la plupart des formations, et nous ne les inventons pas.',
  }
}

/** Celle où il te restera le plus pour vivre. */
function economique(
  resultats: readonly ResultatFormation[],
  verrouille: boolean,
): Proposition {
  if (verrouille) {
    return {
      critere: 'economique',
      raison: 'Crée ton compte pour savoir où il te restera le plus pour vivre.',
    }
  }
  const avecRav = resultats.filter((r) => r.parScenario.central.ravMensuel !== null)
  if (avecRav.length === 0) {
    return {
      critere: 'economique',
      raison:
        'Aucun reste-à-vivre n’a pu être calculé : il manque le loyer ou l’aide au ' +
        'logement pour toutes ces communes.',
    }
  }
  const meilleur = avecRav.reduce((a, b) =>
    (b.parScenario.central.ravMensuel ?? 0) > (a.parScenario.central.ravMensuel ?? 0) ? b : a,
  )
  const rav = meilleur.parScenario.central.ravMensuel ?? 0
  return {
    critere: 'economique',
    resultat: meilleur,
    valeur: `${Math.round(rav).toLocaleString('fr-FR')} € par mois`,
    pourquoi:
      'Ce qu’il te reste une fois le loyer, les courses, les transports et les frais ' +
      'de scolarité payés, aide au logement et bourse comprises. Chaque euro est ' +
      'détaillé dans la carte, avec sa source et son millésime.',
  }
}

/**
 * Les trois propositions, toujours dans le même ordre : géographique d'abord,
 * puis stratégique, puis économique. L'ordre est fixe à dessein — il ne doit
 * pas laisser croire à un classement du meilleur au moins bon.
 */
export function troisChoix(
  resultats: readonly ResultatFormation[],
  eleve: PositionEleve | null,
  verrouille: boolean,
): readonly [Proposition, Proposition, Proposition] {
  return [geographique(resultats, eleve), strategique(resultats), economique(resultats, verrouille)]
}
