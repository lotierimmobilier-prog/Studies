/**
 * Le contenu de la fiche « Rédiger une lettre de motivation ».
 *
 * Tout ce fichier vient d'une seule source : la fiche élève publiée par le
 * ministère de l'Éducation nationale pour Parcoursup. Rien n'y est inventé,
 * rien n'y est reformulé au jugé — les consignes, les repères de longueur et
 * les aides à la formulation sont celles du ministère, et la mention de
 * provenance voyage avec (règle 6).
 *
 * ── Pourquoi Jean-Paul n'écrit PAS la lettre ────────────────────────────
 *
 * La fiche le dit elle-même, et c'est cité mot pour mot plus bas : « évitez
 * absolument le recours à des logiciels de type ChatGPT ou équivalent ». Un
 * site qui publierait cette phrase et proposerait dans la foulée d'écrire la
 * lettre à la place de l'élève se contredirait à une ligne d'intervalle — et
 * lui ferait courir le risque exact contre lequel la fiche le met en garde.
 *
 * L'outil pose donc les questions de la fiche et range les réponses. Le
 * brouillon est fait des phrases de l'élève, dans son ordre à lui. C'est la
 * seule chose que les formations demandent : une production personnelle.
 */

export const SOURCE_LETTRE =
  'Fiche élève « Rédiger une lettre de motivation », ministère de l’Éducation nationale — Parcoursup'

/** Millésime de la fiche, lisible tel quel à l'écran. */
export const MILLESIME_LETTRE = 'campagne 2025'

/**
 * La phrase du ministère sur les IA génératives, citée sans retouche.
 *
 * Elle est affichée en tête de l'outil. La couper ou l'adoucir reviendrait à
 * cacher à un mineur l'avertissement que l'État lui adresse.
 */
export const AVERTISSEMENT_IA =
  'Important : évitez absolument le recours à des logiciels de type ChatGPT ou ' +
  'équivalent : les enseignants le voient et ce qui est demandé, c’est une ' +
  'production personnelle.'

/** Les repères de longueur publiés. `ifsi` : le cas particulier des soins infirmiers. */
export const LONGUEUR = {
  /** 1 500 caractères, « environ 200/250 mots en calibri 11 ». */
  standard: 1500,
  /** Les IFSI acceptent plus long, et la fiche conseille de ne pas dépasser. */
  ifsi: 4500,
  mots: '200 à 250 mots',
} as const

/** Ce qu'une question demande à l'élève, et pourquoi la fiche la pose. */
export interface Question {
  readonly cle: string
  /** La question, telle qu'on la pose à l'élève. */
  readonly question: string
  /** Ce que la fiche attend derrière — affiché sous le champ. */
  readonly pourquoi: string
  /** Deux ou trois exemples de ce qui peut y figurer. Jamais des phrases toutes faites. */
  readonly pistes: readonly string[]
  /** L'endroit du texte où la réponse ira. */
  readonly partie: 'introduction' | 'developpement' | 'conclusion'
}

/**
 * Les questions, dans l'ordre du plan que la fiche recommande.
 *
 * « Structure du texte : une introduction courte d'une phrase, un
 * développement et une phrase de conclusion. »
 *
 * Les pistes ne sont PAS des phrases à recopier : ce sont les catégories que
 * la fiche énumère, pour que l'élève cherche dans sa propre expérience. Une
 * phrase toute faite reproduite par des milliers de candidats se repère aussi
 * bien qu'un texte de machine.
 */
export const QUESTIONS: readonly Question[] = [
  {
    cle: 'demande',
    question: 'Quelle formation demandes-tu, et dans quel établissement ?',
    pourquoi:
      'La fiche demande « le bon intitulé de la formation » et les termes exacts : ' +
      'on écrit « BUT » pour le diplôme, « IUT » seulement pour l’établissement.',
    pistes: [
      'l’intitulé exact, tel qu’il figure sur la fiche Parcoursup',
      'le nom de l’établissement',
    ],
    partie: 'introduction',
  },
  {
    cle: 'motivation',
    question: 'Qu’est-ce qui t’intéresse dans CETTE formation, précisément ?',
    pourquoi:
      'C’est le cœur de la lettre. « Pas de copier/coller » : ce qui vaut pour une ' +
      'formation ne vaut pas pour une autre, et c’est ce qui se voit le plus.',
    pistes: [
      'un cours, une matière ou un thème au programme',
      'la façon dont les enseignements sont organisés',
      'ce que la formation permet de faire après',
    ],
    partie: 'developpement',
  },
  {
    cle: 'connaissance',
    question: 'Comment as-tu découvert cette formation ?',
    pourquoi:
      'La fiche appelle cela « les démarches entreprises pour mieux connaître la ' +
      'formation souhaitée ». Elle montre que le vœu n’est pas pris au hasard.',
    pistes: [
      'une journée portes ouvertes, un salon',
      'un échange avec un enseignant, un étudiant, un professionnel',
      'la fiche Parcoursup, le site de l’établissement',
    ],
    partie: 'developpement',
  },
  {
    cle: 'scolaire',
    question: 'Quelles matières ou compétences scolaires te servent pour cette formation ?',
    pourquoi:
      'La fiche demande de « mettre en relation vos compétences, intérêts et projets ' +
      'avec les attendus de la formation visée ». Les attendus sont sur la fiche Parcoursup.',
    pistes: [
      'une spécialité de terminale et ce qu’elle t’a appris',
      'un travail, un exposé, un projet dont tu es content',
      'une progression au cours de l’année',
    ],
    partie: 'developpement',
  },
  {
    cle: 'experiences',
    question: 'Qu’as-tu fait en dehors des cours qui a un rapport, même indirect ?',
    pourquoi:
      'La fiche liste : stages, jobs, engagement associatif, service civique, cordées ' +
      'de la réussite, productions personnelles. Beaucoup d’élèves n’y pensent pas.',
    pistes: [
      'un stage, un job d’été, du bénévolat',
      'un sport, une pratique artistique, un projet personnel',
      'une cordée de la réussite ou un parcours d’excellence',
    ],
    partie: 'developpement',
  },
  {
    cle: 'projet',
    question: 'Et après cette formation, tu imagines quoi ?',
    pourquoi:
      'La fiche parle des « possibilités de poursuite d’études et/ou de débouchés ». ' +
      'Une idée, même incertaine, vaut mieux qu’un projet inventé pour faire joli.',
    pistes: [
      'un métier, un secteur, une poursuite d’études',
      'ce que tu veux avoir appris au bout',
      '« je ne sais pas encore, et voilà ce que je veux explorer »',
    ],
    partie: 'conclusion',
  },
]

/** Ce que la fiche demande de vérifier avant de recopier dans Parcoursup. */
export const RELECTURE: readonly string[] = [
  'Aucun nom ni prénom dans le texte : la fiche l’interdit expressément.',
  'Pas de date, pas d’en-tête : c’est un texte, pas un courrier.',
  'Un texte différent pour chaque formation demandée. Pas de copier/coller.',
  'Les bons mots : « étudiant » et non « élève », « BUT » et non « IUT ».',
  'L’orthographe et la syntaxe relues, les répétitions supprimées.',
  'Fais relire par un proche ou par un professeur : la fiche le recommande.',
]

/** Les aides à la formulation du ministère, reprises telles quelles. */
export const FORMULATIONS: readonly {
  readonly titre: string
  readonly expressions: readonly string[]
}[] = [
  {
    titre: 'Exprimer sa motivation',
    expressions: [
      'Je suis fortement intéressé / intéressée par',
      'Désireux / Désireuse de participer à',
      'Je souhaite avec beaucoup d’intérêt intégrer / suivre les enseignements',
      'Ce qui m’enthousiasme dans votre formation',
    ],
  },
  {
    titre: 'Relier une expérience à la formation',
    expressions: [
      'Au cours de mon stage / emploi / de mon activité de service civique',
      'Mon expérience acquise en… m’a donné une pratique certaine dans ce domaine',
      'Dans le cadre de ma scolarité, je me suis engagé / engagée au service des autres en réalisant…',
      'Parce que mon expérience… m’a permis d’acquérir des compétences transposables',
    ],
  },
  {
    titre: 'Montrer qu’on connaît la formation',
    expressions: [
      'Lors des journées portes ouvertes, j’ai pu m’informer',
      'Sur votre site, vous indiquez que',
      'Les cours de… et de… m’intéressent particulièrement parce que',
      'Le programme de formation / les thèmes abordés au programme',
    ],
  },
  {
    titre: 'Parler de soi',
    expressions: [
      'Pour ma part',
      'En ce qui me concerne',
      'À mes yeux',
      'À proscrire : « Moi, je… »',
    ],
  },
  {
    titre: 'Terminer',
    expressions: [
      'Je vous remercie par avance de l’attention que vous porterez à ma candidature',
      'Souhaitant que ma candidature retienne votre attention',
      'En espérant qu’à travers cette lettre ma candidature réponde à vos attentes',
    ],
  },
]

/** Les synonymes de la fiche, pour éviter de répéter le même adjectif. */
export const SYNONYMES: Readonly<Record<string, readonly string[]>> = {
  sérieux: ['réfléchi', 'consciencieux', 'soigneux', 'appliqué'],
  dynamique: ['actif', 'entreprenant', 'énergique'],
  créatif: ['innovant', 'inventif', 'ingénieux'],
  'ouvert d’esprit': ['curieux', 'sociable'],
  organisé: ['prévoyant', 'ordonné'],
  motivé: ['stimulé', 'enthousiaste', 'passionné'],
  expérience: ['pratique', 'apprentissage'],
  intérêt: ['attention', 'curiosité', 'passion'],
  projet: ['idée', 'intention', 'programme'],
  participer: ['prendre part', 'collaborer', 'coopérer'],
  's’engager': ['s’impliquer', 'adhérer', 's’associer'],
}

/** Le cas particulier des instituts de formation en soins infirmiers. */
export const CAS_IFSI = {
  titre: 'Tu demandes un IFSI (soins infirmiers) ?',
  points: [
    'Les IFSI regardent en particulier les compétences relationnelles acquises hors du lycée : un stage ou une expérience en milieu sanitaire ou médico-social.',
    'Deux questions à te poser : d’où vient ton intérêt pour l’accompagnement et les soins ? en quoi l’enseignement en IFSI répond-il à ton projet ?',
    'Décris aussi ces expériences dans la rubrique « Activités et centres d’intérêt » de ton dossier.',
    'La lettre peut aller jusqu’à 4 500 caractères, mais la fiche conseille de rester synthétique.',
  ],
} as const

/** Ce que la fiche dit du calendrier, sans le transformer en compte à rebours. */
export const CALENDRIER =
  'La lettre se saisit dans un encart prévu sur Parcoursup, et seulement quand la ' +
  'formation l’a demandée — elle figure alors dans les « pièces demandées ». Pour la ' +
  'campagne 2025, la date limite de saisie était le 2 avril.'
