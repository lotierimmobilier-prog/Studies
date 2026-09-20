/**
 * La table thème → domaines professionnels.
 *
 * Elle est notre choix éditorial, donc personne d'autre ne la vérifiera.
 * Ce qui est contrôlé ici : qu'aucun domaine n'ait été INVENTÉ, et qu'aucun
 * thème n'ait été oublié.
 *
 * La liste des domaines valides est relevée dans le référentiel de France
 * Travail et versionnée avec sa date : le test n'appelle donc aucune API, et
 * il reste reproductible dans dix ans. Le jour où le référentiel change, le
 * relevé se refait et la différence se voit dans le diff — ce qui est
 * exactement ce qu'on veut, plutôt qu'un test qui rougit au gré du réseau.
 */

import { describe, expect, it } from 'vitest'

import { THEMES_METIERS, dansLeDomaine, metiersDuTheme, themeMetiers } from '../index.ts'
import releve from './domaines-rome.json' with { type: 'json' }

const VALIDES = new Set(releve.domaines)

describe('la table des domaines', () => {
  it('ne cite aucun domaine qui n’existe pas', () => {
    const inventes: string[] = []
    for (const t of THEMES_METIERS) {
      for (const d of t.domaines) if (!VALIDES.has(d)) inventes.push(`${t.cle} → ${d}`)
    }
    expect(inventes, 'domaines absents du référentiel France Travail').toEqual([])
  })

  it('couvre les seize thèmes du site, sans doublon', () => {
    expect(THEMES_METIERS).toHaveLength(16)
    expect(new Set(THEMES_METIERS.map((t) => t.cle)).size).toBe(16)
  })

  it('dit toujours ce que le rapprochement vaut', () => {
    // Un thème sans note afficherait des métiers sans expliquer d'où ils
    // sortent — or ils sortent de nous, pas d'une donnée publiée.
    for (const t of THEMES_METIERS) {
      expect(t.note.length, `${t.cle} sans note`).toBeGreaterThan(20)
    }
  })

  it('n’a pas de domaine en double dans un même thème', () => {
    for (const t of THEMES_METIERS) {
      expect(new Set(t.domaines).size, `${t.cle}`).toBe(t.domaines.length)
    }
  })

  it('emploie des codes de domaine bien formés', () => {
    for (const t of THEMES_METIERS) {
      for (const d of t.domaines) expect(d, `${t.cle} → ${d}`).toMatch(/^[A-N]\d{2}$/)
    }
  })
})

describe('choisir les métiers d’un thème', () => {
  const referentiel = [
    { code: 'M1805', libelle: 'Développeur / Développeuse' },
    { code: 'M1810', libelle: 'Administrateur / Administratrice système' },
    { code: 'I1401', libelle: 'Conseiller / Conseillère en systèmes' },
    { code: 'J1502', libelle: 'Cadre de santé' },
    { code: 'A1203', libelle: 'Jardinier / Jardinière' },
  ]

  it('ne retient que les domaines du thème', () => {
    const codes = metiersDuTheme('informatique', referentiel).map((m) => m.code)
    expect(codes).toContain('M1805')
    expect(codes).toContain('I1401')
    expect(codes).not.toContain('J1502')
    expect(codes).not.toContain('A1203')
  })

  it('range par libellé, et pas dans l’ordre du référentiel', () => {
    // L'ordre du référentiel n'a aucun sens pour un lecteur, et un ordre
    // instable ferait changer la page à chaque rechargement.
    const libelles = metiersDuTheme('informatique', referentiel).map((m) => m.libelle)
    expect(libelles).toEqual([...libelles].sort((a, b) => a.localeCompare(b, 'fr')))
  })

  it('borne la liste : chaque métier coûte un appel à l’API', () => {
    const beaucoup = Array.from({ length: 40 }, (_, i) => ({
      code: `M18${String(i).padStart(2, '0')}`,
      libelle: `Métier ${String(i).padStart(2, '0')}`,
    }))
    expect(metiersDuTheme('informatique', beaucoup, 8)).toHaveLength(8)
  })

  it('traverse la liste au lieu d’en prendre le début', () => {
    /* Les huit premiers par ordre alphabétique donnaient, pour la santé,
       huit métiers en « A » et pas un médecin — sur la fiche d'une licence
       de médecine. L'échantillon doit atteindre la fin de la liste. */
    const beaucoup = Array.from({ length: 96 }, (_, i) => ({
      code: `M18${String(i).padStart(2, '0')}`,
      libelle: `Métier ${String(i).padStart(2, '0')}`,
    }))
    const choisis = metiersDuTheme('informatique', beaucoup, 8)
    const positions = choisis.map((m) => Number(m.libelle.slice(-2)))
    expect(positions[0]).toBe(0)
    expect(positions.at(-1)).toBeGreaterThan(80)
    // Régulièrement espacés, et jamais deux fois le même.
    expect(new Set(positions).size).toBe(8)
  })

  it('rend tout quand il y a moins de métiers que la borne', () => {
    const peu = [
      { code: 'M1801', libelle: 'B' },
      { code: 'M1802', libelle: 'A' },
    ]
    expect(metiersDuTheme('informatique', peu, 8).map((m) => m.libelle)).toEqual(['A', 'B'])
  })

  it('rend une liste vide pour un thème inconnu', () => {
    expect(metiersDuTheme('inexistant', referentiel)).toEqual([])
    expect(themeMetiers('inexistant')).toBeNull()
  })

  it('compare le domaine sur trois caractères, pas davantage', () => {
    expect(dansLeDomaine('M1805', 'M18')).toBe(true)
    expect(dansLeDomaine('M1905', 'M18')).toBe(false)
    expect(dansLeDomaine('M18', 'M18')).toBe(true)
  })
})
