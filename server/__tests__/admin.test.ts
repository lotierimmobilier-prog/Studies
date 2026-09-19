import type { IncomingMessage } from 'node:http'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ECHECS_MAX, GardeAdmin } from '../admin'

const JETON = 'un-jeton-administration-de-plus-de-24-caracteres'
const ENV = { ...process.env }

function requete(
  entetes: Record<string, string> = {},
  options: { chiffre?: boolean; ip?: string } = {},
): IncomingMessage {
  return {
    headers: entetes,
    socket: { encrypted: options.chiffre ?? false, remoteAddress: options.ip ?? '203.0.113.7' },
  } as unknown as IncomingMessage
}

beforeEach(() => {
  process.env.ADMIN_TOKEN = JETON
})

afterEach(() => {
  process.env = { ...ENV }
})

describe('console désactivée', () => {
  it('refuse tant qu’ADMIN_TOKEN n’est pas défini', () => {
    delete process.env.ADMIN_TOKEN
    const refus = new GardeAdmin().verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }))
    expect(refus?.code).toBe(503)
    expect(refus?.erreur).toContain('ADMIN_TOKEN')
  })

  it('refuse un jeton trop court, qui donnerait une fausse sécurité', () => {
    process.env.ADMIN_TOKEN = 'trop-court'
    const refus = new GardeAdmin().verifier(requete({ authorization: 'Bearer trop-court' }, { chiffre: true }))
    expect(refus?.code).toBe(503)
  })
})

describe('canal chiffré', () => {
  it('refuse en HTTP simple, même avec le bon jeton', () => {
    const refus = new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${JETON}`, host: 'kitetudiant.fr' }),
    )
    expect(refus?.code).toBe(421)
    expect(refus?.erreur).toContain('HTTPS')
  })

  it('accepte derrière un nginx qui annonce https', () => {
    expect(
      new GardeAdmin().verifier(
        requete({ authorization: `Bearer ${JETON}`, host: 'kitetudiant.fr', 'x-forwarded-proto': 'https' }),
      ),
    ).toBeNull()
  })

  it('accepte en local, pour le développement', () => {
    expect(
      new GardeAdmin().verifier(
        requete({ authorization: `Bearer ${JETON}`, host: 'localhost:8787' }),
      ),
    ).toBeNull()
  })
})

describe('jeton', () => {
  it('refuse un mauvais jeton', () => {
    const refus = new GardeAdmin().verifier(
      requete({ authorization: 'Bearer mauvais-jeton-mais-assez-long-quand-meme' }, { chiffre: true }),
    )
    expect(refus?.code).toBe(401)
  })

  it('refuse une requête sans en-tête d’autorisation', () => {
    expect(new GardeAdmin().verifier(requete({}, { chiffre: true }))?.code).toBe(401)
  })
})

describe('verrouillage', () => {
  it('bloque après cinq échecs, puis relâche après le délai', () => {
    let t = 1_000_000
    const garde = new GardeAdmin(() => t)
    const mauvaise = requete({ authorization: 'Bearer faux-jeton-de-longueur-suffisante' }, { chiffre: true })

    for (let i = 0; i < ECHECS_MAX; i += 1) {
      expect(garde.verifier(mauvaise)?.code).toBe(401)
    }
    const verrou = garde.verifier(mauvaise)
    expect(verrou?.code).toBe(429)
    if (verrou?.code !== 429) return
    expect(verrou.reessayerDansS).toBeGreaterThan(0)

    // Même le bon jeton est refusé pendant le verrou.
    expect(
      garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }))?.code,
    ).toBe(429)

    t += 16 * 60 * 1000
    expect(garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }))).toBeNull()
  })

  it('compte les échecs par client, sans punir les autres', () => {
    let t = 1_000_000
    const garde = new GardeAdmin(() => t)
    const faux = { authorization: 'Bearer faux-jeton-de-longueur-suffisante' }
    for (let i = 0; i < ECHECS_MAX + 1; i += 1) {
      garde.verifier(requete(faux, { chiffre: true, ip: '203.0.113.7' }))
    }
    expect(
      garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true, ip: '198.51.100.4' })),
    ).toBeNull()
  })

  it('oublie les échecs après une réussite', () => {
    const garde = new GardeAdmin()
    garde.verifier(requete({ authorization: 'Bearer faux-jeton-de-longueur-suffisante' }, { chiffre: true }))
    expect(garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }))).toBeNull()
    for (let i = 0; i < ECHECS_MAX - 1; i += 1) {
      expect(
        garde.verifier(requete({ authorization: 'Bearer faux-jeton-de-longueur-suffisante' }, { chiffre: true }))
          ?.code,
      ).toBe(401)
    }
  })
})
