import type { ProfilEtudiant, ResultatSimulation } from '../types'
import { LABELS_DOMAINE, LABELS_MATIERE, LABELS_SPECIALITE } from './labels'
import type { Matiere } from '../types'
import type { PrixFormation } from './prix'
import type { AnalyseBulletin } from './bulletin'

/**
 * Client du conseiller (backend). Récupère des conseils personnalisés — générés
 * par l'IA côté serveur si une clé est configurée, sinon par un moteur de règles.
 * En cas d'indisponibilité, retombe sur des conseils calculés localement.
 */

export interface Conseil {
  conseils: string[]
  source: 'ia' | 'regles' | 'local'
}

// Voir src/data/prix.ts : le préfixe API suit le sous-chemin de déploiement
// (import.meta.env.BASE_URL), pour fonctionner à la racine ou sous « /studies ».
const BASE = ((import.meta.env.VITE_PRIX_API ?? import.meta.env.BASE_URL ?? '') as string).replace(/\/$/, '')

/** Une réponse à une question de ciblage. */
export interface ReponseCiblage {
  question: string
  reponse: string
}

/** Prépare un résumé compact du profil pour le backend. */
function resumerProfil(
  profil: ProfilEtudiant,
  bulletin?: AnalyseBulletin | null,
  reponses?: ReponseCiblage[],
) {
  const notes = (Object.entries(profil.notes) as [Matiere, number][])
    .filter(([, v]) => typeof v === 'number')
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
    appreciation: bulletin?.appreciationGlobale,
    signaux: bulletin?.signaux,
    reponses: reponses && reponses.length > 0 ? reponses : undefined,
  }
}

/** Conseils de repli calculés dans le navigateur si le backend est injoignable. */
function conseilLocal(
  profil: ProfilEtudiant,
  resultats: ResultatSimulation[],
): string[] {
  const out: string[] = []
  const top = resultats[0]
  if (top)
    out.push(
      `Formation la mieux placée pour votre profil : ${top.formation.nom} à ${top.formation.ville} (${top.probabilite}%).`,
    )
  const sures = resultats.filter((r) => r.probabilite >= 65).length
  const ambitieux = resultats.filter((r) => r.probabilite < 35).length
  out.push(
    `Visez une liste équilibrée : ${ambitieux} vœu(x) ambitieux et ${sures} valeur(s) sûre(s).`,
  )
  if (!profil.mobilite && profil.region)
    out.push(
      `Sans mobilité, vos formations en ${profil.region} sont prioritaires pour vous.`,
    )
  return out
}

/** Récupère des conseils personnalisés depuis le backend. */
export async function chargerConseil(
  profil: ProfilEtudiant,
  resultats: ResultatSimulation[],
  prix: Map<string, PrixFormation>,
  bulletin?: AnalyseBulletin | null,
  reponses?: ReponseCiblage[],
  fetchImpl: typeof fetch = fetch,
): Promise<Conseil> {
  const formations = resultats.slice(0, 12).map((r) => ({
    nom: r.formation.nom,
    ville: r.formation.ville,
    domaine: LABELS_DOMAINE[r.formation.domaine],
    probabilite: r.probabilite,
    selectivite: r.formation.selectivite,
    prixAnnuel: prix.get(r.formation.id)?.prixAnnuel ?? null,
  }))

  try {
    const res = await fetchImpl(`${BASE}/api/conseil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profil: resumerProfil(profil, bulletin, reponses),
        formations,
      }),
    })
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as Conseil
  } catch {
    return { conseils: conseilLocal(profil, resultats), source: 'local' }
  }
}
