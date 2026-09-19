import { describe, it, expect } from 'vitest'
import { questionsRegles, obtenirQuestions } from '../questions'
import type { ProfilResume, FormationResume } from '../conseiller'

const profilBase: ProfilResume = {
  classe: 'terminale',
  meilleuresMatieres: ['Mathématiques'],
  region: 'Île-de-France',
  mobilite: false,
  passions: ['Informatique'],
  motivation: 7,
  coherenceProjet: 6,
}

const formations: FormationResume[] = [
  { nom: 'Licence Info', ville: 'Paris', domaine: 'Informatique', probabilite: 60, selectivite: 'non-selective', prixAnnuel: null },
]

describe('questionsRegles', () => {
  it('propose des questions à choix multiple valides pour un terminale', () => {
    const qs = questionsRegles(profilBase)
    expect(qs.length).toBeGreaterThanOrEqual(3)
    for (const q of qs) {
      expect(q.question.length).toBeGreaterThan(0)
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      expect(q.options.length).toBeLessThanOrEqual(4)
    }
  })

  it('adapte les questions à un élève de seconde (spécialités)', () => {
    const qs = questionsRegles({ ...profilBase, classe: 'seconde' })
    expect(qs.some((q) => q.id.startsWith('seconde'))).toBe(true)
  })
})

describe('obtenirQuestions (sans IA)', () => {
  it('retombe sur les règles quand l’IA est désactivée', async () => {
    const r = await obtenirQuestions(profilBase, formations, { utiliserIA: false })
    expect(r.source).toBe('regles')
    expect(r.questions.length).toBeGreaterThanOrEqual(3)
  })
})
