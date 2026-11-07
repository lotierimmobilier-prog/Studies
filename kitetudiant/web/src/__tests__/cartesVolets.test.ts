import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Une carte de résultat doit se comparer à celle du dessus.
 *
 * ── Ce qui s'est passé ───────────────────────────────────────────────────
 *
 * Chaque carte portait, toujours dépliés : la fourchette, une ligne de
 * retours, un bouton budget pleine largeur, quatre liens, un titre de
 * logement et deux liens de plus. Sur quarante formations, comparer deux
 * cartes demandait de faire défiler l'écran entre les deux.
 *
 * Mesuré au navigateur : 403 px par carte. Après repli, 312 px — un quart
 * de moins, et deux cartes et demie à l'écran au lieu d'une et demie.
 *
 * ── L'erreur du premier essai ────────────────────────────────────────────
 *
 * Deux volets séparés — les liens d'un côté, le logement de l'autre — ne
 * gagnaient que 25 px : deux rangées de contenu remplacées par deux rangées
 * de volet. Mesurer a évité de s'en contenter. Un seul volet, et le bouton
 * budget ramené à la même allure, ont fait le reste.
 */

const SRC = resolve(import.meta.dirname, '..')
const APP = readFileSync(resolve(SRC, 'App.tsx'), 'utf8')
const RETOURS = readFileSync(resolve(SRC, 'retours.tsx'), 'utf8')

describe('les liens d’une carte sont repliés', () => {
  it('un seul volet, pas un par sujet', () => {
    // Deux volets coûtent deux rangées : le gain s'annule.
    const volets = [...APP.matchAll(/<details className="carte-volet">/g)]
    expect(volets).toHaveLength(1)
  })

  it('les liens et le logement sont DANS le volet', () => {
    const debut = APP.indexOf('<details className="carte-volet">')
    const fin = APP.indexOf('</details>', debut)
    expect(debut).toBeGreaterThan(-1)
    const dedans = APP.slice(debut, fin)
    expect(dedans, 'la fiche Parcoursup est restée dehors').toContain('Fiche Parcoursup')
    expect(dedans, 'le logement est resté dehors').toContain('Se loger à')
  })

  it('ce qui sert à comparer reste dehors', () => {
    /* Le titre, le lieu, le verdict et les trois lectures ne se replient
       pas : sans eux la carte ne se compare plus, et replier deviendrait
       cacher. */
    const debut = APP.indexOf('<details className="carte-volet">')
    const avant = APP.slice(APP.indexOf('<article className={`carte'), debut)
    for (const garde of ['carte-titre', 'carte-lieu', 'bandeau-mesures', 'bandeau-cle', 'verdict']) {
      expect(avant, `« ${garde} » a été replié alors qu'il sert à comparer`).toContain(garde)
    }
  })

  it('emploie « details » natif plutôt qu’un état React', () => {
    /* Il s'ouvre au clavier, se lit par un lecteur d'écran, fonctionne sans
       JavaScript, et la recherche dans la page le déplie sur les
       navigateurs récents. Rien de tout cela n'est gratuit avec un état. */
    expect(APP).toContain('<details className="carte-volet">')
    expect(APP).toContain('<summary>')
  })
})

describe('le bouton du budget a la même allure, pas le même poids', () => {
  it('n’est plus un bloc pleine largeur', () => {
    expect(APP).not.toMatch(/className="secondaire carte-deplier"/)
    expect(APP).toContain('carte-volet-bouton')
  })

  it('reste un bouton, parce que la liste tient son ouverture', () => {
    // `details` déciderait tout seul ; ici c'est la liste qui décide ce qui
    // reste ouvert. `aria-expanded` dit l'état à qui ne voit pas le triangle.
    expect(APP).toMatch(/aria-expanded=\{ouvert\}/)
  })
})

describe('zéro retour ne s’écrit pas', () => {
  it('la ligne disparaît quand il n’y a aucun retour', () => {
    /* « Aucun retour d'étudiant pour l'instant » s'affichait à l'identique
       sur chacune des quarante cartes et n'apprenait rien : l'absence de
       ligne dit déjà l'absence de retour. */
    expect(RETOURS).toMatch(/if \(agregat\.nombreRetours === 0\) return null/)
  })

  it('mais la fiche détaillée, elle, le dit toujours', () => {
    // Là, on est venu voir les retours : le silence serait une page
    // inachevée.
    expect(RETOURS).toMatch(/Aucun retour déposé pour cette formation/)
  })
})

describe('le volet reste utilisable au clavier', () => {
  const CSS = readFileSync(resolve(SRC, 'styles.css'), 'utf8')

  it('le focus se voit', () => {
    // Ces volets sont désormais le seul chemin vers tous les liens d'une
    // carte : un focus invisible les rendrait introuvables au clavier.
    expect(CSS).toMatch(/\.carte-volet > summary:focus-visible/)
    expect(CSS).toMatch(/\.carte-volet-bouton:focus-visible/)
  })

  it('l’animation du triangle se coupe si on la refuse', () => {
    const bloc = CSS.slice(CSS.indexOf('.carte-volet {'))
    expect(bloc.slice(0, 3000)).toMatch(/prefers-reduced-motion/)
  })
})
