import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  DepotComptes,
  EmailDejaInscrit,
  IdentifiantsRefuses,
  InscriptionInvalide,
  ComptesNonConfigures,
  TropDEssais,
  MOT_DE_PASSE_MINIMUM,
  PURGE_APRES_JOURS,
  SESSION_JOURS,
  jetonDeLEnTete,
} from '../comptes.ts'

const SECRET = 'un-secret-maitre-de-test-assez-long'
const MDP = 'motdepasse-correct'

let dossier: string
let chemin: string

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'comptes-'))
  chemin = join(dossier, 'comptes.json')
})
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

function depot(secret: string = SECRET): DepotComptes {
  return new DepotComptes(chemin, secret)
}

/**
 * Dépôt privé de secret. Fonction distincte à dessein : « depot(undefined) »
 * retomberait sur la valeur par défaut du paramètre et testerait le contraire
 * de ce qu'on croit — c'est arrivé en écrivant ces tests.
 */
function depotSansSecret(): DepotComptes {
  return new DepotComptes(chemin, undefined)
}

describe('inscription', () => {
  it('ouvre une session et permet de se reconnecter', async () => {
    const d = depot()
    const session = await d.inscrire('Eleve@Exemple.FR', MDP)
    expect(session.jeton.length).toBeGreaterThan(20)
    expect(await d.sessionValide(session.jeton)).toBe(true)

    // La casse et les espaces ne doivent pas empêcher de se reconnecter.
    const autre = await depot().connecter('  eleve@exemple.fr ', MDP)
    expect(await depot().sessionValide(autre.jeton)).toBe(true)
  })

  it('refuse deux comptes pour la même adresse', async () => {
    const d = depot()
    await d.inscrire('eleve@exemple.fr', MDP)
    await expect(d.inscrire('ELEVE@exemple.fr', MDP)).rejects.toBeInstanceOf(EmailDejaInscrit)
  })

  it('refuse une adresse invalide et un mot de passe trop court', async () => {
    const d = depot()
    await expect(d.inscrire('pas-une-adresse', MDP)).rejects.toBeInstanceOf(InscriptionInvalide)
    await expect(d.inscrire('a@b.fr', 'court')).rejects.toBeInstanceOf(InscriptionInvalide)
    // La limite elle-même doit passer.
    await expect(d.inscrire('a@b.fr', 'x'.repeat(MOT_DE_PASSE_MINIMUM))).resolves.toBeDefined()
  })
})

describe('ce qui est écrit sur le disque', () => {
  it('ne contient l’adresse en clair nulle part', async () => {
    await depot().inscrire('secrete@exemple.fr', MDP)
    const brut = await readFile(chemin, 'utf8')
    expect(brut).not.toContain('secrete@exemple.fr')
    expect(brut).not.toContain('secrete')
    expect(brut).not.toContain(MDP)
  })

  it('écrit le fichier en 0600', async () => {
    await depot().inscrire('eleve@exemple.fr', MDP)
    const infos = await stat(chemin)
    expect(infos.mode & 0o777).toBe(0o600)
  })

  it('ne stocke aucune donnée scolaire : le fichier n’a que les champs attendus', async () => {
    await depot().inscrire('eleve@exemple.fr', MDP)
    const fichier = JSON.parse(await readFile(chemin, 'utf8')) as {
      comptes: Record<string, unknown>[]
    }
    expect(Object.keys(fichier.comptes[0]!).sort()).toEqual([
      'baliseAuth',
      'emailChiffre',
      'empreinteMotDePasse',
      'index',
      'inscritLe',
      'nonce',
      'selMotDePasse',
      'vuLe',
    ])
  })

  it('ne peut pas être relu avec un autre secret maître', async () => {
    await depot().inscrire('eleve@exemple.fr', MDP)
    // Avec un autre secret maître, l'index de recherche ne correspond plus :
    // le compte devient introuvable, et l'adresse chiffrée illisible.
    await expect(
      depot('un-AUTRE-secret-maitre-assez-long').connecter('eleve@exemple.fr', MDP),
    ).rejects.toBeInstanceOf(IdentifiantsRefuses)
  })
})

describe('connexion', () => {
  it('refuse un mot de passe faux et une adresse inconnue avec le même message', async () => {
    const d = depot()
    await d.inscrire('eleve@exemple.fr', MDP)
    const faux = await d.connecter('eleve@exemple.fr', 'mauvais-mot-de-passe').catch((e) => e)
    const inconnu = await depot().connecter('personne@exemple.fr', MDP).catch((e) => e)
    expect(faux).toBeInstanceOf(IdentifiantsRefuses)
    expect(inconnu).toBeInstanceOf(IdentifiantsRefuses)
    // Un message différent permettrait d'énumérer les adresses inscrites.
    expect(faux.message).toBe(inconnu.message)
  })

  it('verrouille après cinq échecs', async () => {
    const d = depot()
    await d.inscrire('eleve@exemple.fr', MDP)
    for (let i = 0; i < 5; i += 1) {
      await expect(d.connecter('eleve@exemple.fr', 'faux')).rejects.toBeInstanceOf(
        IdentifiantsRefuses,
      )
    }
    // Même le bon mot de passe est refusé pendant le verrou.
    await expect(d.connecter('eleve@exemple.fr', MDP)).rejects.toBeInstanceOf(TropDEssais)
  })
})

describe('sessions', () => {
  it('expire après la durée prévue', async () => {
    const d = depot()
    const t0 = new Date('2026-01-01T00:00:00Z')
    const session = await d.inscrire('eleve@exemple.fr', MDP, t0)
    const veille = new Date(t0.getTime() + (SESSION_JOURS - 1) * 86400000)
    const apres = new Date(t0.getTime() + (SESSION_JOURS + 1) * 86400000)
    expect(await d.sessionValide(session.jeton, veille)).toBe(true)
    expect(await d.sessionValide(session.jeton, apres)).toBe(false)
  })

  it('se ferme à la déconnexion', async () => {
    const d = depot()
    const session = await d.inscrire('eleve@exemple.fr', MDP)
    await d.deconnecter(session.jeton)
    expect(await d.sessionValide(session.jeton)).toBe(false)
  })

  it('refuse un jeton inventé', async () => {
    const d = depot()
    await d.inscrire('eleve@exemple.fr', MDP)
    expect(await d.sessionValide('jeton-invente')).toBe(false)
    expect(await d.sessionValide('')).toBe(false)
  })
})

describe('conservation', () => {
  it('supprime les comptes dormants au-delà du délai', async () => {
    const t0 = new Date('2020-01-01T00:00:00Z')
    await depot().inscrire('vieux@exemple.fr', MDP, t0)
    const apres = new Date(t0.getTime() + (PURGE_APRES_JOURS + 1) * 86400000)

    const frais = depot()
    expect((await frais.etat(apres)).comptes).toBe(0)
    // La preuve que la purge a bien eu lieu : l'adresse est de nouveau libre.
    await expect(frais.inscrire('vieux@exemple.fr', MDP, apres)).resolves.toBeDefined()
  })

  it('garde un compte qui a servi récemment', async () => {
    const t0 = new Date('2020-01-01T00:00:00Z')
    await depot().inscrire('actif@exemple.fr', MDP, t0)
    const presque = new Date(t0.getTime() + (PURGE_APRES_JOURS - 1) * 86400000)
    expect((await depot().etat(presque)).comptes).toBe(1)
  })
})

describe('sans secret maître', () => {
  it('se déclare non configuré et refuse toute inscription', async () => {
    const d = depotSansSecret()
    expect(d.configure).toBe(false)
    await expect(d.inscrire('eleve@exemple.fr', MDP)).rejects.toBeInstanceOf(ComptesNonConfigures)
    expect(await d.sessionValide('peu-importe')).toBe(false)
    expect(await d.etat()).toEqual({ configure: false, comptes: 0, sessionsActives: 0 })
  })

  it('refuse un secret trop court plutôt que de chiffrer faiblement', async () => {
    expect(depot('trop-court').configure).toBe(false)
  })
})

describe('jetonDeLEnTete', () => {
  it('lit un en-tête Bearer et ignore le reste', () => {
    expect(jetonDeLEnTete('Bearer abc123')).toBe('abc123')
    expect(jetonDeLEnTete('bearer  abc123  ')).toBe('abc123')
    expect(jetonDeLEnTete('Basic abc123')).toBe('')
    expect(jetonDeLEnTete(undefined)).toBe('')
  })
})
