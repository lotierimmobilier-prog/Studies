import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../avis', () => ({ obtenirAvis: vi.fn() }))

const { obtenirAvis } = await import('../avis')
const { chercherAvisLieux, estIndisponible } = await import('../avisLieu')

const CLE = process.env.GOOGLE_MAPS_API_KEY

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = 'cle-de-test'
})

afterEach(() => {
  vi.resetAllMocks()
  if (CLE === undefined) delete process.env.GOOGLE_MAPS_API_KEY
  else process.env.GOOGLE_MAPS_API_KEY = CLE
})

describe('sans clé configurée', () => {
  it('dit que le service n’est pas configuré, sans inventer de note', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY
    const [r] = await chercherAvisLieux([{ ref: 'a', etablissement: 'INSA Lyon' }])
    expect(estIndisponible(r!)).toBe(true)
    if (!estIndisponible(r!)) return
    expect(r.raison).toContain('clé Google Places absente')
    expect(obtenirAvis).not.toHaveBeenCalled()
  })
})

describe('avec une fiche trouvée', () => {
  it('rend la note, son effectif, sa date et sa mise en garde', async () => {
    vi.mocked(obtenirAvis).mockResolvedValue({
      etablissement: 'INSA Lyon',
      note: 4.3,
      nombreAvis: 812,
      source: 'google',
      urlMaps: 'https://maps.google.com/?cid=1',
      dateMaj: '2026-09-19T08:00:00.000Z',
    })
    const [r] = await chercherAvisLieux([{ ref: 'a', etablissement: 'INSA Lyon', ville: 'Villeurbanne' }])
    if (estIndisponible(r!)) throw new Error('avis attendu')
    expect(r.note).toBe(4.3)
    expect(r.nombreAvis).toBe(812)
    expect(r.collecteLe).toBe('2026-09-19T08:00:00.000Z')
    expect(r.source).toContain('Google')
    expect(r.miseEnGarde).toContain('pas sur la formation')
  })

  it('rend une indisponibilité motivée quand aucune fiche ne correspond', async () => {
    vi.mocked(obtenirAvis).mockResolvedValue({
      etablissement: 'Établissement introuvable',
      note: null,
      nombreAvis: null,
      source: 'indisponible',
      dateMaj: '2026-09-19T08:00:00.000Z',
    })
    const [r] = await chercherAvisLieux([{ ref: 'a', etablissement: 'Établissement introuvable' }])
    expect(estIndisponible(r!)).toBe(true)
    if (!estIndisponible(r!)) return
    expect(r.raison).toContain('Établissement introuvable')
  })

  it('n’expose aucun champ qui ressemblerait à un score de décision', async () => {
    vi.mocked(obtenirAvis).mockResolvedValue({
      etablissement: 'INSA Lyon',
      note: 4.3,
      nombreAvis: 812,
      source: 'google',
      dateMaj: '2026-09-19T08:00:00.000Z',
    })
    const [r] = await chercherAvisLieux([{ ref: 'a', etablissement: 'INSA Lyon' }])
    const cles = Object.keys(r!).join(' ')
    expect(cles).not.toMatch(/score|rang|classement|pondera/i)
  })
})
