import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Une seule feuille de style sert toutes les vues. Réutiliser un nom de classe
// déjà pris ailleurs ne casse rien au build et ne lève aucune erreur : la
// nouvelle vue hérite simplement de la mise en page de l'autre, en silence.
// C'est arrivé le 19/09/2026 — la page d'accueil avait nommé ses trois piliers
// « axe », nom déjà employé par l'affichage des résultats, et se retrouvait
// composée sur deux colonnes sans que rien ne le signale.
//
// Le symptôme mécanique de cette faute, c'est une classe définie deux fois au
// premier niveau de la feuille. On le détecte donc ici.

const CSS = readFileSync(resolve(import.meta.dirname, '..', 'styles.css'), 'utf8')

/**
 * Les variantes d'un même composant partagent volontairement une règle de base
 * puis se spécialisent. Ces deux-là sont voulues, et documentées comme telles.
 */
const DOUBLONS_ASSUMES = new Set(['.principal', '.secondaire'])

/** Retire les blocs @media : on ne compare que les définitions de premier niveau. */
function sansRequetesMedia(css: string): string {
  const garde: string[] = []
  let dansMedia = false
  let profondeur = 0
  for (let i = 0; i < css.length; i += 1) {
    if (!dansMedia && css.startsWith('@media', i)) {
      dansMedia = true
      profondeur = 0
    }
    if (dansMedia) {
      const c = css[i]
      if (c === '{') profondeur += 1
      else if (c === '}') {
        profondeur -= 1
        if (profondeur === 0) dansMedia = false
      }
    } else {
      garde.push(css[i]!)
    }
  }
  return garde.join('')
}

/**
 * Les sélecteurs de classe simples (`.machin`) et leur nombre de définitions.
 *
 * Les commentaires sont retirés d'abord : sans cela, `[^@{}]+` les avale avec
 * le sélecteur qui suit, la capture ne ressemble plus à une classe, et le
 * doublon passe inaperçu — le test réussissait alors sur une collision réelle.
 */
function definitionsParClasse(css: string): Map<string, number> {
  const compte = new Map<string, number>()
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const bloc of sansCommentaires.matchAll(/([^@{};]+)\{/g)) {
    for (const brut of bloc[1]!.split(',')) {
      // Seule la dernière ligne du prélude porte le sélecteur.
      const sel = (brut.split('\n').pop() ?? '').trim()
      // On ignore les sélecteurs composés (`.a .b`, `.a:hover`, `.a.b`) : seule
      // la classe seule, celle qui porte la mise en page, nous intéresse.
      if (/^\.[a-z0-9-]+$/i.test(sel)) compte.set(sel, (compte.get(sel) ?? 0) + 1)
    }
  }
  return compte
}

describe('feuille de style', () => {
  it('ne définit pas deux fois la même classe au premier niveau', () => {
    const compte = definitionsParClasse(sansRequetesMedia(CSS))
    const doublons = [...compte.entries()]
      .filter(([sel, n]) => n > 1 && !DOUBLONS_ASSUMES.has(sel))
      .map(([sel, n]) => `${sel} (${n} fois)`)
    expect(
      doublons,
      `Ces classes sont définies plusieurs fois hors @media. Soit deux vues se ` +
        `disputent le même nom — la seconde héritera de la mise en page de la ` +
        `première sans prévenir —, soit la règle a été dupliquée par erreur. ` +
        `Renomme, ou ajoute le nom à DOUBLONS_ASSUMES si le partage est voulu.`,
    ).toEqual([])
  })

  it('ne charge aucune police depuis un service tiers', () => {
    // Le site promet « aucun traceur » à des mineurs. Un @import vers
    // fonts.googleapis.com, ou un src pointant fonts.gstatic.com, enverrait
    // l'adresse IP de chaque élève à Google à chaque visite. Poppins est donc
    // servie depuis le site, en licence OFL.
    const fautifs = [...CSS.matchAll(/@import[^;]+;|url\((https?:[^)]*)\)/g)].map((m) => m[0])
    expect(
      fautifs,
      'Une police ou une feuille chargée depuis un domaine tiers rompt la ' +
        'promesse « aucun traceur ». Embarque le fichier dans le paquet.',
    ).toEqual([])
  })

  it('déclare toutes les graisses de Poppins qu’elle utilise', () => {
    // Une graisse déclarée mais jamais utilisée, c'est du poids livré pour
    // rien ; une graisse utilisée mais non déclarée est synthétisée par le
    // navigateur : le rendu s'épaissit grossièrement, et cela ne se voit sur
    // aucun test unitaire.
    const declarees = new Set(
      [...CSS.matchAll(/@font-face \{[^}]*font-weight:\s*(\d+)[^}]*\}/g)].map((m) => m[1]),
    )
    expect(declarees).toEqual(new Set(['400', '600', '700']))
  })

  it('reconnaît bien un doublon quand il y en a un', () => {
    // Garde-fou : sans lui, une expression régulière cassée ferait passer le
    // test ci-dessus pour de bonnes raisons apparentes et ne protégerait rien.
    const compte = definitionsParClasse(
      '.a { color: red; }\n.b { color: blue; }\n/* un commentaire */\n.a { color: green; }',
    )
    // Le commentaire intercalé est précisément ce qui masquait le doublon.
    expect(compte.get('.a')).toBe(2)
    expect(compte.get('.b')).toBe(1)
  })
})
