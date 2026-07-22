/** Types partagés côté serveur pour le portail voyageurs. */

/** Coordonnées de l'hôte, affichées aux voyageurs connectés. */
export interface Hote {
  nom: string
  telephone?: string
  email?: string
  /** Numéro WhatsApp au format international sans « + » (ex. « 33612345678 »). */
  whatsapp?: string
}

/** Un numéro utile (urgences, taxi, médecin…). */
export interface NumeroUtile {
  libelle: string
  numero: string
}

/** Le Wi-Fi de la maison. */
export interface Wifi {
  reseau: string
  motDePasse: string
}

/**
 * Informations de la maison, communes à tous les séjours et **réservées aux
 * voyageurs connectés** (codes, Wi-Fi, adresse précise…).
 */
export interface Maison {
  nom: string
  sousTitre?: string
  /** Photo de la façade, en bannière d'accueil (chemin `api/media/…` ou URL). */
  photo?: string
  adresse: string
  /** Lien Google Maps / Plans vers la maison. */
  lienCarte?: string
  wifi: Wifi
  /** Code de la boîte à clés / de la porte. */
  codeAcces?: string
  /** Instructions détaillées pour récupérer les clés / entrer. */
  instructionsArrivee: string[]
  /** Instructions de départ (clés, ménage, poubelles…). */
  instructionsDepart: string[]
  /** Stationnement. */
  parking?: string
  /** Règlement intérieur (points courts). */
  reglement: string[]
  hote: Hote
  /** Numéros d'urgence et contacts utiles. */
  numerosUtiles: NumeroUtile[]
}

/**
 * Un séjour = une réservation. Le voyageur se connecte avec un simple **code**,
 * associé à son **nom/prénom** (pour l'accueillir) et à ses dates.
 */
export interface Sejour {
  /** Code de connexion unique (ex. « SOLEIL2026 »). */
  code: string
  /** Nom ou prénom affiché à l'accueil (ex. « Marie » ou « Famille Dupont »). */
  nom: string
  /** Date/heure d'arrivée au format ISO local (ex. « 2026-07-25T16:00 »). */
  arrivee: string
  /** Date/heure de départ au format ISO local. */
  depart: string
  /** Nombre de voyageurs (facultatif). */
  voyageurs?: number
  /** Petit mot personnalisé de l'hôte. */
  messageHote?: string
  /** Identifiant de la réservation d'origine (iCal), si importée. Sert à éviter
   *  les doublons lors des synchronisations. */
  sourceUid?: string
  /** Plateforme d'origine (ex. « Airbnb »), si importée. */
  plateforme?: string
}

/** Un calendrier externe à synchroniser (lien iCal Airbnb, Booking…). */
export interface CalendrierSource {
  id: string
  /** URL d'export iCal (.ics) fournie par la plateforme. */
  url: string
  /** Nom de la plateforme / du logement (ex. « Airbnb »). */
  nom?: string
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
  icone: string
  description: string
  video: SourceVideo
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
  conseilHote?: string
}

/** Une photo de la galerie (chemin `api/media/…` ou URL) + légende. */
export interface PhotoGalerie {
  id: string
  url: string
  legende?: string
}

/** Fichier de configuration complet (édité via l'administration). */
export interface Configuration {
  maison: Maison
  sejours: Sejour[]
  tutoriels: Tutoriel[]
  tourisme: LieuTourisme[]
  galerie: PhotoGalerie[]
  /** Calendriers externes à synchroniser (liens iCal). */
  calendriers: CalendrierSource[]
}

/** Contenu renvoyé à un voyageur connecté. */
export interface ContenuVoyageur {
  sejour: Sejour
  maison: Maison
  tutoriels: Tutoriel[]
  tourisme: LieuTourisme[]
  galerie: PhotoGalerie[]
}

/** Réponse d'une connexion voyageur réussie. */
export interface ReponseConnexion extends ContenuVoyageur {
  jeton: string
}
