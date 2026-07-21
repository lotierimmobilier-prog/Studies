import type { Tutoriel } from '../types'

/**
 * Capsules vidéo des tutoriels de la maison.
 *
 * Pour ajouter/modifier un tutoriel, éditez simplement cette liste.
 * La vidéo peut venir de trois sources :
 *   - YouTube : { type: 'youtube', id: 'ID' }  (l'ID est ce qui suit « v= »
 *     dans l'URL, ex. https://youtu.be/dQw4w9WgXcQ → id: 'dQw4w9WgXcQ')
 *   - Vimeo   : { type: 'vimeo', id: '76979871' }
 *   - Fichier : { type: 'fichier', src: '/videos/chauffage.mp4' }
 *     (déposez le fichier .mp4 dans le dossier `public/videos/`)
 *
 * Astuce : sur YouTube, réglez la vidéo en « Non répertoriée » pour qu'elle ne
 * soit visible que via ce portail.
 */
export const TUTORIELS: Tutoriel[] = [
  {
    id: 'wifi',
    titre: 'Se connecter au Wi-Fi',
    categorie: 'Essentiels',
    icone: '📶',
    description:
      "Comment vous connecter au réseau Wi-Fi de la maison en quelques secondes, sur téléphone comme sur ordinateur.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
    etapes: [
      'Ouvrez les réglages Wi-Fi de votre appareil.',
      'Sélectionnez le réseau indiqué dans l\'onglet « Accès ».',
      'Saisissez le mot de passe (attention aux majuscules).',
    ],
  },
  {
    id: 'clim',
    titre: 'Utiliser la climatisation',
    categorie: 'Confort',
    icone: '❄️',
    description:
      "Régler la température, le mode froid/chaud et la minuterie avec la télécommande de la climatisation réversible.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
    etapes: [
      'Appuyez sur le bouton ON/OFF de la télécommande.',
      'Choisissez le mode : flocon = froid, soleil = chaud.',
      'Réglez la température entre 21 et 24°C pour un confort optimal.',
      'Pensez à l\'éteindre en quittant la pièce ou la maison.',
    ],
  },
  {
    id: 'lave-vaisselle',
    titre: 'Le lave-vaisselle',
    categorie: 'Cuisine',
    icone: '🍽️',
    description:
      "Où trouver les pastilles, choisir le bon programme et lancer un cycle sans se tromper.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
    etapes: [
      'Les pastilles sont dans le placard sous l\'évier.',
      'Placez une pastille dans le bac de la porte.',
      'Sélectionnez le programme « Eco » (le plus économique).',
      'Fermez la porte et appuyez sur Départ.',
    ],
  },
  {
    id: 'lave-linge',
    titre: 'Le lave-linge',
    categorie: 'Buanderie',
    icone: '🧺',
    description:
      "Faire une machine simplement : lessive, programme et essorage.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
  },
  {
    id: 'tv',
    titre: 'Télévision & Netflix',
    categorie: 'Confort',
    icone: '📺',
    description:
      "Allumer la TV, changer de source et accéder aux applications de streaming.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
    etapes: [
      'Allumez la TV avec la télécommande noire (bouton rouge).',
      'Appuyez sur « Source » et choisissez « Smart TV ».',
      'Ouvrez l\'application souhaitée (vos comptes personnels recommandés).',
    ],
  },
  {
    id: 'piscine',
    titre: 'La piscine & la douche extérieure',
    categorie: 'Extérieur',
    icone: '🏊',
    description:
      "Consignes de sécurité, système de filtration et douche extérieure.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
    etapes: [
      'La piscine n\'est pas surveillée : surveillez les enfants en permanence.',
      'La filtration se déclenche automatiquement, n\'y touchez pas.',
      'Douchez-vous avant la baignade pour préserver l\'eau.',
    ],
  },
  {
    id: 'poubelles',
    titre: 'Le tri des déchets',
    categorie: 'Essentiels',
    icone: '♻️',
    description:
      "Où se trouvent les conteneurs et comment trier vos déchets pendant le séjour.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
  },
  {
    id: 'volets',
    titre: 'Volets & stores électriques',
    categorie: 'Confort',
    icone: '🪟',
    description:
      "Ouvrir et fermer les volets roulants et le store de la terrasse.",
    video: { type: 'youtube', id: 'dQw4w9WgXcQ' },
  },
]
