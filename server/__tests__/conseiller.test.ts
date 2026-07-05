import { describe, it, expect } from 'vitest'
import {
  conseilRegles,
  obtenirConseil,
  type FormationResume,
  type ProfilResume,
} from '../conseiller'

const profil: ProfilResume = {
  meilleuresMatieres: ['Mathématiques', 'Informatique (NSI)'],
  region: 'Bretagne',
  mobilite: false,
  passions: ['Informatique'],
  motivation: 8,
  coherenceProjet: 7,
}

const formations: FormationResume[] = [
  { nom: 'Licence Informatique', ville: 'Rennes', domaine: 'Informatique', probabilite: 80, selectivite: 'non-selective', prixAnnuel: 175 },
  { nom: 'BUT Informatique', ville: 'Lannion', domaine: 'Informatique', probabilite: 30, selectivite: 'selective', prixAnnuel: 175 },
  { nom: 'École privée', ville: 'Paris', domaine: 'Informatique', probabilite: 55, selectivite: 'selective', prixAnnuel: 9000 },
]

describe('conseilRegles', () => {
  it('mentionne la meilleure matière et la formation la mieux placée', () => {
    const c = conseilRegles(profil, formations)
    expect(c.join(' ')).toMatch(/Mathématiques/)
    expect(c.join(' ')).toMatch(/Licence Informatique/)
  })

  it('signale le secteur géographique sans mobilité', () => {
    const c = conseilRegles(profil, formations)
    expect(c.join(' ')).toMatch(/Bretagne/)
  })

  it('alerte sur les formations chères', () => {
    const c = conseilRegles(profil, formations)
    expect(c.join(' ')).toMatch(/budget|5 000/i)
  })
})

describe('conseilRegles — seconde', () => {
  it('propose des spécialités adaptées aux passions', () => {
    const c = conseilRegles(
      { ...profil, classe: 'seconde', passions: ['Informatique'] },
      formations,
    )
    expect(c.join(' ')).toMatch(/NSI|Mathématiques/)
    expect(c.join(' ')).toMatch(/spécialité/i)
  })

  it('reste utile même sans passion sélectionnée', () => {
    const c = conseilRegles(
      { ...profil, classe: 'seconde', passions: [] },
      formations,
    )
    expect(c.length).toBeGreaterThan(0)
  })
})

describe('obtenirConseil', () => {
  it('retombe sur les règles sans clé API', async () => {
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const c = await obtenirConseil(profil, formations)
    expect(c.source).toBe('regles')
    expect(c.conseils.length).toBeGreaterThan(0)
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
  })
})
