import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  ARTICLES,
  MENTION_SOURCE,
  minutesDeLecture,
  mots,
} from '../../../packages/articles/src/index.ts'
import { adresseComplete, cheminDe, routeDuChemin } from '../routes.ts'

const SRC = resolve(import.meta.dirname, '..')

/* ------------------------------------------------------------------ routes */

describe('les adresses du site', () => {
  it('se déduisent de la base de déploiement, jamais d’un chemin écrit en dur', () => {
    // En test comme en développement, BASE_URL vaut « / ».
    expect(cheminDe({ vue: 'accueil' })).toBe('/')
    expect(cheminDe({ vue: 'blog' })).toBe('/blog')
    expect(cheminDe({ vue: 'article', slug: 'x' })).toBe('/blog/x')
  })

  it('font l’aller-retour', () => {
    for (const route of [
      { vue: 'accueil' },
      { vue: 'blog' },
      { vue: 'article', slug: 'comprendre-parcoursup-en-dix-minutes' },
    ] as const) {
      expect(routeDuChemin(cheminDe(route))).toEqual(route)
    }
  })

  it('tolèrent une barre oblique finale', () => {
    expect(routeDuChemin('/blog/')).toEqual({ vue: 'blog' })
  })

  it('rendent null — et non l’accueil — pour un chemin étranger', () => {
    // null veut dire « ce chemin ne me concerne pas » : l'application garde sa
    // vue. Retomber sur l'accueil effacerait le parcours en cours.
    expect(routeDuChemin('/kitetudiant/blog')).toBeNull()
    expect(routeDuChemin('/blog/Mauvais_Slug')).toBeNull()
    expect(routeDuChemin('/blog/trop/profond')).toBeNull()
  })

  it('fabriquent une adresse absolue pour le lien canonique', () => {
    expect(adresseComplete({ vue: 'article', slug: 'x' }, 'https://kitetudiant.fr')).toBe(
      'https://kitetudiant.fr/blog/x',
    )
    // Une barre oblique de trop dans l'origine ne doit pas doubler.
    expect(adresseComplete({ vue: 'blog' }, 'https://kitetudiant.fr/')).toBe(
      'https://kitetudiant.fr/blog',
    )
  })

  it('ne sont écrites en dur dans aucun fichier du front', () => {
    const fautifs: string[] = []
    for (const fichier of sources(SRC)) {
      if (fichier.endsWith('/routes.ts')) continue
      const source = readFileSync(fichier, 'utf8')
      for (const m of source.matchAll(/['"`]\/blog(?:\/|['"`])/g)) {
        fautifs.push(`${fichier.replace(`${SRC}/`, '')}:${source.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(
      fautifs,
      'Le site est servi sous un sous-chemin : « /blog » vise la racine du ' +
        'serveur, où il n’y a rien. Passe par cheminDe() de routes.ts.',
    ).toEqual([])
  })
})

function sources(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) {
      if (entree === '__tests__' || entree === 'images' || entree === 'polices') continue
      trouves.push(...sources(chemin))
    } else if (/\.tsx?$/.test(entree)) {
      trouves.push(chemin)
    }
  }
  return trouves
}

/* ---------------------------------------------------------------- articles */

describe('les articles', () => {
  it('sont au moins dix, comme demandé', () => {
    expect(ARTICLES.length).toBeGreaterThanOrEqual(10)
  })

  it('ont un identifiant d’URL unique et sans surprise', () => {
    const slugs = ARTICLES.map((a) => a.slug)
    expect(new Set(slugs).size, 'deux articles partagent un slug').toBe(slugs.length)
    for (const slug of slugs) {
      // Minuscules, chiffres et tirets : c'est ce que routeDuChemin accepte,
      // et ce qui survit à un copier-coller d'URL.
      expect(slug, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(routeDuChemin(`/blog/${slug}`)).toEqual({ vue: 'article', slug })
    }
  })

  /**
   * Règle 1 de CLAUDE.md : aucun montant affiché ne peut venir d'ailleurs que
   * d'une ligne de calcul sourcée et datée. Un article vieillit, un barème
   * change. Les articles renvoient donc au calculateur, qui affiche les
   * montants avec leur millésime.
   */
  it('ne citent aucun montant en euros', () => {
    const fautifs: string[] = []
    for (const a of ARTICLES) {
      const textes = [a.chapeau, ...a.corps.flatMap((b) => (b.type === 'liste' ? b.points : [b.texte]))]
      for (const texte of textes) {
        if (/\d[\d   ]*(€|euros?\b)/i.test(texte)) {
          fautifs.push(`${a.slug} → ${texte.slice(0, 60)}…`)
        }
      }
    }
    expect(
      fautifs,
      'Un montant écrit dans un article échappe à sa source et à son millésime, ' +
        'et devient faux dès que le barème change. Renvoie au calculateur.',
    ).toEqual([])
  })

  it('portent un chapeau utilisable comme description par un moteur', () => {
    for (const a of ARTICLES) {
      // Trop court, il n'apprend rien ; trop long, il est tronqué dans les
      // résultats de recherche.
      expect(a.chapeau.length, `${a.slug} : ${a.chapeau.length} caractères`).toBeGreaterThan(70)
      expect(a.chapeau.length, `${a.slug} : ${a.chapeau.length} caractères`).toBeLessThan(220)
    }
  })

  it('ont une date de publication réelle et un corps non vide', () => {
    for (const a of ARTICLES) {
      expect(a.publieLe, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(a.publieLe).getTime()), a.slug).toBe(false)
      expect(a.corps.length, a.slug).toBeGreaterThan(2)
      for (const bloc of a.corps) {
        if (bloc.type === 'liste') {
          expect(bloc.points.length, a.slug).toBeGreaterThan(1)
          for (const point of bloc.points) expect(point.trim(), a.slug).not.toBe('')
        } else {
          expect(bloc.texte.trim(), a.slug).not.toBe('')
        }
      }
    }
  })

  it('ne citent aucune date précise ni aucun millésime de session', () => {
    // Les articles parlent en mois, parce que l'ordre des phases est la seule
    // chose stable d'une année sur l'autre. Un « 13 mars 2027 » écrit ici
    // échapperait à l'avertissement du calendrier et survivrait à la
    // publication du vrai calendrier — donc deviendrait faux sans que rien ne
    // le signale. Les jours vivent dans calendrier.ts, eux seuls.
    const MOIS =
      'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre'
    const fautifs: string[] = []
    for (const a of ARTICLES) {
      const textes = [
        a.titre,
        a.chapeau,
        ...a.corps.flatMap((b) => (b.type === 'liste' ? b.points : [b.texte])),
      ]
      for (const texte of textes) {
        if (new RegExp(`\\b\\d{1,2}(er|ᵉʳ)?\\s+(${MOIS})\\b`, 'i').test(texte))
          fautifs.push(`${a.slug} — jour précis → ${texte.slice(0, 60)}…`)
        if (/\b20\d\d\b/.test(texte))
          fautifs.push(`${a.slug} — année → ${texte.slice(0, 60)}…`)
      }
    }
    expect(
      fautifs,
      'Un article se lit pendant plusieurs sessions. Parle en mois, et laisse les ' +
        'jours au calendrier, qui porte son millésime et son avertissement.',
    ).toEqual([])
  })

  it('annoncent qu’ils ne sont pas un texte officiel', () => {
    // Le site n'est pas affilié à Parcoursup ; un article qui décrit la
    // procédure doit le dire, sans quoi il passe pour une source officielle.
    expect(MENTION_SOURCE).toMatch(/pas un texte officiel/i)
    expect(MENTION_SOURCE).toMatch(/parcoursup\.gouv\.fr/)
    // Et qu'il ne prétend pas donner les dates de la session à venir.
    expect(MENTION_SOURCE).toMatch(/non les dates de la session à venir/i)
    expect(MENTION_SOURCE).toMatch(/fixées chaque année par l’État|fixées chaque année par l'État/)
  })

  it('font entre 600 et 900 mots', () => {
    // Un article de 300 mots se lit bien mais ne se classe pas : il n'a pas la
    // matière pour répondre à une recherche, et un moteur le traite comme une
    // page d'appoint. La borne haute compte autant — au-delà, on dilue, et le
    // lecteur décroche avant la partie utile.
    const fautifs = ARTICLES.filter((a) => mots(a) < 600 || mots(a) > 900).map(
      (a) => `${a.slug} : ${mots(a)} mots`,
    )
    expect(fautifs, 'Longueur visée : 600 à 900 mots, chapeau compris.').toEqual([])
  })

  it('annoncent un temps de lecture cohérent avec leur longueur', () => {
    for (const a of ARTICLES) {
      expect(minutesDeLecture(a), a.slug).toBe(Math.max(1, Math.round(mots(a) / 200)))
      expect(minutesDeLecture(a), a.slug).toBeGreaterThanOrEqual(1)
    }
  })

  it('n’emploient pas de formule anxiogène', () => {
    // CLAUDE.md : jamais « aucune chance ». Le blog parle à des lycéens qui
    // décident de leur année.
    for (const a of ARTICLES) {
      const tout = [a.titre, a.chapeau, ...a.corps.flatMap((b) => (b.type === 'liste' ? b.points : [b.texte]))]
        .join(' ')
        .toLowerCase()
      expect(tout, a.slug).not.toMatch(/aucune chance|c'est fichu|trop tard pour toi/)
    }
  })
})
