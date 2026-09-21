import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * La navigation a deux formes, et c'est exactement ce qui la rend fragile.
 *
 * Le visiteur a une barre en haut, l'élève connecté un rail à gauche qui se
 * replie sur ses icônes — et, sous 1024 px, une barre en bas. Trois rendus
 * pour une seule liste de destinations.
 *
 * Les fautes de cette famille ne cassent rien au build et ne lèvent aucune
 * erreur : une destination ajoutée d'un côté et pas de l'autre devient
 * simplement invisible pour la moitié des gens, et un libellé qui disparaît
 * avec le repli emporte le nom accessible avec lui. Ça se voit à l'œil, sur
 * un seul des trois rendus, et seulement si on pense à le regarder.
 *
 * On vérifie donc les invariants sur la source plutôt que d'attendre la
 * relecture. Le comportement, lui, a été mesuré au navigateur : de 320 à
 * 1920 px, les deux états de connexion, ni débordement ni chevauchement.
 */

const ICI = import.meta.dirname
const NAV = readFileSync(resolve(ICI, '..', 'navigation.tsx'), 'utf8')
const CSS = readFileSync(resolve(ICI, '..', 'styles.css'), 'utf8')
const APP = readFileSync(resolve(ICI, '..', 'App.tsx'), 'utf8')

/** Le corps d'une fonction de composant, du `function X(` à sa fin. */
function corps(source: string, nom: string): string {
  const debut = source.indexOf(`function ${nom}(`)
  if (debut === -1) return ''
  const suivant = source.indexOf('\nfunction ', debut + 1)
  const exporte = source.indexOf('\nexport function ', debut + 1)
  const fins = [suivant, exporte].filter((i) => i > -1)
  return source.slice(debut, fins.length > 0 ? Math.min(...fins) : source.length)
}

/**
 * TOUS les blocs `@media (min-width: 64rem)` de la feuille, bout à bout.
 *
 * Il y en a plusieurs — la feuille les pose au fil des composants plutôt que
 * de tout regrouper. Ne lire que le premier ferait passer ces tests pour des
 * échecs alors que la règle cherchée est simplement dans un autre.
 */
function grandEcran(): string {
  const blocs: string[] = []
  let depuis = 0
  for (;;) {
    const debut = CSS.indexOf('@media (min-width: 64rem)', depuis)
    if (debut === -1) break
    let profondeur = 0
    let i = CSS.indexOf('{', debut)
    for (; i < CSS.length; i += 1) {
      if (CSS[i] === '{') profondeur += 1
      if (CSS[i] === '}') {
        profondeur -= 1
        if (profondeur === 0) break
      }
    }
    blocs.push(CSS.slice(debut, i + 1))
    depuis = i + 1
  }
  expect(blocs.length, 'la feuille doit avoir au moins un bloc grand écran').toBeGreaterThan(0)
  return blocs.join('\n')
}

describe('les deux navigations ne se mélangent pas', () => {
  it('le visiteur a une barre en haut, et aucun rail', () => {
    const visiteur = corps(NAV, 'BarreVisiteur')
    expect(visiteur).toContain('barre-haut')
    // Un rail chez le visiteur, c'est la barre du bas qui réapparaît sur son
    // téléphone — par-dessus les boutons de la page.
    expect(visiteur).not.toMatch(/className="rail\b/)
  })

  it('l’élève connecté a un rail, et aucune barre en haut', () => {
    const rail = corps(NAV, 'RailApplication')
    expect(rail).toMatch(/'rail rail-replie' : 'rail'/)
    expect(rail).not.toContain('barre-haut')
  })

  it('le choix se fait sur l’état de connexion, une seule fois', () => {
    expect(NAV).toMatch(/nav\.connecte \? <RailApplication .*\/> : <BarreVisiteur .*\/>/)
  })
})

describe('une seule liste de destinations', () => {
  it('n’est déclarée qu’à un endroit', () => {
    // Deux listes finissent toujours par diverger.
    expect(NAV.match(/function destinations\(/g)).toHaveLength(1)
  })

  it('sert aux deux formes', () => {
    expect(corps(NAV, 'BarreVisiteur')).toContain('destinations(nav)')
    expect(corps(NAV, 'RailApplication')).toContain('destinations(nav)')
  })

  it('n’ajoute l’entrée de compte qu’une fois par forme', () => {
    // Le visiteur a « Se connecter » en bouton à part, hors de la liste : le
    // remettre aussi dans la liste le ferait apparaître deux fois.
    const visiteur = corps(NAV, 'BarreVisiteur')
    expect(visiteur.match(/entreeCompte\(/g)).toHaveLength(1)
    expect(corps(NAV, 'RailApplication').match(/entreeCompte\(/g)).toHaveLength(1)
  })
})

describe('le repli n’emporte pas le nom des destinations', () => {
  it('chaque lien porte son libellé long en aria-label ET en title', () => {
    /* Replié, le rail n'affiche plus que des icônes. Sans ces deux attributs,
       une destination n'a plus de nom du tout : ni pour un lecteur d'écran,
       ni au survol. C'est le risque propre à cette fonctionnalité. */
    const lien = corps(NAV, 'Lien')
    expect(lien).toContain("'aria-label': entree.libelle")
    expect(lien).toContain('title: entree.libelle')
  })

  it('le bouton de repli annonce son état et le geste à venir', () => {
    const rail = corps(NAV, 'RailApplication')
    expect(rail).toContain('aria-expanded={!replie}')
    expect(rail).toMatch(/aria-label=\{replie \? 'Déplier le menu' : 'Replier le menu'\}/)
  })

  it('l’écran courant reste signalé dans les deux formes', () => {
    expect(corps(NAV, 'Lien')).toContain("'aria-current': 'page' as const")
  })
})

describe('le repli ne concerne que le grand écran', () => {
  const GRAND = grandEcran()

  it('toutes les règles de repli vivent dans le bloc grand écran', () => {
    /* La classe `rail-replie` reste posée sur le <nav> quelle que soit la
       largeur : quelqu'un qui replie son rail au bureau puis ouvre le site
       sur son téléphone la porte encore. Si ces règles fuyaient hors du bloc,
       il trouverait une barre du bas aux libellés effacés et aux icônes
       décentrées, sans aucun bouton pour rétablir — le bouton, lui, n'existe
       que sur grand écran. */
    const toutes = CSS.match(/\.rail-replie[^{]*\{/g) ?? []
    const dansLeBloc = GRAND.match(/\.rail-replie[^{]*\{/g) ?? []
    expect(toutes.length).toBeGreaterThan(0)
    expect(dansLeBloc).toHaveLength(toutes.length)
  })

  it('la largeur du rail n’est écrite qu’une fois par état', () => {
    // La colonne de la grille vaut `auto` : c'est le rail qui décide. Une
    // largeur répétée sur la grille divergerait de celle du rail.
    expect(GRAND).toMatch(/\.coque-app \{\s*display: grid;\s*grid-template-columns: auto 1fr;/)
  })
})

describe('la réserve du bas ne vise que la barre du bas', () => {
  it('est portée par .coque-app, jamais par .coque-page seule', () => {
    /* Cette réserve empêche la barre du bas de recouvrir les derniers boutons
       de la page. Appliquée au visiteur, qui n'a pas de barre du bas, elle ne
       ferait que creuser un vide de 4,5 rem sous chaque page. */
    expect(CSS).toContain('.coque-app .coque-page {')
    const bloc = /^\.coque-page \{([^}]*)\}/m.exec(CSS)
    expect(bloc?.[1] ?? '').not.toContain('padding-bottom')
  })

  it('App.tsx pose la classe qui distingue les deux coques', () => {
    expect(APP).toContain("connecte ? 'coque coque-app' : 'coque coque-visiteur'")
  })
})
