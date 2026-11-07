import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cheminDe, routeDuChemin, type Route } from '../routes.ts'

/**
 * Chaque route du site a un sort explicite : indexée, ou écartée.
 *
 * ── Ce que ce test aurait évité ──────────────────────────────────────────
 *
 * `routes.ts` déclarait onze chemins ; le plan du site en contenait trois
 * formes. La page « Chercher une école » — la seule qui réponde à « qu'est-ce
 * qu'il y a comme écoles à Limoges ? » — n'était ni au plan, ni liée depuis
 * l'accueil livrée. Aucun robot ne pouvait l'atteindre.
 *
 * Dans l'autre sens, cinq pages privées — connexion, inscription, compte,
 * cartes, vœux — n'étaient écartées d'aucun index.
 *
 * Rien ne le signalait : `seo.test.ts` vérifiait que les articles étaient
 * bouclés, pas que la liste des routes l'était. Un commentaire de `routes.ts`
 * évoquait pourtant un `routes.test.ts` qui n'existait pas.
 *
 * ── Ce qu'il exige ───────────────────────────────────────────────────────
 *
 * Toute route ajoutée à `routes.ts` doit apparaître dans `prerendre.ts`, d'un
 * côté ou de l'autre. Une route oubliée fait échouer ce test au lieu de
 * disparaître en silence.
 */

const PRERENDU = readFileSync(
  resolve(import.meta.dirname, '..', '..', '..', 'scripts', 'prerendre.ts'),
  'utf8',
)

/**
 * Un exemplaire de chaque forme de route.
 *
 * Écrit à la main plutôt que dérivé du type : c'est la LISTE qui doit faire
 * échouer le test quand une route apparaît sans qu'on y pense, et une liste
 * dérivée automatiquement ne le ferait jamais.
 */
const TOUTES: readonly Route[] = [
  { vue: 'accueil' },
  { vue: 'blog' },
  { vue: 'article', slug: 'comprendre-parcoursup-en-dix-minutes' },
  { vue: 'recherche' },
  { vue: 'formation', code: '2519' },
  { vue: 'etablissement', uai: '0870669E' },
  { vue: 'connexion' },
  { vue: 'inscription' },
  { vue: 'compte' },
  { vue: 'collection' },
  { vue: 'voeux' },
  { vue: 'mentions' },
  { vue: 'lettre' },
]

/** Les chemins que le pré-rendu écarte nommément des index. */
const PRIVES = ['connexion', 'inscription', 'mon-compte', 'mes-cartes', 'mes-voeux']

/**
 * Les fiches ne sont ni au plan ni interdites, et c'est assumé.
 *
 * Elles se comptent par milliers et dépendent d'un appel à l'open data :
 * `prerendre.ts` ne sait pas les générer sans un export local des données.
 * Elles restent donc atteignables et indexables — par les liens de la
 * recherche — mais absentes du plan. Le jour où on voudra les y mettre, il
 * faudra un export ; d'ici là, ce test dit que le silence est délibéré.
 */
const HORS_PLAN_ASSUME = ['formation', 'etablissement']

describe('toute route a un sort explicite', () => {
  it('la liste d’épreuve couvre chaque forme de route', () => {
    // Si `routes.ts` gagne une vue, `cheminDe` la connaîtra et ce test
    // continuera de passer — d'où le garde-fou : on compte les cas du
    // `switch`, et on exige autant d'entrées ici.
    const casDuSwitch = (PRERENDU.length > 0 && readFileSync(
      resolve(import.meta.dirname, '..', 'routes.ts'),
      'utf8',
    ).match(/^\s*case '[a-z]+':/gm)) || []
    expect(new Set(casDuSwitch).size).toBe(TOUTES.length)
  })

  it('chaque route publique est au plan du site ou liée depuis l’accueil', () => {
    for (const route of TOUTES) {
      const chemin = cheminDe(route).replace(/^\//, '')
      if (route.vue === 'article' || HORS_PLAN_ASSUME.includes(route.vue)) continue
      if (PRIVES.includes(chemin)) continue
      const racine = chemin === '' ? 'BASE}`' : chemin
      expect(
        PRERENDU.includes(racine),
        `« ${chemin || '(racine)'} » n’apparaît pas dans prerendre.ts : ` +
          `ni au plan du site, ni dans les liens de l’accueil, ni parmi les chemins privés`,
      ).toBe(true)
    }
  })

  it('chaque route privée est écartée des index', () => {
    for (const route of TOUTES) {
      const chemin = cheminDe(route).replace(/^\//, '')
      if (!PRIVES.includes(chemin)) continue
      expect(
        PRERENDU.includes(`'${chemin}'`),
        `« ${chemin} » doit figurer dans CHEMINS_PRIVES de prerendre.ts`,
      ).toBe(true)
    }
  })

  it('les chemins privés déclarés existent vraiment', () => {
    // L'inverse du test précédent : un chemin écarté qui ne correspond à
    // aucune route interdirait une adresse qui n'existe pas, et laisserait
    // croire que le travail est fait.
    const connus = TOUTES.map((r) => cheminDe(r).replace(/^\//, ''))
    for (const prive of PRIVES) {
      expect(connus, `« ${prive} » est écarté mais n’est pas une route`).toContain(prive)
    }
  })

  it('chaque chemin se relit dans les deux sens', () => {
    // Une adresse au plan du site qui ne se relit pas donne une page
    // d'accueil déguisée — le pire cas pour un moteur, qui y voit un doublon.
    for (const route of TOUTES) {
      const relue = routeDuChemin(cheminDe(route))
      expect(relue, `« ${cheminDe(route)} » ne se relit pas`).not.toBeNull()
      expect(relue?.vue).toBe(route.vue)
    }
  })
})

/**
 * Le repli de nginx ne doit pas faire mentir les pages qu'il sert.
 *
 * ── Ce que ce test aurait évité ──────────────────────────────────────────
 *
 * La configuration disait « try_files $uri $uri/ /index.html ». Une adresse
 * sans fichier — et c'est le cas de TOUTES les fiches, qui se comptent par
 * milliers — recevait donc index.html, c'est-à-dire l'accueil pré-rendue,
 * avec son propre :
 *
 *     <link rel="canonical" href="https://kitetudiant.fr/">
 *
 * Chaque fiche déclarait ainsi elle-même être un doublon de l'accueil. Un
 * canonique n'est pas une suggestion : c'est la façon la plus efficace qui
 * soit de faire désindexer ses propres pages.
 *
 * `useMetadonnees` corrige au montage de React, mais le canonique est lu
 * AVANT — par un moteur qui explore sans exécuter le JavaScript, et par
 * tous les robots d'aperçu, dont aucun n'en exécute.
 *
 * Rien ne le signalait : `seo.test.ts` vérifiait que les articles étaient
 * bouclés, et `metadonnees.ts` faisait son travail. Le défaut vivait dans
 * l'espace entre le script de pré-rendu et la configuration du serveur, que
 * ni l'un ni l'autre ne lisait.
 */
describe('les vues rendues par React ne se déclarent pas doublons de l’accueil', () => {
  const RACINE = resolve(import.meta.dirname, '..', '..', '..', '..')
  const SETUP = readFileSync(resolve(RACINE, 'deploy', 'vps-setup.sh'), 'utf8')
  const EXEMPLE = readFileSync(resolve(RACINE, 'deploy', 'nginx.conf.example'), 'utf8')
  const NGINX = [SETUP, EXEMPLE]

  it('le pré-rendu écrit une coquille de repli', () => {
    expect(PRERENDU).toContain("join(SORTIE, 'app.html')")
  })

  it('elle ne déclare ni canonique ni og:url', () => {
    /* Le `null` passé à `coquilleAvec`. Une page qui n'annonce pas sa forme
       canonique est prise pour elle-même — ce qu'on veut ; une page qui en
       annonce une fausse est effacée au profit de celle qu'elle désigne. */
    const bloc = PRERENDU.slice(PRERENDU.indexOf("join(SORTIE, 'app.html')"))
    const appel = bloc.slice(0, bloc.indexOf('\n)'))
    expect(appel).toMatch(/^\s*null,\s*$/m)
    expect(appel).not.toContain('ORIGINE')
  })

  it('nginx retombe sur elle, et jamais sur l’accueil', () => {
    for (const conf of NGINX) {
      const replis = [...conf.matchAll(/try_files[^;]*;/g)].map((m) => m[0])
      expect(replis.length, 'aucun try_files trouvé : le test ne vérifie rien').toBeGreaterThan(0)
      for (const repli of replis) {
        expect(
          repli,
          `« ${repli.trim()} » sert l’accueil pré-rendue en repli, ` +
            `avec son canonique vers « / »`,
        ).not.toMatch(/\/(?:[a-z0-9-]+\/)?index\.html/)
      }
    }
  })

  it('les deux modes de déploiement sont couverts', () => {
    // vps-setup.sh en pose deux : racine de domaine, et sous-chemin.
    expect([...SETUP.matchAll(/try_files[^;]*app\.html;/g)]).toHaveLength(2)
  })
})
