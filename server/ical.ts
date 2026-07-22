/**
 * Lecture de calendriers iCal (.ics) — standard exporté par Airbnb, Booking,
 * Abritel/VRBO, etc. On en extrait les périodes réservées (arrivée / départ).
 *
 * Sans dépendance : un mini-parseur suffit pour les VEVENT de ces plateformes.
 */

export interface EvenementReserve {
  /** UID unique de la réservation (stable entre deux synchronisations). */
  uid: string
  /** Arrivée au format ISO local « YYYY-MM-DDTHH:mm ». */
  arrivee: string
  /** Départ au format ISO local « YYYY-MM-DDTHH:mm ». */
  depart: string
  /** Résumé de l'événement (ex. « Reserved »). */
  resume: string
}

/** Heures d'arrivée / départ par défaut pour les réservations « journée entière ». */
const HEURE_ARRIVEE = '16:00'
const HEURE_DEPART = '10:00'

/** Événements à ignorer (blocages manuels, indisponibilités — pas des voyageurs). */
const IGNORER = /not available|unavailable|blocked|indisponible|bloqu|closed/i

/** Déplie les lignes iCal (repli RFC 5545 : retour + espace/tabulation). */
function deplier(texte: string): string[] {
  return texte
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
}

/**
 * Convertit une valeur de date iCal en « YYYY-MM-DDTHH:mm » (heure locale).
 * Gère les dates seules (`20260725`) et les date-heures (`20260725T160000Z`).
 */
function versIso(valeur: string, heureDefaut: string): string | null {
  const v = valeur.trim()
  const dateSeule = v.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateSeule) {
    const [, y, m, d] = dateSeule
    return `${y}-${m}-${d}T${heureDefaut}`
  }
  const dateHeure = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/)
  if (dateHeure) {
    const [, y, m, d, hh, mm] = dateHeure
    return `${y}-${m}-${d}T${hh}:${mm}`
  }
  return null
}

/** Analyse un texte iCal et renvoie la liste des réservations (hors blocages). */
export function analyserIcal(texte: string): EvenementReserve[] {
  const lignes = deplier(texte)
  const evenements: EvenementReserve[] = []

  let dans = false
  let cur: Record<string, string> = {}

  for (const ligne of lignes) {
    if (ligne === 'BEGIN:VEVENT') {
      dans = true
      cur = {}
      continue
    }
    if (ligne === 'END:VEVENT') {
      dans = false
      const arrivee = cur.DTSTART ? versIso(cur.DTSTART, HEURE_ARRIVEE) : null
      const depart = cur.DTEND ? versIso(cur.DTEND, HEURE_DEPART) : null
      const resume = cur.SUMMARY ?? ''
      if (arrivee && depart && !IGNORER.test(resume)) {
        evenements.push({
          uid: cur.UID || `${cur.DTSTART}_${cur.DTEND}`,
          arrivee,
          depart,
          resume,
        })
      }
      continue
    }
    if (!dans) continue

    // Nom de propriété = avant le premier « ; » ou « : » ; valeur = après « : ».
    const sep = ligne.indexOf(':')
    if (sep === -1) continue
    const avant = ligne.slice(0, sep)
    const valeur = ligne.slice(sep + 1)
    const nom = avant.split(';')[0].toUpperCase()
    if (nom === 'DTSTART' || nom === 'DTEND' || nom === 'UID' || nom === 'SUMMARY') {
      cur[nom] = valeur
    }
  }

  return evenements
}

/** Récupère le contenu iCal à une URL (avec délai maximal). */
export async function recupererIcal(url: string): Promise<string> {
  const ctrl = new AbortController()
  const minuteur = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'PortailVoyageurs/1.0' },
    })
    if (!res.ok) throw new Error(`Calendrier inaccessible (HTTP ${res.status}).`)
    return await res.text()
  } finally {
    clearTimeout(minuteur)
  }
}
