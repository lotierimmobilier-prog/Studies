// Types partagés de l'application Simulateur Parcoursup

/** Grands domaines d'études, utilisés pour relier passions et formations. */
export type Domaine =
  | 'sante'
  | 'droit'
  | 'informatique'
  | 'ingenieur'
  | 'sciences'
  | 'commerce'
  | 'economie'
  | 'lettres'
  | 'langues'
  | 'arts'
  | 'social'
  | 'staps'
  | 'communication'

/** Régions administratives (métropole) pour la géolocalisation. */
export type Region =
  | 'Auvergne-Rhône-Alpes'
  | 'Bourgogne-Franche-Comté'
  | 'Bretagne'
  | 'Centre-Val de Loire'
  | 'Corse'
  | 'Grand Est'
  | 'Hauts-de-France'
  | 'Île-de-France'
  | 'Normandie'
  | 'Nouvelle-Aquitaine'
  | 'Occitanie'
  | 'Pays de la Loire'
  | "Provence-Alpes-Côte d'Azur"

/** Matières scolaires évaluées (notes sur 20). */
export type Matiere =
  | 'mathematiques'
  | 'physique_chimie'
  | 'svt'
  | 'francais'
  | 'philosophie'
  | 'histoire_geo'
  | 'ses'
  | 'langues'
  | 'informatique'
  | 'eps'
  | 'arts'

/** Sélectivité de la formation. */
export type Selectivite = 'selective' | 'non-selective'

/** Une formation Parcoursup (échantillon de données). */
export interface Formation {
  id: string
  nom: string
  etablissement: string
  ville: string
  region: Region
  domaine: Domaine
  selectivite: Selectivite
  /** Taux d'accès historique moyen (part des candidats ayant reçu une proposition), en %. */
  tauxAccesBase: number
  /** Matières déterminantes et leur poids relatif (somme libre, normalisée à l'usage). */
  matieresCles: Partial<Record<Matiere, number>>
  /** Attendus / description courte affichée à l'utilisateur. */
  attendus: string
}

/** Profil saisi par l'étudiant. */
export interface ProfilEtudiant {
  /** Notes sur 20 par matière (partiel : seules les matières renseignées comptent). */
  notes: Partial<Record<Matiere, number>>
  region: Region | null
  /** Accepte de s'éloigner de sa région pour étudier. */
  mobilite: boolean
  /** Domaines qui passionnent l'étudiant. */
  passions: Domaine[]
  /** Motivation auto-évaluée pour son projet (0-10). */
  motivation: number
  /** Cohérence perçue entre le projet et le parcours (0-10). */
  coherenceProjet: number
}

/** Résultat de simulation pour une formation donnée. */
export interface ResultatSimulation {
  formation: Formation
  /** Probabilité d'admission estimée en %. */
  probabilite: number
  /** Décomposition des sous-scores (0-100) pour la transparence. */
  details: {
    academique: number
    passion: number
    motivation: number
    geographie: number
  }
  /** Explications lisibles des facteurs clés. */
  explications: string[]
}
