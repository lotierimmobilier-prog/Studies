/**
 * Les questions fréquentes des articles.
 *
 * ── Pourquoi elles méritent leurs propres tests ──────────────────────────
 *
 * Une question-réponse est le morceau qu'un moteur génératif reprendra HORS
 * de tout contexte, souvent sans lien vers l'article. C'est donc le seul
 * endroit du site où une phrase mal tournée peut circuler toute seule,
 * attribuée à KitEtudiant.fr, sans que personne puisse remonter à ce qui la
 * justifie. Elle doit tenir debout à elle seule.
 */
import { describe, expect, it } from 'vitest'

import { ARTICLES, tousLesTextes } from '../../../packages/articles/src/index.ts'

const QUESTIONS = ARTICLES.flatMap((a) =>
  (a.questions ?? []).map((q) => ({ slug: a.slug, ...q })),
)

describe('chaque article porte ses questions', () => {
  it('tous en ont, et au moins trois', () => {
    for (const a of ARTICLES) {
      expect((a.questions ?? []).length, `${a.slug} n’a pas de questions`).toBeGreaterThanOrEqual(3)
    }
  })

  it('aucune question n’est posée deux fois sur le site', () => {
    // Deux réponses différentes à la même question, sur deux pages, se
    // concurrencent : un moteur en choisit une, et ce n'est pas forcément
    // la meilleure.
    const vues = QUESTIONS.map((q) => q.question.toLowerCase())
    const doublons = vues.filter((q, i) => vues.indexOf(q) !== i)
    expect(doublons).toEqual([])
  })
})

describe('une question est formulée comme on la pose', () => {
  it('se termine par un point d’interrogation', () => {
    for (const q of QUESTIONS) {
      expect(q.question, `${q.slug} → ${q.question}`).toMatch(/\?$/)
    }
  })

  it('reste courte, sinon ce n’est plus une question', () => {
    for (const q of QUESTIONS) {
      expect(q.question.length, `${q.slug} → ${q.question}`).toBeLessThanOrEqual(90)
      expect(q.question.length, `${q.slug} → ${q.question}`).toBeGreaterThan(15)
    }
  })
})

describe('une réponse tient debout toute seule', () => {
  it('fait entre quarante et quatre-vingt-dix mots', () => {
    // En dessous, elle n'apprend rien ; au-delà, un moteur la tronque au
    // milieu d'une phrase et publie une demi-affirmation.
    for (const q of QUESTIONS) {
      const mots = q.reponse.split(/\s+/).filter(Boolean).length
      expect(mots, `${q.slug} → « ${q.question} » : ${mots} mots`).toBeGreaterThanOrEqual(35)
      expect(mots, `${q.slug} → « ${q.question} » : ${mots} mots`).toBeLessThanOrEqual(90)
    }
  })

  it('ne renvoie pas à ce qui précède', () => {
    // « Comme on l'a vu plus haut » n'a aucun sens dans un encadré repris
    // seul par un moteur. C'est le défaut le plus facile à commettre en
    // rédigeant une FAQ à la suite d'un article.
    const RENVOIS = /\b(comme (on l’a vu|vu plus haut|dit plus haut)|ci-dessus|plus haut dans cet article|voir ci-dessous)\b/i
    for (const q of QUESTIONS) {
      expect(RENVOIS.test(q.reponse), `${q.slug} → « ${q.question} »`).toBe(false)
    }
  })

  it('n’emploie aucune formule anxiogène', () => {
    // Le site s'adresse à des mineurs en pleine décision d'orientation.
    // CLAUDE.md interdit « aucune chance » nommément.
    const INTERDITS = [
      /aucune chance/i,
      /c’est fichu|c'est fichu/i,
      /trop tard pour (toi|vous)/i,
      /impossible d’y (entrer|arriver)/i,
    ]
    for (const q of QUESTIONS) {
      for (const interdit of INTERDITS) {
        expect(interdit.test(q.reponse), `${q.slug} → « ${q.question} »`).toBe(false)
      }
    }
  })
})

describe('aucun champ de texte n’échappe aux garde-fous', () => {
  it('« tousLesTextes » recense bien les questions', () => {
    // Ce test est la raison d'être de `tousLesTextes`. Quand les questions
    // ont été ajoutées, les contrôles « pas d'euro » et « pas de date
    // précise » ont continué de passer au vert sur un champ qu'ils ne
    // voyaient pas. Un champ de texte ajouté demain sans passer par cette
    // fonction ferait tomber ce test, pas les autres.
    const premier = ARTICLES.find((a) => (a.questions ?? []).length > 0)
    expect(premier).toBeDefined()
    const textes = tousLesTextes(premier!)
    const q = premier!.questions![0]!
    expect(textes).toContain(q.question)
    expect(textes).toContain(q.reponse)
    expect(textes).toContain(premier!.titre)
    expect(textes).toContain(premier!.chapeau)
  })
})
