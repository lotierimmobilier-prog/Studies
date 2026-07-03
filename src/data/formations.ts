import type { Formation } from '../types'

/**
 * Échantillon de formations Parcoursup à but de démonstration.
 *
 * Les taux d'accès sont des ordres de grandeur inspirés des données publiques
 * (data.gouv.fr / statistiques Parcoursup) et n'engagent pas la réalité d'une
 * campagne donnée. Ils servent de base réaliste au moteur de simulation.
 */
export const FORMATIONS: Formation[] = [
  {
    id: 'pass-paris',
    nom: 'PASS (accès aux études de santé)',
    etablissement: 'Université Paris Cité',
    ville: 'Paris',
    region: 'Île-de-France',
    domaine: 'sante',
    selectivite: 'non-selective',
    tauxAccesBase: 25,
    matieresCles: { physique_chimie: 3, svt: 3, mathematiques: 2 },
    attendus:
      "Solides compétences scientifiques, capacité de travail soutenue et régularité.",
  },
  {
    id: 'licence-droit-assas',
    nom: 'Licence de Droit',
    etablissement: 'Université Paris-Panthéon-Assas',
    ville: 'Paris',
    region: 'Île-de-France',
    domaine: 'droit',
    selectivite: 'non-selective',
    tauxAccesBase: 45,
    matieresCles: { francais: 2, histoire_geo: 2, philosophie: 2, ses: 1 },
    attendus:
      "Qualité de l'expression écrite, culture générale et goût du raisonnement.",
  },
  {
    id: 'licence-info-lyon',
    nom: 'Licence Informatique',
    etablissement: 'Université Claude Bernard Lyon 1',
    ville: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    domaine: 'informatique',
    selectivite: 'non-selective',
    tauxAccesBase: 60,
    matieresCles: { mathematiques: 3, informatique: 3, physique_chimie: 1 },
    attendus:
      "Aisance en mathématiques et en logique, intérêt pour l'algorithmique.",
  },
  {
    id: 'but-info-toulouse',
    nom: 'BUT Informatique',
    etablissement: 'IUT de Toulouse',
    ville: 'Toulouse',
    region: 'Occitanie',
    domaine: 'informatique',
    selectivite: 'selective',
    tauxAccesBase: 30,
    matieresCles: { mathematiques: 3, informatique: 2, langues: 1 },
    attendus:
      "Dossier régulier, autonomie et appétence pour les projets techniques.",
  },
  {
    id: 'cpge-mpsi-llg',
    nom: 'CPGE MPSI',
    etablissement: 'Lycée Louis-le-Grand',
    ville: 'Paris',
    region: 'Île-de-France',
    domaine: 'ingenieur',
    selectivite: 'selective',
    tauxAccesBase: 8,
    matieresCles: { mathematiques: 4, physique_chimie: 3 },
    attendus:
      "Excellence en mathématiques et physique, très forte capacité de travail.",
  },
  {
    id: 'cpge-ecg-bordeaux',
    nom: 'CPGE ECG',
    etablissement: 'Lycée Montaigne',
    ville: 'Bordeaux',
    region: 'Nouvelle-Aquitaine',
    domaine: 'commerce',
    selectivite: 'selective',
    tauxAccesBase: 22,
    matieresCles: { mathematiques: 3, ses: 2, langues: 2, histoire_geo: 1 },
    attendus:
      "Bon niveau général, aisance en langues et en analyse économique.",
  },
  {
    id: 'but-gea-nantes',
    nom: 'BUT Gestion des Entreprises et des Administrations',
    etablissement: 'IUT de Nantes',
    ville: 'Nantes',
    region: 'Pays de la Loire',
    domaine: 'economie',
    selectivite: 'selective',
    tauxAccesBase: 35,
    matieresCles: { ses: 3, mathematiques: 2, francais: 1 },
    attendus:
      "Intérêt pour la gestion et l'économie, dossier sérieux et régulier.",
  },
  {
    id: 'licence-psycho-lille',
    nom: 'Licence Psychologie',
    etablissement: 'Université de Lille',
    ville: 'Lille',
    region: 'Hauts-de-France',
    domaine: 'social',
    selectivite: 'non-selective',
    tauxAccesBase: 40,
    matieresCles: { svt: 2, ses: 2, francais: 2, philosophie: 1 },
    attendus:
      "Curiosité pour le comportement humain, rigueur et esprit d'analyse.",
  },
  {
    id: 'licence-llce-anglais-rennes',
    nom: 'Licence LLCER Anglais',
    etablissement: 'Université Rennes 2',
    ville: 'Rennes',
    region: 'Bretagne',
    domaine: 'langues',
    selectivite: 'non-selective',
    tauxAccesBase: 70,
    matieresCles: { langues: 4, francais: 2 },
    attendus:
      "Très bon niveau d'anglais et goût pour la littérature et la culture.",
  },
  {
    id: 'licence-staps-grenoble',
    nom: 'Licence STAPS',
    etablissement: 'Université Grenoble Alpes',
    ville: 'Grenoble',
    region: 'Auvergne-Rhône-Alpes',
    domaine: 'staps',
    selectivite: 'non-selective',
    tauxAccesBase: 35,
    matieresCles: { eps: 3, svt: 2, ses: 1 },
    attendus:
      "Pratique sportive, bases scientifiques et projet professionnel clair.",
  },
  {
    id: 'ecole-art-strasbourg',
    nom: 'DNA Art (école supérieure d\'art)',
    etablissement: 'HEAR Strasbourg',
    ville: 'Strasbourg',
    region: 'Grand Est',
    domaine: 'arts',
    selectivite: 'selective',
    tauxAccesBase: 18,
    matieresCles: { arts: 4, francais: 1 },
    attendus:
      "Portfolio personnel, sensibilité artistique et culture visuelle.",
  },
  {
    id: 'licence-eco-gestion-montpellier',
    nom: 'Licence Économie et Gestion',
    etablissement: 'Université de Montpellier',
    ville: 'Montpellier',
    region: 'Occitanie',
    domaine: 'economie',
    selectivite: 'non-selective',
    tauxAccesBase: 55,
    matieresCles: { mathematiques: 2, ses: 3, langues: 1 },
    attendus:
      "Aisance avec les chiffres et intérêt pour les questions économiques.",
  },
  {
    id: 'but-info-com-marseille',
    nom: 'BUT Information-Communication',
    etablissement: 'IUT d\'Aix-Marseille',
    ville: 'Marseille',
    region: "Provence-Alpes-Côte d'Azur",
    domaine: 'communication',
    selectivite: 'selective',
    tauxAccesBase: 28,
    matieresCles: { francais: 3, langues: 2, ses: 1 },
    attendus:
      "Excellente expression, curiosité pour les médias et esprit d'équipe.",
  },
  {
    id: 'licence-lettres-caen',
    nom: 'Licence Lettres Modernes',
    etablissement: 'Université de Caen Normandie',
    ville: 'Caen',
    region: 'Normandie',
    domaine: 'lettres',
    selectivite: 'non-selective',
    tauxAccesBase: 75,
    matieresCles: { francais: 4, philosophie: 2, histoire_geo: 1 },
    attendus:
      "Goût de la lecture et de l'écriture, solide culture littéraire.",
  },
  {
    id: 'licence-maths-dijon',
    nom: 'Licence Mathématiques',
    etablissement: 'Université de Bourgogne',
    ville: 'Dijon',
    region: 'Bourgogne-Franche-Comté',
    domaine: 'sciences',
    selectivite: 'non-selective',
    tauxAccesBase: 65,
    matieresCles: { mathematiques: 4, physique_chimie: 2, informatique: 1 },
    attendus:
      "Très bon niveau en mathématiques et goût pour l'abstraction.",
  },
]
