/**
 * Le chiffre qui défile.
 *
 * L'animation est décorative, mais elle affiche des nombres — donc elle tombe
 * sous la règle 1. Le seul chiffre qui reste à l'écran doit être le vrai, au
 * chiffre près, quelle que soit la façon dont l'animation s'est terminée.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { amorti, DUREE_MS, valeurA } from '../compteur.ts'

const SRC = resolve(__dirname, '..')

describe('l’amorti', () => {
  it('part de 0 et arrive à 1', () => {
    expect(amorti(0)).toBe(0)
    expect(amorti(1)).toBe(1)
  })

  it('ne sort jamais de [0, 1], même hors bornes', () => {
    for (const t of [-5, -0.001, 0.5, 1.001, 42]) {
      const v = amorti(t)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('ralentit vers la fin', () => {
    // Amorti de sortie : la moitié du temps a déjà couvert plus de la moitié
    // du chemin. Un défilement linéaire échouerait ici.
    expect(amorti(0.5)).toBeGreaterThan(0.5)
    const debut = amorti(0.1) - amorti(0)
    const fin = amorti(1) - amorti(0.9)
    expect(debut).toBeGreaterThan(fin)
  })
})

describe('la valeur affichée', () => {
  it('tombe EXACTEMENT sur la cible à la dernière image', () => {
    /* Le cas qui compte : 1 245 au lieu de 1 246 serait un chiffre faux
       laissé à l'écran, sur une page qui promet des chiffres sourcés. */
    for (const cible of [1246, 3, 7, 999999, 1]) {
      expect(valeurA(cible, DUREE_MS)).toBe(cible)
      expect(valeurA(cible, DUREE_MS + 1)).toBe(cible)
      expect(valeurA(cible, DUREE_MS * 10)).toBe(cible)
    }
  })

  it('part de zéro', () => {
    expect(valeurA(1246, 0)).toBe(0)
    expect(valeurA(1246, -50)).toBe(0)
  })

  it('ne dépasse jamais la cible en chemin', () => {
    for (let t = 0; t <= DUREE_MS; t += 7) {
      const v = valeurA(1246, t)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1246)
    }
  })

  it('ne recule jamais', () => {
    let precedent = -1
    for (let t = 0; t <= DUREE_MS; t += 9) {
      const v = valeurA(1246, t)
      expect(v).toBeGreaterThanOrEqual(precedent)
      precedent = v
    }
  })

  it('rend un entier, jamais 1 245,6', () => {
    for (let t = 0; t <= DUREE_MS; t += 13) {
      expect(Number.isInteger(valeurA(1246, t))).toBe(true)
    }
  })

  it('supporte une durée nulle sans boucler ni diviser par zéro', () => {
    expect(valeurA(1246, 0, 0)).toBe(1246)
  })
})

describe('le composant', () => {
  const source = readFileSync(resolve(SRC, 'compteur.tsx'), 'utf8')

  it('respecte « prefers-reduced-motion »', () => {
    expect(source).toContain('mouvementRefuse()')
    const reduit = readFileSync(resolve(SRC, 'compteur.ts'), 'utf8')
    expect(reduit).toContain('prefers-reduced-motion: reduce')
    // Sans matchMedia — rendu serveur, vieux navigateur — on n'anime pas.
    expect(reduit).toMatch(/return true/)
  })

  it('cache les images intermédiaires aux lecteurs d’écran', () => {
    /* Quarante valeurs annoncées à la suite, dont trente-neuf fausses :
       c'est ce que donne un compteur qu'on laisse lire. */
    expect(source).toContain('aria-hidden="true"')
    expect(source).toMatch(/className="sr-only">\{nombre\(cible\)\}/)
  })

  it('annule l’image en attente quand il disparaît', () => {
    // Sans cela, une animation continue de poser un état sur un composant
    // démonté à chaque changement de vue.
    expect(source).toContain('cancelAnimationFrame')
  })
})

describe('la page d’accueil', () => {
  const accueil = readFileSync(resolve(SRC, 'accueil.tsx'), 'utf8')

  it('fait défiler les trois chiffres de la bande', () => {
    const bande = /function Bandeau\(\)[\s\S]*?\n\}/.exec(accueil)
    expect(bande).not.toBeNull()
    expect([...bande![0].matchAll(/<Compteur cible=/g)]).toHaveLength(3)
    expect(bande![0], 'un chiffre est resté figé dans le JSX').not.toMatch(
      /<span className="bandeau-chiffre">/,
    )
  })

  it('dit que le site est gratuit et à quoi il sert', () => {
    const bloc = /<p className="hero-gratuit">[\s\S]*?<\/p>/.exec(accueil)
    expect(bloc, 'la promesse a disparu du hero').not.toBeNull()
    expect(bloc![0]).toMatch(/Gratuit/)
    expect(bloc![0]).toMatch(/quotidien/)
    expect(bloc![0]).toMatch(/études/)
  })
})
