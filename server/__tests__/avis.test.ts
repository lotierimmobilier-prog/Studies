import { describe, it, expect } from 'vitest'
import { obtenirAvis } from '../avis'
import { CacheDisque } from '../cache'
import type { AvisEcole } from '../types'

const now = () => 1_700_000_000_000

/** fetch simulé renvoyant une réponse Google Places donnée. */
function fakeFetch(payload: unknown, ok = true) {
  const calls: string[] = []
  const impl = (async (url: string) => {
    calls.push(url)
    return {
      ok,
      json: async () => payload,
    } as Response
  }) as unknown as typeof fetch
  return { impl, calls }
}

describe('obtenirAvis', () => {
  it("renvoie « indisponible » sans clé API (et n'appelle pas Google)", async () => {
    const { impl, calls } = fakeFetch({})
    const a = await obtenirAvis(
      { etablissement: 'Université Test', ville: 'Lyon' },
      { fetchImpl: impl, now, apiKey: undefined },
    )
    expect(a.source).toBe('indisponible')
    expect(a.note).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('extrait la note et le nombre d’avis depuis Google Places', async () => {
    const { impl, calls } = fakeFetch({
      status: 'OK',
      candidates: [
        {
          place_id: 'abc123',
          name: 'Université Test',
          rating: 4.3,
          user_ratings_total: 128,
        },
      ],
    })
    const a = await obtenirAvis(
      { etablissement: 'Université Test', ville: 'Lyon' },
      { fetchImpl: impl, now, apiKey: 'CLE' },
    )
    expect(a.source).toBe('google')
    expect(a.note).toBe(4.3)
    expect(a.nombreAvis).toBe(128)
    expect(a.urlMaps).toContain('abc123')
    expect(calls[0]).toContain('findplacefromtext')
    expect(calls[0]).toContain('key=CLE')
  })

  it('renvoie « indisponible » quand Google ne trouve rien', async () => {
    const { impl } = fakeFetch({ status: 'ZERO_RESULTS', candidates: [] })
    const a = await obtenirAvis(
      { etablissement: 'École Inconnue' },
      { fetchImpl: impl, now, apiKey: 'CLE' },
    )
    expect(a.source).toBe('indisponible')
  })

  it('sert depuis le cache sans rappeler Google', async () => {
    const cache = new CacheDisque<AvisEcole>('/tmp/test-avis-cache.json', 1000 * 60)
    const premier = fakeFetch({
      status: 'OK',
      candidates: [{ place_id: 'p', rating: 4.0, user_ratings_total: 10 }],
    })
    await obtenirAvis(
      { etablissement: 'Université Cache', ville: 'Paris' },
      { fetchImpl: premier.impl, now, apiKey: 'CLE', cache },
    )
    const second = fakeFetch({ status: 'OK', candidates: [{ rating: 1.0 }] })
    const a = await obtenirAvis(
      { etablissement: 'Université Cache', ville: 'Paris' },
      { fetchImpl: second.impl, now, apiKey: 'CLE', cache },
    )
    expect(a.note).toBe(4.0) // valeur du cache, pas du 2e appel
    expect(second.calls).toHaveLength(0)
  })
})
