import { describe, it, expect } from 'vitest'

import { communeLisible, departementDe, nomCommune } from '../communes.ts'

/**
 * Les communes, nommées plutôt que codées.
 *
 * Les relevés du simulateur portent des codes INSEE — c'est la clé pivot du
 * projet, et elle ne bouge pas quand un nom change. Mais « 87085 » ne dit
 * rien à qui lit un tableau de statistiques.
 */

describe('le département se lit dans le code', () => {
  it('tient en deux caractères en métropole', () => {
    expect(departementDe('87085')).toBe('87')
    expect(departementDe('75101')).toBe('75')
  })

  it('en prend trois outre-mer', () => {
    /* Couper à deux donnerait « 97 » pour la Guadeloupe, la Martinique, la
       Guyane, La Réunion et Mayotte : le département ne distinguerait plus
       rien, ce qui est exactement ce qu'on lui demande de faire. */
    expect(departementDe('97411')).toBe('974')
    expect(departementDe('97105')).toBe('971')
    expect(departementDe('98611')).toBe('986')
  })

  it('laisse la Corse à deux', () => {
    expect(departementDe('2A004')).toBe('2A')
    expect(departementDe('2B033')).toBe('2B')
  })
})

describe('une commune se lit par son nom', () => {
  it('rend le nom et son département', () => {
    expect(communeLisible('87085')).toBe('Limoges (87)')
  })

  it('distingue les homonymes', () => {
    /* Sept noms sont portés par deux communes dans cette table — Valence,
       Saint-Denis, Sainte-Marie, Saint-Pierre. « Sainte-Marie » seul, dans un
       tableau, ne dit pas s'il s'agit de la Martinique ou de La Réunion, et
       les deux lignes se confondraient. */
    const martinique = communeLisible('97230')
    const reunion = communeLisible('97418')
    expect(martinique).toContain('(972)')
    expect(reunion).toContain('(974)')
    expect(martinique).not.toBe(reunion)
  })

  it('rend le code brut quand elle ne connaît pas', () => {
    /* La table ne porte que les communes dont un loyer est publié : 1 246
       sur trente-cinq mille. Un village n'y est pas, et inventer un nom
       approchant ferait perdre la seule information dont on dispose. */
    expect(nomCommune('99999')).toBeNull()
    expect(communeLisible('99999')).toBe('99999')
  })

  it('ne rend jamais une chaîne vide', () => {
    // Une ligne de statistiques sans libellé serait une barre sans nom.
    for (const code of ['87085', '99999', '2A004', '', '   ']) {
      expect(communeLisible(code).length, `code ${JSON.stringify(code)}`).toBeGreaterThan(0)
    }
  })
})
