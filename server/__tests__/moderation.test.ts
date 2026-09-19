import { describe, it, expect } from 'vitest'
import { moderationRegles, moderer } from '../moderation'

describe('moderationRegles', () => {
  it('approuve un avis normal, y compris une critique négative argumentée', () => {
    expect(moderationRegles('Super école, profs à l’écoute.').statut).toBe('approuve')
    expect(
      moderationRegles("Cursus décevant, peu d'encadrement en 1re année.").statut,
    ).toBe('approuve')
  })

  it('rejette un commentaire trop court', () => {
    expect(moderationRegles('ok').statut).toBe('rejete')
  })

  it('rejette les insultes / propos haineux', () => {
    expect(moderationRegles('les profs sont des connards').statut).toBe('rejete')
    expect(moderationRegles('cette école de PÉDÉ').statut).toBe('rejete')
  })

  it('rejette les coordonnées et liens (anti-spam / doxxing)', () => {
    expect(moderationRegles('contactez moi a test@mail.com').statut).toBe('rejete')
    expect(moderationRegles('infos sur https://spam.example').statut).toBe('rejete')
    expect(moderationRegles('appelle le 06 12 34 56 78 stp').statut).toBe('rejete')
  })

  it('ne confond pas un mot sain avec un terme interdit (limites de mots)', () => {
    // « pute » ne doit pas matcher dans « réputation »
    expect(moderationRegles('bonne réputation, je recommande.').statut).toBe('approuve')
  })
})

describe('moderer (sans IA)', () => {
  it('retombe sur les règles quand l’IA est désactivée', async () => {
    expect((await moderer('Très bonne ambiance.', { utiliserIA: false })).statut).toBe(
      'approuve',
    )
    expect((await moderer('sale arabe', { utiliserIA: false })).statut).toBe('rejete')
  })
})
