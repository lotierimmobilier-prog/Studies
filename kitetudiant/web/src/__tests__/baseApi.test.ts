import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { BASE_API } from '../donnees.ts'

/**
 * Le site est servi sous un sous-chemin sur le VPS (« /kitetudiant/ »), et
 * nginx n'expose l'API que sous ce même préfixe. Un « /api/… » écrit en dur
 * vise la racine du serveur, où il n'y a rien.
 *
 * Ce défaut ne se voit ni au build, ni aux types, ni en développement — le
 * serveur de Vite, lui, sert la racine. Il n'apparaît qu'une fois déployé, et
 * sur TOUS les appels à la fois : le 19/09/2026, la création de compte
 * répondait 404 en production alors que le serveur répondait 201 sur le bon
 * chemin. Mes vérifications passaient par l'URL complète : elles testaient le
 * serveur, jamais ce que le front demande réellement.
 *
 * D'où ces deux tests, qui gardent la seule source de vérité du chemin.
 */

const SRC = resolve(import.meta.dirname, '..')

function fichiersSources(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) {
      if (entree === '__tests__') continue
      trouves.push(...fichiersSources(chemin))
    } else if (/\.tsx?$/.test(entree)) {
      trouves.push(chemin)
    }
  }
  return trouves
}

describe('chemin de l’API', () => {
  it('se déduit du chemin de déploiement, jamais d’une constante écrite en dur', () => {
    // En test comme en développement, BASE_URL vaut « / ».
    expect(BASE_API).toBe('/api')
    // Et la dérivation elle-même : un préfixe de déploiement doit se retrouver
    // devant « api », sans doubler les barres obliques.
    const compose = (base: string): string => `${base}api`.replace(/\/{2,}/g, '/')
    expect(compose('/')).toBe('/api')
    expect(compose('/kitetudiant/')).toBe('/kitetudiant/api')
    expect(compose('//kitetudiant//')).toBe('/kitetudiant/api')
  })

  it('n’est écrit en dur dans aucun fichier du front', () => {
    const fautifs: string[] = []
    for (const fichier of fichiersSources(SRC)) {
      const source = readFileSync(fichier, 'utf8')
      // On cherche une chaîne littérale qui commence par /api : c'est la forme
      // exacte du défaut, et elle ne doit exister nulle part.
      for (const m of source.matchAll(/['"`]\/api(?:\/|['"`])/g)) {
        const ligne = source.slice(0, m.index).split('\n').length
        fautifs.push(`${fichier.replace(`${SRC}/`, '')}:${ligne}`)
      }
    }
    expect(
      fautifs,
      'Ces fichiers visent « /api » à la racine du serveur. En production, le ' +
        'site est servi sous un sous-chemin et l’appel revient en 404. ' +
        'Utilise BASE_API, qui se déduit de import.meta.env.BASE_URL.',
    ).toEqual([])
  })
})
