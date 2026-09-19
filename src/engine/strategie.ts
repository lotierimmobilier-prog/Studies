import type { ResultatSimulation } from '../types'

/**
 * Catégorie stratégique d'un vœu, pour aider l'étudiant à constituer une
 * liste équilibrée (recommandation Parcoursup : mélanger des vœux ambitieux,
 * réalistes et des valeurs sûres plutôt que de tout miser sur un seul choix).
 */
export type CategorieStrategie = 'ambitieux' | 'realiste' | 'valeur-sure'

export interface GroupeStrategie {
  categorie: CategorieStrategie
  titre: string
  description: string
  emoji: string
  resultats: ResultatSimulation[]
}

/** Classe une probabilité dans une catégorie stratégique. */
export function categoriser(probabilite: number): CategorieStrategie {
  if (probabilite >= 65) return 'valeur-sure'
  if (probabilite >= 35) return 'realiste'
  return 'ambitieux'
}

/**
 * Regroupe les résultats en trois catégories stratégiques et propose plusieurs
 * choix par catégorie, afin que l'étudiant puisse formuler une liste de vœux
 * équilibrée : viser son projet « rêvé » tout en gardant des options sûres.
 */
export function construireStrategie(
  resultats: ResultatSimulation[],
  parCategorie = 3,
): GroupeStrategie[] {
  const groupes: Record<CategorieStrategie, ResultatSimulation[]> = {
    ambitieux: [],
    realiste: [],
    'valeur-sure': [],
  }

  for (const r of resultats) {
    groupes[categoriser(r.probabilite)].push(r)
  }

  const meta: Record<
    CategorieStrategie,
    { titre: string; description: string; emoji: string }
  > = {
    ambitieux: {
      titre: 'Vœux ambitieux',
      description:
        'Votre projet « rêvé » : chances plus faibles, mais à tenter si la formation vous motive vraiment.',
      emoji: '🎯',
    },
    realiste: {
      titre: 'Vœux réalistes',
      description:
        'Un bon équilibre entre vos chances et votre projet : le cœur de votre liste.',
      emoji: '✅',
    },
    'valeur-sure': {
      titre: 'Valeurs sûres',
      description:
        'Des formations où vos chances sont élevées : à inclure pour sécuriser votre orientation.',
      emoji: '🛡️',
    },
  }

  const ordre: CategorieStrategie[] = ['ambitieux', 'realiste', 'valeur-sure']

  return ordre
    .map((categorie) => ({
      categorie,
      ...meta[categorie],
      resultats: groupes[categorie].slice(0, parCategorie),
    }))
    .filter((g) => g.resultats.length > 0)
}
