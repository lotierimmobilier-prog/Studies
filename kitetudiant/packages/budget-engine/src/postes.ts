/**
 * Construction des lignes de budget, un poste à la fois.
 *
 * Chaque fonction rend une ligne calculée avec sa provenance, une ligne
 * manquante avec sa raison, ou une ligne sans objet. Aucune ne rend de valeur
 * de repli silencieuse : c'est la règle « une donnée manquante s'affiche comme
 * manquante » de CLAUDE.md.
 */

import {
  estIndisponible,
  montantApplicable,
  montantIndexe,
  type BaremeIndisponible,
  type ValeurApplicable,
} from '../../baremes/src/index.ts'

import type {
  LigneBudget,
  MontantSource,
  Poste,
  ProfilEleve,
  Scenario,
  Sens,
  VoeuBudget,
} from './types.ts'

const SAISIE = 'Saisie déclarative de l’élève'

function manquant(poste: Poste, sens: Sens, raison: string): LigneBudget {
  return { statut: 'manquant', poste, sens, raison }
}

function sansObjet(poste: Poste, sens: Sens, raison: string): LigneBudget {
  return { statut: 'sans_objet', poste, sens, raison }
}

function mensuel(
  poste: Poste,
  sens: Sens,
  valeur: MontantSource,
): LigneBudget {
  return { statut: 'calcule', poste, sens, periodicite: 'mensuel', valeur, mensualise: valeur.montant }
}

function annuel(
  poste: Poste,
  sens: Sens,
  valeur: MontantSource,
  mensualitesParAn: number,
): LigneBudget {
  return {
    statut: 'calcule',
    poste,
    sens,
    periodicite: 'annuel',
    valeur,
    mensualise: valeur.montant / mensualitesParAn,
  }
}

function depuisBareme(
  resultat: ValeurApplicable<number> | BaremeIndisponible,
  hypothese: string,
): MontantSource | BaremeIndisponible {
  if (estIndisponible(resultat)) return resultat
  return {
    montant: resultat.valeur,
    source: resultat.source,
    millesime: resultat.millesime,
    hypothese,
  }
}

// ---------------------------------------------------------------- dépenses

/**
 * Loyer charges comprises du logement type, moins l'APL simulée.
 *
 * L'indicateur de loyers est un loyer d'annonce, charges comprises, pour un
 * bien loué vide : les deux hypothèses voyagent avec le montant. Le scénario
 * choisit la borne de l'intervalle de prédiction publié.
 */
export function ligneLoyerNet(voeu: VoeuBudget, scenario: Scenario): LigneBudget {
  if (voeu.loyer === null) {
    return manquant(
      'loyer_net',
      'depense',
      voeu.codeInsee === null
        ? 'Commune non résolue : aucun indicateur de loyer ne peut être rattaché à cette formation.'
        : `Aucun indicateur de loyer pour la commune ${voeu.codeInsee}.`,
    )
  }
  if (voeu.aplMensuelle === null) {
    return manquant(
      'loyer_net',
      'depense',
      'APL non simulée. Le loyer net exige une simulation OpenFisca : aucune approximation n’est admise.',
    )
  }
  const euroParM2 =
    scenario === 'optimiste'
      ? voeu.loyer.euroParM2.bas
      : scenario === 'prudent'
        ? voeu.loyer.euroParM2.haut
        : voeu.loyer.euroParM2.central
  const borne =
    scenario === 'optimiste'
      ? 'borne basse'
      : scenario === 'prudent'
        ? 'borne haute'
        : 'valeur centrale'
  const brut = euroParM2 * voeu.surfaceHypotheseM2
  const net = brut - voeu.aplMensuelle.montant
  return mensuel('loyer_net', 'depense', {
    montant: Math.max(net, 0),
    source: `${voeu.loyer.source} ; APL : ${voeu.aplMensuelle.source}`,
    millesime: `${voeu.loyer.millesime} / ${voeu.aplMensuelle.millesime}`,
    hypothese:
      `${euroParM2} €/m² (${borne} de l’intervalle de prédiction, estimation « ${voeu.loyer.qualite} ») ` +
      `× ${voeu.surfaceHypotheseM2} m², loyer d’annonce charges comprises pour un bien loué vide, ` +
      `moins ${voeu.aplMensuelle.montant} € d’APL` +
      (net < 0 ? ' ; APL supérieure au loyer, le poste est ramené à 0 €' : ''),
  })
}

export function ligneTransport(voeu: VoeuBudget): LigneBudget {
  if (voeu.transportMensuel === null) {
    return manquant(
      'transport',
      'depense',
      'Tarif de l’abonnement urbain étudiant non disponible pour ce réseau (lot L7).',
    )
  }
  return mensuel('transport', 'depense', voeu.transportMensuel)
}

/**
 * Alimentation : repas au restaurant universitaire au tarif réglementaire,
 * plus les courses déclarées par l'élève.
 */
export function ligneAlimentation(profil: ProfilEleve, aLaDate: string): LigneBudget {
  const cle = profil.echelonBourse === null ? 'repas_crous_non_boursier' : 'repas_crous_boursier'
  const repas = depuisBareme(
    montantApplicable(cle, aLaDate),
    `${profil.repasCrousParMois} repas par mois au restaurant universitaire`,
  )
  if (estIndisponible(repas)) return manquant('alimentation', 'depense', repas.raison)
  if (profil.coursesMensuelles === null) {
    return manquant(
      'alimentation',
      'depense',
      'Budget courses non renseigné : le poste alimentation ne peut pas être arrêté.',
    )
  }
  const coutRepas = repas.montant * profil.repasCrousParMois
  return mensuel('alimentation', 'depense', {
    montant: coutRepas + profil.coursesMensuelles,
    source: `${repas.source} ; courses : ${SAISIE}`,
    millesime: repas.millesime,
    hypothese:
      `${profil.repasCrousParMois} repas × ${repas.montant} € au tarif ` +
      `${profil.echelonBourse === null ? 'non boursier' : 'boursier'} = ${round2(coutRepas)} €, ` +
      `plus ${profil.coursesMensuelles} € de courses déclarées`,
  })
}

export function ligneFraisDivers(profil: ProfilEleve): LigneBudget {
  if (profil.fraisDiversMensuels === null) {
    return manquant(
      'frais_divers',
      'depense',
      'Forfait téléphone, mutuelle, fournitures et loisirs non renseigné.',
    )
  }
  return mensuel('frais_divers', 'depense', {
    montant: profil.fraisDiversMensuels,
    source: SAISIE,
    millesime: 'déclaratif',
    hypothese: 'Forfait mensuel paramétré par l’élève : téléphone, mutuelle, fournitures, loisirs',
  })
}

/** Frais de scolarité et CVEC, amortis sur les mensualités de l'année. */
export function ligneFraisScolarite(
  profil: ProfilEleve,
  voeu: VoeuBudget,
  aLaDate: string,
  mensualites: number,
): LigneBudget {
  if (voeu.fraisScolariteAnnuels === null) {
    return manquant(
      'frais_scolarite',
      'depense',
      'Droits d’inscription non disponibles : aucune source déterministe (le champ Onisep est en texte libre et renseigné à 36,40 %).',
    )
  }
  const exonere = profil.exonereCvec || profil.echelonBourse !== null
  if (!voeu.assujettiCvec || exonere) {
    const raison = !voeu.assujettiCvec
      ? 'Formation non concernée par la CVEC'
      : profil.echelonBourse !== null
        ? 'Boursier sur critères sociaux : exonéré de CVEC'
        : 'Exonéré de CVEC (aide spécifique annuelle ou bourse régionale)'
    return annuel('frais_scolarite', 'depense', {
      ...voeu.fraisScolariteAnnuels,
      hypothese: `${voeu.fraisScolariteAnnuels.hypothese} ; CVEC nulle (${raison})`,
    }, mensualites)
  }
  const cvec = depuisBareme(montantApplicable('cvec', aLaDate), 'CVEC due pour l’année universitaire')
  if (estIndisponible(cvec)) return manquant('frais_scolarite', 'depense', cvec.raison)
  return annuel('frais_scolarite', 'depense', {
    montant: voeu.fraisScolariteAnnuels.montant + cvec.montant,
    source: `${voeu.fraisScolariteAnnuels.source} ; CVEC : ${cvec.source}`,
    millesime: `${voeu.fraisScolariteAnnuels.millesime} / ${cvec.millesime}`,
    hypothese: `${voeu.fraisScolariteAnnuels.hypothese} ; plus ${cvec.montant} € de CVEC`,
  }, mensualites)
}

export function ligneFraisInstallation(voeu: VoeuBudget, mensualites: number): LigneBudget {
  if (voeu.fraisInstallation === null) {
    return manquant(
      'frais_installation',
      'depense',
      'Barème d’installation non disponible pour cette typologie de logement (dépôt de garantie, déménagement, premier équipement).',
    )
  }
  return annuel('frais_installation', 'depense', voeu.fraisInstallation, mensualites)
}

// -------------------------------------------------------------- ressources

export function ligneContributionFamiliale(profil: ProfilEleve): LigneBudget {
  if (profil.contributionFamilialeMensuelle === null) {
    return manquant(
      'contribution_familiale',
      'ressource',
      'Contribution familiale non renseignée.',
    )
  }
  return mensuel('contribution_familiale', 'ressource', {
    montant: profil.contributionFamilialeMensuelle,
    source: SAISIE,
    millesime: 'déclaratif',
    hypothese: 'Contribution mensuelle déclarée par la famille',
  })
}

export function ligneJobEtudiant(profil: ProfilEleve, scenario: Scenario): LigneBudget {
  if (profil.jobEtudiantMensuel === null) {
    return manquant('job_etudiant', 'ressource', 'Revenu de job étudiant non renseigné.')
  }
  const { bas, haut } = profil.jobEtudiantMensuel
  const montant =
    scenario === 'optimiste' ? haut : scenario === 'prudent' ? bas : (bas + haut) / 2
  const borne =
    scenario === 'optimiste'
      ? 'borne haute'
      : scenario === 'prudent'
        ? 'borne basse'
        : 'moyenne des bornes'
  return mensuel('job_etudiant', 'ressource', {
    montant,
    source: SAISIE,
    millesime: 'déclaratif',
    hypothese: `Fourchette déclarée ${bas} à ${haut} € par mois, ${borne} retenue pour le scénario ${scenario}`,
  })
}

export function ligneBourseCrous(profil: ProfilEleve, aLaDate: string): LigneBudget {
  if (profil.echelonBourse === null) {
    return sansObjet('bourse_crous', 'ressource', 'Élève non boursier sur critères sociaux')
  }
  const resultat = montantIndexe('bourse_criteres_sociaux', profil.echelonBourse, aLaDate)
  const montant = depuisBareme(resultat, `Échelon ${profil.echelonBourse}`)
  if (estIndisponible(montant)) return manquant('bourse_crous', 'ressource', montant.raison)
  return mensuel('bourse_crous', 'ressource', montant)
}

export function ligneAideMerite(profil: ProfilEleve, aLaDate: string, mensualites: number): LigneBudget {
  if (!profil.eligibleAideMerite) {
    return sansObjet('aide_merite', 'ressource', 'Élève non éligible à l’aide au mérite')
  }
  const montant = depuisBareme(
    montantApplicable('aide_merite', aLaDate),
    `Aide au mérite annuelle, amortie sur ${mensualites} mensualités`,
  )
  if (estIndisponible(montant)) return manquant('aide_merite', 'ressource', montant.raison)
  return annuel('aide_merite', 'ressource', montant, mensualites)
}

export function ligneAideMobilite(profil: ProfilEleve, aLaDate: string, mensualites: number): LigneBudget {
  if (!profil.eligibleAideMobiliteParcoursup) {
    return sansObjet(
      'aide_mobilite_parcoursup',
      'ressource',
      'Élève non éligible à l’aide à la mobilité Parcoursup',
    )
  }
  const montant = depuisBareme(
    montantApplicable('aide_mobilite_parcoursup', aLaDate),
    `Aide versée une fois, amortie sur ${mensualites} mensualités`,
  )
  if (estIndisponible(montant)) return manquant('aide_mobilite_parcoursup', 'ressource', montant.raison)
  return annuel('aide_mobilite_parcoursup', 'ressource', montant, mensualites)
}

export function ligneAidesRegionales(profil: ProfilEleve, mensualites: number): LigneBudget {
  if (profil.aidesRegionalesAnnuelles === null) {
    return sansObjet(
      'aides_regionales',
      'ressource',
      'Aucune aide régionale déclarée. Les barèmes régionaux ne sont pas encore intégrés.',
    )
  }
  return annuel('aides_regionales', 'ressource', {
    montant: profil.aidesRegionalesAnnuelles,
    source: SAISIE,
    millesime: 'déclaratif',
    hypothese: `Aides régionales annuelles déclarées, amorties sur ${mensualites} mensualités`,
  }, mensualites)
}

export function round2(valeur: number): number {
  return Math.round(valeur * 100) / 100
}
