/**
 * Les thèmes ne sont PAS une nomenclature du ministère : c'est notre
 * regroupement, et ces tests tiennent les propriétés qui le rendent
 * défendable — pas de doublon, pas de thème vide, des libellés qui n'ont pas
 * l'air officiels.
 */
import { describe, expect, it } from 'vitest'

import { THEMES, motsDuTheme } from '../themes.ts'

describe('catalogue des thèmes', () => {
  it('ne contient aucune clé en double', () => {
    const cles = THEMES.map((t) => t.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it('donne à chaque thème au moins un mot à chercher', () => {
    // Un thème sans mot ne chercherait rien et rendrait une liste vide que
    // l'élève prendrait pour « il n'y a rien à cette adresse ».
    for (const t of THEMES) {
      expect(t.mots.length, t.cle).toBeGreaterThan(0)
      for (const m of t.mots) expect(m.trim(), t.cle).not.toBe('')
    }
  })

  it('emploie des clés utilisables dans une adresse', () => {
    for (const t of THEMES) expect(t.cle).toMatch(/^[a-z]+$/)
  })

  it('rend une liste vide, et pas une erreur, pour une clé inconnue', () => {
    // « Tous les thèmes » passe la chaîne vide : elle doit se comporter comme
    // une absence de filtre, pas comme un filtre qui ne trouve rien.
    expect(motsDuTheme('')).toEqual([])
    expect(motsDuTheme('inexistant')).toEqual([])
  })

  it('retrouve les mots d’un thème connu', () => {
    expect(motsDuTheme('droit')).toContain('droit')
    expect(motsDuTheme('sport')).toContain('STAPS')
  })
})
