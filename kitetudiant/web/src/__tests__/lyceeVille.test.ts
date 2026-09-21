/**
 * La ville d'un lycée dans les propositions.
 *
 * « Lycée Jean-Moulin » existe dans une dizaine de communes : sans la ville,
 * la liste demandait à l'élève de reconnaître le sien à son code UAI.
 *
 * L'open data publie tout en capitales. Le remettre en casse française est la
 * seule transformation admise ici : on ne restitue pas les accents que la
 * source n'écrit pas.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { casseDeLieu, chercherLycees } from '../lycees.ts'

const SRC = resolve(__dirname, '..')

describe('la casse d’un nom de lieu', () => {
  it.each([
    ['CARCASSONNE', 'Carcassonne'],
    ['AUDE', 'Aude'],
    ['LE HAVRE', 'Le Havre'],
    ['SAINT-ETIENNE-DU-ROUVRAY', 'Saint-Etienne-du-Rouvray'],
    ['AIX-EN-PROVENCE', 'Aix-en-Provence'],
    ['BOULOGNE-SUR-MER', 'Boulogne-sur-Mer'],
    ["VILLENEUVE-D'ASCQ", "Villeneuve-d'Ascq"],
    ['VAL-DE-MARNE', 'Val-de-Marne'],
    ['SEINE-MARITIME', 'Seine-Maritime'],
  ])('%s → %s', (brut, attendu) => {
    expect(casseDeLieu(brut)).toBe(attendu)
  })

  it('laisse une chaîne vide vide, sans inventer de tiret', () => {
    expect(casseDeLieu('')).toBe('')
    expect(casseDeLieu('   ')).toBe('')
  })

  it('n’ajoute jamais d’accent que la source n’écrit pas', () => {
    // « NIMES » reste « Nimes » : mettre « Nîmes » serait réécrire la donnée.
    expect(casseDeLieu('NIMES')).toBe('Nimes')
    expect(casseDeLieu('BEZIERS')).toBe('Beziers')
  })

  it('garde la majuscule du premier mot même s’il est dans la liste basse', () => {
    expect(casseDeLieu('LA ROCHELLE')).toBe('La Rochelle')
    expect(casseDeLieu('LES MUREAUX')).toBe('Les Mureaux')
  })
})

describe('la recherche de lycées', () => {
  const LIGNE = {
    code_etablissement: '0110007Y',
    etablissement: 'LYCEE JULES FIL (GENERAL ET TECHNO.)',
    commune: '11069',
    ville: 'CARCASSONNE',
    departement: 'AUDE',
    annee: '2023',
  }

  function faux(reponse: unknown): typeof fetch {
    return (async () =>
      new Response(JSON.stringify(reponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch
  }

  it('demande la ville et le département à l’open data', async () => {
    let vue = ''
    const espion = (async (url: string) => {
      vue = String(url)
      return new Response(JSON.stringify({ results: [LIGNE] }), { status: 200 })
    }) as unknown as typeof fetch
    await chercherLycees('jules fil', espion)
    const champs = decodeURIComponent(vue)
    expect(champs).toContain('ville')
    expect(champs).toContain('departement')
  })

  it('rend la ville en casse lisible', async () => {
    const [l] = await chercherLycees('jules fil', faux({ results: [LIGNE] }))
    expect(l?.ville).toBe('Carcassonne')
    expect(l?.departement).toBe('Aude')
    // Le code INSEE reste la clé pivot : il ne disparaît pas.
    expect(l?.commune).toBe('11069')
  })

  it('rend une ville vide plutôt qu’un repli, quand le jeu ne la publie pas', async () => {
    const sansVille = { ...LIGNE, ville: null, departement: undefined }
    const [l] = await chercherLycees('jules fil', faux({ results: [sansVille] }))
    expect(l?.ville).toBe('')
    expect(l?.departement).toBe('')
  })
})

describe('l’affichage d’une proposition', () => {
  const source = readFileSync(resolve(SRC, 'monLycee.tsx'), 'utf8')

  it('montre la ville, et le département pour départager les homonymes', () => {
    expect(source).toContain('l.ville')
    expect(source).toContain('l.departement')
  })

  it('n’écrit rien quand la ville manque', () => {
    // Un « · (…) » vide se lirait comme une donnée perdue.
    expect(source).toMatch(/l\.ville !== ''/)
    expect(source).toMatch(/l\.departement !== ''/)
  })

  it('garde l’UAI, la clé pivot', () => {
    expect(source).toContain('UAI {l.uai}')
  })
})
