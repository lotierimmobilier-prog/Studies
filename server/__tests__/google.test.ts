import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  emailDepuisCode,
  GoogleRefuse,
  reglagesGoogle,
  urlDeDepart,
  type ReglagesGoogle,
} from '../googleIdentite.ts'
import {
  avecParametre,
  retourSur,
  SecretsEphemeres,
} from '../googleSessions.ts'
import { DepotComptes } from '../comptes.ts'

const REGLAGES: ReglagesGoogle = {
  clientId: 'client-de-test.apps.googleusercontent.com',
  clientSecret: 'secret-de-test',
  retour: 'https://kitetudiant.fr/kitetudiant/api/comptes/google/retour',
}

/** Fabrique un jeton d'identité comme Google en émet, sans signature valide. */
function jetonIdentite(charge: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'RS256' })}.${b64(charge)}.signature-non-verifiee`
}

const DEMAIN = Math.floor(Date.now() / 1000) + 3600

/** Un faux Google qui renvoie le jeton qu'on lui donne. */
function googleQuiRepond(charge: Record<string, unknown>): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ id_token: jetonIdentite(charge) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch
}

const CHARGE_VALIDE = {
  iss: 'https://accounts.google.com',
  aud: REGLAGES.clientId,
  exp: DEMAIN,
  email: 'Eleve.Test@Example.FR',
  email_verified: true,
}

/* ------------------------------------------------------------- réglages */

describe('la configuration Google', () => {
  it('rend null quand elle est absente, sans lever', () => {
    // Un serveur sans identifiants Google fonctionne : il propose une façon
    // de moins de se connecter. Ce n'est pas une panne.
    expect(reglagesGoogle({})).toBeNull()
    expect(reglagesGoogle({ GOOGLE_CLIENT_ID: 'x' })).toBeNull()
    expect(reglagesGoogle({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' })).toBeNull()
  })

  it('exige les trois valeurs, l’adresse de retour comprise', () => {
    expect(
      reglagesGoogle({
        GOOGLE_CLIENT_ID: 'x',
        GOOGLE_CLIENT_SECRET: 'y',
        GOOGLE_REDIRECT_URI: 'https://kitetudiant.fr/retour',
      }),
    ).toEqual({ clientId: 'x', clientSecret: 'y', retour: 'https://kitetudiant.fr/retour' })
  })
})

describe('l’adresse de départ', () => {
  const url = new URL(urlDeDepart(REGLAGES, 'mon-etat'))

  it('va bien chez Google et emporte l’état', () => {
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('state')).toBe('mon-etat')
    expect(url.searchParams.get('client_id')).toBe(REGLAGES.clientId)
    expect(url.searchParams.get('redirect_uri')).toBe(REGLAGES.retour)
    expect(url.searchParams.get('response_type')).toBe('code')
  })

  it('ne demande que l’adresse e-mail', () => {
    // Pas de « profile » : nous n'avons que faire du prénom, de la photo ni
    // de la langue. Ce qui n'est pas demandé n'a pas à être protégé.
    expect(url.searchParams.get('scope')).toBe('openid email')
  })

  it('ne demande aucun accès hors ligne', () => {
    // « offline » donnerait un jeton de rafraîchissement, donc un secret de
    // longue durée à garder. Nous n'en avons aucun usage.
    expect(url.searchParams.get('access_type')).toBeNull()
  })
})

/* ---------------------------------------------------- échange du code */

describe('l’échange du code contre une adresse', () => {
  it('rend l’adresse, normalisée en minuscules', async () => {
    const email = await emailDepuisCode(REGLAGES, 'un-code', googleQuiRepond(CHARGE_VALIDE))
    expect(email).toBe('eleve.test@example.fr')
  })

  it('refuse un jeton destiné à une autre application', async () => {
    // Sans ce contrôle, un jeton obtenu par une autre application pour le
    // même élève ouvrirait une session ici.
    await expect(
      emailDepuisCode(REGLAGES, 'c', googleQuiRepond({ ...CHARGE_VALIDE, aud: 'quelqun-dautre' })),
    ).rejects.toThrow(/autre application/i)
  })

  it('refuse un jeton émis par un tiers', async () => {
    await expect(
      emailDepuisCode(REGLAGES, 'c', googleQuiRepond({ ...CHARGE_VALIDE, iss: 'https://ailleurs' })),
    ).rejects.toThrow(/tiers inattendu/i)
  })

  it('refuse une adresse que Google n’a pas confirmée', async () => {
    // C'est le contrôle qui autorise à rejoindre un compte existant : sans
    // lui, déclarer l'adresse de quelqu'un d'autre suffirait à entrer chez lui.
    await expect(
      emailDepuisCode(REGLAGES, 'c', googleQuiRepond({ ...CHARGE_VALIDE, email_verified: false })),
    ).rejects.toThrow(/confirmé/i)
    await expect(
      emailDepuisCode(REGLAGES, 'c', googleQuiRepond({ ...CHARGE_VALIDE, email_verified: 'true' })),
    ).rejects.toThrow(/confirmé/i)
  })

  it('refuse un jeton périmé', async () => {
    await expect(
      emailDepuisCode(
        REGLAGES,
        'c',
        googleQuiRepond({ ...CHARGE_VALIDE, exp: Math.floor(Date.now() / 1000) - 10 }),
      ),
    ).rejects.toThrow(/expiré/i)
  })

  it('refuse un jeton illisible, sans laisser fuir une exception brute', async () => {
    const cassé = (async () =>
      new Response(JSON.stringify({ id_token: 'pas-un-jwt' }), { status: 200 })) as unknown as typeof fetch
    await expect(emailDepuisCode(REGLAGES, 'c', cassé)).rejects.toBeInstanceOf(GoogleRefuse)
  })

  it('ne recopie pas le corps d’erreur de Google dans son message', async () => {
    // Ce corps peut contenir nos identifiants en écho ; il finirait dans un
    // journal.
    const refus = (async () =>
      new Response(JSON.stringify({ error: 'invalid_client', secret: REGLAGES.clientSecret }), {
        status: 401,
      })) as unknown as typeof fetch
    await expect(emailDepuisCode(REGLAGES, 'c', refus)).rejects.toThrow(/code 401/)
    await expect(emailDepuisCode(REGLAGES, 'c', refus)).rejects.not.toThrow(
      new RegExp(REGLAGES.clientSecret),
    )
  })

  it('envoie bien le code et le secret au point d’échange', async () => {
    let vu: { url: string; corps: string } | null = null
    const espion = (async (u: string, o: RequestInit) => {
      vu = { url: u, corps: String(o.body) }
      return new Response(JSON.stringify({ id_token: jetonIdentite(CHARGE_VALIDE) }), { status: 200 })
    }) as unknown as typeof fetch
    await emailDepuisCode(REGLAGES, 'le-code', espion)
    expect(vu!.url).toBe('https://oauth2.googleapis.com/token')
    const p = new URLSearchParams(vu!.corps)
    expect(p.get('code')).toBe('le-code')
    expect(p.get('grant_type')).toBe('authorization_code')
    expect(p.get('client_secret')).toBe(REGLAGES.clientSecret)
  })
})

/* -------------------------------------------------- secrets éphémères */

describe('les secrets d’aller-retour', () => {
  it('ne servent qu’une fois', () => {
    const magasin = new SecretsEphemeres<string>(60_000)
    const cle = magasin.creer('valeur')
    expect(magasin.consommer(cle)).toBe('valeur')
    expect(magasin.consommer(cle)).toBeNull()
  })

  it('expirent', () => {
    const magasin = new SecretsEphemeres<string>(1_000)
    const t0 = new Date('2026-09-20T12:00:00Z')
    const cle = magasin.creer('valeur', t0)
    expect(magasin.consommer(cle, new Date(t0.getTime() + 2_000))).toBeNull()
  })

  it('rendent null pour une clé inconnue, plutôt que de lever', () => {
    expect(new SecretsEphemeres<string>(1_000).consommer('inventée')).toBeNull()
  })

  it('refusent de gonfler indéfiniment', () => {
    // Une file qui grossit sans fin est une attaque par épuisement mémoire.
    const magasin = new SecretsEphemeres<string>(60_000)
    expect(() => {
      for (let i = 0; i < 600; i++) magasin.creer('x')
    }).toThrow(/Trop de connexions/)
  })

  it('oublient ce qui a expiré au lieu de l’accumuler', () => {
    const magasin = new SecretsEphemeres<string>(1_000)
    const t0 = new Date('2026-09-20T12:00:00Z')
    for (let i = 0; i < 10; i++) magasin.creer('x', t0)
    magasin.creer('y', new Date(t0.getTime() + 5_000))
    expect(magasin.taille).toBeLessThanOrEqual(1)
  })
})

describe('l’adresse de retour dans l’application', () => {
  it('accepte un chemin interne', () => {
    expect(retourSur('/kitetudiant/')).toBe('/kitetudiant/')
    expect(retourSur('/kitetudiant/connexion')).toBe('/kitetudiant/connexion')
  })

  /**
   * C'est la faille la plus coûteuse de ce mécanisme : le retour emporte un
   * ticket de session. Une redirection ouverte le livrerait à un tiers, qui
   * n'aurait plus qu'à l'échanger pour entrer dans le compte de l'élève.
   */
  it('refuse tout ce qui sortirait du site', () => {
    for (const hostile of [
      'https://ailleurs.example/vole',
      'http://ailleurs.example',
      '//ailleurs.example',
      'javascript:alert(1)',
      'ailleurs.example',
      '/\\ailleurs.example',
      '/ok\r\nLocation: https://ailleurs.example',
    ]) {
      expect(retourSur(hostile), hostile).toBe('/')
    }
  })

  it('retombe sur la racine quand rien n’est demandé', () => {
    expect(retourSur(null)).toBe('/')
    expect(retourSur('')).toBe('/')
  })

  it('ajoute un paramètre sans casser un chemin qui en a déjà', () => {
    expect(avecParametre('/k/', 'ticket', 'a b')).toBe('/k/?ticket=a%20b')
    expect(avecParametre('/k/?x=1', 'ticket', 'z')).toBe('/k/?x=1&ticket=z')
  })
})

/* ------------------------------------------- ouverture du compte élève */

describe('l’ouverture de session par fournisseur', () => {
  let dossier: string
  let depot: DepotComptes

  beforeEach(() => {
    dossier = mkdtempSync(join(tmpdir(), 'comptes-google-'))
    depot = new DepotComptes(join(dossier, 'comptes.json'), 'x'.repeat(64))
  })
  afterEach(() => rmSync(dossier, { recursive: true, force: true }))

  it('crée le compte à la première connexion, puis le retrouve', async () => {
    const un = await depot.ouvrirParFournisseur('eleve@example.fr')
    expect(un.jeton).not.toBe('')
    expect(await depot.sessionValide(un.jeton)).toBe(true)

    const deux = await depot.ouvrirParFournisseur('eleve@example.fr')
    expect(deux.jeton).not.toBe(un.jeton)
    expect((await depot.etat()).comptes).toBe(1)
  })

  /**
   * Le compte créé n'a pas de mot de passe utilisable : son empreinte vient
   * d'un secret aléatoire aussitôt oublié. Une empreinte vide, ou calculée
   * sur une chaîne vide, aurait ouvert le compte à qui l'aurait deviné.
   */
  it('ne laisse aucun mot de passe utilisable derrière elle', async () => {
    await depot.ouvrirParFournisseur('sans-mot-de-passe@example.fr')
    for (const essai of ['', ' ', '—', 'motdepasse']) {
      await expect(depot.connecter('sans-mot-de-passe@example.fr', essai)).rejects.toThrow()
    }
  })

  it('rejoint un compte ouvert avec un mot de passe, sans le dupliquer', async () => {
    await depot.inscrire('les-deux@example.fr', 'un-mot-de-passe-long')
    const parGoogle = await depot.ouvrirParFournisseur('les-deux@example.fr')
    expect(await depot.sessionValide(parGoogle.jeton)).toBe(true)
    expect((await depot.etat()).comptes).toBe(1)

    // Et le mot de passe d'origine continue de fonctionner.
    const parMotDePasse = await depot.connecter('les-deux@example.fr', 'un-mot-de-passe-long')
    expect(await depot.sessionValide(parMotDePasse.jeton)).toBe(true)
  })

  it('traite la casse de l’adresse comme la connexion ordinaire', async () => {
    await depot.inscrire('Casse@Example.FR', 'un-mot-de-passe-long')
    await depot.ouvrirParFournisseur('casse@example.fr')
    expect((await depot.etat()).comptes).toBe(1)
  })
})
