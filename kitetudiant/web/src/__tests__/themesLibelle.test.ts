/**
 * De l'intitulé d'une formation vers ses thèmes.
 *
 * Le piège que ce test garde est réel : une comparaison par sous-chaîne
 * range « transport » dans le thème « sport ». C'est arrivé en construisant
 * la table des métiers, sur ce mot-là exactement.
 */

import { describe, expect, it } from 'vitest'

import { themesDuLibelle } from '../themes.ts'

describe('les thèmes d’un intitulé', () => {
  it('ne confond pas « transport » avec « sport »', () => {
    expect(themesDuLibelle('BUT - Gestion logistique et transport')).not.toContain('sport')
    expect(themesDuLibelle('BUT - Gestion logistique et transport')).toContain('transport')
  })

  it('reconnaît un intitulé accentué comme un intitulé sans accent', () => {
    // Les intitulés du ministère mêlent les deux graphies.
    expect(themesDuLibelle('Licence - Génie électrique')).toEqual(
      themesDuLibelle('LICENCE - GENIE ELECTRIQUE'),
    )
  })

  it('rend plusieurs thèmes quand l’intitulé en porte plusieurs', () => {
    const t = themesDuLibelle('Licence - Droit et économie')
    expect(t).toContain('droit')
    expect(t).toContain('economie')
  })

  it('rend une liste vide plutôt que de deviner', () => {
    // Mieux vaut ne proposer aucun métier que d'en proposer au hasard.
    expect(themesDuLibelle('Formation')).toEqual([])
    expect(themesDuLibelle('')).toEqual([])
  })

  it('reconnaît les intitulés réels du jeu Parcoursup', () => {
    expect(themesDuLibelle('Licence - Informatique')).toContain('informatique')
    expect(themesDuLibelle('Formation d’ingénieur Bac + 5 - Bac Général')).toContain(
      'ingenierie',
    )
    expect(themesDuLibelle('Licence - Parcours d’Accès Spécifique Santé (PASS)')).toContain(
      'sante',
    )
  })
})
