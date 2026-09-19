import type { ProfilEtudiant, ResultatSimulation } from '../types'
import { LABELS_DOMAINE, LABELS_MATIERE, LABELS_SPECIALITE } from './labels'
import type { Matiere } from '../types'

/**
 * Client des questions de ciblage : le backend (IA ou règles) renvoie 3-4
 * questions à choix multiple pour affiner le projet. Repli sur un jeu local si
 * le serveur est indisponible.
 */

export interface QuestionCiblage {
  id: string
  question: string
  options: string[]
}

const BASE = ((import.meta.env.VITE_PRIX_API ?? import.meta.env.BASE_URL ?? '') as string).replace(/\/$/, '')

function resumerProfil(profil: ProfilEtudiant) {
  const exclues = new Set(profil.matieresExclues)
  const notes = (Object.entries(profil.notes) as [Matiere, number][])
    .filter(([m, v]) => typeof v === 'number' && !exclues.has(m))
    .sort((a, b) => b[1] - a[1])
  return {
    classe: profil.classe,
    souhaits: profil.souhaits,
    specialites: profil.specialites.map((s) => LABELS_SPECIALITE[s]),
    meilleuresMatieres: notes.slice(0, 3).map(([m]) => LABELS_MATIERE[m]),
    region: profil.region,
    villes: profil.villes,
    mobilite: profil.mobilite,
    passions: profil.passions.map((p) => LABELS_DOMAINE[p]),
    motivation: profil.motivation,
    coherenceProjet: profil.coherenceProjet,
  }
}

/** Jeu de questions de repli si le backend est injoignable. */
function questionsLocales(profil: ProfilEtudiant): QuestionCiblage[] {
  if (profil.classe === 'seconde') {
    return [
      {
        id: 'seconde_direction',
        question: 'Vers quel type d’études te vois-tu plutôt aller ?',
        options: ['Scientifique / technique', 'Économie / droit / commerce', 'Lettres / langues / arts', 'Indécis·e'],
      },
      {
        id: 'seconde_horizon',
        question: 'Ce qui compte le plus pour toi à terme :',
        options: ['Un métier précis', 'Garder des portes ouvertes', 'Suivre ma passion'],
      },
    ]
  }
  return [
    {
      id: 'type_cursus',
      question: 'Quel type de cursus te correspond le mieux ?',
      options: ['Court et pro (BTS/BUT)', 'Long et théorique (licence/prépa)', 'Peu importe'],
    },
    {
      id: 'priorite',
      question: 'Ta priorité n°1 dans ce choix :',
      options: ['Débouchés / emploi', 'Passion / matière', 'Proximité', 'Coût'],
    },
    {
      id: 'alternance',
      question: 'L’alternance t’intéresse ?',
      options: ['Oui', 'Plutôt non', 'À voir'],
    },
  ]
}

export async function chargerQuestions(
  profil: ProfilEtudiant,
  resultats: ResultatSimulation[],
  fetchImpl: typeof fetch = fetch,
): Promise<QuestionCiblage[]> {
  const formations = resultats.slice(0, 8).map((r) => ({
    nom: r.formation.nom,
    ville: r.formation.ville,
    domaine: LABELS_DOMAINE[r.formation.domaine],
    probabilite: r.probabilite,
    selectivite: r.formation.selectivite,
    prixAnnuel: null,
  }))
  try {
    const res = await fetchImpl(`${BASE}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profil: resumerProfil(profil), formations }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { questions: QuestionCiblage[] }
    if (!data.questions?.length) throw new Error('vide')
    return data.questions
  } catch {
    return questionsLocales(profil)
  }
}
