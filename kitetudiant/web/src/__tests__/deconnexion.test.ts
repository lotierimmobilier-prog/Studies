/**
 * Se déconnecter doit être possible, sur n'importe quelle largeur d'écran.
 *
 * Ça ne l'était pas. Le seul bouton vivait dans le rail latéral, masqué par
 * `display: none` sous 64 rem — donc sur tout téléphone — et masqué aussi
 * quand le rail était replié, faute d'icône. Dans l'espace personnel,
 * `onDeconnexion` n'était câblé qu'au bouton d'EFFACEMENT du compte.
 *
 * Résultat : sur un téléphone, on ne pouvait pas fermer sa session. Et un
 * commentaire du CSS affirmait le contraire — « elle reste dans Mon espace » —
 * ce qui est le genre d'assertion qu'aucun test ne vérifiait.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '..')
const APP = readFileSync(resolve(SRC, 'App.tsx'), 'utf8')
const NAV = readFileSync(resolve(SRC, 'navigation.tsx'), 'utf8')
const COMPTE = readFileSync(resolve(SRC, 'monCompte.tsx'), 'utf8')
const STYLES = readFileSync(resolve(SRC, 'styles.css'), 'utf8')
const ILLUS = readFileSync(resolve(SRC, 'illustrations.tsx'), 'utf8')

describe('l’espace personnel', () => {
  it('porte un vrai bouton de déconnexion', () => {
    /* C'est le seul chemin sur un téléphone : sans lui, la session ne se
       ferme pas. */
    expect(COMPTE).toContain('function Deconnexion(')
    expect(COMPTE).toMatch(/<Deconnexion\s/)
  })

  it('ne le confond pas avec l’effacement du compte', () => {
    /* Deux façons de partir : l'une réversible, l'autre non. Les présenter
       pareil coûte un compte. L'effacement garde son bloc à lui. */
    const deco = COMPTE.indexOf('function Deconnexion(')
    const effacer = COMPTE.indexOf('function Effacer(')
    expect(deco).toBeGreaterThan(-1)
    expect(effacer).toBeGreaterThan(-1)
    const bloc = COMPTE.slice(deco, effacer)
    expect(bloc, 'le bouton de déconnexion est présenté comme destructif').not.toMatch(
      /bloc-compte-effacer|danger|supprim/i,
    )
    expect(bloc).toContain('restent intacts')
  })

  it('ramène à l’accueil, plutôt que de laisser une page de compte vide', () => {
    const deco = COMPTE.indexOf('<Deconnexion')
    const bloc = COMPTE.slice(deco, deco + 300)
    expect(bloc).toContain('onDeconnexion()')
    expect(bloc).toMatch(/onNaviguer\(\{ vue: 'accueil' \}\)/)
  })
})

describe('le rail latéral', () => {
  it('donne une icône à la déconnexion', () => {
    expect(NAV).toMatch(/className="rail-deconnexion"[\s\S]{0,200}<Sortie \/>/)
    expect(ILLUS).toContain('export function Sortie()')
  })

  it('garde un nom accessible quand le libellé disparaît', () => {
    /* Replié, le texte visible n'existe plus : une icône seule sans
       `aria-label` est un bouton muet pour un lecteur d'écran. */
    const bouton = /<button[\s\S]*?className="rail-deconnexion"[\s\S]*?<\/button>/.exec(NAV)
    expect(bouton).not.toBeNull()
    expect(bouton![0]).toContain('aria-label="Se déconnecter"')
    expect(bouton![0]).toContain('title="Se déconnecter"')
  })

  it('ne disparaît plus quand le rail est replié', () => {
    /* La régression exacte : `display: none` retirait la déconnexion du site
       entier sur les écrans larges où le rail était replié. */
    const regle = /\.rail-replie \.rail-deconnexion \{[^}]*\}/.exec(STYLES)
    expect(regle, 'la règle du rail replié a disparu').not.toBeNull()
    expect(regle![0], 'la déconnexion est de nouveau masquée').not.toMatch(
      /display:\s*none/,
    )
  })

  it('reste hors de la barre du bas d’un téléphone', () => {
    /* Sous 64 rem, le même composant devient la barre du bas : c'est donc le
       CSS qui l'en retire, pas le JSX. Une action qui ferme la session, posée
       d'un doigt à côté des onglets, se déclenche par accident — et « Mon
       espace », lui, EST une destination de cette barre.

       On vérifie la PREMIÈRE règle `.rail-deconnexion` du fichier : c'est
       celle de premier niveau, la seule qui s'applique sur un téléphone.
       Celle du rail large vient après, dans sa media query. */
    const regle = /\.rail-deconnexion \{[^}]*\}/.exec(STYLES)
    expect(regle, 'la règle qui masque la déconnexion sur mobile a disparu').not.toBeNull()
    expect(
      regle![0],
      'la déconnexion est apparue dans la barre du bas d’un téléphone',
    ).toMatch(/display:\s*none/)
  })
})

describe('l’icône de sortie', () => {
  it('ne peut pas se lire comme « supprimer »', () => {
    /* C'était l'argument contre toute icône ici. Une porte franchie par une
       flèche ne barre rien et ne jette rien : aucune croix, aucune corbeille,
       aucun trait en travers. */
    const svg = /export function Sortie\(\)[\s\S]*?\n\}/.exec(ILLUS)
    expect(svg).not.toBeNull()
    // Une croix se dessine par deux diagonales opposées ; on n'en veut pas.
    expect(svg![0]).not.toMatch(/M\s*6\s+6\s*L?\s*18\s+18|corbeille|trash/i)
    expect(svg![0]).toContain('aria-hidden="true"')
  })

  it('pointe vers la droite, dans le sens du départ', () => {
    /* Vers la gauche, la même flèche se lit « revenir » — le contraire. */
    const svg = /export function Sortie\(\)[\s\S]*?\n\}/.exec(ILLUS)!
    expect(svg[0]).toContain('M11 12h9')
    expect(svg[0]).toContain('m16.8 8.6 3.4 3.4-3.4 3.4')
  })

  it('suit le trait des autres pictos', () => {
    const svg = /export function Sortie\(\)[\s\S]*?\n\}/.exec(ILLUS)!
    expect(svg[0]).toContain('viewBox="0 0 24 24"')
    expect(svg[0]).toContain('strokeWidth="1.8"')
    expect(svg[0]).toContain('className="illu-picto"')
  })
})

describe('la session est vraiment fermée', () => {
  /* Le défaut que la relecture de la PR #46 a trouvé : l'espace personnel
     recevait `() => setConnecte(false)`, qui ne change que l'affichage. Le
     jeton restait dans le navigateur et la session restait ouverte côté
     serveur — un rafraîchissement reconnectait.

     Invisible jusque-là parce que ce rappel ne servait qu'à l'EFFACEMENT du
     compte, où la session meurt avec le compte. Le jour où un vrai bouton
     « Se déconnecter » s'y est branché, le défaut est devenu la
     fonctionnalité, sur l'écran fait pour les téléphones partagés. */

  it('aucun rappel de déconnexion ne se contente de l’affichage', () => {
    const rappels = [...APP.matchAll(/onDeconnexion=\{([^}]*)\}/g)].map((m) => m[1]!)
    expect(rappels.length).toBeGreaterThan(0)
    for (const r of rappels) {
      expect(r, `« ${r} » ne ferme pas la session`).toContain('seDeconnecter')
      expect(r, `« ${r} » se contente de changer l’affichage`).not.toMatch(
        /^\s*\(\)\s*=>\s*setConnecte\(false\)\s*$/,
      )
    }
  })

  it('oublie le jeton ET ferme la session côté serveur', () => {
    /* Oublier le jeton localement laisserait une session ouverte jusqu'à son
       expiration ; la fermer sans oublier le jeton laisserait le navigateur
       croire qu'il est connecté. Les deux, ou rien. */
    const donnees = readFileSync(resolve(SRC, 'donnees.ts'), 'utf8')
    const f = /export async function deconnecter\([\s\S]*?\n\}/.exec(donnees)
    expect(f).not.toBeNull()
    expect(f![0]).toContain('oublierJeton()')
    expect(f![0]).toContain('/comptes/deconnexion')

    const se = /const seDeconnecter = useCallback\([\s\S]*?\}, \[\]\)/.exec(APP)
    expect(se).not.toBeNull()
    expect(se![0]).toContain('await deconnecter()')
  })

  it('vaut aussi pour l’effacement du compte', () => {
    /* Même rappel, même exigence : après une suppression, un jeton laissé
       dans le navigateur est un jeton qui désigne un compte disparu. */
    const compte = readFileSync(resolve(SRC, 'monCompte.tsx'), 'utf8')
    const effacer = compte.indexOf('<Effacer')
    const bloc = compte.slice(effacer, effacer + 250)
    expect(bloc).toContain('onDeconnexion()')
  })
})
