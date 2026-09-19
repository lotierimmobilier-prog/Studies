/**
 * Calcul du reste-à-vivre mensuel projeté.
 *
 * Formule du cahier des charges :
 *
 *   RAV = (R_famille + R_job + A_annuelles) / 10
 *         − ( L_net + T + Alim + S + (F_scol + F_install) / 10 )
 *
 * Divergence assumée et signalée : le cahier des charges définit R_famille
 * comme une « contribution mensuelle » et R_job comme un revenu mensuel, mais
 * les divise tous deux par 10 dans la formule. Diviser un montant déjà mensuel
 * par le nombre de mensualités annuelles n'a pas de sens dimensionnel et
 * amputerait le RAV de 90 % de ces deux ressources. Le moteur applique donc :
 *
 *   RAV = R_famille + R_job + A_annuelles / 10
 *         − ( L_net + T + Alim + S + (F_scol + F_install) / 10 )
 *
 * Seuls les montants réellement annuels sont amortis. Voir l'onglet Décisions.
 */

import { estIndisponible, montantApplicable } from '../../baremes/src/index.ts'
import {
  ligneAideMerite,
  ligneAideMobilite,
  ligneAidesRegionales,
  ligneAlimentation,
  ligneBourseCrous,
  ligneContributionFamiliale,
  ligneFraisDivers,
  ligneFraisInstallation,
  ligneFraisScolarite,
  ligneJobEtudiant,
  ligneLoyerNet,
  ligneTransport,
  round2,
} from './postes.ts'
import type {
  LigneBudget,
  Poste,
  ProfilEleve,
  ResultatRAV,
  Scenario,
  Soutenabilite,
  VoeuBudget,
} from './types.ts'

/** Repli si le barème de mensualités est introuvable : on refuse de calculer. */
const MENSUALITES_PAR_DEFAUT = null

/** Seuils du feu tricolore, tels que fixés par le cahier des charges. */
export const SEUIL_SOUTENABLE_EUROS = 150

export function classerSoutenabilite(ravMensuel: number | null): Soutenabilite {
  if (ravMensuel === null) return 'indeterminable'
  if (ravMensuel < 0) return 'non_financable'
  if (ravMensuel <= SEUIL_SOUTENABLE_EUROS) return 'tendu'
  return 'soutenable'
}

function nombreDeMensualites(aLaDate: string): { valeur: number; source: string } | string {
  const resultat = montantApplicable('bourse_nombre_mensualites', aLaDate)
  if (estIndisponible(resultat)) return resultat.raison
  return { valeur: resultat.valeur, source: resultat.source }
}

/**
 * Reste-à-vivre mensuel d'un vœu pour un profil et un scénario.
 *
 * Rend `ravMensuel: null` dès qu'un poste est manquant. Un RAV partiel serait
 * un montant inventé, ce que la règle 1 interdit.
 */
export function calculerRAV(
  profil: ProfilEleve,
  voeu: VoeuBudget,
  scenario: Scenario,
  aLaDate: string,
): ResultatRAV {
  const mensualites = nombreDeMensualites(aLaDate)
  if (typeof mensualites === 'string') {
    return {
      scenario,
      ravMensuel: MENSUALITES_PAR_DEFAUT,
      lignes: [],
      postesManquants: [],
      soutenabilite: 'indeterminable',
      avertissements: [`Nombre de mensualités indisponible : ${mensualites}`],
      dateDeCalcul: aLaDate,
    }
  }
  const m = mensualites.valeur

  const lignes: readonly LigneBudget[] = [
    ligneLoyerNet(voeu, scenario),
    ligneTransport(voeu),
    ligneAlimentation(profil, aLaDate),
    ligneFraisDivers(profil),
    ligneFraisScolarite(profil, voeu, aLaDate, m),
    ligneFraisInstallation(voeu, m),
    ligneContributionFamiliale(profil),
    ligneJobEtudiant(profil, scenario),
    ligneBourseCrous(profil, aLaDate),
    ligneAideMerite(profil, aLaDate, m),
    ligneAideMobilite(profil, aLaDate, m),
    ligneAidesRegionales(profil, m),
  ]

  const postesManquants: Poste[] = lignes
    .filter((l): l is Extract<LigneBudget, { statut: 'manquant' }> => l.statut === 'manquant')
    .map((l) => l.poste)

  const avertissements: string[] = []
  if (voeu.loyer !== null && voeu.loyer.qualite !== 'commune') {
    avertissements.push(
      `Le loyer de référence n'est pas estimé au niveau communal mais à la maille « ${voeu.loyer.qualite} ».`,
    )
  }

  if (postesManquants.length > 0) {
    return {
      scenario,
      ravMensuel: null,
      lignes,
      postesManquants,
      soutenabilite: 'indeterminable',
      avertissements,
      dateDeCalcul: aLaDate,
    }
  }

  let ressources = 0
  let depenses = 0
  for (const ligne of lignes) {
    if (ligne.statut !== 'calcule') continue
    if (ligne.sens === 'ressource') ressources += ligne.mensualise
    else depenses += ligne.mensualise
  }
  const ravMensuel = round2(ressources - depenses)

  return {
    scenario,
    ravMensuel,
    lignes,
    postesManquants,
    soutenabilite: classerSoutenabilite(ravMensuel),
    avertissements,
    dateDeCalcul: aLaDate,
  }
}

/** Les trois scénarios d'un coup : la fourchette que l'interface doit montrer. */
export function calculerFourchetteRAV(
  profil: ProfilEleve,
  voeu: VoeuBudget,
  aLaDate: string,
): Readonly<Record<Scenario, ResultatRAV>> {
  return {
    optimiste: calculerRAV(profil, voeu, 'optimiste', aLaDate),
    central: calculerRAV(profil, voeu, 'central', aLaDate),
    prudent: calculerRAV(profil, voeu, 'prudent', aLaDate),
  }
}
