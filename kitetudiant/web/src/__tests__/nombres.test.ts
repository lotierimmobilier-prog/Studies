import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { euros, eurosPrecis, FINE_INSECABLE, INSECABLE, lisible, nombre } from '../nombres.ts'

const SRC = resolve(import.meta.dirname, '..')
/* Le moteur écrit lui aussi du texte lu par l'élève — le champ `hypothese`
   de chaque ligne de budget. Il est donc balayé par le même garde-fou. */
const MOTEUR = resolve(import.meta.dirname, '..', '..', '..', 'packages')

describe('mise en forme des nombres', () => {
  it('sépare les milliers par une espace que toute police sait rendre', () => {
    // L'espace fine insécable de la locale française (U+202F) est rendue deux
    // fois plus étroite par Poppins que par la police du système : « 1 246 »
    // se lisait « 1246 ». Mesuré au navigateur le 20/09/2026.
    expect(nombre(1246)).toBe(`1${INSECABLE}246`)
    expect(nombre(1246)).not.toContain(FINE_INSECABLE)
  })

  it('laisse les petits nombres intacts', () => {
    expect(nombre(0)).toBe('0')
    expect(nombre(999)).toBe('999')
  })

  it('colle le symbole euro par une insécable, pour qu’il ne parte pas à la ligne', () => {
    expect(euros(335)).toBe(`335${INSECABLE}€`)
    expect(euros(1246)).toBe(`1${INSECABLE}246${INSECABLE}€`)
  })

  it('emploie le vrai signe moins, pas le trait d’union du clavier', () => {
    expect(euros(-376)).toBe(`−376${INSECABLE}€`)
    expect(euros(-376)).not.toContain('-')
  })

  it('arrondit à l’euro, et au centime quand on le demande', () => {
    expect(euros(334.6)).toBe(`335${INSECABLE}€`)
    expect(eurosPrecis(13.39)).toBe(`13,39${INSECABLE}€`)
  })

  it('ne touche à rien d’autre', () => {
    expect(lisible('Limoges')).toBe('Limoges')
    expect(lisible('a b')).toBe('a b')
  })
})

/**
 * Le défaut se réintroduirait à la première ligne qui appelle `toLocaleString`
 * sans passer par ce module, et rien ne le signalerait : le nombre s'afficherait
 * simplement un peu serré. D'où ce garde-fou.
 */
describe('personne ne met en forme un nombre dans son coin', () => {
  function sources(dossier: string): string[] {
    const trouves: string[] = []
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree)
      if (statSync(chemin).isDirectory()) {
        if (entree === '__tests__' || entree === 'images' || entree === 'polices') continue
        trouves.push(...sources(chemin))
      } else if (/\.tsx?$/.test(entree)) {
        trouves.push(chemin)
      }
    }
    return trouves
  }

  it('aucun toLocaleString de nombre hors de nombres.ts', () => {
    const fautifs: string[] = []
    for (const fichier of [...sources(SRC), ...sources(MOTEUR)]) {
      if (fichier.endsWith('/nombres.ts')) continue
      const source = readFileSync(fichier, 'utf8')
      for (const m of source.matchAll(/\.toLocaleString\(/g)) {
        const avant = source.slice(0, m.index)
        const ligne = avant.split('\n').length
        // Les dates ont leurs propres méthodes et ne sont pas concernées.
        const debut = avant.lastIndexOf('\n') + 1
        const texte = source.slice(debut, source.indexOf('\n', m.index!))
        if (/toLocaleDateString|new Date\(/.test(texte)) continue
        const court = fichier.replace(`${SRC}/`, '').replace(`${MOTEUR}/`, '')
        fautifs.push(`${court}:${ligne} → ${texte.trim()}`)
      }
    }
    expect(
      fautifs,
      'Passe par nombre(), euros() ou eurosPrecis() de nombres.ts : la locale ' +
        'française produit une espace fine que la police des chiffres rend trop ' +
        'étroite, et « 1 246 » se lit alors « 1246 ».',
    ).toEqual([])
  })
})
