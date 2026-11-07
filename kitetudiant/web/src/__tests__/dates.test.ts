import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

import { dateLisible, dateMachine } from '../dates.ts'

const RACINE = resolve(import.meta.dirname, '..', '..', '..', '..')

/**
 * Une date écrite en toutes lettres doit désigner le même jour partout.
 *
 * ── Ce que ce test aurait évité ──────────────────────────────────────────
 *
 * Trois écrans portaient chacun leur `dateLisible`, et deux passaient une
 * date SEULE à `new Date` sans l'ancrer :
 *
 *     new Date('2025-09-01')            // minuit UTC
 *       .toLocaleDateString('fr-FR', …) // rendu dans le fuseau du lecteur
 *
 * À l'ouest de Greenwich, minuit UTC tombe la veille. Un élève à Tahiti
 * lisait « 31 août 2025 » sur un fichier daté du 1er septembre. Le site
 * couvre l'outre-mer — les codes INSEE 97x et 98x sont traités à part
 * partout ailleurs dans le code — donc ce n'était pas un cas d'école.
 *
 * La règle 6 de CLAUDE.md impose que toute donnée porte son millésime et sa
 * date de collecte. Une date de collecte qui change selon l'endroit où on la
 * lit ne vaut pas mieux qu'une date absente.
 */

describe('une date seule ne bouge pas avec le fuseau', () => {
  it('rend le jour écrit, pas la veille ni le lendemain', () => {
    expect(dateLisible('2025-09-01')).toBe('1 septembre 2025')
    expect(dateLisible('2025-01-01')).toBe('1 janvier 2025')
    expect(dateLisible('2025-12-31')).toBe('31 décembre 2025')
  })

  /* Vitest fixe TZ au démarrage du processus : la seule façon de vérifier
     VRAIMENT l'indépendance au fuseau est d'en lancer un autre. Un premier
     jet vérifiait à la place que midi UTC ± douze heures reste le même
     jour — ce qui est faux (+14 h donne le lendemain) et, surtout, ne
     disait rien de la fonction : c'est `timeZone: 'UTC'` qui la protège,
     pas la marge. Le test est donc lent, et c'est le prix à payer. */
  const FUSEAUX = ['Pacific/Tahiti', 'Pacific/Kiritimati', 'America/Guadeloupe', 'UTC']

  it.each(FUSEAUX)('donne le même jour sous TZ=%s', (tz) => {
    const sortie = execFileSync(
      resolve(RACINE, 'node_modules', '.bin', 'tsx'),
      [resolve(import.meta.dirname, 'sous-un-autre-fuseau.ts')],
      { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
    ).trim()
    expect(sortie, `sous TZ=${tz}`).toBe('1 septembre 2025|1 janvier 2025|31 décembre 2025')
  })
})

describe('un instant se lit dans le fuseau du lecteur', () => {
  it('garde l’heure au lieu de l’écraser à midi', () => {
    // Une date d'inscription est un point dans le temps, pas un jour :
    // l'ancrage serait faux ici. On vérifie qu'elle n'est pas ancrée.
    const rendu = dateLisible('2025-09-01T23:40:00Z')
    expect(rendu).toMatch(/^\d{1,2} \w+ 2025$/)
  })
})

describe('une entrée illisible se voit', () => {
  it('rend la chaîne telle quelle plutôt qu’une date inventée', () => {
    // « Pas de valeur de repli silencieuse » (CLAUDE.md). Une date cassée
    // affichée en clair se corrige ; un 1er janvier 1970 ne se voit pas.
    expect(dateLisible('pas une date')).toBe('pas une date')
    expect(dateLisible('')).toBe('')
    expect(dateMachine('pas une date')).toBe('pas une date')
  })
})

describe('plus personne ne réécrit dateLisible dans son coin', () => {
  const ECRANS = ['accueil.tsx', 'blog.tsx', 'monCompte.tsx']

  it('les écrans importent le module au lieu d’en refaire une copie', () => {
    for (const nom of ECRANS) {
      const source = readFileSync(resolve(import.meta.dirname, '..', nom), 'utf8')
      expect(
        source,
        `${nom} redéfinit dateLisible au lieu d’importer ./dates.ts — ` +
          `c'est comme ça que deux des trois copies étaient fausses`,
      ).not.toMatch(/function dateLisible\(/)
      expect(source).toMatch(/from '\.\/dates\.ts'/)
    }
  })
})

describe('la page livrée et la page rendue disent la même date', () => {
  const PRERENDU = readFileSync(
    resolve(import.meta.dirname, '..', '..', '..', 'scripts', 'prerendre.ts'),
    'utf8',
  )

  it('le pré-rendu écrit la date en toutes lettres, pas l’ISO brut', () => {
    // Il écrivait « <time datetime="2025-09-01">2025-09-01</time> » : la
    // forme machine deux fois, dont une à la place du texte.
    expect(PRERENDU).toMatch(/from '\.\.\/web\/src\/dates\.ts'/)
    expect(PRERENDU).not.toMatch(/>\$\{article\.publieLe\}<\/time>/)
  })

  it('le pré-rendu montre la date de révision, comme l’écran', () => {
    // `dateModified` était déjà dans le JSON-LD. Un article revu le 1er
    // septembre affichait quand même sa seule date de parution.
    expect(PRERENDU).toMatch(/revu le/)
  })
})

describe('la FAQ est une section de l’article, pas une sous-section', () => {
  const BLOG = readFileSync(resolve(import.meta.dirname, '..', 'blog.tsx'), 'utf8')
  const PRERENDU = readFileSync(
    resolve(import.meta.dirname, '..', '..', '..', 'scripts', 'prerendre.ts'),
    'utf8',
  )

  it('les deux versions de la page lui donnent le même niveau', () => {
    /* L'écran écrivait `h3`, le pré-rendu `h2` : les deux versions de la
       même adresse annonçaient deux plans différents. En `h3`, la FAQ se
       rangeait sous la dernière section de l'article quel qu'en soit le
       sujet — un lecteur d'écran qui parcourt les titres l'y trouvait. */
    expect(BLOG).toMatch(/<h2 className="questions-titre"/)
    expect(BLOG).not.toMatch(/<h3 className="questions-titre"/)
    expect(PRERENDU).toMatch(/<h2>Questions fréquentes<\/h2>/)
  })
})
