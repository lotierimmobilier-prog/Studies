/** Petits utilitaires de formatage et de compte à rebours pour le séjour. */

const JOUR_MS = 1000 * 60 * 60 * 24

/** Formate une date ISO en français long, ex. « samedi 25 juillet 2026 ». */
export function formaterDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Formate l'heure, ex. « 16h00 ». */
export function formaterHeure(iso: string): string {
  const d = new Date(iso)
  return d
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h')
}

/** Nombre de jours entiers entre aujourd'hui (minuit) et une date. */
function joursJusqua(iso: string, maintenant = new Date()): number {
  const cible = new Date(iso)
  const aMinuit = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
  )
  const cibleMinuit = new Date(
    cible.getFullYear(),
    cible.getMonth(),
    cible.getDate(),
  )
  return Math.round((cibleMinuit.getTime() - aMinuit.getTime()) / JOUR_MS)
}

export type EtatSejour =
  | { phase: 'avant'; jours: number }
  | { phase: 'pendant'; joursRestants: number }
  | { phase: 'apres' }

/** Détermine où l'on en est du séjour (avant / pendant / après). */
export function etatSejour(
  arrivee: string,
  depart: string,
  maintenant = new Date(),
): EtatSejour {
  const versArrivee = joursJusqua(arrivee, maintenant)
  const versDepart = joursJusqua(depart, maintenant)
  if (versArrivee > 0) return { phase: 'avant', jours: versArrivee }
  if (versDepart >= 0) return { phase: 'pendant', joursRestants: versDepart }
  return { phase: 'apres' }
}
