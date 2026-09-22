import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  LEBONCOIN,
  PAPERNEST,
  PARTENAIRES_GERES,
  avecLien,
  lienAutorise,
  partenaireGere,
} from '../partenaires.ts'
import { appliquer, liensDeLaReponse } from '../partenairesEnLigne.tsx'

/**
 * Le lien d'affiliation se règle en console — le reste, non.
 *
 * ── Ce que ce test protège ───────────────────────────────────────────────
 *
 * Deux choses, et elles se tiennent.
 *
 * La première : la mention de rémunération ne doit JAMAIS devenir réglable à
 * côté du lien. Le jour où elle le deviendrait, un lien payé pourrait perdre
 * sa phrase depuis un écran d'administration — sans relecture, sans trace
 * dans le dépôt, et sans que personne s'en aperçoive avant longtemps.
 *
 * La seconde : le logo reste celui du dépôt. Une adresse reréglée hors du
 * domaine du partenaire mettrait donc son logo au-dessus d'un bouton menant
 * ailleurs. Que ce soit une faute de frappe ou une console compromise, le
 * résultat à l'écran est le même — et c'est lui qui compte.
 */

const SRC = resolve(import.meta.dirname, '..')

describe('la liste des partenaires réglables est fermée', () => {
  it('ne contient que ceux déclarés dans le dépôt', () => {
    expect(PARTENAIRES_GERES.map((p) => p.nom)).toEqual(['papernest', 'leboncoin'])
  })

  it('refuse un nom inventé', () => {
    expect(partenaireGere('papernest')).toBe(PAPERNEST)
    expect(partenaireGere('ailleurs')).toBeNull()
    expect(partenaireGere('')).toBeNull()
  })
})

describe('ce qu’une adresse doit être pour remplacer celle du dépôt', () => {
  it('accepte le domaine du partenaire et ses sous-domaines', () => {
    expect(lienAutorise(PAPERNEST, 'https://papernest.com/x').ok).toBe(true)
    expect(lienAutorise(PAPERNEST, 'https://app.papernest.com/onboarding?a=1').ok).toBe(true)
    expect(lienAutorise(LEBONCOIN, 'https://www.leboncoin.fr/recherche?category=10').ok).toBe(
      true,
    )
  })

  it('refuse un autre domaine, et dit pourquoi', () => {
    const verdict = lienAutorise(PAPERNEST, 'https://ailleurs.fr/offre')
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    expect(verdict.raison).toContain('ailleurs.fr')
    expect(verdict.raison).toContain('papernest.com')
  })

  it('refuse un domaine qui se contente de finir par le bon', () => {
    /* `papernest.com.ailleurs.fr` et `pas-papernest.com` finissent tous deux
       par la bonne suite de caractères. Un test écrit avec `includes` les
       laisserait passer — et c'est précisément la forme que prend une
       usurpation de domaine. */
    expect(lienAutorise(PAPERNEST, 'https://papernest.com.ailleurs.fr/x').ok).toBe(false)
    expect(lienAutorise(PAPERNEST, 'https://pas-papernest.com/x').ok).toBe(false)
  })

  it('refuse le http simple', () => {
    /* Le lien part vers un formulaire de souscription : en clair, il est
       lisible et modifiable par n'importe quel intermédiaire du réseau. */
    expect(lienAutorise(PAPERNEST, 'http://app.papernest.com/x').ok).toBe(false)
  })

  it('refuse une adresse qui n’en est pas une', () => {
    expect(lienAutorise(PAPERNEST, 'app.papernest.com/x').ok).toBe(false)
    expect(lienAutorise(PAPERNEST, '').ok).toBe(false)
    expect(lienAutorise(PAPERNEST, '   ').ok).toBe(false)
  })

  it('refuse un identifiant glissé devant l’hôte', () => {
    // `https://papernest.com@ailleurs.fr/` a pour hôte ailleurs.fr : à l'œil,
    // il se lit dans l'autre sens.
    expect(lienAutorise(PAPERNEST, 'https://papernest.com@ailleurs.fr/').ok).toBe(false)
  })

  it('refuse un javascript: même s’il contient le domaine', () => {
    expect(lienAutorise(PAPERNEST, 'javascript:alert("papernest.com")').ok).toBe(false)
  })
})

describe('ce que le navigateur fait d’une adresse reçue', () => {
  it('la pose quand elle est valable', () => {
    const p = avecLien(PAPERNEST, 'https://app.papernest.com/autre-campagne')
    expect(p.lien).toBe('https://app.papernest.com/autre-campagne')
  })

  it('garde celle du dépôt quand elle ne l’est pas', () => {
    /* Le serveur valide déjà — mais c'est ici que l'adresse est posée SOUS le
       logo du partenaire, et sur ce point précis le navigateur n'a aucune
       raison de faire confiance à une réponse. */
    expect(avecLien(PAPERNEST, 'https://ailleurs.fr/x').lien).toBe(PAPERNEST.lien)
    expect(avecLien(PAPERNEST, undefined).lien).toBe(PAPERNEST.lien)
  })

  it('ne change JAMAIS la mention, le nom ni la description', () => {
    /* C'est l'invariant central : le lien se règle, la phrase qui le déclare
       payé ne se règle pas. Si `avecLien` venait un jour à recopier autre
       chose que l'adresse, ce test vire au rouge. */
    const p = avecLien(PAPERNEST, 'https://app.papernest.com/autre-campagne')
    expect(p.remuneration).toBe(PAPERNEST.remuneration)
    expect(p.nom).toBe(PAPERNEST.nom)
    expect(p.quoi).toBe(PAPERNEST.quoi)
    expect(p.domaine).toBe(PAPERNEST.domaine)
  })

  it('applique chaque adresse au bon partenaire', () => {
    const p = appliquer({
      papernest: 'https://app.papernest.com/campagne-2',
      leboncoin: 'https://ailleurs.fr/annonces',
    })
    expect(p.papernest.lien).toBe('https://app.papernest.com/campagne-2')
    expect(p.leboncoin.lien).toBe(LEBONCOIN.lien)
  })

  it('survit à une réponse qui n’a pas la forme attendue', () => {
    for (const corps of [null, 'non', { liens: null }, { liens: 'non' }, {}]) {
      expect(liensDeLaReponse(corps)).toEqual({})
    }
    expect(liensDeLaReponse({ liens: { papernest: 4, leboncoin: 'https://x.fr' } })).toEqual({
      leboncoin: 'https://x.fr',
    })
  })
})

/**
 * L'écran d'administration n'ouvre pas ce qu'il ne doit pas ouvrir.
 *
 * Un champ de saisie de plus dans `Partenaires.tsx` est vite ajouté, et la
 * mention est la seule chose qu'on aurait envie d'y mettre. Ce test le refuse
 * tant que personne n'a écrit ce qui suit ici.
 */
describe('la console ne règle que l’adresse', () => {
  const PANNEAU = readFileSync(resolve(SRC, 'admin', 'Partenaires.tsx'), 'utf8')

  it('n’envoie que le nom et le lien', () => {
    const envois = [...PANNEAU.matchAll(/enregistrerLienPartenaire\(([^)]*)\)/g)]
    expect(envois.length).toBeGreaterThan(0)
    for (const [, args] of envois) {
      expect(args).not.toMatch(/remuneration|quoi|logo|nom:/i)
    }
  })

  it('affiche la mention sans champ pour la modifier', () => {
    expect(PANNEAU).toContain('etat.remuneration')
    /* Un seul champ de saisie, celui de l'adresse. Un second serait
       nécessairement pour autre chose. */
    expect([...PANNEAU.matchAll(/<input/g)]).toHaveLength(1)
    expect(PANNEAU).not.toContain('<textarea')
  })
})

describe('la mention voyage toujours avec le lien', () => {
  /** Tous les fichiers de l'application, sauf les tests. */
  function sources(dossier = SRC): string[] {
    return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
      const chemin = resolve(dossier, e.name)
      if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(chemin)
      return /\.tsx?$/.test(e.name) ? [chemin] : []
    })
  }

  it('aucun écran ne pose l’adresse réglée sans afficher la mention', () => {
    /* Le même invariant que `partenaires.test.ts`, mais sur le chemin réglé :
       le lien peut désormais venir du serveur, et c'est exactement le genre
       de chemin neuf par lequel une mention se perd. */
    for (const fichier of sources()) {
      const source = readFileSync(fichier, 'utf8')
      if (!/partenaires\.papernest\.lien/.test(source)) continue
      expect(
        /partenaires\.papernest\.remuneration/.test(source),
        `${fichier.slice(SRC.length + 1)} pose le lien réglé sans afficher la mention`,
      ).toBe(true)
    }
  })
})
