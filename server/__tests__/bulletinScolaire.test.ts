import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../bulletin', () => ({
  analyserBulletin: vi.fn(),
}))

const { analyserBulletin } = await import('../bulletin')
const { extraireBulletin } = await import('../bulletinScolaire')

const ANALYSE_COMPLETE = {
  notes: { mathematiques: 15.5, francais: 11, svt: null, physique_chimie: 22 },
  appreciationGlobale:
    'Élève sérieux mais discret. Des difficultés passagères au premier trimestre.',
  signaux: { serieux: 8, participation: 4, progression: 7 },
  pointsForts: ['travail régulier', 'bon niveau en mathématiques'],
  pointsAmeliorer: ['participation à l’oral'],
}

afterEach(() => vi.resetAllMocks())

describe('extraction d’un bulletin pour KITETUDIANT', () => {
  it('ne laisse sortir que des nombres : aucun texte d’appréciation', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')

    expect(Object.keys(extrait).sort()).toEqual(['matieresLues', 'notes', 'signaux', 'source'])
    const serialise = JSON.stringify(extrait)
    expect(serialise).not.toContain('discret')
    expect(serialise).not.toContain('participation à l’oral')
    expect(serialise).not.toContain('travail régulier')
  })

  it('garde les moyennes lues et écarte les matières absentes', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.notes.mathematiques).toBe(15.5)
    expect(extrait.notes.francais).toBe(11)
    expect(extrait.notes).not.toHaveProperty('svt')
    expect(extrait.matieresLues).toBe(3)
  })

  it('borne les notes à 20 plutôt que de propager une valeur aberrante', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.notes.physique_chimie).toBe(20)
  })

  it('borne les signaux à 10 et remplace l’absurde par zéro', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue({
      ...ANALYSE_COMPLETE,
      signaux: { serieux: 99, participation: Number.NaN, progression: -3 },
    })
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.signaux).toEqual({ serieux: 10, participation: 0, progression: 0 })
  })

  it('dit d’où viennent ces chiffres et que le texte n’est pas conservé', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.source).toContain('non conservé')
  })
})
