/**
 * Le tri et les filtres touchent à la règle 4 de CLAUDE.md — « aucun vœu
 * n'est jamais masqué ou retiré » — et à la règle 5 — « les trois scores
 * restent séparés ». Ces tests tiennent la frontière.
 */
import { describe, expect, it } from 'vitest'

import {
  CLASSEMENTS,
  SANS_FILTRE,
  aucunFiltre,
  classer,
  comptesParSecteur,
  filtrer,
  secteurDe,
  villesDe,
} from '../tri.ts'
import type { ResultatFormation } from '../calcul.ts'

function resultat(
  id: string,
  ville: string,
  statut: string | null,
  rav: number | null,
  tauxAcces: number | null,
): ResultatFormation {
  return {
    formation: { id, ville, statutEtablissement: statut, tauxAcces },
    parScenario: {
      central: { ravMensuel: rav ?? 0, postesManquants: rav === null ? ['loyer_net'] : [] },
    },
  } as unknown as ResultatFormation
}

const LISTE = [
  resultat('a', 'Toulouse', 'Public', 420, 59),
  resultat('b', 'Nancy', 'Privé sous contrat d’association', 180, 92),
  resultat('c', 'Limoges', null, null, null),
  resultat('d', 'Amiens', 'Privé hors contrat', 610, 31),
]

describe('classer', () => {
  it('laisse l’ordre du calcul intact pour « ce qui te correspond »', () => {
    // Cet ordre est produit en deux temps par le calcul — affinité puis
    // reste-à-vivre, jamais additionnés (règle 5). On ne le refait pas ici.
    expect(classer(LISTE, 'pertinence').map((r) => r.formation.id)).toEqual([
      'a', 'b', 'c', 'd',
    ])
  })

  it('ne modifie jamais la liste qu’on lui donne', () => {
    const avant = LISTE.map((r) => r.formation.id)
    classer(LISTE, 'reste')
    expect(LISTE.map((r) => r.formation.id)).toEqual(avant)
  })

  it('classe par reste-à-vivre décroissant', () => {
    expect(classer(LISTE, 'reste').map((r) => r.formation.id)).toEqual([
      'd', 'a', 'b', 'c',
    ])
  })

  it('range un reste-à-vivre manquant À LA FIN, jamais comme un zéro', () => {
    // « Inconnu » n'est pas « le plus pauvre ». Le ranger comme un zéro
    // reviendrait à inventer un montant, ce que la règle 1 interdit.
    const classe = classer(LISTE, 'reste')
    expect(classe[classe.length - 1]!.formation.id).toBe('c')
  })

  it('classe par taux d’accès, manquants à la fin', () => {
    expect(classer(LISTE, 'chances').map((r) => r.formation.id)).toEqual([
      'b', 'a', 'd', 'c',
    ])
  })

  it('classe les villes à la française, accents compris', () => {
    const villes = classer(LISTE, 'ville').map((r) => r.formation.ville)
    expect(villes).toEqual(['Amiens', 'Limoges', 'Nancy', 'Toulouse'])
  })

  it('propose un libellé pour chaque classement, et pas de doublon', () => {
    const cles = CLASSEMENTS.map((c) => c.cle)
    expect(new Set(cles).size).toBe(cles.length)
    for (const c of CLASSEMENTS) expect(c.libelle.length).toBeGreaterThan(0)
  })
})

describe('secteurDe', () => {
  it('reconnaît les quatre statuts publiés par le ministère', () => {
    expect(secteurDe('Public')).toBe('public')
    expect(secteurDe('Privé sous contrat d’association')).toBe('prive')
    expect(secteurDe('Privé enseignement supérieur')).toBe('prive')
    expect(secteurDe('Privé hors contrat')).toBe('prive')
  })

  it('ne range PAS un statut absent dans le public', () => {
    // La différence de coût entre public et privé se compte en milliers
    // d'euros par an. Deviner ici tromperait sur un montant.
    expect(secteurDe(null)).toBeNull()
    expect(secteurDe('')).toBeNull()
    expect(secteurDe('Sous tutelle du ministère de l’agriculture')).toBeNull()
  })
})

describe('filtrer — règle 4 : rien n’est retiré de la vue', () => {
  it('rend deux listes, et leur somme fait toujours le tout', () => {
    for (const filtres of [
      SANS_FILTRE,
      { secteur: 'public' as const, ville: null },
      { secteur: null, ville: 'Nancy' },
      { secteur: 'prive' as const, ville: 'Nancy' },
    ]) {
      const { retenus, ecartes } = filtrer(LISTE, filtres)
      expect(retenus.length + ecartes.length).toBe(LISTE.length)
    }
  })

  it('n’écarte rien quand aucun filtre n’est posé', () => {
    expect(filtrer(LISTE, SANS_FILTRE).ecartes).toEqual([])
    expect(aucunFiltre(SANS_FILTRE)).toBe(true)
  })

  it('garde une formation au statut inconnu, quel que soit le secteur demandé', () => {
    // L'élève a demandé « public », pas « tout sauf ce dont on ne sait rien ».
    // Écarter l'inconnu transformerait une donnée manquante en réponse
    // négative — exactement ce que CLAUDE.md interdit.
    for (const secteur of ['public', 'prive'] as const) {
      const { retenus } = filtrer(LISTE, { secteur, ville: null })
      expect(retenus.map((r) => r.formation.id)).toContain('c')
    }
  })

  it('filtre sur le secteur demandé', () => {
    expect(
      filtrer(LISTE, { secteur: 'public', ville: null }).retenus.map((r) => r.formation.id),
    ).toEqual(['a', 'c'])
    expect(
      filtrer(LISTE, { secteur: 'prive', ville: null }).retenus.map((r) => r.formation.id),
    ).toEqual(['b', 'c', 'd'])
  })

  it('filtre sur la ville exacte', () => {
    const { retenus, ecartes } = filtrer(LISTE, { secteur: null, ville: 'Nancy' })
    expect(retenus.map((r) => r.formation.id)).toEqual(['b'])
    expect(ecartes).toHaveLength(3)
  })
})

describe('ce qu’on propose à l’élève', () => {
  it('liste les villes présentes, sans doublon et classées', () => {
    expect(villesDe([...LISTE, resultat('e', 'Nancy', 'Public', 200, 50)])).toEqual([
      'Amiens', 'Limoges', 'Nancy', 'Toulouse',
    ])
  })

  it('compte les formations par secteur, l’inconnu compris', () => {
    // L'inconnu est compté à part : le taire laisserait croire que le jeu de
    // données est complet.
    expect(comptesParSecteur(LISTE)).toEqual({ public: 1, prive: 2, inconnu: 1 })
  })
})
