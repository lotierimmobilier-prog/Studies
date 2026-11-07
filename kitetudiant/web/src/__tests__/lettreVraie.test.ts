import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { LONGUEUR, QUESTIONS } from '../../../packages/articles/src/lettreMotivation.ts'
import { nombre } from '../nombres.ts'
import { SEUIL_NOTES, assembler, relire, typographier } from '../lettre.ts'

/**
 * « Faire une vraie lettre » sans écrire à la place de l'élève.
 *
 * ── La limite, et où elle passe ──────────────────────────────────────────
 *
 * La fiche du ministère, citée en tête de l'écran, dit « évitez absolument le
 * recours à des logiciels de type ChatGPT ou équivalent ». Le site ne compose
 * donc pas.
 *
 * Ce qu'il fait : la MISE EN FORME — une majuscule en début de phrase, un
 * point à la fin, les paragraphes du plan. Le critère est vérifiable, et ce
 * fichier le vérifie : si l'on retire la mise en forme, il reste exactement
 * les mots de l'élève, dans son ordre.
 */

const SRC = resolve(import.meta.dirname, '..')

/** Les mots d'un texte, sans ponctuation ni casse. */
function mots(texte: string): string[] {
  return texte
    .toLowerCase()
    .replace(/[.!?,;:«»()…]/g, ' ')
    .split(/\s+/)
    .filter((m) => m !== '')
}

describe('la mise en forme n’ajoute aucun mot', () => {
  it('met une majuscule au début et un point à la fin', () => {
    expect(typographier('professeur de sport')).toBe('Professeur de sport.')
  })

  it('remet une majuscule après chaque fin de phrase', () => {
    expect(typographier('j’aime le sport. je veux enseigner')).toBe(
      'J’aime le sport. Je veux enseigner.',
    )
  })

  it('ne majuscule pas au milieu d’un mot pointé', () => {
    /* Un point suivi d'une lettre SANS espace ne finit pas une phrase : c'est
       une adresse, une abréviation, une décimale. La règle exige donc
       l'espace. Sans elle, « kitetudiant.fr » devient « kitetudiant.Fr » —
       vérifié en retirant le `+` du motif. */
    expect(typographier('trouvé sur kitetudiant.fr en cherchant')).toBe(
      'Trouvé sur kitetudiant.fr en cherchant.',
    )
    expect(typographier('une moyenne de 14.5 en sport')).toBe('Une moyenne de 14.5 en sport.')
  })

  it('ne double pas la ponctuation déjà posée', () => {
    expect(typographier('Pourquoi ce BUT ?')).toBe('Pourquoi ce BUT ?')
    expect(typographier('Voilà mon projet.')).toBe('Voilà mon projet.')
  })

  it('laisse le texte vide vide', () => {
    expect(typographier('')).toBe('')
    expect(typographier('   ')).toBe('')
  })

  it('rend EXACTEMENT les mots de l’élève, dans son ordre', () => {
    /* L'invariant central. Il tiendrait encore si l'on ajoutait une espace ou
       une majuscule ; il tombe à la première formule glissée dans le texte. */
    const reponses = Object.fromEntries(
      QUESTIONS.map((q, i) => [q.cle, `réponse numéro ${i} sur le sport à toulouse`]),
    )
    const assemble = assembler(reponses)
    expect(mots(assemble)).toEqual(
      QUESTIONS.flatMap((_, i) => mots(`réponse numéro ${i} sur le sport à toulouse`)),
    )
  })
})

describe('Jean-Paul dit quand ce sont encore des notes', () => {
  const brouillonCourt = () => {
    const reponses = {
      [QUESTIONS[0]!.cle]: 'sport à toulouse',
      [QUESTIONS[1]!.cle]: 'le sport par kitetudiant sport compétition natation',
      [QUESTIONS[5]!.cle]: 'professeur de sport',
    }
    return {
      codeFormation: 'brouillon-libre',
      reponses,
      texte: assembler(reponses),
      modifieLe: '2026-09-22T12:00:00.000Z',
    }
  }

  it('le signale, avec ce qui manque', () => {
    /* Le compteur affichait « 90 sur 1 500 ». Un compteur ne dit pas que
       c'est un problème, il dit un nombre. */
    const notes = relire(brouillonCourt()).find((r) => r.cle === 'notes')
    expect(notes, 'rien ne dit que le texte est trop court pour être une lettre').toBeDefined()
    expect(notes!.texte).toMatch(/encore des notes/i)
    /* Les milliers mis en forme comme partout ailleurs sur le site : « 1500 »
       et « 1 500 » à deux lignes d'écart — le compteur est juste à côté — se
       lisent comme deux nombres différents.

       Comparé à `nombre()` et non à un motif écrit à la main : la fonction
       sépare par une espace fine insécable, que j'avais d'abord cherchée avec
       une espace ordinaire. Le test échouait sur une sortie correcte. */
    expect(notes!.texte).toContain(`environ ${nombre(LONGUEUR.standard)}`)
    expect(notes!.texte, 'un nombre est écrit sans son séparateur').not.toMatch(/\b1500\b/)
  })

  it('nomme la réponse la plus courte, au lieu de dire « développe »', () => {
    const notes = relire(brouillonCourt()).find((r) => r.cle === 'notes')!
    expect(notes.texte).toContain(QUESTIONS[0]!.question)
  })

  it('ne dit rien sur une lettre de longueur normale', () => {
    const long = 'Une phrase entière qui développe ce que je veux faire. '.repeat(20)
    const reponses = Object.fromEntries(QUESTIONS.map((q) => [q.cle, long]))
    const remarques = relire({
      codeFormation: 'x',
      reponses,
      texte: assembler(reponses),
      modifieLe: '2026-09-22T12:00:00.000Z',
    })
    expect(remarques.find((r) => r.cle === 'notes')).toBeUndefined()
  })

  it('ne dit rien sur un texte vide : il y a déjà la phrase d’accueil', () => {
    const remarques = relire({
      codeFormation: 'x',
      reponses: {},
      texte: '',
      modifieLe: '2026-09-22T12:00:00.000Z',
    })
    expect(remarques.find((r) => r.cle === 'notes')).toBeUndefined()
  })

  it('le seuil reste sous la moitié de la limite', () => {
    // Au-delà, on dirait « c'est des notes » d'un texte à moitié écrit.
    expect(SEUIL_NOTES).toBeLessThan(0.5)
    expect(SEUIL_NOTES).toBeGreaterThan(0)
  })
})

describe('le site ne compose toujours rien', () => {
  const MODULE = readFileSync(resolve(SRC, 'lettre.ts'), 'utf8')
  const ECRAN = readFileSync(resolve(SRC, 'lettre.tsx'), 'utf8')

  it('aucun appel à un modèle, ni ici ni à l’écran', () => {
    /* La fiche du ministère est citée sur cette page même : un site qui
       l'affiche et compose la lettre à côté se contredirait à deux
       centimètres d'intervalle, et ferait courir à l'élève exactement le
       risque dont la fiche le prévient. */
    for (const [nom, source] of [
      ['lettre.ts', MODULE],
      ['lettre.tsx', ECRAN],
    ] as const) {
      expect(source, `${nom} appelle un modèle`).not.toMatch(/anthropic|openai|\/api\/conseil/i)
    }
  })

  it('l’assemblage ne connaît aucune phrase toute faite', () => {
    /* Le chemin le plus court vers « une vraie lettre » serait d'interpoler
       les réponses dans des transitions écrites ici. Ce serait du texte de
       machine dans la lettre d'un élève, simplement écrit plus tôt. */
    const assemblage = /export function assembler[\s\S]*?\n}/.exec(MODULE)![0]
    /* `\n` exclu de la classe : sans lui, le motif enjambe les lignes et
       « apparie » deux apostrophes situées dans deux instructions
       différentes. Il trouvait alors des phrases là où il n'y a que du
       code — vérifié en l'exécutant. */
    expect(assemblage).not.toMatch(/['"`][^'"`\n]{25,}['"`]/)
  })
})
