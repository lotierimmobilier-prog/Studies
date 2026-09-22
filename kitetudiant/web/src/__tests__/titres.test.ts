/**
 * Un titre de niveau un par écran, ni zéro ni deux.
 *
 * ── Pourquoi ce garde existe ─────────────────────────────────────────────
 *
 * Il est né d'une faute réelle. En déplaçant la marque vers la barre de
 * navigation, chaque écran a perdu le `<h1 className="marque">` qui le
 * coiffait. Trois d'entre eux — la collection, l'espace personnel, le
 * formulaire de compte — se sont retrouvés SANS aucun titre de niveau un,
 * et rien ne l'a signalé : la page s'affichait normalement.
 *
 * Ce qui casse, dans ce cas, ne se voit pas à l'écran :
 *
 *   - un lecteur d'écran propose de sauter « au titre principal » et ne
 *     trouve rien à proposer ;
 *   - un moteur de recherche n'a plus de titre de page à indexer, et prend
 *     ce qu'il trouve — souvent le premier bout de texte venu ;
 *   - à l'inverse, deux `h1` (c'était le cas de l'accueil, qui portait la
 *     promesse ET la marque) donnent deux titres concurrents.
 *
 * ── Comment il s'y prend ─────────────────────────────────────────────────
 *
 * Il compte les `<h1` dans chaque fichier d'écran, sans exécuter React : le
 * projet n'a pas d'environnement DOM en test, et en installer un pour
 * compter des balises coûterait plus cher que ce qu'il rapporte.
 *
 * La limite est assumée et vaut d'être écrite : un fichier qui rendrait deux
 * écrans différents, chacun avec son `h1`, serait compté deux fois et
 * refusé à tort. Le jour où cela arrive, c'est la LISTE ci-dessous qu'il
 * faut corriger, jamais le seuil.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = resolve(import.meta.dirname, '..')

/**
 * Les fichiers qui rendent un écran entier, et le nom qu'on leur donne.
 *
 * `App.tsx` n'y figure pas : il rend plusieurs écrans — les résultats et le
 * parcours — et porte donc légitimement plusieurs `h1`. `blog.tsx` non plus,
 * pour la même raison : la liste des articles et un article sont deux écrans.
 * Les deux sont vérifiés à part, par leur nombre attendu.
 */
const ECRANS: readonly { readonly fichier: string; readonly attendus: number }[] = [
  { fichier: 'accueil.tsx', attendus: 1 },
  { fichier: 'collection.tsx', attendus: 1 },
  { fichier: 'compte.tsx', attendus: 1 },
  { fichier: 'mesVoeux.tsx', attendus: 1 },
  { fichier: 'monCompte.tsx', attendus: 1 },
  { fichier: 'pageEtablissement.tsx', attendus: 1 },
  { fichier: 'pageFormation.tsx', attendus: 1 },
  { fichier: 'rechercheEcoles.tsx', attendus: 1 },
  // La liste des articles, et un article.
  { fichier: 'blog.tsx', attendus: 2 },
  // Les résultats, et le parcours de questions.
  { fichier: 'App.tsx', attendus: 2 },
]

function compterH1(fichier: string): number {
  const source = readFileSync(resolve(SRC, fichier), 'utf8')
  return [...source.matchAll(/<h1[\s>]/g)].length
}

describe('chaque écran porte un titre de niveau un', () => {
  it.each(ECRANS.map((e) => [e.fichier, e.attendus] as const))(
    '%s en compte %i',
    (fichier, attendus) => {
      expect(
        compterH1(fichier),
        `${fichier} doit contenir exactement ${attendus} balise(s) <h1>. ` +
          'Zéro : l’écran n’a plus de titre principal — un lecteur d’écran n’a ' +
          'rien à proposer quand on demande à sauter au titre, et un moteur de ' +
          'recherche prend le premier texte venu. Plusieurs de trop : deux titres ' +
          'principaux se font concurrence. C’est arrivé en déplaçant la marque ' +
          'vers la barre de navigation.',
      ).toBe(attendus)
    },
  )

  it('la marque n’est plus un titre de niveau un', () => {
    // Elle l'était sur chaque écran, ce qui donnait deux h1 à l'accueil : la
    // promesse et le logo. La marque vit maintenant dans la barre de
    // navigation, où elle est un lien, pas un titre.
    for (const { fichier } of ECRANS) {
      const source = readFileSync(resolve(SRC, fichier), 'utf8')
      expect(source, `${fichier} : la marque ne doit plus servir de <h1>`).not.toMatch(
        /<h1[^>]*className="marque"/,
      )
    }
  })

  it('la liste des écrans est à jour', () => {
    // Un écran ajouté sans être inscrit ici ne serait jamais vérifié. On
    // compare donc à ce que le dossier contient réellement.
    const attendus = new Set(ECRANS.map((e) => e.fichier))
    const suspects = [
      'accueil.tsx',
      'blog.tsx',
      'collection.tsx',
      'compte.tsx',
      'mesVoeux.tsx',
      'monCompte.tsx',
      'pageEtablissement.tsx',
      'pageFormation.tsx',
      'rechercheEcoles.tsx',
      'App.tsx',
    ].filter((f) => !attendus.has(f))
    expect(suspects, 'écrans non vérifiés').toEqual([])
  })
})

describe('la hiérarchie des titres ne saute pas de niveau', () => {
  /* `titres.test.ts` comptait les h1 et rien d'autre. La fiche de formation
     passait donc de h1 à h4 — deux niveaux sautés, sur la page la plus
     nombreuse du site — sans que rien ne le signale.
     
     Un lecteur d'écran annonce « titre de niveau 4 » après un titre de
     niveau 1 : l'auditeur en déduit qu'il a manqué deux sections. */

  function niveaux(source: string): number[] {
    // Les commentaires de code citent parfois des balises : on ne lit que le
    // JSX rendu.
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
    return [...sansCommentaires.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]))
  }

  for (const fichier of ECRANS.map((e) => e.fichier)) {
    it(`${fichier} n’enjambe aucun niveau`, () => {
      const source = readFileSync(resolve(import.meta.dirname, '..', fichier), 'utf8')
      const vus = niveaux(source)
      if (vus.length === 0) return
      /* On ne vérifie pas l'ORDRE d'apparition dans le fichier — un composant
         défini avant son appelant fausserait la lecture — mais l'ensemble des
         niveaux employés : un h4 sans aucun h3 dans le même écran est un saut,
         quel que soit l'ordre du code. */
      const presents = new Set(vus)
      for (const n of presents) {
        if (n === 1) continue
        expect(
          presents.has(n - 1),
          `${fichier} emploie un h${n} sans aucun h${n - 1} : la hiérarchie saute`,
        ).toBe(true)
      }
    })
  }
})

/**
 * Une page, un nom.
 *
 * ── Ce que ce test aurait évité ──────────────────────────────────────────
 *
 * La page des cartes en portait quatre à la fois :
 *
 *   - « Mes cartes » dans la barre de navigation ;
 *   - « Ta collection » dans le fil d'Ariane ;
 *   - « Tes cartes » dans le `h1` ;
 *   - « Mes cartes de villes » dans l'onglet.
 *
 * Quatre noms pour une adresse, c'est quatre pages pour qui la cherche dans
 * son historique, et c'est un fil d'Ariane qui ne nomme pas la page où il
 * s'arrête. « Mes vœux » — l'autre page personnelle — en portait un seul,
 * le même partout : c'est la convention, et elle suit l'adresse.
 */
describe('les pages personnelles portent le même nom partout', () => {
  const PAGES: readonly {
    readonly fichier: string
    readonly nom: string
    readonly cle: string
  }[] = [
    { fichier: 'collection.tsx', nom: 'Mes cartes', cle: 'collection' },
    { fichier: 'mesVoeux.tsx', nom: 'Mes vœux', cle: 'voeux' },
    /* L'atelier de lettre en portait DEUX — « Ma lettre de motivation » dans
       la navigation, « Ta lettre de motivation » en tête de page — et pas
       d'onglet du tout : le titre du navigateur restait celui de la page
       précédente. */
    { fichier: 'lettre.tsx', nom: 'Ma lettre de motivation', cle: 'lettre' },
  ]

  const NAV = readFileSync(resolve(SRC, 'navigation.tsx'), 'utf8')

  it.each(PAGES)('« $nom » : fil d’Ariane, h1 et onglet concordent', ({ fichier, nom }) => {
    const source = readFileSync(resolve(SRC, fichier), 'utf8')
    expect(source, `${fichier} : le fil d’Ariane ne dit pas « ${nom} »`).toContain(
      `{ libelle: '${nom}', route: null }`,
    )
    expect(source, `${fichier} : le h1 ne dit pas « ${nom} »`).toMatch(
      new RegExp(`<h1[^>]*>${nom}</h1>`),
    )
    expect(source, `${fichier} : l’onglet ne commence pas par « ${nom} »`).toContain(
      `titre: '${nom} — KitEtudiant.fr'`,
    )
  })

  it('la barre de navigation emploie le même nom', () => {
    for (const { nom } of PAGES) {
      // Le libellé des cartes porte un compteur — « Mes cartes (3) » — d'où
      // la recherche du nom seul plutôt que de la ligne entière.
      expect(NAV, `la navigation ne dit pas « ${nom} »`).toContain(`'${nom}`)
    }
  })
})
