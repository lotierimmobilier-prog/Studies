import type { Domaine, Matiere, Region, Specialite } from '../types'

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

export const LABELS_SPECIALITE: Record<Specialite, string> = {
  maths: 'Mathématiques',
  physique_chimie: 'Physique-Chimie',
  svt: 'SVT',
  nsi: 'NSI (informatique)',
  ses: 'SES',
  hggsp: 'HGGSP',
  hlp: 'Humanités (HLP)',
  llcer: 'LLCER (langues)',
  si: "Sciences de l'ingénieur",
  arts: 'Arts',
  llca: "Langues de l'Antiquité",
  biologie_ecologie: 'Biologie-écologie',
  eppcs: 'EPS (EPPCS)',
}

export const SPECIALITES: Specialite[] = [
  'maths',
  'physique_chimie',
  'svt',
  'nsi',
  'ses',
  'hggsp',
  'hlp',
  'llcer',
  'si',
  'arts',
  'llca',
  'biologie_ecologie',
  'eppcs',
]

/** Spécialités valorisées par domaine d'études (attendus fréquents). */
export const SPECIALITES_PAR_DOMAINE: Record<Domaine, Specialite[]> = {
  sante: ['svt', 'physique_chimie', 'maths'],
  droit: ['hggsp', 'hlp', 'ses'],
  informatique: ['nsi', 'maths', 'physique_chimie'],
  ingenieur: ['maths', 'physique_chimie', 'si'],
  sciences: ['maths', 'physique_chimie', 'svt'],
  commerce: ['ses', 'maths', 'llcer'],
  economie: ['ses', 'maths', 'hggsp'],
  lettres: ['hlp', 'hggsp', 'llcer'],
  langues: ['llcer', 'hlp', 'llca'],
  arts: ['arts', 'hlp'],
  social: ['ses', 'svt', 'hggsp'],
  staps: ['svt', 'eppcs', 'physique_chimie'],
  communication: ['hlp', 'ses', 'llcer'],
}

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
