import type { ResultatSimulation } from '../types'

/**
 * Mise en avant des formations les plus ADAPTÉES au profil de l'étudiant.
 *
 * Une formation « adaptée » n'est pas seulement celle où la probabilité est la
 * plus haute (sinon on ne proposerait que des formations peu sélectives que
 * tout le monde obtient). C'est celle qui **correspond au profil** — notes dans
 * les matières clés, spécialités, passions, région — **tout en restant
 * réellement accessible**.
 *
 * On combine donc :
 *  - l'adéquation (à quel point la formation colle au profil), et
 *  - un facteur de faisabilité (les chances réelles d'admission),
 * pour éviter de mettre en avant un « rêve » hors de portée comme une évidence.
 */

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v))

/**
 * Facteur de faisabilité dans [0,1] : neutre (1) dès que les chances sont
 * correctes (≥ 45 %), il décroît quand la formation devient hors de portée.
 */
export function faisabilite(probabilite: number): number {
  return clamp(probabilite / 45, 0, 1)
}

/**
 * Score de recommandation (0-100) : l'adéquation, modulée par la faisabilité.
 * Une formation parfaitement adaptée mais très difficile est atténuée ; une
 * formation facile mais peu adaptée ne remonte pas artificiellement.
 */
export function scoreRecommandation(r: ResultatSimulation): number {
  return Math.round(r.adequation * (0.55 + 0.45 * faisabilite(r.probabilite)))
}

/**
 * Raisons courtes expliquant pourquoi une formation est mise en avant, dérivées
 * des sous-scores. Sert de « badges » pédagogiques sous chaque recommandation.
 */
export function raisonsAdaptation(r: ResultatSimulation): string[] {
  const raisons: string[] = []
  const d = r.details
  if (d.academique >= 70) raisons.push('📈 Notes solides dans les matières clés')
  if (d.specialites >= 70) raisons.push('🧭 Spécialités alignées')
  if (d.passion >= 100) raisons.push('❤️ Correspond à ta passion')
  else if (d.passion >= 65) raisons.push('❤️ Proche de tes centres d’intérêt')
  if (d.geographie >= 100) raisons.push('📍 Dans ta région (priorité de secteur)')
  if (r.probabilite >= 60) raisons.push('✅ Bonnes chances d’admission')
  if (d.motivation >= 80) raisons.push('🔥 Projet motivé et cohérent')
  return raisons
}

export interface Recommandation {
  resultat: ResultatSimulation
  /** Score de recommandation (0-100). */
  score: number
  /** Badges expliquant l'adéquation. */
  raisons: string[]
}

/**
 * Renvoie les `n` formations les plus adaptées au profil, triées par pertinence.
 *
 * Un seuil d'adéquation minimal évite de « mettre en avant » des formations qui
 * ne correspondent pas vraiment (ex. profil sans aucune note dans le domaine).
 */
export function recommander(
  resultats: ResultatSimulation[],
  n = 3,
  adequationMin = 45,
): Recommandation[] {
  return resultats
    .filter((r) => r.adequation >= adequationMin)
    .map((r) => ({
      resultat: r,
      score: scoreRecommandation(r),
      raisons: raisonsAdaptation(r),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}
