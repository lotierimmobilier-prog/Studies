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

/** Spécialités de première / terminale (voie générale). */
export type Specialite =
  | 'maths'
  | 'physique_chimie'
  | 'svt'
  | 'nsi'
  | 'ses'
  | 'hggsp'
  | 'hlp'
  | 'llcer'
  | 'si'
  | 'arts'
  | 'llca'
  | 'biologie_ecologie'
  | 'eppcs'

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

  // --- Champs issus de l'open data officiel (optionnels) ---
  /** Statut de l'établissement (Public, Privé sous contrat, Privé…). */
  statut?: string
  /** Capacité d'accueil de la formation. */
  capacite?: number
  /** Coordonnées GPS [latitude, longitude]. */
  coords?: [number, number]
  /** Lien vers la fiche de la formation sur Parcoursup. */
  lienParcoursup?: string
  /** Estimation indicative des frais de scolarité (l'open data ne fournit pas le prix). */
  prixIndicatif?: string
}

/** Niveau scolaire de l'étudiant. */
export type Classe = 'seconde' | 'premiere' | 'terminale'

/** Profil saisi par l'étudiant. */
export interface ProfilEtudiant {
  /** Classe actuelle (oriente les conseils : spécialités en seconde, vœux ensuite). */
  classe: Classe
  /** Souhaits / projet exprimés librement par l'étudiant. */
  souhaits: string
  /** Spécialités choisies (jusqu'à 3 en première, 2 en terminale). */
  specialites: Specialite[]
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
  /**
   * Score d'adéquation global (0-100) : à quel point la formation correspond
   * au profil (notes, spécialités, passions, motivation, géographie), avant
   * prise en compte de la sélectivité. Sert à mettre en avant les formations
   * les plus « adaptées » à l'étudiant, indépendamment de la seule probabilité.
   */
  adequation: number
  /** Décomposition des sous-scores (0-100) pour la transparence. */
  details: {
    academique: number
    specialites: number
    passion: number
    motivation: number
    geographie: number
  }
  /** Explications lisibles des facteurs clés. */
  explications: string[]
}
