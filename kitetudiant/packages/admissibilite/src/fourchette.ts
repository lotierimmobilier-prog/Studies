/**
 * Fourchette d'admissibilité, à partir des seules statistiques publiées.
 *
 * Ce module n'est PAS le modèle calibré du lot L2. C'est une lecture
 * transparente des chiffres publiés par le ministère : le taux d'accès de la
 * formation, ajusté par des facteurs bornés et nommés. Il ne prétend à aucune
 * validité statistique et n'a pas été rétro-testé. Le remplacer par un modèle
 * logistique calibré sur trois millésimes, avec backtest, reste à faire.
 *
 * Deux garde-fous, repris du cahier des charges :
 *   - jamais un point, toujours une fourchette ;
 *   - sous 30 admis connus, on renvoie « effectif insuffisant » plutôt qu'un
 *     chiffre que trop peu d'observations soutiennent.
 */

import type { Admissibilite, ProfilAdmission, StatsFormation } from './types.ts'

export const EFFECTIF_MINIMUM = 30

/**
 * Bornes des mentions au bac, telles que le code de l'éducation les fixe.
 * Sert à situer la moyenne de l'élève dans la distribution des admis, faute de
 * connaître leurs moyennes exactes : Parcoursup ne publie que les mentions.
 */
const SEUILS_MENTION = { sansMention: 10, ab: 12, b: 14, tb: 16, tbf: 18 } as const

/** Moyenne estimée du groupe des admis, à partir de leur répartition par mention. */
export function moyenneEstimeeDesAdmis(stats: StatsFormation): number | null {
  const tranches: [number | null, number][] = [
    [stats.admisSansMention, (SEUILS_MENTION.sansMention + SEUILS_MENTION.ab) / 2],
    [stats.admisMentionAB, (SEUILS_MENTION.ab + SEUILS_MENTION.b) / 2],
    [stats.admisMentionB, (SEUILS_MENTION.b + SEUILS_MENTION.tb) / 2],
    [stats.admisMentionTB, (SEUILS_MENTION.tb + SEUILS_MENTION.tbf) / 2],
    [stats.admisMentionTBF, 19],
  ]
  let effectif = 0
  let somme = 0
  for (const [nombre, centre] of tranches) {
    if (typeof nombre !== 'number' || nombre <= 0) continue
    effectif += nombre
    somme += nombre * centre
  }
  if (effectif === 0) return null
  return Math.round((somme / effectif) * 100) / 100
}

function part(numerateur: number | null, denominateur: number | null): number | null {
  if (typeof numerateur !== 'number' || typeof denominateur !== 'number' || denominateur <= 0) {
    return null
  }
  return numerateur / denominateur
}

function admisDuMemeBac(stats: StatsFormation, typeBac: ProfilAdmission['typeBac']): number | null {
  switch (typeBac) {
    case 'general':
      return stats.admisBacGeneral
    case 'technologique':
      return stats.admisBacTechno
    case 'professionnel':
      return stats.admisBacPro
    default:
      return stats.admisAutres
  }
}

/**
 * Fourchette d'admissibilité pour un profil et une formation.
 *
 * Chaque facteur est multiplicatif, borné, et nommé dans le résultat : l'élève
 * doit pouvoir lire pourquoi le chiffre bouge.
 */
export function admissibilite(
  profil: ProfilAdmission,
  stats: StatsFormation,
  source: string,
): Admissibilite {
  if (stats.tauxAcces === null) {
    return {
      statut: 'donnee_manquante',
      raison: 'Le taux d’accès de cette formation n’est pas publié.',
    }
  }
  if (stats.admisTotal === null) {
    return {
      statut: 'donnee_manquante',
      raison: 'Le nombre d’admis de cette formation n’est pas publié.',
    }
  }
  if (stats.admisTotal < EFFECTIF_MINIMUM) {
    return {
      statut: 'effectif_insuffisant',
      effectifAdmis: stats.admisTotal,
      raison:
        `Seulement ${stats.admisTotal} admis connus sur la session ${stats.session} : ` +
        `trop peu pour en tirer une estimation honnête (seuil de ${EFFECTIF_MINIMUM}).`,
    }
  }

  const facteurs: string[] = []
  let estimation = stats.tauxAcces

  // Type de bac : la part des admis ayant le même bac que l'élève.
  const partBac = part(admisDuMemeBac(stats, profil.typeBac), stats.admisTotal)
  if (partBac !== null) {
    // Une part de 1/3 laisse l'estimation inchangée ; en deçà elle baisse,
    // au-delà elle monte, dans un rapport borné à [0,6 ; 1,4].
    const coefficient = Math.min(1.4, Math.max(0.6, 0.6 + partBac * 1.2))
    estimation *= coefficient
    facteurs.push(
      `${Math.round(partBac * 100)} % des admis avaient le même type de bac que toi.`,
    )
  }

  // Niveau scolaire : position de la moyenne de l'élève face à celle des admis.
  const moyenneAdmis = moyenneEstimeeDesAdmis(stats)
  if (profil.moyenneGenerale !== null && moyenneAdmis !== null) {
    const ecart = profil.moyenneGenerale - moyenneAdmis
    const coefficient = Math.min(1.5, Math.max(0.5, 1 + ecart * 0.12))
    estimation *= coefficient
    const sens = ecart >= 0 ? 'au-dessus' : 'en dessous'
    facteurs.push(
      `Ta moyenne de ${profil.moyenneGenerale.toFixed(1)}/20 est ${sens} de celle des admis, ` +
        `estimée à ${moyenneAdmis.toFixed(1)}/20 d’après leurs mentions.`,
    )
  } else if (profil.moyenneGenerale === null) {
    facteurs.push('Aucune note renseignée : ton niveau n’a pas pu être pris en compte.')
  }

  // Boursier : le taux minimum fixé par le recteur joue en ta faveur.
  if (profil.boursier) {
    const partBoursiers = part(stats.admisBoursiers, stats.admisTotal)
    if (partBoursiers !== null && partBoursiers > 0) {
      estimation *= Math.min(1.2, 1 + partBoursiers * 0.3)
      facteurs.push(
        `${Math.round(partBoursiers * 100)} % des admis étaient boursiers ; un taux minimum est fixé par le recteur.`,
      )
    }
  }

  // Origine géographique, surtout sur les formations non sélectives.
  const partAcademie = part(stats.admisMemeAcademie, stats.admisTotal)
  if (partAcademie !== null) {
    const poids = stats.selective ? 0.15 : 0.3
    const coefficient = profil.memeAcademie
      ? 1 + partAcademie * poids
      : 1 - partAcademie * poids
    estimation *= Math.min(1.3, Math.max(0.7, coefficient))
    facteurs.push(
      `${Math.round(partAcademie * 100)} % des admis venaient de l’académie de la formation.`,
    )
  }

  // La fourchette s'élargit quand l'effectif est faible : moins on observe,
  // moins on peut être précis. Elle est plafonnée à 20 points : au-delà, une
  // fourchette ne dit plus rien et vaut mieux être lue comme « moins de X % ».
  const demiLargeur = Math.min(20, Math.max(5, Math.round(250 / Math.sqrt(stats.admisTotal))))
  const centre = Math.min(100, Math.max(0, estimation))
  return {
    statut: 'fourchette',
    bas: Math.max(0, Math.round(centre - demiLargeur)),
    haut: Math.min(100, Math.round(centre + demiLargeur)),
    tauxAccesPublie: stats.tauxAcces,
    effectifAdmis: stats.admisTotal,
    source,
    millesime: stats.session,
    facteurs,
  }
}
