import type { Domaine, Matiere, Region } from '../types'

export const LABELS_DOMAINE: Record<Domaine, string> = {
  sante: 'Santé',
  droit: 'Droit',
  informatique: 'Informatique',
  ingenieur: 'Ingénierie',
  sciences: 'Sciences',
  commerce: 'Commerce',
  economie: 'Économie / Gestion',
  lettres: 'Lettres',
  langues: 'Langues',
  arts: 'Arts',
  social: 'Sciences sociales',
  staps: 'Sport (STAPS)',
  communication: 'Communication',
}

export const LABELS_MATIERE: Record<Matiere, string> = {
  mathematiques: 'Mathématiques',
  physique_chimie: 'Physique-Chimie',
  svt: 'SVT',
  francais: 'Français',
  philosophie: 'Philosophie',
  histoire_geo: 'Histoire-Géo',
  ses: 'SES',
  langues: 'Langues',
  informatique: 'Informatique (NSI)',
  eps: 'EPS',
  arts: 'Arts',
}

export const REGIONS: Region[] = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
]

export const MATIERES: Matiere[] = [
  'mathematiques',
  'physique_chimie',
  'svt',
  'francais',
  'philosophie',
  'histoire_geo',
  'ses',
  'langues',
  'informatique',
  'eps',
  'arts',
]

export const DOMAINES: Domaine[] = [
  'sante',
  'droit',
  'informatique',
  'ingenieur',
  'sciences',
  'commerce',
  'economie',
  'lettres',
  'langues',
  'arts',
  'social',
  'staps',
  'communication',
]
