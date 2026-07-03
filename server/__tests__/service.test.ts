import { describe, it, expect } from 'vitest'
import { obtenirPrix } from '../service'
import { chercherCurated, estimerParCategorie } from '../registre'

const now = () => 1_700_000_000_000

describe('registre', () => {
  it('trouve une école curée par motif', () => {
    expect(chercherCurated('EPITA Paris')?.prixAnnuel).toBe(10600)
  })

  it('estime le public à ~175 €/an, boursiers exonérés', () => {
    const p = estimerParCategorie({ etablissement: 'Université X', statut: 'Public' })
    expect(p.prixAnnuel).toBe(175)
    expect(p.gratuitBoursier).toBe(true)
  })

  it('estime un BTS public gratuit', () => {
    const p = estimerParCategorie({
      etablissement: 'Lycée Y',
      statut: 'Public',
      fili: '3_BTS',
    })
    expect(p.prixAnnuel).toBe(0)
  })

  it('donne une fourchette pour une école de commerce privée', () => {
    const p = estimerParCategorie({
      etablissement: 'ESC Z',
      statut: 'Privé',
      formation: 'Programme Grande École - commerce',
    })
    expect(p.prixAnnuel).toBeGreaterThan(0)
    expect(p.note).toMatch(/commerce/i)
  })
})

describe('obtenirPrix', () => {
  it('scrape le site quand une URL curée est disponible', async () => {
    const fakeFetch = (async () =>
      new Response('Frais de scolarité : 11 200 € par an', {
        status: 200,
      })) as unknown as typeof fetch
    const p = await obtenirPrix(
      { etablissement: 'EPITA' },
      { fetchImpl: fakeFetch, now },
    )
    expect(p.source).toBe('scrape')
    expect(p.prixAnnuel).toBe(11200)
  })

  it('retombe sur le prix curé si le scraping échoue', async () => {
    const failFetch = (async () =>
      new Response('rien', { status: 500 })) as unknown as typeof fetch
    const p = await obtenirPrix(
      { etablissement: 'EPITA' },
      { fetchImpl: failFetch, now },
    )
    expect(p.source).toBe('curated')
    expect(p.prixAnnuel).toBe(10600)
  })

  it('estime par catégorie pour un établissement inconnu', async () => {
    const p = await obtenirPrix(
      { etablissement: 'Université de Nulle-Part', statut: 'Public' },
      { now },
    )
    expect(p.source).toBe('estimation')
    expect(p.prixAnnuel).toBe(175)
  })
})
