/**
 * Garder un vœu depuis la liste des résultats.
 *
 * Le mécanisme existait, mais seulement sur la fiche d'une formation : depuis
 * la liste, il fallait ouvrir la fiche, enregistrer, puis revenir — trois
 * écrans pour un geste qu'on fait quarante fois en comparant.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { Voeu } from '../donnees.ts'
import {
  codesEnregistres,
  gesteDuClic,
  libelleDuBouton,
  MAXIMUM_VOEUX,
  nomAccessible,
  rangDe,
  rappelDuPlafond,
} from '../voeuxRapides.ts'

const SRC = resolve(__dirname, '..')

function voeu(rang: number, codeFormation: string): Voeu {
  return { rang, codeFormation, session: 2026, signalement: null, ajouteLe: '2026-09-01' }
}

const LISTE = [voeu(1, '12'), voeu(2, '34'), voeu(3, '56')]

describe('savoir ce qui est déjà gardé', () => {
  it('rend les codes enregistrés', () => {
    const gardes = codesEnregistres(LISTE)
    expect(gardes.has('12')).toBe(true)
    expect(gardes.has('99')).toBe(false)
  })

  it('ne se trompe pas de liste vide', () => {
    expect(codesEnregistres([]).size).toBe(0)
  })
})

describe('le rang, relu et jamais mémorisé', () => {
  it('trouve le rang d’un code', () => {
    expect(rangDe(LISTE, '34')).toBe(2)
    expect(rangDe(LISTE, '99')).toBeNull()
  })

  it('rend le rang du SERVEUR, pas la position dans le tableau', () => {
    /* Les deux coïncident presque toujours, et c'est le piège : le jour où
       ils diffèrent — une liste rendue dans un autre ordre, un rang qui
       commence ailleurs — compter les positions retirerait le mauvais vœu.
       `retirerVoeu` prend le rang tel que le serveur le donne. */
    const decale = [voeu(3, 'a'), voeu(7, 'b'), voeu(9, 'c')]
    expect(rangDe(decale, 'a')).toBe(3)
    expect(rangDe(decale, 'b')).toBe(7)
    expect(rangDe(decale, 'c')).toBe(9)
  })

  it('suit les rangs après un retrait', () => {
    /* `retirerVoeu` prend un RANG, et les rangs se resserrent. Mémoriser
       celui qu'on a vu il y a trois clics retirerait le mauvais vœu. */
    const apresRetrait = [voeu(1, '12'), voeu(2, '56')]
    expect(rangDe(LISTE, '56')).toBe(3)
    expect(rangDe(apresRetrait, '56')).toBe(2)
  })
})

describe('le geste d’un clic', () => {
  it('ouvre l’inscription quand il n’y a pas de compte', () => {
    /* On n'essaie pas d'enregistrer pour échouer ensuite : découvrir après
       coup que rien n'a été gardé est la façon la plus sûre de perdre une
       liste qu'on croyait faite. */
    expect(gesteDuClic(LISTE, '12', 2026, false)).toEqual({ quoi: 'inscrire' })
    expect(gesteDuClic([], '99', 2026, false)).toEqual({ quoi: 'inscrire' })
  })

  it('ajoute ce qui n’y est pas', () => {
    expect(gesteDuClic(LISTE, '99', 2026, true)).toEqual({
      quoi: 'ajouter',
      code: '99',
      session: 2026,
    })
  })

  it('retire ce qui y est, par son rang', () => {
    expect(gesteDuClic(LISTE, '34', 2026, true)).toEqual({ quoi: 'retirer', rang: 2 })
  })

  it('bascule dans les deux sens', () => {
    /* Un bouton qui n'ajoute que dans un sens oblige à quitter la liste pour
       défaire, ce qui est exactement le détour qu'on supprime ici. */
    const apres = [...LISTE, voeu(4, '99')]
    expect(gesteDuClic(LISTE, '99', 2026, true).quoi).toBe('ajouter')
    expect(gesteDuClic(apres, '99', 2026, true).quoi).toBe('retirer')
  })
})

describe('ce que le bouton dit', () => {
  it('annonce l’état en clair', () => {
    expect(libelleDuBouton(false)).toBe('Garder')
    expect(libelleDuBouton(true)).toBe('Dans mes vœux')
  })

  it('nomme la formation pour un lecteur d’écran', () => {
    /* Quarante boutons nommés « Garder » ne se distinguent pas les uns des
       autres : le nom accessible porte l'action ET la formation. */
    expect(nomAccessible(false, 'Licence de droit à Agen')).toBe(
      'Garder Licence de droit à Agen dans mes vœux',
    )
    expect(nomAccessible(true, 'Licence de droit à Agen')).toBe(
      'Retirer Licence de droit à Agen de mes vœux',
    )
  })

  it('dit une action, pas seulement un état', () => {
    for (const garde of [true, false]) {
      expect(nomAccessible(garde, 'X')).toMatch(/^(Garder|Retirer) /)
    }
  })
})

describe('le plafond de dix vœux', () => {
  it('reste silencieux tant que la liste est courte', () => {
    /* Un compteur permanent sur quarante cartes serait du bruit. */
    for (const n of [0, 1, 5, 7]) {
      expect(rappelDuPlafond(n)).toBeNull()
    }
  })

  it('prévient au dernier vœu possible', () => {
    expect(rappelDuPlafond(MAXIMUM_VOEUX - 1)).toContain('Encore un')
  })

  it('explique quoi faire une fois plein, au lieu de constater', () => {
    const m = rappelDuPlafond(MAXIMUM_VOEUX)
    expect(m).toContain('maximum')
    expect(m, 'le message constate sans dire quoi faire').toContain('retires-en un')
  })

  it('tient encore au-delà, si le serveur en rendait plus', () => {
    expect(rappelDuPlafond(MAXIMUM_VOEUX + 2)).toContain('maximum')
  })

  it('emploie le plafond de Parcoursup', () => {
    expect(MAXIMUM_VOEUX).toBe(10)
  })
})

describe('le branchement sur la liste', () => {
  const app = readFileSync(resolve(SRC, 'App.tsx'), 'utf8')
  const module = readFileSync(resolve(SRC, 'voeuxRapides.tsx'), 'utf8')

  it('monte l’état UNE fois, pas une par carte', () => {
    /* Quarante cartes qui interrogeraient l'API chacune de leur côté feraient
       quarante requêtes au chargement, et divergeraient au premier ajout. */
    expect([...app.matchAll(/useVoeuxRapides\(/g)]).toHaveLength(1)
    expect(app).toContain('voeux={voeuxRapides}')
  })

  it('pose le bouton dans la rangée d’actions, avant le budget', () => {
    const actions = /<div className="carte-actions">[\s\S]*?<\/div>/.exec(app)
    expect(actions).not.toBeNull()
    const garder = actions![0].indexOf('<BoutonGarder')
    const budget = actions![0].indexOf('carte-volet-bouton')
    expect(garder).toBeGreaterThan(-1)
    expect(garder, 'le budget passe avant « Garder »').toBeLessThan(budget)
  })

  it('n’enferme pas les trente-neuf autres cartes pendant un appel', () => {
    // `occupe` porte le CODE en cours, pas un booléen.
    expect(module).toMatch(/useState<string \| null>\(null\)/)
    expect(module).toContain('etat.occupe === code')
  })

  it('affiche le refus du serveur tel quel', () => {
    /* Reformuler un refus qu'on n'a pas décidé — le onzième vœu, une session
       finie — c'est le déformer. */
    expect(module).toContain('setMessage((e as Error).message)')
    expect(app).toContain('voeuxRapides.message')
  })

  it('pose le message au-dessus de la liste, pas sur la carte cliquée', () => {
    /* Un message attaché à la trente-septième carte s'affiche hors de
       l'écran, et l'élève voit seulement que rien ne s'est passé. */
    const message = app.indexOf('voeuxRapides.message')
    const liste = app.indexOf('<div className="cartes">')
    expect(message).toBeGreaterThan(-1)
    expect(message).toBeLessThan(liste)
  })
})
