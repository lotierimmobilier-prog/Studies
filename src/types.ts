/** Types du portail voyageurs (côté navigateur). */

export interface Wifi {
  reseau: string
  motDePasse: string
}

export interface Hote {
  nom: string
  telephone?: string
  email?: string
  whatsapp?: string
}

export interface NumeroUtile {
  libelle: string
  numero: string
}

export interface Maison {
  nom: string
  sousTitre?: string
  /** Photo de la façade (chemin `api/media/…` ou URL), affichée à l'accueil. */
  photo?: string
  adresse: string
  lienCarte?: string
  wifi: Wifi
  codeAcces?: string
  instructionsArrivee: string[]
  instructionsDepart: string[]
  parking?: string
  reglement: string[]
  hote: Hote
  numerosUtiles: NumeroUtile[]
}

export interface Sejour {
  /** Code de connexion unique (choisi par l'admin). */
  code: string
  /** Nom ou prénom affiché à l'accueil. */
  nom: string
  arrivee: string
  depart: string
  voyageurs?: number
  messageHote?: string
}

/** Une photo de la galerie (chemin `api/media/…` ou URL) + légende. */
export interface PhotoGalerie {
  id: string
  url: string
  legende?: string
}

/** Contenu reçu par un voyageur connecté. */
export interface Session {
  jeton: string
  sejour: Sejour
  maison: Maison
  tutoriels: Tutoriel[]
  tourisme: LieuTourisme[]
  galerie: PhotoGalerie[]
}

/** Configuration complète, éditée dans l'administration. */
export interface Configuration {
  maison: Maison
  sejours: Sejour[]
  tutoriels: Tutoriel[]
  tourisme: LieuTourisme[]
  galerie: PhotoGalerie[]
}

/** Source d'une capsule vidéo : YouTube, Vimeo, ou fichier vidéo hébergé. */
export type SourceVideo =
  | { type: 'youtube'; id: string }
  | { type: 'vimeo'; id: string }
  | { type: 'fichier'; src: string }

/** Un tutoriel = une capsule vidéo + son explication pour un équipement. */
export interface Tutoriel {
  id: string
  titre: string
  categorie: string
  /** Emoji d'illustration. */
  icone: string
  description: string
  video: SourceVideo
  /** Étapes détaillées (facultatif). */
  etapes?: string[]
}

/** Une bonne adresse / activité touristique avec ses contacts. */
export interface LieuTourisme {
  id: string
  nom: string
  categorie: string
  icone: string
  description: string
  distance?: string
  telephone?: string
  siteWeb?: string
  lienCarte?: string
  /** Recommandation personnelle de l'hôte. */
  conseilHote?: string
}
