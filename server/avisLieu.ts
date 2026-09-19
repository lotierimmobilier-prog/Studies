/**
 * Note publique du LIEU, pour KITETUDIANT.
 *
 * Ce n'est pas un avis sur la formation. C'est la note que le grand public a
 * donnée à l'adresse sur Google Maps : elle agrège des visiteurs, des parents,
 * des passants. KITETUDIANT travaille à la maille de la formation — 14 252
 * formations pour 4 058 établissements — et une même étoile couvrirait des
 * dizaines de formations très différentes.
 *
 * Elle est donc rendue avec tout ce qu'il faut pour la lire correctement :
 * l'attribution à Google, le nombre d'avis, la date de collecte, et une mise en
 * garde explicite. Elle n'entre dans aucun tri et dans aucun score — le module
 * M10 du cahier des charges interdit toute note globale d'établissement dans
 * les critères de décision, et la règle 5 de CLAUDE.md interdit d'agréger les
 * axes entre eux.
 *
 * Sans clé `GOOGLE_MAPS_API_KEY`, le service dit « indisponible » et rien ne
 * s'affiche. Aucune valeur de repli n'est inventée.
 */

import { join } from 'node:path'

import { obtenirAvis } from './avis'
import { CacheDisque } from './cache'
import type { AvisEcole } from './types'

/** Limite de conservation des données Places imposée par Google. */
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30

const cache = new CacheDisque<AvisEcole>(
  join(process.cwd(), '.cache', 'avis-lieu.json'),
  CACHE_TTL_MS,
)

export interface DemandeAvisLieu {
  /** Référence libre renvoyée telle quelle, pour réapparier côté appelant. */
  readonly ref: string
  readonly etablissement: string
  readonly ville?: string
}

export interface AvisLieu {
  readonly ref: string
  readonly note: number
  readonly nombreAvis: number
  readonly urlMaps: string | null
  readonly source: string
  readonly collecteLe: string
  /** À afficher telle quelle, à côté de la note. */
  readonly miseEnGarde: string
}

export interface AvisLieuIndisponible {
  readonly ref: string
  readonly raison: string
}

export type ResultatAvisLieu = AvisLieu | AvisLieuIndisponible

export function estIndisponible(r: ResultatAvisLieu): r is AvisLieuIndisponible {
  return 'raison' in r
}

const MISE_EN_GARDE =
  'Avis du grand public sur le lieu, pas sur la formation : ils agrègent des ' +
  'visiteurs et des passants, et la même note couvre toutes les formations de ' +
  'cette adresse.'

export async function chercherAvisLieux(
  demandes: readonly DemandeAvisLieu[],
): Promise<ResultatAvisLieu[]> {
  if (demandes.length === 0) return []
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return demandes.map((d) => ({
      ref: d.ref,
      raison: 'Avis du lieu non configurés sur ce serveur (clé Google Places absente).',
    }))
  }
  return Promise.all(
    demandes.map(async (d) => {
      const avis = await obtenirAvis(
        d.ville === undefined
          ? { etablissement: d.etablissement }
          : { etablissement: d.etablissement, ville: d.ville },
        { cache },
      )
      if (avis.source === 'indisponible' || avis.note === null || avis.nombreAvis === null) {
        return {
          ref: d.ref,
          raison: `Aucune fiche publique trouvée pour « ${d.etablissement} ».`,
        }
      }
      return {
        ref: d.ref,
        note: avis.note,
        nombreAvis: avis.nombreAvis,
        urlMaps: avis.urlMaps ?? null,
        source: 'Google Maps, via l’API Places',
        collecteLe: avis.dateMaj,
        miseEnGarde: MISE_EN_GARDE,
      }
    }),
  )
}
