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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { nombre } from '../../kitetudiant/packages/budget-engine/src/nombres.ts'
import { salaireMinimum, ClientEmploi, EmploiNonConfigure, lienOffres } from '../emploi.ts'
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

describe('éprouver la connexion depuis la console', () => {
  it('dit à quelle étape ça casse, et pas seulement que ça casse', async () => {
    // « Échec » tout court oblige l'exploitant à deviner : clé fausse ?
    // portée manquante ? panne chez eux ? Les trois se réparent autrement.
    const { recuperer } = faussetch(() => new Response('', { status: 401 }))
    const client = new ClientEmploi(coffre(), recuperer)
    const r = await client.essayer()
    expect(r.ok).toBe(false)
    expect(r.etape).toBe('authentification')
  })

  it('signale les identifiants manquants avant d’appeler qui que ce soit', async () => {
    const { recuperer, appels } = faussetch(() => jetonOk())
    const client = new ClientEmploi(coffre(null, null), recuperer)
    const r = await client.essayer()
    expect(r.etape).toBe('identifiants')
    expect(appels).toEqual([])
  })

  it('va jusqu’à un comptage réel, pas seulement jusqu’au jeton', async () => {
    /* Des identifiants valables mais sans la portée `api_offresdemploiv2`
       donnent un jeton et échouent ensuite. S'arrêter au jeton afficherait
       « la connexion fonctionne » sur une configuration qui ne compte rien. */
    const { recuperer, appels } = faussetch((url) =>
      url.includes('oauth2')
        ? jetonOk()
        : url.includes('referentiel')
          ? new Response(JSON.stringify([{ code: 'M1805', libelle: 'Dév' }]), { status: 200 })
          : comptage(9600),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    const r = await client.essayer()
    expect(r.ok).toBe(true)
    expect(appels.some((a) => a.includes('offres/search'))).toBe(true)
    /* `nombre()` et non « 9 600 » écrit à la main : la locale française
       sépare les milliers par une espace FINE INSÉCABLE (U+202F), pas par
       une espace ordinaire. Le test échouait sur une chaîne pourtant
       juste. */
    expect(r.detail).toContain(nombre(9600))
  })

  it('ne relaie jamais le corps de la réponse de France Travail', async () => {
    const { recuperer } = faussetch(
      () => new Response(`{"erreur":"clé ${SECRET} invalide"}`, { status: 400 }),
    )
    const client = new ClientEmploi(coffre(), recuperer)
    const r = await client.essayer()
    expect(JSON.stringify(r)).not.toContain(SECRET)
  })
})

describe('le salaire minimum est LU, jamais estimé', () => {
  /* La règle 1 de CLAUDE.md interdit tout montant qui ne remonte pas à une
     source. Ici rien n'est calculé : le chiffre est celui que l'employeur a
     publié, et cette fonction ne fait que le détacher du texte.
     
     Les formes ci-dessous sont RELEVÉES sur 150 offres réelles du domaine
     M18 le 21/09/2026 — pas imaginées. La fonction en a lu 101 sur 101. */

  it('lit les quatre formes publiées par France Travail', () => {
    expect(salaireMinimum('Annuel de 24000.00 Euros à 28000.00 Euros')).toEqual({
      montant: 24000,
      periode: 'an',
    })
    expect(salaireMinimum('Annuel de 32000.0 Euros - Selon compétences et profil')).toEqual({
      montant: 32000,
      periode: 'an',
    })
    expect(salaireMinimum('Mensuel de 2450.0 Euros - Voiture, téléphone,')).toEqual({
      montant: 2450,
      periode: 'mois',
    })
    expect(salaireMinimum('Horaire de 12.5 Euros')).toEqual({ montant: 12.5, periode: 'heure' })
  })

  it('retient le PLANCHER d’une fourchette, pas le plafond', () => {
    /* Annoncer le haut ferait passer une possibilité pour une promesse.
       Le bas est ce que l'employeur s'engage à verser. */
    expect(salaireMinimum('Annuel de 65000.0 Euros à 73000.0 Euros')?.montant).toBe(65000)
    expect(salaireMinimum('Horaire de 13.0 Euros à 14.0 Euros')?.montant).toBe(13)
  })

  it('rend null plutôt qu’un montant approché', () => {
    // Un libellé non reconnu ne devient PAS une estimation : la carte dira
    // « salaire non publié », ce qui est vrai.
    expect(salaireMinimum('Rémunération au minimum conventionnel applicable')).toBeNull()
    expect(salaireMinimum('Selon profil')).toBeNull()
    expect(salaireMinimum('')).toBeNull()
    expect(salaireMinimum(null)).toBeNull()
    expect(salaireMinimum(undefined)).toBeNull()
    expect(salaireMinimum(42 as unknown as string)).toBeNull()
  })

  it('refuse un montant qui n’en est pas un', () => {
    // Un champ mal rempli afficherait « à partir de 0 € par an ».
    expect(salaireMinimum('Annuel de 0 Euros')).toBeNull()
    expect(salaireMinimum('Annuel de -5 Euros')).toBeNull()
    // Une période inconnue n'est pas devinée.
    expect(salaireMinimum('Cadeau de 20000 Euros')).toBeNull()
    expect(salaireMinimum('Trimestriel de 6000 Euros')).toBeNull()
  })

  it('accepte la virgule décimale et la casse de l’API', () => {
    expect(salaireMinimum('Mensuel de 2450,50 Euros')?.montant).toBe(2450.5)
    expect(salaireMinimum('ANNUEL DE 30000 EUROS')?.periode).toBe('an')
  })
})

describe('les annonces vieillissent plus vite que les compteurs', () => {
  const SOURCE = readFileSync(resolve(import.meta.dirname, '..', 'emploi.ts'), 'utf8')

  it('ont leur propre cache, bien plus court', () => {
    /* D15 disait « le compteur, pas les annonces » : une offre est pourvue
       en quelques jours. Garder une liste six heures comme un compteur
       montrerait des postes pris. */
    expect(SOURCE).toContain('const CACHE_OFFRES_MINUTES = 60')
    expect(SOURCE).toContain('CACHE_OFFRES_MINUTES * 60_000')
    // Et les deux caches restent distincts.
    expect(SOURCE).toContain('private readonly annonces = new Map')
  })

  it('écartent une annonce sans lien, sans lieu ou sans intitulé', () => {
    // Une carte sans lien est un cul-de-sac : c'est le lien qui montre
    // qu'un poste est pourvu.
    expect(SOURCE).toContain('if (!id || !intitule || !lieu || !url) return null')
  })

  it('interrogent les domaines un par un', () => {
    /* Vérifié contre l'API le 21/09/2026 : « domaine=M18&domaine=A12 » rend
       cinquante offres, toutes M18. Le second est ignoré EN SILENCE — la
       requête réussit, et on croirait couvrir les deux. */
    expect(SOURCE).toContain('for (const domaine of retenus)')
    expect(SOURCE).toContain('const DOMAINES_PAR_ECHANTILLON = 3')
  })
})
