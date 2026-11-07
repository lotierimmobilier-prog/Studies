import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ACCUEIL_QUESTIONS } from '../../../packages/articles/src/accueil.ts'

/**
 * Les questions de l'accueil.
 *
 * ── Pourquoi elles existent ──────────────────────────────────────────────
 *
 * L'accueil est la page la plus citée d'un site, et c'était la seule à ne
 * déclarer aucune question. Les articles en portent (`Article.questions`,
 * déclarées en `FAQPage`) ; elle, rien. Or une question suivie de sa
 * réponse est la plus petite unité citable qui existe : elle tient debout
 * hors de sa page, ce qu'un paragraphe au milieu d'un fil ne fait pas.
 *
 * ── Pourquoi elles sont dangereuses ──────────────────────────────────────
 *
 * Une réponse figée dans du code ne porte ni source ni millésime. Elle ne
 * peut donc pas chiffrer (règles 1 et 6), et elle ne peut pas promettre —
 * ni un résultat, ni une place. C'est aussi le genre de texte qu'un moteur
 * reprend mot pour mot : une phrase fausse ici voyage plus loin que partout
 * ailleurs sur le site.
 */

const SRC = resolve(import.meta.dirname, '..')
const ACCUEIL = readFileSync(resolve(SRC, 'accueil.tsx'), 'utf8')
const PRERENDU = readFileSync(
  resolve(SRC, '..', '..', 'scripts', 'prerendre.ts'),
  'utf8',
)

describe('les questions de l’accueil tiennent debout seules', () => {
  it('il y en a assez pour servir, et pas au point de noyer la page', () => {
    expect(ACCUEIL_QUESTIONS.length).toBeGreaterThanOrEqual(5)
    expect(ACCUEIL_QUESTIONS.length).toBeLessThanOrEqual(10)
  })

  it('chaque question en est une, et chaque réponse est autoportante', () => {
    for (const q of ACCUEIL_QUESTIONS) {
      expect(q.question, `« ${q.question} » ne se termine pas par un point d’interrogation`).toMatch(/\?$/)
      /* Une réponse d'une ligne citée hors contexte ne dit rien ; une
         réponse de dix lignes n'est pas citée. */
      expect(q.reponse.length, `« ${q.question} » : réponse trop courte`).toBeGreaterThan(80)
      expect(q.reponse.length, `« ${q.question} » : réponse trop longue`).toBeLessThan(600)
      // Elle doit se comprendre sans la question : pas de « oui, c'est ça ».
      expect(q.reponse, `« ${q.question} » : réponse vide de contenu`).toMatch(/[a-zà-ÿ]{4,}/)
    }
  })

  it('aucune ne cite de montant', () => {
    // Règle 1 : tout euro affiché remonte à une ligne de calcul avec sa
    // source et son millésime. Un texte figé n'en a pas.
    for (const q of ACCUEIL_QUESTIONS) {
      const entier = `${q.question} ${q.reponse}`
      expect(entier, `« ${q.question} » chiffre un montant`).not.toMatch(/\d[\d  ]*(€|euros?\b)/i)
    }
  })

  it('aucune ne promet un résultat ni n’effraie', () => {
    /* « Ne pas écrire de texte d'interface anxiogène. Jamais "aucune
       chance" » (CLAUDE.md), et règle 5 : pas de meilleure école. */
    const interdits = [
      /aucune chance/i,
      /la meilleure (école|formation)/i,
      /\btu seras (pris|accepté)/i,
      /\bgarantit?\b/i,
      /\bimpossible\b/i,
    ]
    for (const q of ACCUEIL_QUESTIONS) {
      const entier = `${q.question} ${q.reponse}`
      for (const motif of interdits) {
        expect(entier, `« ${q.question} » : ${motif}`).not.toMatch(motif)
      }
    }
  })

  it('les questions qui protègent l’élève sont posées', () => {
    /* Ce ne sont pas des questions de confort. Une mauvaise réponse à l'une
       d'elles fait du tort : un élève qui croit le site officiel, ou qui
       croit ses vœux déposés ici, le découvre après la date limite. */
    const toutes = ACCUEIL_QUESTIONS.map((q) => `${q.question} ${q.reponse}`).join(' ')
    expect(toutes, 'rien ne dit que le site n’est pas officiel').toMatch(
      /n’est pas affilié|service indépendant|pas le site officiel|indépendant, sans lien/i,
    )
    expect(toutes, 'rien ne dit que les vœux ne partent pas sur Parcoursup').toMatch(
      /parcoursup\.gouv\.fr/,
    )
    expect(toutes, 'rien ne dit que le site ne classe pas les écoles').toMatch(
      /ne (les )?class|pas de classement|jamais fondues/i,
    )
  })
})

describe('l’écran et la page livrée posent les mêmes questions', () => {
  it('les deux lisent le même module', () => {
    /* Écrites deux fois, elles divergeraient — et la divergence a un nom :
       du contenu masqué. Un moteur qui reçoit une réponse et en voit une
       autre à l'exécution sanctionne la page, et il a raison. */
    expect(ACCUEIL).toContain('ACCUEIL_QUESTIONS')
    expect(PRERENDU).toContain('ACCUEIL_QUESTIONS')
  })

  it('la page livrée les écrit en clair, pas seulement en JSON-LD', () => {
    // Un moteur qui ne lit pas les données structurées doit les trouver
    // quand même, et un lecteur arrivé avant que React ne monte aussi.
    const bloc = PRERENDU.slice(PRERENDU.indexOf('function corpsAccueil'))
    expect(bloc.slice(0, bloc.indexOf('\n}'))).toContain('ACCUEIL_QUESTIONS.map')
  })

  it('elle les déclare aussi en FAQPage', () => {
    expect(PRERENDU).toMatch(/questionsEnFaq\(ACCUEIL_QUESTIONS\)/)
  })
})

/**
 * Le fichier réellement écrit, quand il a été construit.
 *
 * Les tests ci-dessus lisent les sources. Celui-ci vérifie que le résultat
 * tient : une seule déclaration `FAQPage` sur l'accueil — deux se
 * contrediraient — et chaque question présente dans le texte livré.
 */
describe('l’accueil pré-rendue', () => {
  const CHEMIN = resolve(SRC, '..', '..', '..', 'dist-kitetudiant', 'index.html')
  const SORTIE = existsSync(CHEMIN) ? readFileSync(CHEMIN, 'utf8') : null

  it.skipIf(SORTIE === null)('ne déclare qu’un seul FAQPage', () => {
    expect((SORTIE ?? '').match(/"FAQPage"/g) ?? []).toHaveLength(1)
  })

  it.skipIf(SORTIE === null)('écrit chaque question dans le corps de la page', () => {
    for (const q of ACCUEIL_QUESTIONS) {
      // Le pré-rendu échappe les chevrons et les guillemets droits ; aucune
      // question n'en contient, donc la comparaison directe suffit.
      expect(SORTIE, `« ${q.question} » manque du HTML livré`).toContain(`<dt>${q.question}</dt>`)
    }
  })
})
