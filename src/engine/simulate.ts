import type {
  Domaine,
  Formation,
  ProfilEtudiant,
  ResultatSimulation,
} from '../types'
import { SPECIALITES_PAR_DOMAINE } from '../data/labels'

/**
 * Moteur de simulation du taux d'admission.
 *
 * L'estimation combine quatre sous-scores, chacun ramené sur 0-100 :
 *  - académique  : adéquation des notes avec les matières clés de la formation
 *  - passion     : correspondance entre les domaines aimés et le domaine visé
 *  - motivation  : motivation auto-évaluée et cohérence du projet
 *  - géographie  : proximité régionale (déterminante pour les licences de secteur)
 *
 * Ces sous-scores forment un « score d'adéquation » pondéré, qui module le
 * taux d'accès historique de la formation pour produire une probabilité.
 *
 * ⚠️ Il s'agit d'une estimation pédagogique, pas d'une prédiction officielle.
 */

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v))

/**
 * Pondération des sous-scores dans l'adéquation globale. La somme vaut 1, si
 * bien que l'adéquation reste sur 0-100.
 */
export interface Ponderation {
  academique: number
  specialites: number
  passion: number
  motivation: number
  geographie: number
}

// Profils de pondération selon la nature de la formation. Le poids de chaque
// critère n'a pas le même sens partout : une prépa scientifique se joue sur les
// notes et les spécialités, une licence non sélective sur le secteur
// géographique, une école d'art sur la passion et la motivation.

/** Licences non sélectives : priorité de secteur, notes moins discriminantes. */
const P_SECTEUR: Ponderation = {
  academique: 0.35,
  specialites: 0.1,
  passion: 0.15,
  motivation: 0.1,
  geographie: 0.3,
}
/** Filières scientifiques/techniques sélectives : notes + spécialités décisives. */
const P_SCIENTIFIQUE: Ponderation = {
  academique: 0.5,
  specialites: 0.22,
  passion: 0.12,
  motivation: 0.08,
  geographie: 0.08,
}
/** Arts, lettres, langues, communication, staps : passion et motivation renforcées. */
const P_CREATIF: Ponderation = {
  academique: 0.35,
  specialites: 0.15,
  passion: 0.25,
  motivation: 0.17,
  geographie: 0.08,
}
/** Commerce, économie, droit, social : équilibré, la motivation compte. */
const P_TERTIAIRE: Ponderation = {
  academique: 0.42,
  specialites: 0.15,
  passion: 0.15,
  motivation: 0.16,
  geographie: 0.12,
}

const FAMILLE: Record<Domaine, Ponderation> = {
  sciences: P_SCIENTIFIQUE,
  ingenieur: P_SCIENTIFIQUE,
  informatique: P_SCIENTIFIQUE,
  sante: P_SCIENTIFIQUE,
  arts: P_CREATIF,
  lettres: P_CREATIF,
  langues: P_CREATIF,
  communication: P_CREATIF,
  staps: P_CREATIF,
  commerce: P_TERTIAIRE,
  economie: P_TERTIAIRE,
  droit: P_TERTIAIRE,
  social: P_TERTIAIRE,
}

/**
 * Choisit la pondération adaptée à la formation : les licences non sélectives
 * privilégient le secteur géographique ; les formations sélectives suivent le
 * profil de leur domaine (scientifique, créatif, tertiaire).
 */
export function ponderation(formation: Formation): Ponderation {
  if (formation.selectivite === 'non-selective') return P_SECTEUR
  return FAMILLE[formation.domaine] ?? P_TERTIAIRE
}

/** Score académique : moyenne des notes pondérée par les matières clés (0-100). */
export function scoreAcademique(
  formation: Formation,
  profil: ProfilEtudiant,
): number {
  const entries = Object.entries(formation.matieresCles) as [
    keyof typeof formation.matieresCles,
    number,
  ][]

  let sommePoids = 0
  let sommeNotes = 0
  for (const [matiere, poids] of entries) {
    const note = profil.notes[matiere]
    if (typeof note === 'number') {
      sommeNotes += note * poids
      sommePoids += poids
    }
  }

  // Aucune matière clé renseignée : on retombe sur la moyenne générale saisie.
  if (sommePoids === 0) {
    const toutes = Object.values(profil.notes).filter(
      (n): n is number => typeof n === 'number',
    )
    if (toutes.length === 0) return 50 // neutre faute d'information
    const moyenne = toutes.reduce((a, b) => a + b, 0) / toutes.length
    return clamp((moyenne / 20) * 100)
  }

  const moyennePonderee = sommeNotes / sommePoids // sur 20
  return clamp((moyennePonderee / 20) * 100)
}

/**
 * Score spécialités : adéquation entre les spécialités choisies et celles
 * valorisées par la formation. Neutre (50) si aucune spécialité n'est indiquée.
 */
export function scoreSpecialites(
  formation: Formation,
  profil: ProfilEtudiant,
): number {
  if (profil.specialites.length === 0) return 50 // neutre
  const attendues = SPECIALITES_PAR_DOMAINE[formation.domaine] ?? []
  if (attendues.length === 0) return 50
  const communes = profil.specialites.filter((s) => attendues.includes(s)).length
  const ratio = communes / Math.min(3, attendues.length)
  // 0 correspondance → 25 ; toutes → 100.
  return clamp(25 + ratio * 75)
}

/** Score passion : 100 si le domaine visé fait partie des passions, sinon dégressif. */
export function scorePassion(
  formation: Formation,
  profil: ProfilEtudiant,
): number {
  if (profil.passions.length === 0) return 50 // neutre
  if (profil.passions.includes(formation.domaine)) return 100
  // Domaines proches : on accorde un bonus partiel.
  const proches: Record<string, string[]> = {
    informatique: ['sciences', 'ingenieur'],
    sciences: ['informatique', 'ingenieur', 'sante'],
    ingenieur: ['sciences', 'informatique'],
    sante: ['sciences'],
    commerce: ['economie'],
    economie: ['commerce'],
    lettres: ['langues', 'communication'],
    langues: ['lettres', 'communication'],
    communication: ['lettres', 'langues', 'arts'],
    social: ['sante'],
    arts: ['communication'],
  }
  const voisins = proches[formation.domaine] ?? []
  const aUnVoisin = profil.passions.some((p) => voisins.includes(p))
  return aUnVoisin ? 65 : 25
}

/** Score motivation : combine motivation auto-évaluée et cohérence du projet (0-100). */
export function scoreMotivation(profil: ProfilEtudiant): number {
  const motivation = clamp((profil.motivation / 10) * 100)
  const coherence = clamp((profil.coherenceProjet / 10) * 100)
  return clamp(motivation * 0.6 + coherence * 0.4)
}

/** Score géographie : bonus de secteur pour les formations non sélectives. */
export function scoreGeographie(
  formation: Formation,
  profil: ProfilEtudiant,
): number {
  // Ville explicitement souhaitée : meilleure adéquation géographique possible.
  const villes = profil.villes ?? []
  if (villes.length > 0) {
    const villeFormation = formation.ville.trim().toLowerCase()
    const souhaitee = villes.some((v) => v.trim().toLowerCase() === villeFormation)
    if (souhaitee) return 100
  }
  if (profil.region === null) return 60 // légèrement favorable par défaut
  const memeRegion = profil.region === formation.region
  if (memeRegion) return 100
  // Hors secteur : la mobilité limite la pénalité.
  if (profil.mobilite) return 70
  // Les licences non sélectives priorisent le secteur géographique : pénalité forte.
  return formation.selectivite === 'non-selective' ? 30 : 55
}

/**
 * Convertit le taux d'accès de base et le score d'adéquation en probabilité.
 *
 * Idée : un candidat « moyen » (adéquation ≈ 50) retrouve à peu près le taux
 * d'accès de base. Un excellent dossier tire la probabilité vers le haut, un
 * dossier faible la tire vers le bas, l'amplitude étant plus grande pour les
 * formations très sélectives.
 */
export function combinerProbabilite(
  tauxAccesBase: number,
  scoreAdequation: number,
): number {
  const ecart = (scoreAdequation - 50) / 50 // dans [-1, 1]
  // Amplitude d'ajustement : plus la formation est sélective, plus l'écart pèse.
  const amplitude = 40 + (100 - tauxAccesBase) * 0.5
  const proba = tauxAccesBase + ecart * amplitude
  return Math.round(clamp(proba, 1, 99))
}

/** Simule l'admission pour une formation donnée. */
export function simulerFormation(
  formation: Formation,
  profil: ProfilEtudiant,
): ResultatSimulation {
  const academique = Math.round(scoreAcademique(formation, profil))
  const specialites = Math.round(scoreSpecialites(formation, profil))
  const passion = Math.round(scorePassion(formation, profil))
  const motivation = Math.round(scoreMotivation(profil))
  const geographie = Math.round(scoreGeographie(formation, profil))

  // Pondération des sous-scores adaptée à la nature de la formation.
  const w = ponderation(formation)
  const scoreAdequation =
    academique * w.academique +
    specialites * w.specialites +
    passion * w.passion +
    motivation * w.motivation +
    geographie * w.geographie

  const probabilite = combinerProbabilite(
    formation.tauxAccesBase,
    scoreAdequation,
  )

  const explications: string[] = []
  if (academique >= 75)
    explications.push('Vos résultats dans les matières clés sont un vrai atout.')
  else if (academique < 45)
    explications.push(
      'Vos notes dans les matières déterminantes restent à consolider.',
    )
  if (specialites >= 85)
    explications.push('Vos spécialités correspondent bien aux attendus.')
  else if (profil.specialites.length > 0 && specialites <= 40)
    explications.push(
      'Vos spécialités sont peu alignées avec les attendus de cette formation.',
    )
  if (passion === 100)
    explications.push('La formation correspond pleinement à vos passions.')
  else if (passion <= 25)
    explications.push(
      "Ce domaine est éloigné des passions que vous avez indiquées.",
    )
  if (geographie === 100)
    explications.push('Formation dans votre région : priorité de secteur.')
  else if (geographie <= 30)
    explications.push(
      'Formation hors secteur sans mobilité : accès plus difficile.',
    )
  if (motivation >= 80)
    explications.push('Motivation et projet cohérents renforcent votre dossier.')

  return {
    formation,
    probabilite,
    adequation: Math.round(scoreAdequation),
    details: { academique, specialites, passion, motivation, geographie },
    explications,
  }
}

/** Simule toutes les formations et les trie par probabilité décroissante. */
export function simulerToutes(
  formations: Formation[],
  profil: ProfilEtudiant,
): ResultatSimulation[] {
  return formations
    .map((f) => simulerFormation(f, profil))
    .sort((a, b) => b.probabilite - a.probabilite)
}
