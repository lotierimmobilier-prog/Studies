import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  ARTICLES,
  MENTION_SOURCE,
  minutesDeLecture,
  mots,
  tousLesTextes,
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
      for (const texte of tousLesTextes(a)) {
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
      for (const texte of tousLesTextes(a)) {
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

/**
 * Le site tutoie. Les quinze articles vouvoyaient.
 *
 * ── Ce qui s'est passé ───────────────────────────────────────────────────
 *
 * Tous les écrans s'adressent à l'élève au tutoiement — « Tes vœux »,
 * « Crée ton compte », « Voir ce qu'il me restera pour vivre ». Les
 * articles, écrits plus tard, vouvoyaient : 265 pronoms et déterminants,
 * 183 formes verbales, sur les quinze.
 *
 * Ce n'est pas une question de goût. Le site s'adresse à des mineurs
 * (règle 3 de CLAUDE.md) ; changer de registre entre l'outil et le texte
 * qui l'explique donne l'impression de deux sites cousus ensemble, et
 * c'est le genre de détail qui fait douter du reste.
 *
 * ── Pourquoi un test, et pas seulement une relecture ─────────────────────
 *
 * Les articles sont modifiables depuis la console d'administration, et un
 * article ajouté dans six mois sera écrit par quelqu'un qui n'aura pas lu
 * ce commentaire. Le registre se vérifie mécaniquement : autant le faire.
 */
describe('les articles tutoient, comme le reste du site', () => {
  /* `vous`, `votre`, `vos`, et le possessif `le vôtre` — le seul qui ne se
     devine pas depuis les trois premiers. Pas de `-ez` ici : « chez »,
     « assez », « cherchez » ne se distinguent pas par une expression
     régulière, et un test qui crie au loup finit ignoré. */
  const VOUVOIEMENT = /\b(vous|votre|vos|vôtres?)\b/i

  it.each(ARTICLES.map((a) => [a.slug, a] as const))(
    '« %s » n’emploie ni « vous » ni « votre »',
    (_slug, article) => {
      for (const texte of tousLesTextes(article)) {
        const trouve = VOUVOIEMENT.exec(texte)
        expect(
          trouve,
          trouve === null
            ? ''
            : `« ${trouve[0]} » dans : « ${texte.slice(Math.max(0, trouve.index - 60), trouve.index + 60)} »`,
        ).toBeNull()
      }
    },
  )

  it('le tutoiement est bien présent, et pas seulement le vouvoiement absent', () => {
    /* Le pendant positif. Un article écrit à la troisième personne — « le
       candidat doit », « il faut » — passerait le test précédent sans
       tutoyer personne, et c'est une autre façon de tenir le lecteur à
       distance. */
    for (const article of ARTICLES) {
      const entier = tousLesTextes(article).join(' ')
      expect(
        entier,
        `« ${article.slug} » ne s’adresse jamais à l’élève`,
      ).toMatch(/\b(tu|ton|ta|tes|te|t’|toi)\b/i)
    }
  })

  it('le slug de l’article « bulletins » reste tel qu’il est publié', () => {
    /* Sa conversion l'avait emporté aussi — les tirets font frontière de
       mot — et une adresse publiée ne se renomme pas : le lien casse,
       l'indexation acquise est perdue, et la carte de partage
       `partage/…-vos-bulletins.png` ne correspond plus.
       
       Conséquence assumée : l'adresse dit « vos » et le titre dit « tes ».
       Le jour où ça vaudra la peine, il faudra un nouveau slug ET une
       redirection depuis l'ancien, pas un renommage sec. */
    expect(ARTICLES.map((a) => a.slug)).toContain(
      'ce-qui-compte-vraiment-dans-vos-bulletins',
    )
  })
})
