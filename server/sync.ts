import { analyserIcal, recupererIcal } from './ical'
import { configurationComplete, enregistrerConfiguration } from './config'
import type { Sejour } from './types'

/**
 * Synchronisation du planning : récupère les calendriers iCal configurés,
 * crée un séjour pour chaque nouvelle réservation (code généré automatiquement)
 * et met à jour les dates des réservations déjà importées. Aucun doublon grâce
 * au `sourceUid` de chaque réservation.
 */

export interface ResultatSync {
  ajouts: number
  misAJour: number
  /** Nombre total de réservations vues dans les calendriers. */
  vues: number
  erreurs: string[]
}

/** Mots « vacances » pour composer des codes lisibles. */
const MOTS = [
  'SOLEIL',
  'PLAGE',
  'OLIVIER',
  'MISTRAL',
  'LAVANDE',
  'CIGALE',
  'GARRIGUE',
  'ROMARIN',
  'FIGUIER',
  'CALANQUE',
  'AZUR',
  'PALMIER',
  'MIMOSA',
  'TERRASSE',
  'PISCINE',
  'PINEDE',
]

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/** Génère un code lisible et unique (parmi `existants`, en minuscule). */
function genererCode(uid: string, existants: Set<string>): string {
  const h = hash(uid)
  for (let t = 0; t < MOTS.length * 90; t++) {
    const mot = MOTS[(h + t) % MOTS.length]
    const num = (((h >> 3) + t) % 90) + 10
    const code = `${mot}${num}`
    if (!existants.has(code.toLowerCase())) {
      existants.add(code.toLowerCase())
      return code
    }
  }
  const secours = `SEJOUR${h % 10000}`
  existants.add(secours.toLowerCase())
  return secours
}

/** Devine la plateforme d'après le nom fourni ou l'URL du calendrier. */
function plateforme(nom: string | undefined, url: string): string {
  if (nom && nom.trim()) return nom.trim()
  if (/airbnb/i.test(url)) return 'Airbnb'
  if (/booking/i.test(url)) return 'Booking'
  if (/abritel|vrbo|homeaway/i.test(url)) return 'Abritel'
  return 'Réservation'
}

export async function synchroniser(): Promise<ResultatSync> {
  const config = configurationComplete()
  const resultat: ResultatSync = { ajouts: 0, misAJour: 0, vues: 0, erreurs: [] }

  const sejours: Sejour[] = [...config.sejours]
  const codesExistants = new Set(
    sejours.map((s) => s.code.trim().toLowerCase()).filter(Boolean),
  )
  const parUid = new Map<string, Sejour>()
  for (const s of sejours) if (s.sourceUid) parUid.set(s.sourceUid, s)

  for (const cal of config.calendriers) {
    if (!cal.url.trim()) continue
    try {
      const texte = await recupererIcal(cal.url)
      const evenements = analyserIcal(texte)
      const nom = plateforme(cal.nom, cal.url)
      for (const ev of evenements) {
        resultat.vues++
        const existant = parUid.get(ev.uid)
        if (existant) {
          // Met à jour les dates si la réservation a été modifiée.
          if (
            existant.arrivee !== ev.arrivee ||
            existant.depart !== ev.depart
          ) {
            existant.arrivee = ev.arrivee
            existant.depart = ev.depart
            resultat.misAJour++
          }
        } else {
          const nouveau: Sejour = {
            code: genererCode(ev.uid, codesExistants),
            nom: '',
            arrivee: ev.arrivee,
            depart: ev.depart,
            sourceUid: ev.uid,
            plateforme: nom,
          }
          sejours.push(nouveau)
          parUid.set(ev.uid, nouveau)
          resultat.ajouts++
        }
      }
    } catch (e) {
      resultat.erreurs.push(
        `${plateforme(cal.nom, cal.url)} : ${(e as Error).message}`,
      )
    }
  }

  if (resultat.ajouts > 0 || resultat.misAJour > 0) {
    await enregistrerConfiguration({ ...config, sejours })
  }
  return resultat
}
