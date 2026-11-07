import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ArticleIntrouvable, ArticleInvalide, DepotArticles } from '../articles.ts'
import {
  enBlocs,
  enTexte,
  slugDe,
  articleDepuisSaisie,
} from '../../kitetudiant/packages/articles/src/index.ts'

/* ------------------------------------------------------- la mini-syntaxe */

describe('la mini-syntaxe du corps', () => {
  it('reconnaît les quatre formes de bloc', () => {
    expect(
      enBlocs(
        [
          '## Une section',
          '',
          'Un paragraphe.',
          '',
          '- un point',
          '- un autre',
          '',
          '> Une mise en garde.',
        ].join('\n'),
      ),
    ).toEqual([
      { type: 'titre', texte: 'Une section' },
      { type: 'paragraphe', texte: 'Un paragraphe.' },
      { type: 'liste', points: ['un point', 'un autre'] },
      { type: 'encadre', texte: 'Une mise en garde.' },
    ])
  })

  it('recolle les lignes d’un même paragraphe, et sépare sur une ligne vide', () => {
    expect(enBlocs('Première ligne\nsuite du paragraphe\n\nUn autre.')).toEqual([
      { type: 'paragraphe', texte: 'Première ligne suite du paragraphe' },
      { type: 'paragraphe', texte: 'Un autre.' },
    ])
  })

  it('ferme une liste dès qu’un texte ordinaire suit, sans ligne vide', () => {
    const blocs = enBlocs('- un point\nUne phrase.')
    expect(blocs).toEqual([
      { type: 'liste', points: ['un point'] },
      { type: 'paragraphe', texte: 'Une phrase.' },
    ])
  })

  /**
   * C'est la garantie de fond : quoi qu'on tape dans le formulaire, il en
   * sort des données, jamais du balisage. Le rendu passe par des composants
   * React, donc du HTML écrit ici ressort comme du texte visible — pas comme
   * une balise exécutée chez un lecteur.
   */
  it('ne produit aucun balisage, même quand on en tape', () => {
    const blocs = enBlocs('<script>alert(1)</script>\n\n- <img onerror=x>')
    for (const bloc of blocs) {
      expect(bloc.type).toMatch(/^(paragraphe|titre|liste|encadre)$/)
    }
    expect(blocs[0]).toEqual({ type: 'paragraphe', texte: '<script>alert(1)</script>' })
    expect(JSON.stringify(blocs)).not.toContain('dangerously')
  })

  it('fait l’aller-retour : un corps rouvert dans le formulaire redonne les mêmes blocs', () => {
    const texte = '## Section\n\nUn paragraphe.\n\n- a\n- b\n\n> Attention.'
    expect(enBlocs(enTexte(enBlocs(texte)))).toEqual(enBlocs(texte))
  })
})

/* -------------------------------------------------------------- les slugs */

describe('l’identifiant d’URL', () => {
  it('retire les accents et les ligatures plutôt que de les perdre', () => {
    expect(slugDe('Choisir sa ville : le cœur du problème')).toBe(
      'choisir-sa-ville-le-coeur-du-probleme',
    )
    expect(slugDe('Les vœux à l’épreuve du réel')).toBe('les-voeux-a-l-epreuve-du-reel')
  })

  it('ne finit ni ne commence par un tiret, même après troncature', () => {
    const long = slugDe(`${'mot '.repeat(40)}fin`)
    expect(long.length).toBeLessThanOrEqual(80)
    expect(long).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('rend une chaîne vide quand le titre n’a aucun caractère utilisable', () => {
    expect(slugDe('!!! ???')).toBe('')
  })
})

/* ---------------------------------------------------------- la validation */

const CORPS = `## Une section

${'Une phrase de corps qui prend un peu de place. '.repeat(6)}

- un point
- un autre`

const SAISIE = {
  titre: 'Ce qui compte dans vos bulletins',
  chapeau:
    'Les notes ne sont pas tout, et la régularité pèse souvent plus que la pointe. ' +
    'Ce que regardent vraiment les formations, et comment le montrer.',
  corps: CORPS,
  motsCles: ['bulletins', 'terminale'],
}

describe('la validation d’une saisie', () => {
  it('accepte une saisie complète et en déduit le reste', () => {
    const article = articleDepuisSaisie(SAISIE)
    expect(article.slug).toBe('ce-qui-compte-dans-vos-bulletins')
    expect(article.revuLe).toBeNull()
    expect(article.publieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(article.corps.length).toBeGreaterThan(1)
  })

  /**
   * Elle lève plutôt que de corriger en silence : un chapeau vide ou un slug
   * bancal donne un article mal référencé, et personne ne s'en aperçoit avant
   * des mois. Le message revient tel quel au rédacteur, en 400.
   */
  it('refuse, en disant quoi, ce qui rendrait l’article inutilisable', () => {
    const refus = (saisie: Record<string, unknown>): string => {
      try {
        articleDepuisSaisie(saisie)
      } catch (e) {
        expect(e).toBeInstanceOf(ArticleInvalide)
        return (e as Error).message
      }
      throw new Error('la saisie aurait dû être refusée')
    }

    expect(refus({ ...SAISIE, titre: 'Court' })).toMatch(/titre/i)
    expect(refus({ ...SAISIE, titre: undefined })).toMatch(/titre/i)
    expect(refus({ ...SAISIE, chapeau: 'Trop court.' })).toMatch(/chapeau/i)
    expect(refus({ ...SAISIE, chapeau: 'a'.repeat(300) })).toMatch(/chapeau/i)
    expect(refus({ ...SAISIE, corps: 'Trop court.' })).toMatch(/corps/i)
    expect(refus({ ...SAISIE, corps: `${'a'.repeat(300)}` })).toMatch(/deux blocs/i)
    expect(refus({ ...SAISIE, titre: '!!! ??? !!! ??? !!!' })).toMatch(/identifiant/i)
  })

  it('normalise les mots-clés et en limite le nombre', () => {
    const article = articleDepuisSaisie({
      ...SAISIE,
      motsCles: [' Parcoursup ', 'BULLETINS', '', 42, ...Array.from({ length: 10 }, (_, i) => `m${i}`)],
    })
    expect(article.motsCles.slice(0, 2)).toEqual(['parcoursup', 'bulletins'])
    expect(article.motsCles.length).toBeLessThanOrEqual(8)
  })

  it('respecte une date de publication fournie, ignore une date absurde', () => {
    expect(articleDepuisSaisie({ ...SAISIE, publieLe: '2026-03-01' }).publieLe).toBe('2026-03-01')
    expect(articleDepuisSaisie({ ...SAISIE, publieLe: 'hier' }).publieLe).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })
})

/* ----------------------------------------------------------------- le dépôt */

describe('le dépôt d’articles', () => {
  let dossier: string
  let depot: DepotArticles

  beforeEach(() => {
    dossier = mkdtempSync(join(tmpdir(), 'articles-'))
    depot = new DepotArticles(join(dossier, 'articles.json'))
  })
  afterEach(() => rmSync(dossier, { recursive: true, force: true }))

  it('part d’une liste vide quand rien n’a jamais été écrit', async () => {
    expect(await depot.lister()).toEqual([])
    expect(await depot.etat()).toEqual({ nombre: 0, dernierLe: null })
  })

  it('publie, relit depuis le disque, et ne laisse pas fuir sa trace d’écriture', async () => {
    await depot.publier(SAISIE)

    const relu = await new DepotArticles(join(dossier, 'articles.json')).lister()
    expect(relu).toHaveLength(1)
    expect(relu[0]!.titre).toBe(SAISIE.titre)
    // `ecritLe` sert à l'exploitation ; il n'a rien à faire dans l'API publique.
    expect(Object.keys(relu[0]!)).not.toContain('ecritLe')
    expect(JSON.parse(readFileSync(join(dossier, 'articles.json'), 'utf8'))[0].ecritLe).toBeTypeOf(
      'string',
    )
  })

  /**
   * Republier corrige un texte, ça ne le republie pas : il ne doit ni remonter
   * en tête de liste, ni repartir à neuf aux yeux d'un moteur de recherche.
   */
  it('garde la date de publication d’origine et note la révision', async () => {
    const premier = await depot.publier({ ...SAISIE, publieLe: '2026-01-05' })
    expect(premier.revuLe).toBeNull()

    const corrige = await depot.publier({ ...SAISIE, publieLe: '2026-09-20', chapeau: `${SAISIE.chapeau} Corrigé.` })
    expect(corrige.slug).toBe(premier.slug)
    expect(corrige.publieLe).toBe('2026-01-05')
    expect(corrige.revuLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await depot.lister()).toHaveLength(1)
  })

  it('classe du plus récent au plus ancien', async () => {
    await depot.publier({ ...SAISIE, titre: 'Le premier article publié', publieLe: '2026-01-05' })
    await depot.publier({ ...SAISIE, titre: 'Le second article publié', publieLe: '2026-06-05' })
    expect((await depot.lister()).map((a) => a.publieLe)).toEqual(['2026-06-05', '2026-01-05'])
  })

  it('refuse une saisie invalide sans rien écrire', async () => {
    await expect(depot.publier({ ...SAISIE, chapeau: '' })).rejects.toBeInstanceOf(ArticleInvalide)
    await expect(depot.publier('un texte')).rejects.toBeInstanceOf(ArticleInvalide)
    await expect(depot.publier(null)).rejects.toBeInstanceOf(ArticleInvalide)
    expect(await depot.lister()).toEqual([])
  })

  it('retire un article, et dit lequel manque quand il n’existe pas', async () => {
    const publie = await depot.publier(SAISIE)
    await depot.retirer(publie.slug)
    expect(await depot.lister()).toEqual([])
    await expect(depot.retirer(publie.slug)).rejects.toBeInstanceOf(ArticleIntrouvable)
  })

  /**
   * Un fichier illisible ne doit pas empêcher l'API de démarrer : le blog du
   * dépôt reste en ligne, seuls les articles de la console manquent.
   */
  it('traite un fichier corrompu comme « aucun article » plutôt que de tomber', async () => {
    const fichier = join(dossier, 'casse', 'articles.json')
    mkdirSync(join(dossier, 'casse'))
    writeFileSync(fichier, '{ pas du JSON', 'utf8')
    const abime = new DepotArticles(fichier)
    expect(await abime.lister()).toEqual([])
    // Et il repart : publier écrase le fichier illisible.
    await abime.publier(SAISIE)
    expect(await abime.lister()).toHaveLength(1)
  })

  it('rend un état d’exploitation utilisable par la console', async () => {
    await depot.publier(SAISIE)
    const etat = await depot.etat()
    expect(etat.nombre).toBe(1)
    expect(etat.dernierLe).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
