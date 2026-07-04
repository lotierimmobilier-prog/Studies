/** Résultat de prix pour un établissement / une formation. */
export interface PrixFormation {
  etablissement: string
  /** Frais de scolarité annuels en euros, ou null si inconnu. */
  prixAnnuel: number | null
  devise: 'EUR'
  /** Les boursiers sont-ils exonérés (fréquent dans le public) ? */
  gratuitBoursier?: boolean
  /** Provenance de l'information. */
  source: 'curated' | 'scrape' | 'estimation'
  /** URL consultée (site de l'école) le cas échéant. */
  url?: string
  /** Précision lisible (ex. « droits nationaux », fourchette privée…). */
  note?: string
  /** Date de mise à jour (ISO), injectée par l'appelant. */
  dateMaj: string
}

/** Requête de prix : on transmet ce que l'on connaît de la formation. */
export interface RequetePrix {
  etablissement: string
  /** Statut de l'open data (Public / Privé sous contrat…). */
  statut?: string
  /** Filière très agrégée de l'open data (ex. 9_EcoleIngenieur). */
  fili?: string
  /** Intitulé de la formation (aide au classement par catégorie). */
  formation?: string
}

/** Avis Google d'un établissement (note moyenne + nombre d'avis). */
export interface AvisEcole {
  etablissement: string
  /** Note moyenne sur 5, ou null si inconnue. */
  note: number | null
  /** Nombre d'avis pris en compte, ou null si inconnu. */
  nombreAvis: number | null
  /** Provenance : Google Places, ou indisponible (clé absente / non trouvé). */
  source: 'google' | 'indisponible'
  /** Lien vers la fiche Google Maps, le cas échéant. */
  urlMaps?: string
  /** Date de mise à jour (ISO), injectée par l'appelant. */
  dateMaj: string
}

/** Requête d'avis : le nom et la ville aident à identifier la bonne fiche. */
export interface RequeteAvis {
  etablissement: string
  ville?: string
}
