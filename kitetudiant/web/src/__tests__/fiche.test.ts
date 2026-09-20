import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { affiniteCourte, affiniteNote, chancesCourtes } from '../libelles.ts'
import type { Admissibilite } from '../../../packages/admissibilite/src/index.ts'
import type { Affinite } from '../../../packages/profil-scolaire/src/index.ts'

const SRC = resolve(import.meta.dirname, '..')

function fourchette(bas: number, haut: number): Admissibilite {
  return {
    statut: 'fourchette',
    bas,
    haut,
    tauxAccesPublie: 42,
    effectifAdmis: 120,
    source: 'Parcoursup, taux d’accès publié',
    millesime: '2025',
    facteurs: [],
  }
}

describe('les chances, en quelques mots', () => {
  it('annoncent une fourchette quand elle existe', () => {
    expect(chancesCourtes(fourchette(45, 62))).toBe('45 à 62 %')
  })

  it('annoncent un plafond plutôt qu’un zéro', () => {
    // CLAUDE.md : jamais de texte anxiogène, et nommément jamais « aucune
    // chance ». Une borne basse à zéro ne dit rien d'utile de toute façon.
    expect(chancesCourtes(fourchette(0, 12))).toBe('moins de 12 %')
    expect(chancesCourtes(fourchette(0, 12))).not.toMatch(/0 /)
  })

  it('disent « non estimé » quand la donnée manque, jamais un chiffre de repli', () => {
    const manquante = { statut: 'donnee_manquante', raison: 'x' } as unknown as Admissibilite
    const insuffisant = {
      statut: 'effectif_insuffisant',
      raison: 'y',
    } as unknown as Admissibilite
    expect(chancesCourtes(manquante)).toBe('non estimé')
    expect(chancesCourtes(insuffisant)).toBe('non estimé')
  })

  it('n’écrivent jamais qu’un élève n’a aucune chance', () => {
    const tous = [fourchette(0, 1), fourchette(0, 100), fourchette(3, 7)].map(chancesCourtes)
    // « \b » indispensable : sans lui, « moins de 100 % » contient « 0 % » et
    // le test échouait sur une formulation pourtant parfaitement correcte.
    for (const t of tous) expect(t).not.toMatch(/aucune|nulle|impossible|\b0 %/i)
  })
})

describe('l’affinité, en quelques mots', () => {
  const connu = { score: 78, domaineInconnu: false, raisons: [] } as unknown as Affinite
  const inconnu = { score: 0, domaineInconnu: true, raisons: [] } as unknown as Affinite

  it('affiche le score sur cent quand le domaine est reconnu', () => {
    expect(affiniteCourte(connu)).toBe('78/100')
    expect(affiniteNote(connu)).toBe('selon tes notes et tes goûts')
  })

  it('affiche un tiret, pas un zéro, quand le domaine est inconnu', () => {
    // Un « 0/100 » serait lu comme un jugement ; c'est une donnée absente.
    expect(affiniteCourte(inconnu)).toBe('—')
    expect(affiniteNote(inconnu)).toBe('domaine non reconnu')
  })

  it('distingue « on ne sait rien de toi » d’une affinité faible', () => {
    // Constaté au navigateur le 20/09/2026 : sans passions ni notes déclarées,
    // toutes les fiches affichaient « 0/100 », ce qui se lit comme « cette
    // formation ne te va pas » alors que la phrase juste est « dis-nous en
    // plus ». `raisons` vide et score nul, c'est l'absence d'information.
    const rien = { score: 0, domaineInconnu: false, raisons: [] } as unknown as Affinite
    expect(affiniteCourte(rien)).toBe('—')
    expect(affiniteNote(rien)).toBe('dis-nous ce qui t’intéresse')

    // Un vrai zéro, lui, repose sur quelque chose : il reste affiché.
    const vraiZero = {
      score: 0,
      domaineInconnu: false,
      raisons: ['aucune de tes matières fortes n’est mobilisée'],
    } as unknown as Affinite
    expect(affiniteCourte(vraiZero)).toBe('0/100')
    expect(affiniteNote(vraiZero)).toBe('selon tes notes et tes goûts')
  })
})

/**
 * La note publique de l'adresse est affichée sur la fiche depuis le 20/09/2026.
 * Elle ne doit pour autant jamais entrer dans le tri ni dans les deux axes :
 * règle 5 de CLAUDE.md, module M10 du cahier des charges.
 *
 * La garantie n'est pas une promesse de vigilance, c'est une propriété du
 * code : les modules qui calculent, trient et recommandent ne connaissent pas
 * ce type. Ce test le rend permanent.
 */
describe('la note de l’adresse n’entre dans aucun calcul', () => {
  const CALCULANTS = ['calcul.ts', 'recommandations.ts', 'budgetSimple.ts', 'collection.ts']

  it.each(CALCULANTS)('%s ne connaît ni avisLieu ni AvisLieu', (fichier) => {
    const source = readFileSync(resolve(SRC, fichier), 'utf8')
    expect(
      source,
      `${fichier} calcule, trie ou recommande : s'il accède à la note publique ` +
        `de l'adresse, celle-ci peut se glisser dans un score ou dans un ordre, ` +
        `ce que la règle 5 interdit.`,
    ).not.toMatch(/avisLieu|AvisLieu/)
  })

  it('ResultatFormation ne transporte pas de note d’établissement', () => {
    const calcul = readFileSync(resolve(SRC, 'calcul.ts'), 'utf8')
    const bloc = /export interface ResultatFormation \{[\s\S]*?\n\}/.exec(calcul)
    expect(bloc).not.toBeNull()
    expect(bloc![0]).not.toMatch(/note|avis|etoile|rating/i)
  })
})

/**
 * La fiche montre trois réponses côte à côte. Les fondre en une seule note est
 * la faute que la règle 5 vise en premier, et elle se glisserait ici sans que
 * rien n'échoue.
 */
describe('la fiche garde les trois réponses séparées', () => {
  const app = readFileSync(resolve(SRC, 'App.tsx'), 'utf8')

  it('affiche exactement trois cases', () => {
    // Une seule expression : deux motifs séparés comptaient deux fois la case
    // au nom composé (`trio-case trio-reste …`).
    const cases = app.match(/className=\{?["`]trio-case\b/g) ?? []
    expect(cases).toHaveLength(3)
  })

  it('ne calcule aucune note globale à partir des trois', () => {
    // Une moyenne ou une somme des trois axes n'apparaîtrait pas autrement.
    expect(app).not.toMatch(/scoreGlobal|noteGlobale|moyenneDesAxes|totalScore/i)
  })
})
