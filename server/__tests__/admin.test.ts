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
  delete process.env.ADMIN_EMAILS
  process.env = { ...ENV }
})

describe('console désactivée', () => {
  it('refuse tant qu’ADMIN_TOKEN n’est pas défini', async () => {
    delete process.env.ADMIN_TOKEN
    const refus = await new GardeAdmin().verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }))
    expect(refus?.code).toBe(503)
    expect(refus?.erreur).toContain('ADMIN_TOKEN')
  })

  it('refuse un jeton trop court, qui donnerait une fausse sécurité', async () => {
    process.env.ADMIN_TOKEN = 'trop-court'
    const refus = await new GardeAdmin().verifier(requete({ authorization: 'Bearer trop-court' }, { chiffre: true }))
    expect(refus?.code).toBe(503)
  })
})

describe('canal chiffré', () => {
  it('refuse en HTTP simple, même avec le bon jeton', async () => {
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${JETON}`, host: 'kitetudiant.fr' }),
    )
    expect(refus?.code).toBe(421)
    expect(refus?.erreur).toContain('HTTPS')
  })

  it('accepte derrière un nginx qui annonce https', async () => {
    expect(
      await new GardeAdmin().verifier(
        requete({ authorization: `Bearer ${JETON}`, host: 'kitetudiant.fr', 'x-forwarded-proto': 'https' }),
      ),
    ).toBeNull()
  })

  it('accepte en local, pour le développement', async () => {
    expect(
      await new GardeAdmin().verifier(
        requete({ authorization: `Bearer ${JETON}`, host: 'localhost:8787' }),
      ),
    ).toBeNull()
  })
})

describe('jeton', () => {
  it('refuse un mauvais jeton', async () => {
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: 'Bearer mauvais-jeton-mais-assez-long-quand-meme' }, { chiffre: true }),
    )
    expect(refus?.code).toBe(401)
  })

  it('refuse une requête sans en-tête d’autorisation', async () => {
    expect((await new GardeAdmin().verifier(requete({}, { chiffre: true })))?.code).toBe(401)
  })
})

describe('verrouillage', () => {
  it('bloque après cinq échecs, puis relâche après le délai', async () => {
    let t = 1_000_000
    const garde = new GardeAdmin(() => t)
    const mauvaise = requete({ authorization: 'Bearer faux-jeton-de-longueur-suffisante' }, { chiffre: true })

    for (let i = 0; i < ECHECS_MAX; i += 1) {
      expect((await garde.verifier(mauvaise))?.code).toBe(401)
    }
    const verrou = await garde.verifier(mauvaise)
    expect(verrou?.code).toBe(429)
    if (verrou?.code !== 429) return
    expect(verrou.reessayerDansS).toBeGreaterThan(0)

    // Même le bon jeton est refusé pendant le verrou.
    expect(
      (await garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true })))?.code,
    ).toBe(429)

    t += 16 * 60 * 1000
    expect(await garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }))).toBeNull()
  })

  it('compte les échecs par client, sans punir les autres', async () => {
    let t = 1_000_000
    const garde = new GardeAdmin(() => t)
    const faux = { authorization: 'Bearer faux-jeton-de-longueur-suffisante' }
    for (let i = 0; i < ECHECS_MAX + 1; i += 1) {
      await garde.verifier(requete(faux, { chiffre: true, ip: '203.0.113.7' }))
    }
    expect(
      await garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true, ip: '198.51.100.4' })),
    ).toBeNull()
  })

  it('oublie les échecs après une réussite', async () => {
    const garde = new GardeAdmin()
    await garde.verifier(requete({ authorization: 'Bearer faux-jeton-de-longueur-suffisante' }, { chiffre: true }))
    expect(await garde.verifier(requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }))).toBeNull()
    for (let i = 0; i < ECHECS_MAX - 1; i += 1) {
      expect(
        (
          await garde.verifier(
            requete({ authorization: 'Bearer faux-jeton-de-longueur-suffisante' }, { chiffre: true }),
          )
        )?.code,
      ).toBe(401)
    }
  })
})

describe('administrer avec son compte (ADMIN_EMAILS)', () => {
  /** Faux résolveur de session : associe un jeton à l'adresse de son porteur. */
  function porteur(table: Record<string, string>) {
    return async (jeton: string): Promise<string | null> => table[jeton] ?? null
  }

  const SESSION = 'jeton-de-session-de-jerome'

  it('accepte la session d’une adresse listée', async () => {
    process.env.ADMIN_EMAILS = 'jerome@exemple.fr'
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${SESSION}` }, { chiffre: true }),
      porteur({ [SESSION]: 'jerome@exemple.fr' }),
    )
    expect(refus).toBeNull()
  })

  it('ignore la casse et les espaces de la liste', async () => {
    process.env.ADMIN_EMAILS = '  Jerome@Exemple.FR , autre@exemple.fr '
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${SESSION}` }, { chiffre: true }),
      porteur({ [SESSION]: 'jerome@exemple.fr' }),
    )
    expect(refus).toBeNull()
  })

  it('refuse la session d’une adresse non listée', async () => {
    process.env.ADMIN_EMAILS = 'jerome@exemple.fr'
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${SESSION}` }, { chiffre: true }),
      porteur({ [SESSION]: 'quelquun-dautre@exemple.fr' }),
    )
    expect(refus?.code).toBe(401)
  })

  it('refuse un jeton de session inconnu', async () => {
    process.env.ADMIN_EMAILS = 'jerome@exemple.fr'
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: 'Bearer jeton-invente' }, { chiffre: true }),
      porteur({ [SESSION]: 'jerome@exemple.fr' }),
    )
    expect(refus?.code).toBe(401)
  })

  it('n’ouvre rien quand ADMIN_EMAILS est vide, même avec une session valide', async () => {
    // Le défaut doit rester le jeton seul : une liste vide ne doit pas se
    // comporter comme « tout le monde est administrateur ».
    delete process.env.ADMIN_EMAILS
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${SESSION}` }, { chiffre: true }),
      porteur({ [SESSION]: 'jerome@exemple.fr' }),
    )
    expect(refus?.code).toBe(401)
  })

  it('fonctionne sans ADMIN_TOKEN dès qu’ADMIN_EMAILS est renseignée', async () => {
    delete process.env.ADMIN_TOKEN
    process.env.ADMIN_EMAILS = 'jerome@exemple.fr'
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${SESSION}` }, { chiffre: true }),
      porteur({ [SESSION]: 'jerome@exemple.fr' }),
    )
    expect(refus).toBeNull()
  })

  it('exige toujours HTTPS, compte ou pas', async () => {
    process.env.ADMIN_EMAILS = 'jerome@exemple.fr'
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${SESSION}`, host: 'kitetudiant.fr' }),
      porteur({ [SESSION]: 'jerome@exemple.fr' }),
    )
    expect(refus?.code).toBe(421)
  })

  it('verrouille aussi les tentatives par compte', async () => {
    process.env.ADMIN_EMAILS = 'jerome@exemple.fr'
    const garde = new GardeAdmin()
    const resoudre = porteur({ [SESSION]: 'jerome@exemple.fr' })
    const mauvaise = requete({ authorization: 'Bearer session-volee' }, { chiffre: true })
    for (let i = 0; i < ECHECS_MAX; i += 1) {
      expect((await garde.verifier(mauvaise, resoudre))?.code).toBe(401)
    }
    expect((await garde.verifier(mauvaise, resoudre))?.code).toBe(429)
  })

  it('laisse le jeton d’exploitation ouvrir la porte en parallèle', async () => {
    // Voie de secours : si un compte administrateur est compromis, le jeton
    // doit continuer de fonctionner pour aller le retirer de la liste.
    process.env.ADMIN_EMAILS = 'jerome@exemple.fr'
    const refus = await new GardeAdmin().verifier(
      requete({ authorization: `Bearer ${JETON}` }, { chiffre: true }),
      porteur({}),
    )
    expect(refus).toBeNull()
  })
})
