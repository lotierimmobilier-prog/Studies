/** Le profil scolaire de l'élève : ce qu'il sait faire et ce qui l'intéresse. */

export const MATIERES = [
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
] as const
export type Matiere = (typeof MATIERES)[number]

export const DOMAINES = [
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
] as const
export type Domaine = (typeof DOMAINES)[number]

export const LIBELLES_MATIERE: Readonly<Record<Matiere, string>> = {
  mathematiques: 'Mathématiques',
  physique_chimie: 'Physique-chimie',
  svt: 'SVT',
  francais: 'Français',
  philosophie: 'Philosophie',
  histoire_geo: 'Histoire-géographie',
  ses: 'Sciences économiques et sociales',
  langues: 'Langues vivantes',
  informatique: 'Informatique, NSI',
  eps: 'EPS',
  arts: 'Arts',
}

export const LIBELLES_DOMAINE: Readonly<Record<Domaine, string>> = {
  sante: 'Santé',
  droit: 'Droit',
  informatique: 'Informatique',
  ingenieur: 'Ingénierie',
  sciences: 'Sciences',
  commerce: 'Commerce',
  economie: 'Économie, gestion',
  lettres: 'Lettres',
  langues: 'Langues',
  arts: 'Arts',
  social: 'Social, éducation',
  staps: 'Sport',
  communication: 'Communication',
}

/** Signaux chiffrés tirés des appréciations. Le texte brut n'est jamais gardé. */
export interface SignauxBulletin {
  /** 0 à 10. */
  readonly serieux: number
  readonly participation: number
  readonly progression: number
}

export interface ProfilScolaire {
  /** Moyennes sur 20, par matière renseignée. Les autres sont absentes. */
  readonly notes: Partial<Readonly<Record<Matiere, number>>>
  /** Matière que l'élève dit préférer. Compte davantage que les autres. */
  readonly matierePreferee: Matiere | null
  /** Domaines qui l'intéressent. */
  readonly passions: readonly Domaine[]
  /** Motivation auto-évaluée, 0 à 10. */
  readonly motivation: number
  /** Signaux du bulletin, quand un bulletin a été analysé. */
  readonly signaux: SignauxBulletin | null
}

export function moyenneGenerale(notes: ProfilScolaire['notes']): number | null {
  const valeurs = Object.values(notes).filter((v): v is number => typeof v === 'number')
  if (valeurs.length === 0) return null
  const somme = valeurs.reduce((a, b) => a + b, 0)
  return Math.round((somme / valeurs.length) * 100) / 100
}
