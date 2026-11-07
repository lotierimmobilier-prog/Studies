/**
 * Choix budgétaires en langage courant.
 *
 * L'étape « Ton budget » demandait dix montants mensuels à un élève de
 * terminale : contribution familiale, fourchette de job étudiant, repas au
 * resto U, courses, frais divers, transport, surface du logement, droits
 * d'inscription, frais d'installation. Personne de dix-sept ans ne connaît ces
 * chiffres, et les inventer sous la contrainte donne un reste-à-vivre faux.
 *
 * Ces trois listes remplacent la saisie par des choix compréhensibles. Le point
 * essentiel, et il n'est pas négociable : **chaque option AFFICHE les montants
 * qu'elle applique**. Ce ne sont donc pas des valeurs de repli silencieuses —
 * ce que l'avant-dernière ligne de CLAUDE.md interdit — mais des hypothèses
 * annoncées, que l'élève voit, accepte, et peut corriger une à une dans le
 * détail.
 *
 * Les montants sont des ordres de grandeur déclaratifs, pas des barèmes : ils
 * ne prétendent pas venir d'une source officielle, et l'étape le dit en
 * toutes lettres (`.budget-avertissement`, dans web/src/parcours.tsx). Ils
 * n'entrent dans le reste-à-vivre que comme des dépenses déclarées par
 * l'élève, exactement comme s'il les avait tapées.
 *
 * Ce commentaire a longtemps affirmé que « le libellé le dit » alors
 * qu'aucun libellé ne le disait : les treize options affichaient leurs
 * montants sans jamais préciser qu'ils n'étaient pas des barèmes. Un
 * commentaire qui décrit une garantie absente est pire qu'un silence, parce
 * qu'il empêche de la chercher. `budgetSimple.test.ts` vérifie désormais la
 * phrase à l'écran, pas ici.
 */

/** Ce qu'un choix de train de vie fixe, en euros par mois sauf mention. */
export interface TrainDeVie {
  readonly cle: 'pris-en-charge' | 'simple' | 'moyen' | 'large'
  readonly titre: string
  readonly resume: string
  readonly coursesMensuelles: number
  readonly fraisDiversMensuels: number
  readonly transportMensuel: number
  readonly repasCrousParMois: number
}

export const TRAINS_DE_VIE: readonly TrainDeVie[] = [
  {
    /* Le cas où la famille prend en charge le quotidien en nature : elle fait
       les courses, paie l'abonnement, remplit le frigo. Il existe, il est
       fréquent, et sans lui l'élève concerné déclarait des dépenses qu'il
       n'a pas — donc un reste-à-vivre plus bas que la réalité.

       Zéro n'est PAS une valeur de repli silencieuse : c'est une hypothèse
       que l'élève choisit lui-même, et le bouton affiche « 0 € de courses ·
       0 € divers · 0 € transport » comme les autres affichent les leurs. Ce
       qui est interdit, c'est de poser un montant sans le dire — pas de
       prendre acte d'une dépense qui n'a pas lieu.

       Ce choix ne touche ni au loyer ni aux frais de scolarité : ceux-là
       dépendent de la formation et de la ville, et restent calculés. */
    cle: 'pris-en-charge',
    titre: 'Mes parents s’occupent de tout',
    resume: 'Les courses, les transports, le quotidien : je n’avance rien.',
    coursesMensuelles: 0,
    fraisDiversMensuels: 0,
    transportMensuel: 0,
    repasCrousParMois: 0,
  },
  {
    cle: 'simple',
    titre: 'Je fais attention',
    resume: 'Je cuisine, je me déplace à pied ou à vélo, je sors peu.',
    coursesMensuelles: 120,
    fraisDiversMensuels: 60,
    transportMensuel: 15,
    repasCrousParMois: 20,
  },
  {
    cle: 'moyen',
    titre: 'Comme la plupart',
    resume: 'Un abonnement de transport, quelques sorties, un forfait mobile.',
    coursesMensuelles: 150,
    fraisDiversMensuels: 90,
    transportMensuel: 30,
    repasCrousParMois: 15,
  },
  {
    cle: 'large',
    titre: 'J’ai plus de dépenses',
    resume: 'Je mange souvent dehors, je sors, j’ai une activité qui coûte.',
    coursesMensuelles: 200,
    fraisDiversMensuels: 140,
    transportMensuel: 50,
    repasCrousParMois: 10,
  },
]

export interface AideFamille {
  readonly cle: 'aucune' | 'petite' | 'moyenne' | 'grande'
  readonly titre: string
  readonly montant: number
}

export const AIDES_FAMILLE: readonly AideFamille[] = [
  { cle: 'aucune', titre: 'Rien', montant: 0 },
  { cle: 'petite', titre: 'Un petit coup de main', montant: 100 },
  { cle: 'moyenne', titre: 'Une aide régulière', montant: 250 },
  { cle: 'grande', titre: 'Ils prennent en charge', montant: 450 },
]

export interface JobEtudiant {
  readonly cle: 'non' | 'vacances' | 'regulier' | 'important'
  readonly titre: string
  readonly bas: number
  readonly haut: number
}

export const JOBS_ETUDIANTS: readonly JobEtudiant[] = [
  { cle: 'non', titre: 'Non, je veux me concentrer sur mes études', bas: 0, haut: 0 },
  { cle: 'vacances', titre: 'Pendant les vacances seulement', bas: 0, haut: 150 },
  { cle: 'regulier', titre: 'Quelques heures par semaine', bas: 150, haut: 350 },
  { cle: 'important', titre: 'Un vrai mi-temps', bas: 350, haut: 600 },
]

/** Montants qu'un train de vie applique, prêts à fusionner dans les réponses. */
export function valeursDe(t: TrainDeVie): {
  coursesMensuelles: number
  fraisDiversMensuels: number
  transportMensuel: number
  repasCrousParMois: number
} {
  return {
    coursesMensuelles: t.coursesMensuelles,
    fraisDiversMensuels: t.fraisDiversMensuels,
    transportMensuel: t.transportMensuel,
    repasCrousParMois: t.repasCrousParMois,
  }
}

/**
 * Le train de vie dont les montants correspondent exactement aux réponses
 * actuelles, ou null si l'élève a ajusté quelque chose dans le détail.
 *
 * Reconnaître le choix plutôt que le mémoriser évite un second état qui
 * pourrait diverger des valeurs réelles : ce qui est mis en évidence à
 * l'écran est toujours ce qui sera calculé.
 */
export function trainDeVieCourant(reponses: {
  coursesMensuelles: number
  fraisDiversMensuels: number
  transportMensuel: number
  repasCrousParMois: number
}): TrainDeVie | null {
  return (
    TRAINS_DE_VIE.find(
      (t) =>
        t.coursesMensuelles === reponses.coursesMensuelles &&
        t.fraisDiversMensuels === reponses.fraisDiversMensuels &&
        t.transportMensuel === reponses.transportMensuel &&
        t.repasCrousParMois === reponses.repasCrousParMois,
    ) ?? null
  )
}

export function aideFamilleCourante(contributionFamiliale: number): AideFamille | null {
  return AIDES_FAMILLE.find((a) => a.montant === contributionFamiliale) ?? null
}

export function jobCourant(jobBas: number, jobHaut: number): JobEtudiant | null {
  return JOBS_ETUDIANTS.find((j) => j.bas === jobBas && j.haut === jobHaut) ?? null
}

/**
 * Total des dépenses mensuelles déclarées, hors logement et hors scolarité —
 * les deux postes que l'élève ne choisit pas ici, puisqu'ils dépendent de la
 * formation et de la ville.
 */
export function depensesDeclarees(reponses: {
  coursesMensuelles: number
  fraisDiversMensuels: number
  transportMensuel: number
}): number {
  return (
    reponses.coursesMensuelles + reponses.fraisDiversMensuels + reponses.transportMensuel
  )
}
