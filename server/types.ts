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

/** Un séjour = une réservation, avec son identifiant de connexion. */
export interface Sejour {
  login: string
  motDePasse: string
  /** Nom affiché (ex. « Famille Dupont »). */
  nom: string
  /** Date/heure d'arrivée au format ISO local (ex. « 2026-07-25T16:00 »). */
  arrivee: string
  /** Date/heure de départ au format ISO local. */
  depart: string
  /** Nombre de voyageurs (facultatif). */
  voyageurs?: number
  /** Petit mot personnalisé de l'hôte. */
  messageHote?: string
}

/** Le séjour tel qu'il est renvoyé au client (sans le mot de passe). */
export type SejourPublic = Omit<Sejour, 'motDePasse'>

/** Fichier de configuration complet. */
export interface Configuration {
  maison: Maison
  sejours: Sejour[]
}

/** Réponse d'une connexion réussie. */
export interface ReponseConnexion {
  jeton: string
  sejour: SejourPublic
  maison: Maison
}
