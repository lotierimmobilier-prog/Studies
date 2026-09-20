/**
 * Le client France Travail.
 *
 * Ce qui compte ici n'est pas que l'API réponde — c'est la leur, elle
 * répond — mais que NOTRE code ne fasse rien de dangereux ni de faux :
 *
 *   - la clé secrète ne doit apparaître dans aucun message d'erreur ;
 *   - « on n'a pas pu compter » ne doit jamais devenir « zéro offre » ;
 *   - le quota de dix requêtes par seconde ne doit pas être dépassé, donc
 *     le cache doit vraiment éviter les appels, et les comptages d'une
 *     page doivent partir en série.
 *
 * Tout est exercé sur un `fetch` simulé : ces propriétés-là ne dépendent
 * pas du réseau, et un test qui appelle une API tierce échoue un jour pour
 * une raison qui n'est pas la sienne.
 */

import { describe, expect, it } from 'vitest'

import { ClientEmploi, EmploiNonConfigure, lienOffres } from '../emploi.ts'
import type { Coffre } from '../secrets.ts'

const SECRET = 'cle-secrete-tres-confidentielle'

function coffre(id: string | null = 'PAR_essai', secret: string | null = SECRET): Coffre {
  return {
    valeur: async (nom: string) =>
      nom === 'FRANCE_TRAVAIL_ID' ? id : nom === 'FRANCE_TRAVAIL_SECRET' ? secret : null,
  } as unknown as Coffre
}

/** Un `fetch` qui compte les appels et rend ce qu'on lui dit. */
function faussetch(reponses: (url: string) => Response) {
  const appels: string[] = []
  const recuperer = ((url: string) => {
    appels.push(url)
    return Promise.resolve(reponses(url))
  }) as unknown as typeof fetch
  return { recuperer, appels }
}

function jetonOk(): Response {
  return new Response(JSON.stringify({ access_token: 'JETON', expires_in: 1500 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function comptage(total: number): Response {
  return new Response('[]', {
    status: 206,
    headers: { 'Content-Range': `offres 0-0/${total}` },
  })
}

describe('sans identifiants', () => {
  it('se déclare non configuré plutôt que de lever', async () => {
    const { recuperer } = faussetch(() => jetonOk())
    const client = new ClientEmploi(coffre(null, null), recuperer)
    expect(await client.configure()).toBe(false)
  })

  it('refuse de compter, avec une erreur nommée', async () => {
    const { recuperer, appels } = faussetch(() => jetonOk())
    const client = new ClientEmploi(coffre(null, null), recuperer)
    await expect(client.metiers()).rejects.toBeInstanceOf(EmploiNonConfigure)
    // Et surtout : aucun appel n'est parti.
    expect(appels).toEqual([])
  })
})

describe('le secret ne fuit pas', () => {
  it('un refus d’authentification ne répète pas la clé', async () => {
    const { recuperer } = faussetch(
      () => new Response(`{"error":"invalid_client","client_secret":"${SECRET}"}`, { status: 401 }),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    // Le corps de la réponse peut répéter l'identifiant : on ne le relaie pas.
    await expect(client.metiers()).rejects.toThrow(/refusé l’authentification \(401\)/)
    await expect(client.metiers()).rejects.not.toThrow(new RegExp(SECRET))
  })
})

describe('compter les offres', () => {
  it('lit le total dans l’en-tête, pas dans le corps', async () => {
    const { recuperer } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : comptage(2295),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    const [c] = await client.comptages([{ code: 'J1502', libelle: 'Cadre de santé' }], null)
    expect(c!.enFrance).toBe(2295)
    expect(c!.releveLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('traite 204 comme un vrai zéro', async () => {
    const { recuperer } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : new Response(null, { status: 204 }),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    const [c] = await client.comptages([{ code: 'M1805', libelle: 'Dév' }], null)
    expect(c!.enFrance).toBe(0)
  })

  it('ne transforme JAMAIS une panne en zéro', async () => {
    // « Aucune offre » et « on n'a pas pu compter » sont deux informations
    // différentes, et la seconde ne doit pas se faire passer pour la
    // première : elle découragerait sur la foi d'une panne réseau.
    const { recuperer } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : new Response('', { status: 500 }),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    const [c] = await client.comptages([{ code: 'M1805', libelle: 'Dév' }], null)
    expect(c!.enFrance).toBeNull()
    expect(c!.enFrance).not.toBe(0)
  })

  it('demande une offre et non cinquante', async () => {
    // `range=0-50` téléchargerait cinquante annonces dont on n'affiche
    // aucune, à chaque compteur de chaque page.
    const { recuperer, appels } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : comptage(12),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    await client.comptages([{ code: 'M1805', libelle: 'Dév' }], null)
    expect(appels.find((a) => a.includes('offres/search'))).toContain('range=0-0')
  })

  it('compte les deux échelles, et jamais le département', async () => {
    const { recuperer, appels } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : comptage(26),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    const [c] = await client.comptages([{ code: 'M1855', libelle: 'Dév web' }], '75')
    expect(c!.enFrance).toBe(26)
    expect(c!.enRegion).toBe(26)
    const recherches = appels.filter((a) => a.includes('offres/search'))
    expect(recherches).toHaveLength(2)
    expect(recherches.some((a) => a.includes('region=75'))).toBe(true)
    expect(recherches.some((a) => a.includes('departement='))).toBe(false)
  })
})

describe('le quota de dix requêtes par seconde', () => {
  it('ne redemande pas un compteur déjà connu', async () => {
    const { recuperer, appels } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : comptage(7),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    const metier = [{ code: 'M1805', libelle: 'Dév' }]
    await client.comptages(metier, null)
    await client.comptages(metier, null)
    await client.comptages(metier, null)
    expect(appels.filter((a) => a.includes('offres/search'))).toHaveLength(1)
  })

  it('ne garde un échec que brièvement', async () => {
    // Sinon une panne d'une minute rendrait la page muette six heures.
    let temps = 1_000_000
    let etat = 500
    const { recuperer } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : etat === 500 ? new Response('', { status: 500 }) : comptage(9),
    )
    const client = new ClientEmploi(coffre(), recuperer, () => temps)
    expect((await client.comptages([{ code: 'M1805', libelle: 'D' }], null))[0]!.enFrance).toBeNull()
    etat = 200
    temps += 61_000
    expect((await client.comptages([{ code: 'M1805', libelle: 'D' }], null))[0]!.enFrance).toBe(9)
  })

  it('ne redemande pas un jeton encore valable', async () => {
    const { recuperer, appels } = faussetch((url) =>
      url.includes('oauth2') ? jetonOk() : comptage(3),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    await client.comptages(
      [
        { code: 'A', libelle: 'a' },
        { code: 'B', libelle: 'b' },
        { code: 'C', libelle: 'c' },
      ],
      null,
    )
    expect(appels.filter((a) => a.includes('oauth2'))).toHaveLength(1)
  })

  it('charge le référentiel une seule fois', async () => {
    const { recuperer, appels } = faussetch((url) =>
      url.includes('oauth2')
        ? jetonOk()
        : new Response(JSON.stringify([{ code: 'M1805', libelle: 'Dév' }]), { status: 200 }),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    await client.metiers()
    await client.metiers()
    expect(appels.filter((a) => a.includes('referentiel'))).toHaveLength(1)
  })
})

describe('le lien vers France Travail', () => {
  it('vise leur site public, pas l’API', () => {
    const url = lienOffres('Développeur / Développeuse web', '75')
    expect(url).toContain('candidat.francetravail.fr')
    expect(url).not.toContain('api.francetravail')
    expect(decodeURIComponent(url)).toContain('Développeur')
    expect(url).toContain('region=75')
  })
})
