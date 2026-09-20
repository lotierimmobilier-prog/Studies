import { describe, expect, it, vi } from 'vitest'

import {
  OPTIONS,
  SPECIALITES,
  doublettesAdmises,
  libelleDe,
} from '../specialites.ts'

function reponse(resultats: unknown[]): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ results: resultats }), { status: 200 }),
  ) as unknown as typeof fetch
}

describe('catalogue', () => {
  it('liste les treize spécialités du bac général', () => {
    expect(SPECIALITES).toHaveLength(13)
    const cles = SPECIALITES.map((s) => s.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it('donne à chacune un nom complet, pour qui ne connaît pas le sigle', () => {
    // « HGGSP » ne dit rien à un parent. Le sigle sert à l'élève, le nom
    // complet sert à l'infobulle et au lecteur d'écran.
    for (const s of [...SPECIALITES, ...OPTIONS]) {
      expect(s.complet.length, s.cle).toBeGreaterThan(s.libelle.length - 1)
      expect(s.libelle.trim(), s.cle).not.toBe('')
    }
  })

  it('n’emploie aucune clé deux fois, options comprises', () => {
    // Spécialités et options se mélangent dans les réponses de l'élève : une
    // clé partagée rendrait « arts » ambigu entre la spécialité et l'option.
    const toutes = [...SPECIALITES, ...OPTIONS].map((s) => s.cle)
    expect(new Set(toutes).size).toBe(toutes.length)
  })

  it('retrouve un libellé, et rend la clé quand elle est inconnue', () => {
    expect(libelleDe('hggsp')).toBe('HGGSP')
    expect(libelleDe('maths-expertes')).toBe('Maths expertes')
    // Pas de repli silencieux sur « Autre » : une clé inconnue se voit.
    expect(libelleDe('inventee')).toBe('inventee')
  })
})

describe('doublettes des admis', () => {
  const LIGNES = [
    { annee_du_bac: '2024', doublette: ['Mathématiques Spécialité', 'Physique-Chimie Spécialité'], acceptations: 60 },
    { annee_du_bac: '2024', doublette: ['Mathématiques Spécialité', 'SVT Spécialité'], acceptations: 40 },
    { annee_du_bac: '2023', doublette: ['Arts', 'Arts'], acceptations: 500 },
  ]

  it('ne retient que le millésime le plus récent', async () => {
    // Mélanger deux sessions ferait des parts qui ne veulent rien dire, et
    // l'écran ne pourrait plus dater ce qu'il affiche (règle 6).
    const d = await doublettesAdmises('Licence', reponse(LIGNES))
    expect(d).toHaveLength(2)
    expect(d.every((x) => x.annee === '2024')).toBe(true)
  })

  it('calcule les parts sur ce millésime seul', async () => {
    const d = await doublettesAdmises('Licence', reponse(LIGNES))
    expect(d[0]!.pourcentage).toBe(60)
    expect(d[1]!.pourcentage).toBe(40)
  })

  it('allège le mot « Spécialité », répété sur chaque ligne', async () => {
    const d = await doublettesAdmises('Licence', reponse(LIGNES))
    expect(d[0]!.specialites).toEqual(['Mathématiques', 'Physique-Chimie'])
  })

  it('rend une liste vide plutôt que d’inventer', async () => {
    expect(await doublettesAdmises('Licence', reponse([]))).toEqual([])
    // Une famille trop courte ne déclenche même pas d'appel.
    const faux = reponse(LIGNES)
    expect(await doublettesAdmises('a', faux)).toEqual([])
    expect(faux).not.toHaveBeenCalled()
  })

  it('porte toujours son millésime', async () => {
    const d = await doublettesAdmises('Licence', reponse(LIGNES))
    for (const x of d) expect(x.annee).toMatch(/^\d{4}$/)
  })
})
