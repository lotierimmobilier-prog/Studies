import type { LieuTourisme } from '../types'

/**
 * Bonnes adresses et activités touristiques à recommander à vos voyageurs.
 * Éditez librement cette liste : restaurants, plages, activités, marchés…
 */
export const LIEUX: LieuTourisme[] = [
  {
    id: 'plage-pampelonne',
    nom: 'Plage de Pampelonne',
    categorie: 'Plages',
    icone: '🏖️',
    description:
      "La plus célèbre plage de la région : 5 km de sable fin, eau turquoise et paillotes de charme.",
    distance: '10 min en voiture',
    lienCarte: 'https://maps.google.com/?q=Plage+de+Pampelonne',
    conseilHote:
      "Arrivez tôt le matin en été pour profiter du calme et trouver une place de parking facilement.",
  },
  {
    id: 'resto-poisson',
    nom: 'La Table du Pêcheur',
    categorie: 'Restaurants',
    icone: '🍽️',
    description:
      "Poissons frais et cuisine méditerranéenne dans un cadre chaleureux face au port.",
    distance: '15 min à pied',
    telephone: '+33 4 94 00 00 00',
    lienCarte: 'https://maps.google.com/?q=restaurant+Saint-Tropez',
    conseilHote:
      "Notre adresse préférée ! Réservez la veille et demandez une table en terrasse.",
  },
  {
    id: 'marche-provencal',
    nom: 'Marché provençal',
    categorie: 'À faire',
    icone: '🧺',
    description:
      "Marché typique le mardi et samedi matin : produits locaux, fromages, olives, tissus provençaux.",
    distance: '10 min à pied',
    conseilHote:
      "Idéal pour composer un pique-nique. Goûtez la tapenade et les navettes !",
  },
  {
    id: 'sentier-littoral',
    nom: 'Sentier du littoral',
    categorie: 'À faire',
    icone: '🥾',
    description:
      "Magnifique randonnée côtière entre criques sauvages et panoramas sur la mer.",
    distance: '5 min en voiture',
    lienCarte: 'https://maps.google.com/?q=sentier+du+littoral',
    conseilHote:
      "Prévoyez de bonnes chaussures, de l'eau et un chapeau. La lumière est superbe en fin de journée.",
  },
  {
    id: 'location-velo',
    nom: 'Loc\'Vélo & Scooters',
    categorie: 'Services',
    icone: '🚲',
    description:
      "Location de vélos, VTT électriques et scooters pour explorer la région en liberté.",
    distance: '8 min à pied',
    telephone: '+33 4 94 11 11 11',
    siteWeb: 'https://example.com',
  },
  {
    id: 'cave-vin',
    nom: 'Domaine des Oliviers',
    categorie: 'À faire',
    icone: '🍷',
    description:
      "Dégustation de rosé de Provence et visite du domaine viticole familial.",
    distance: '20 min en voiture',
    telephone: '+33 4 94 22 22 22',
    siteWeb: 'https://example.com',
    conseilHote:
      "Réservez une visite guidée avec dégustation. Le rosé y est exceptionnel.",
  },
  {
    id: 'pharmacie',
    nom: 'Pharmacie du Centre',
    categorie: 'Services',
    icone: '💊',
    description: 'Pharmacie la plus proche, ouverte du lundi au samedi.',
    distance: '7 min à pied',
    telephone: '+33 4 94 33 33 33',
    lienCarte: 'https://maps.google.com/?q=pharmacie',
  },
  {
    id: 'supermarche',
    nom: 'Supermarché & épicerie',
    categorie: 'Services',
    icone: '🛒',
    description:
      "Pour vos courses : supermarché bien achalandé et épicerie fine locale à côté.",
    distance: '5 min en voiture',
    lienCarte: 'https://maps.google.com/?q=supermarché',
  },
]
