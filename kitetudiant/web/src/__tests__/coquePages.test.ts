import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Chaque page rend sa propre coque.
 *
 * ── Ce qui s'est passé ───────────────────────────────────────────────────
 *
 * `App.tsx` enveloppe chaque vue dans `coque()`, qui pose la barre de
 * navigation et un `div`. La LARGEUR, la gouttière et le centrage, eux,
 * viennent du `<main className="app …">` que chaque page rend elle-même.
 *
 * L'atelier de lettre n'en rendait aucun. Il n'y avait donc, sur cette page
 * et sur elle seule : aucune limite de largeur, aucune gouttière — le titre
 * et le texte collés au bord gauche de la fenêtre —, et aucun repère de
 * navigation pour un lecteur d'écran.
 *
 * Rien ne le signalait. Le build passait, les tests passaient, la page
 * s'affichait : elle s'affichait simplement de travers, en production, depuis
 * sa mise en ligne. Mesuré le 22/09/2026 sur les cinq pages du site :
 * 32 px de gouttière partout, 0 ici.
 *
 * ── Ce que ce test exige ─────────────────────────────────────────────────
 *
 * Que chaque page rende un `main` portant la classe `app`. C'est tout ce qui
 * manquait, et c'est le genre d'oubli qu'on ne voit pas en relisant un diff.
 */

const SRC = resolve(import.meta.dirname, '..')

/**
 * La source sans ses commentaires.
 *
 * Indispensable ici : les commentaires de ces fichiers CITENT la balise qu'on
 * cherche, pour expliquer pourquoi elle doit être là. Sans ce nettoyage, le
 * test trouvait la phrase au lieu du code — et passait au vert sur un fichier
 * dont on venait de retirer le `main`. Constaté en cassant délibérément
 * lettre.tsx : deux occurrences, dont une dans un commentaire.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

/**
 * Les écrans qui rendent leur propre coque.
 *
 * `compte.tsx` n'y est pas, et ce n'est pas un oubli : c'est un FORMULAIRE,
 * pas une page. Il est posé tel quel dans deux vues et dans une modale, et
 * c'est `App.tsx` qui lui met un `main` autour à l'endroit où il sert de
 * page. Le test suivant tient ce cas-là. Sa première version le comptait ici
 * et virait au rouge sur une page parfaitement correcte.
 */
const PAGES = [
  'accueil.tsx',
  'blog.tsx',
  'collection.tsx',
  'lettre.tsx',
  'mentionsLegales.tsx',
  'mesVoeux.tsx',
  'monCompte.tsx',
  'pageEtablissement.tsx',
  'pageFormation.tsx',
  'rechercheEcoles.tsx',
] as const

describe('chaque page pose sa coque', () => {
  it.each(PAGES)('%s rend un <main className="app …">', (fichier) => {
    const source = sansCommentaires(readFileSync(resolve(SRC, fichier), 'utf8'))
    expect(
      source,
      `${fichier} ne rend aucun <main className="app …"> : sa page n’aura ni ` +
        `largeur bornée, ni gouttière, ni repère de navigation, et son texte ` +
        `sera collé au bord gauche de la fenêtre.`,
    ).toMatch(/<main className="app\b/)
  })

  it('le formulaire de compte reçoit sa coque de App.tsx', () => {
    /* Il n'est pas une page : la même pièce sert /connexion, /inscription et
       une modale. C'est donc l'appelant qui décide s'il fait page — et pour
       les deux vues qui en font une, il doit poser le `main`. */
    const app = sansCommentaires(readFileSync(resolve(SRC, 'App.tsx'), 'utf8'))
    /* App le pose à TROIS endroits — /connexion, /inscription et la demande
       de compte qui interrompt un parcours — et ces trois-là passent par deux
       appels. Compter, et non chercher une fois : un test qui se contentait
       d'une occurrence restait vert quand on retirait l'un des deux `main`,
       ce que j'ai vérifié en le cassant. */
    const poses = [...app.matchAll(/<main className="app">\s*\n\s*<Compte/g)]
    const appels = [...app.matchAll(/<Compte\b/g)]
    expect(appels.length, 'le formulaire de compte n’est plus posé nulle part').toBeGreaterThan(0)
    expect(
      poses.length,
      `${appels.length} appel(s) à <Compte>, mais ${poses.length} dans un <main> : ` +
        `l’un d’eux fera une page sans largeur ni gouttière.`,
    ).toBe(appels.length)
  })

  it('l’atelier de lettre passe par la même coque que les autres', () => {
    /* Nommé à part parce que c'est celui qui a manqué, et parce que le test
       ci-dessus passerait si quelqu'un le retirait de la liste. */
    const lettre = sansCommentaires(readFileSync(resolve(SRC, 'lettre.tsx'), 'utf8'))
    expect(lettre).toMatch(/<main className="app app-large">/)
    // Et son fil d'Ariane, comme les deux autres pages personnelles.
    expect(lettre).toContain('<FilAriane')
  })

  it('aucune page ne se donne une largeur qui déborde de sa coque', () => {
    /* `.app-large` borne à 72 rem et pose la gouttière. Une largeur plus
       grande posée à l'intérieur déborderait, ou rouvrirait la question de
       savoir lequel des deux commande. Le premier jet de l'atelier portait
       un `max-width: 76rem` qui faisait exactement ça. */
    const css = sansCommentaires(readFileSync(resolve(SRC, 'styles.css'), 'utf8'))
    const trop = [...css.matchAll(/max-width:\s*(\d+(?:\.\d+)?)rem/g)]
      .map((m) => Number(m[1]))
      .filter((rem) => rem > 72)
    expect(
      trop,
      `des largeurs dépassent les 72 rem de la coque : ${trop.join(', ')}`,
    ).toEqual([])
  })
})
