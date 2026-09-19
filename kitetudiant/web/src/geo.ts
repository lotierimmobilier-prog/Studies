/**
 * Localisation de l'élève.
 *
 * Une position GPS est une donnée personnelle sensible, et nos utilisateurs
 * sont mineurs (règle 3 de CLAUDE.md). La conception en découle, et elle n'est
 * pas négociable :
 *
 *   - la position est demandée au navigateur, qui exige le consentement
 *     explicite de l'élève — nous ne la prenons jamais de force ;
 *   - elle N'EST JAMAIS ENVOYÉE NULLE PART. Ni à notre serveur, ni à un
 *     service de géocodage tiers. Le rapprochement avec une commune se fait
 *     entièrement dans le navigateur, à partir du jeu de communes déjà
 *     embarqué pour les loyers ;
 *   - elle n'est pas stockée : elle vit le temps du calcul, dans une variable.
 *
 * C'est pour cela que le fichier de communes porte désormais une latitude et
 * une longitude : sans elles, il faudrait envoyer la position à un service de
 * géocodage inverse, ce que nous refusons.
 *
 * Le refus de géolocalisation n'est pas une erreur. C'est un cas nominal, et
 * l'application doit continuer sans — l'élève a déjà indiqué son académie.
 */

import { communesPositionnees, type CommunePositionnee } from './donnees.ts'

/** Rayon moyen de la Terre, en kilomètres. */
const RAYON_TERRE_KM = 6371

export type Localisation =
  | { readonly etat: 'trouvee'; readonly codeInsee: string; readonly nom: string; readonly distanceKm: number }
  | { readonly etat: 'refusee' }
  | { readonly etat: 'indisponible'; readonly raison: string }

/**
 * Distance orthodromique entre deux points, en kilomètres (formule de
 * haversine). Suffisamment exacte à l'échelle de la France, et surtout sans
 * dépendance : elle sert à ordonner des villes, pas à naviguer.
 */
export function distanceKm(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const rad = (d: number): number => (d * Math.PI) / 180
  const dLat = rad(latB - latA)
  const dLon = rad(lonB - lonA)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Commune la plus proche d'une position, parmi celles du jeu embarqué.
 * Renvoie null si le jeu est vide — jamais une commune arbitraire.
 */
export function communeLaPlusProche(
  lat: number,
  lon: number,
  communes: readonly CommunePositionnee[] = communesPositionnees(),
): { readonly codeInsee: string; readonly nom: string; readonly distanceKm: number } | null {
  let meilleure: CommunePositionnee | null = null
  let meilleureDistance = Number.POSITIVE_INFINITY
  for (const c of communes) {
    const d = distanceKm(lat, lon, c.lat, c.lon)
    if (d < meilleureDistance) {
      meilleureDistance = d
      meilleure = c
    }
  }
  if (meilleure === null) return null
  return {
    codeInsee: meilleure.codeInsee,
    nom: meilleure.nom,
    distanceKm: Math.round(meilleureDistance),
  }
}

/**
 * Demande la position au navigateur et la rapproche d'une commune, sur place.
 *
 * `geolocation` est délibérément passé en paramètre : c'est ce qui rend cette
 * fonction testable sans navigateur, et vérifiable — on peut prouver qu'aucun
 * appel réseau n'en sort.
 */
export async function localiser(
  geolocation: Geolocation | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.geolocation,
  communes: readonly CommunePositionnee[] = communesPositionnees(),
): Promise<Localisation> {
  if (!geolocation) {
    return { etat: 'indisponible', raison: 'Ce navigateur ne sait pas donner ta position.' }
  }
  const position = await new Promise<GeolocationPosition | GeolocationPositionError>((resoudre) => {
    geolocation.getCurrentPosition(resoudre, resoudre, {
      enableHighAccuracy: false, // la commune suffit : inutile de viser le mètre
      timeout: 10_000,
      maximumAge: 5 * 60 * 1000,
    })
  })

  if (!('coords' in position)) {
    // 1 = PERMISSION_DENIED. Un refus n'est pas une panne : on le distingue
    // pour ne pas afficher un message d'erreur à qui a simplement dit non.
    if (position.code === 1) return { etat: 'refusee' }
    return {
      etat: 'indisponible',
      raison: 'Ta position n’a pas pu être déterminée.',
    }
  }

  const proche = communeLaPlusProche(position.coords.latitude, position.coords.longitude, communes)
  if (proche === null) {
    return { etat: 'indisponible', raison: 'Aucune commune de référence à comparer.' }
  }
  return { etat: 'trouvee', ...proche }
}
