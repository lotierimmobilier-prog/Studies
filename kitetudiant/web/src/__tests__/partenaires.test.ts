import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { PAPERNEST, REL_PARTENAIRE } from '../partenaires.ts'

/**
 * Un lien rémunéré ne se pose jamais sans sa mention.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * Ce site s'adresse à des mineurs (règle 3 de CLAUDE.md) et il porte
 * désormais un lien qui le rémunère. Les deux peuvent coexister — à une
 * condition, que le lecteur sache qu'il en est un, au moment où il clique
 * et non dans des mentions légales.
 *
 * Le risque n'est pas qu'on écrive un jour « lien non rémunéré ». Il est
 * qu'on recopie l'adresse dans un deuxième écran — une fiche, un e-mail,
 * un article — sans la phrase qui l'accompagne. C'est exactement comme ça
 * que les deux premières promesses de ce site sont devenues fausses : pas
 * par mensonge, par copie partielle.
 *
 * ── Ce que le test refuse ────────────────────────────────────────────────
 *
 * Un fichier qui contient l'adresse sans contenir la mention, et un montant
 * d'économie promis — que la règle 1 interdit, puisqu'un euro annoncé par
 * un partenaire ne remonte à aucune ligne de calcul datée.
 */

const SRC = resolve(import.meta.dirname, '..')

/** Tous les fichiers de l'application, sauf les tests eux-mêmes. */
function sources(dossier = SRC): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = resolve(dossier, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(chemin)
    return /\.tsx?$/.test(e.name) ? [chemin] : []
  })
}

/** Le fragment qui identifie l'affiliation, sans dépendre de l'URL entière. */
const IDENTIFIANT = 'app.papernest.com'

describe('le lien partenaire est toujours déclaré comme tel', () => {
  const PORTEURS = sources().filter(
    (f) => readFileSync(f, 'utf8').includes(IDENTIFIANT) && !f.endsWith('partenaires.ts'),
  )

  it('aucun écran ne recopie l’adresse en dur', () => {
    /* Elle vit dans `partenaires.ts` et nulle part ailleurs. Recopiée, elle
       se retrouverait un jour posée sans sa mention — et une adresse en
       double, c'est aussi une adresse qu'on oublie de mettre à jour. */
    expect(
      PORTEURS.map((f) => f.slice(SRC.length + 1)),
      'ces fichiers écrivent l’adresse au lieu d’importer PAPERNEST',
    ).toEqual([])
  })

  it('tout écran qui pose le lien affiche la mention de rémunération', () => {
    for (const fichier of sources()) {
      const source = readFileSync(fichier, 'utf8')
      if (!source.includes('PAPERNEST.lien')) continue
      expect(
        source.includes('PAPERNEST.remuneration'),
        `${fichier.slice(SRC.length + 1)} pose le lien sans afficher la mention`,
      ).toBe(true)
    }
  })

  it('au moins un écran le pose vraiment', () => {
    // Sinon les deux tests ci-dessus passeraient sur un site sans partenaire,
    // et diraient « tout va bien » de rien du tout.
    const poseurs = sources().filter((f) => readFileSync(f, 'utf8').includes('PAPERNEST.lien'))
    expect(poseurs.length).toBeGreaterThan(0)
  })
})

describe('ce que la mention doit dire', () => {
  it('dit que le partenaire nous rémunère, pas seulement qu’il est partenaire', () => {
    // « Notre partenaire » tout seul laisse croire à une recommandation
    // éditoriale. Le mot qui compte est celui de l'argent.
    expect(PAPERNEST.remuneration).toMatch(/rémunèr|rémunérat|commission/i)
  })

  it('dit que c’est gratuit pour l’élève', () => {
    expect(PAPERNEST.remuneration).toMatch(/gratuit/i)
  })

  it('ne promet aucune économie chiffrée', () => {
    /* Règle 1 : tout euro affiché remonte à une ligne de calcul avec sa
       source et son millésime. Une économie annoncée par un partenaire n'en
       a aucune. On dit ce que le service FAIT, jamais ce qu'il ferait
       gagner. */
    for (const texte of [PAPERNEST.quoi, PAPERNEST.remuneration]) {
      expect(texte).not.toMatch(/\d[\d  ]*(€|euros?\b)/i)
      expect(texte).not.toMatch(/\d+\s*%/)
      expect(texte).not.toMatch(/jusqu’à|jusqu'à|économise[rz]?\b/i)
    }
  })
})

describe('les attributs du lien', () => {
  it('le déclare rémunéré aux moteurs', () => {
    // Sans « sponsored », un moteur le traite comme une recommandation
    // éditoriale — ce qu'il n'est pas — et peut sanctionner le site.
    expect(REL_PARTENAIRE).toContain('sponsored')
  })

  it('ne laisse fuiter ni la page de départ ni l’accès à la nôtre', () => {
    expect(REL_PARTENAIRE).toContain('noopener')
    expect(REL_PARTENAIRE).toContain('noreferrer')
  })

  it('l’écran emploie bien ces attributs, pas les siens', () => {
    const accueil = readFileSync(resolve(SRC, 'accueil.tsx'), 'utf8')
    expect(accueil).toContain('rel={REL_PARTENAIRE}')
  })
})

describe('les promesses du site restent vraies', () => {
  const COMPTE = readFileSync(resolve(SRC, 'compte.tsx'), 'utf8')
  const texteVisible = COMPTE.replace(/\/\*[\s\S]*?\*\//g, ' ')

  it('ne promet plus « aucune publicité »', () => {
    /* Elle était vraie jusqu'au jour où le site a porté un lien rémunéré.
       Une promesse qu'on garde en faisant ce qu'elle interdit est un
       mensonge ; c'est déjà arrivé deux fois ici, et les deux fois la
       promesse avait survécu des jours au changement qui la contredisait. */
    expect(texteVisible).not.toMatch(/aucune publicité/i)
  })

  it('dit à la place qu’un partenaire nous rémunère', () => {
    // Retirer la phrase sans la remplacer laisserait un silence, qui se lit
    // comme l'ancienne promesse.
    expect(texteVisible).toMatch(/rémunèr/i)
    expect(texteVisible).toMatch(/partenaire/i)
  })
})

describe('ce que les robots lisent du financement', () => {
  const CHEMIN = resolve(SRC, '..', '..', '..', 'dist-kitetudiant', 'llms.txt')
  const SORTIE = existsSync(CHEMIN) ? readFileSync(CHEMIN, 'utf8') : null

  it.skipIf(SORTIE === null)('llms.txt déclare le seul lien commercial du site', () => {
    /* Un moteur génératif à qui l'on demande « ce site est-il fiable ? »
       doit pouvoir répondre avec le financement. Le taire serait le laisser
       présenter le site comme désintéressé. */
    expect(SORTIE).toMatch(/Comment le site est financé/)
    expect(SORTIE).toMatch(/rémunér/i)
  })
})
