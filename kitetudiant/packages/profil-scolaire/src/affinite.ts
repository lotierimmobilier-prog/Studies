/**
 * Affinité entre un élève et une formation.
 *
 * Ce n'est PAS un quatrième score au sens du cahier des charges : l'affinité
 * sert à choisir quelles formations montrer et dans quel ordre, jamais à être
 * additionnée à l'admissibilité ou au reste-à-vivre. La règle 5 de CLAUDE.md
 * — les scores restent séparés, jamais de note globale — tient.
 *
 * Le rattachement d'une formation à un domaine se fait par mots-clés sur son
 * libellé et sa filière, tels que Parcoursup les publie. Rien n'est deviné en
 * silence : une formation qu'aucun mot-clé ne reconnaît le dit.
 */

import {
  moyenneGenerale,
  type Domaine,
  type Matiere,
  type ProfilScolaire,
} from './types.ts'

/** Mots-clés de rattachement, appliqués au libellé et à la filière. */
const MOTS_CLES: Readonly<Record<Domaine, readonly string[]>> = {
  sante: ['sante', 'infirmier', 'ifsi', 'pass', 'las', 'medic', 'pharmac', 'kine', 'sage-femme', 'orthoph', 'ergo', 'podolog', 'audiopro', 'manipulateur'],
  droit: ['droit', 'juridique', 'notariat', 'carrieres juridiques'],
  informatique: ['informatique', 'numerique', 'reseaux', 'nsi', 'cybersecurite', 'developpement logiciel', 'donnees'],
  ingenieur: ['ingenieur', 'genie', 'mecanique', 'electrotechnique', 'maintenance', 'industriel', 'aeronautique', 'batiment', 'travaux publics'],
  // « sciences » seul attrape « Sciences Po » et « sciences humaines » : on
  // exige un intitulé plus précis plutôt que de rattacher à tort.
  sciences: ['sciences de la vie', 'sciences et technologies', 'sciences pour la sante', 'mathematiques', 'physique', 'chimie', 'biologie', 'geologie'],
  commerce: ['commerce', 'vente', 'marketing', 'negociation', 'management commercial', 'mco', 'ndrc'],
  economie: ['economie', 'gestion', 'comptabilite', 'finance', 'administration', 'ressources humaines', 'aes'],
  lettres: ['lettres', 'litterature', 'philosophie', 'histoire', 'geographie', 'humanites', 'archeologie'],
  langues: ['langue', 'llce', 'lea', 'anglais', 'espagnol', 'allemand', 'traduction'],
  arts: ['art', 'design', 'musique', 'spectacle', 'audiovisuel', 'graphisme', 'mode', 'patrimoine'],
  social: ['social', 'educateur', 'animation', 'carrieres sociales', 'petite enfance', 'assistant de service'],
  staps: ['staps', 'sport', 'activites physiques'],
  communication: ['communication', 'information', 'journalisme', 'documentation', 'medias', 'edition'],
}

/** Matières qui comptent le plus pour réussir dans un domaine. */
const MATIERES_CLES: Readonly<Record<Domaine, readonly Matiere[]>> = {
  sante: ['svt', 'physique_chimie', 'mathematiques'],
  droit: ['francais', 'histoire_geo', 'philosophie'],
  informatique: ['mathematiques', 'informatique'],
  ingenieur: ['mathematiques', 'physique_chimie', 'informatique'],
  sciences: ['mathematiques', 'physique_chimie', 'svt'],
  commerce: ['ses', 'francais', 'langues'],
  economie: ['ses', 'mathematiques', 'francais'],
  lettres: ['francais', 'philosophie', 'histoire_geo'],
  langues: ['langues', 'francais'],
  arts: ['arts', 'francais'],
  social: ['ses', 'francais', 'svt'],
  staps: ['eps', 'svt'],
  communication: ['francais', 'langues', 'ses'],
}

function sansAccent(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Domaines reconnus dans le libellé d'une formation. Vide si aucun. */
export function domainesDe(libelle: string, filiere: string): Domaine[] {
  const texte = sansAccent(`${libelle} ${filiere}`)
  const trouves: Domaine[] = []
  for (const [domaine, mots] of Object.entries(MOTS_CLES) as [Domaine, readonly string[]][]) {
    if (mots.some((mot) => texte.includes(mot))) trouves.push(domaine)
  }
  return trouves
}

export interface Affinite {
  /** 0 à 100. */
  readonly score: number
  readonly domaines: readonly Domaine[]
  /** Ce qui a joué, en clair, pour l'afficher à l'élève. */
  readonly raisons: readonly string[]
  /** Vrai quand aucun mot-clé ne reconnaît la formation. */
  readonly domaineInconnu: boolean
}

/**
 * Affinité d'un profil avec une formation, sur 100.
 *
 * Trois apports, bornés et explicites :
 *   passions déclarées      jusqu'à 40 points
 *   notes dans les matières
 *   clés du domaine         jusqu'à 40 points
 *   matière préférée        jusqu'à 20 points
 *
 * La motivation et les signaux du bulletin n'entrent pas ici : ils ne disent
 * rien de l'adéquation à une discipline, et les mêler ferait une note fourre-tout.
 */
export function affiniteAvec(
  profil: ProfilScolaire,
  formation: { readonly libelle: string; readonly filiere: string },
): Affinite {
  const domaines = domainesDe(formation.libelle, formation.filiere)
  const raisons: string[] = []

  if (domaines.length === 0) {
    return {
      score: 0,
      domaines: [],
      raisons: ['Aucun domaine reconnu dans l’intitulé de cette formation.'],
      domaineInconnu: true,
    }
  }

  let score = 0

  const passionnants = domaines.filter((d) => profil.passions.includes(d))
  if (passionnants.length > 0) {
    score += 40
    raisons.push(`Fait partie des domaines qui t’intéressent.`)
  }

  const matieresUtiles = [...new Set(domaines.flatMap((d) => MATIERES_CLES[d]))]
  const notesUtiles = matieresUtiles
    .map((m) => profil.notes[m])
    .filter((n): n is number => typeof n === 'number')

  if (notesUtiles.length > 0) {
    const moyenneUtile = notesUtiles.reduce((a, b) => a + b, 0) / notesUtiles.length
    // 8/20 vaut 0 point, 16/20 vaut les 40 points : en deçà de 8 on ne retire
    // rien de plus, au-delà de 16 on n'ajoute rien.
    const part = Math.min(1, Math.max(0, (moyenneUtile - 8) / 8))
    score += Math.round(part * 40)
    raisons.push(
      `Moyenne de ${moyenneUtile.toFixed(1)}/20 dans les matières qui comptent pour ce domaine.`,
    )
  } else {
    const generale = moyenneGenerale(profil.notes)
    if (generale !== null) {
      raisons.push('Aucune note dans les matières clés de ce domaine : elles n’ont pas compté.')
    }
  }

  if (profil.matierePreferee !== null && matieresUtiles.includes(profil.matierePreferee)) {
    score += 20
    raisons.push('Ta matière préférée compte dans ce domaine.')
  }

  return {
    score: Math.min(100, score),
    domaines,
    raisons,
    domaineInconnu: false,
  }
}
