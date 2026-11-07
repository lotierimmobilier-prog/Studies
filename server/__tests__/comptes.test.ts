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

describe('espace personnel — profil', () => {
  it('rend l’adresse et les dates du titulaire de la session', async () => {
    const d = depot()
    const { jeton } = await d.inscrire('Eleve@Exemple.fr', MDP)
    const profil = await d.profil(jeton)
    expect(profil?.email).toBe('eleve@exemple.fr')
    expect(profil?.inscritLe).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(profil?.sessionExpireLe).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('ne rend RIEN d’autre que ces quatre champs', async () => {
    // Le contour exact de ce qui sort vers le navigateur. Ce test tombera le
    // jour où quelqu'un ajoutera un champ au profil : c'est sa raison d'être.
    // Les titulaires sont mineurs, et aucune donnée ne doit apparaître ici
    // sans décision (règle 3 de CLAUDE.md).
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    expect(Object.keys((await d.profil(jeton))!).sort()).toEqual([
      'email',
      'inscritLe',
      'sessionExpireLe',
      'vuLe',
    ])
  })

  it('refuse un jeton inconnu ou expiré', async () => {
    const d = depot()
    await d.inscrire('eleve@exemple.fr', MDP)
    expect(await d.profil('jeton-inventé')).toBeNull()
    expect(await d.profil('')).toBeNull()
  })

  it('ne rend plus rien une fois la session expirée', async () => {
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    const apres = new Date(Date.now() + (SESSION_JOURS + 1) * 86400_000)
    expect(await d.profil(jeton, apres)).toBeNull()
  })
})

describe('espace personnel — mot de passe', () => {
  it('change le mot de passe quand l’ancien est juste', async () => {
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    await d.changerMotDePasse(jeton, MDP, 'un-nouveau-mot-de-passe')
    await expect(d.connecter('eleve@exemple.fr', 'un-nouveau-mot-de-passe')).resolves.toBeTruthy()
    await expect(d.connecter('eleve@exemple.fr', MDP)).rejects.toBeInstanceOf(IdentifiantsRefuses)
  })

  it('exige l’ancien mot de passe, même avec une session valide', async () => {
    // Une session se vole ou s'emprunte — un téléphone laissé déverrouillé
    // suffit. Sans cette vérification, celui qui la détient verrouillerait le
    // compte pour son titulaire.
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    await expect(
      d.changerMotDePasse(jeton, 'pas-le-bon', 'un-nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(IdentifiantsRefuses)
    await expect(d.connecter('eleve@exemple.fr', MDP)).resolves.toBeTruthy()
  })

  it('refuse un nouveau mot de passe trop court, en le disant', async () => {
    // Le nouveau est validé AVANT l'ancien : sinon un mot de passe trop court
    // renverrait « identifiants refusés » et laisserait croire à une faute de
    // frappe sur l'ancien.
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    await expect(d.changerMotDePasse(jeton, MDP, 'court')).rejects.toBeInstanceOf(
      InscriptionInvalide,
    )
    await expect(d.changerMotDePasse(jeton, 'pas-le-bon', 'court')).rejects.toBeInstanceOf(
      InscriptionInvalide,
    )
  })

  it('fait tomber les AUTRES sessions, et garde celle-ci', async () => {
    // C'est le geste qu'on attend d'un changement de mot de passe : si
    // quelqu'un d'autre était connecté, il ne l'est plus — et l'élève n'est
    // pas déconnecté par sa propre précaution.
    const d = depot()
    const premiere = await d.inscrire('eleve@exemple.fr', MDP)
    const seconde = await d.connecter('eleve@exemple.fr', MDP)
    await d.changerMotDePasse(seconde.jeton, MDP, 'un-nouveau-mot-de-passe')
    expect(await d.sessionValide(seconde.jeton)).toBe(true)
    expect(await d.sessionValide(premiere.jeton)).toBe(false)
  })

  it('tire un sel neuf, plutôt que de réutiliser l’ancien', async () => {
    // Réutiliser le sel laisserait deux empreintes comparables dans les
    // sauvegardes successives du fichier.
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    const selAvant = JSON.parse(await readFile(chemin, 'utf8')).comptes[0].selMotDePasse
    await d.changerMotDePasse(jeton, MDP, 'un-nouveau-mot-de-passe')
    const selApres = JSON.parse(await readFile(chemin, 'utf8')).comptes[0].selMotDePasse
    expect(selApres).not.toBe(selAvant)
  })

  it('refuse sur une session inconnue', async () => {
    const d = depot()
    await d.inscrire('eleve@exemple.fr', MDP)
    await expect(
      d.changerMotDePasse('jeton-inventé', MDP, 'un-nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(IdentifiantsRefuses)
  })

  it('ne parle pas d’une adresse que l’élève n’a pas saisie', async () => {
    // Le message ambigu de la connexion — « adresse OU mot de passe » —
    // existe pour empêcher d'énumérer les comptes. Ici, la session identifie
    // déjà le compte : il n'y a rien à énumérer, et cette ambiguïté enverrait
    // l'élève chercher une faute de frappe dans un champ qui n'existe pas.
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    await expect(
      d.changerMotDePasse(jeton, 'pas-le-bon', 'un-nouveau-mot-de-passe'),
    ).rejects.toThrow(/mot de passe actuel/i)
    await expect(
      d.changerMotDePasse('jeton-inventé', MDP, 'un-nouveau-mot-de-passe'),
    ).rejects.toThrow(/session/i)
    // La connexion, elle, garde son message ambigu.
    await expect(d.connecter('eleve@exemple.fr', 'pas-le-bon')).rejects.toThrow(
      /Adresse ou mot de passe/i,
    )
  })
})

describe('espace personnel — effacement', () => {
  it('efface le compte et toutes ses sessions', async () => {
    const d = depot()
    const premiere = await d.inscrire('eleve@exemple.fr', MDP)
    const seconde = await d.connecter('eleve@exemple.fr', MDP)
    expect(await d.supprimerCompte(seconde.jeton)).toBe(true)
    expect(await d.sessionValide(premiere.jeton)).toBe(false)
    expect(await d.sessionValide(seconde.jeton)).toBe(false)
    expect((await d.etat()).comptes).toBe(0)
  })

  it('ne laisse aucune trace de l’adresse sur le disque', async () => {
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    const avant = await readFile(chemin, 'utf8')
    const chiffre = JSON.parse(avant).comptes[0].emailChiffre
    await d.supprimerCompte(jeton)
    const apres = await readFile(chemin, 'utf8')
    expect(apres).not.toContain(chiffre)
    expect(JSON.parse(apres).comptes).toEqual([])
  })

  it('permet de se réinscrire avec la même adresse', async () => {
    // Un effacement qui laisserait l'index derrière lui rendrait l'adresse
    // définitivement inutilisable — une punition, pas un droit.
    const d = depot()
    const { jeton } = await d.inscrire('eleve@exemple.fr', MDP)
    await d.supprimerCompte(jeton)
    await expect(d.inscrire('eleve@exemple.fr', MDP)).resolves.toBeTruthy()
  })

  it('n’efface rien sur une session inconnue', async () => {
    const d = depot()
    await d.inscrire('eleve@exemple.fr', MDP)
    expect(await d.supprimerCompte('jeton-inventé')).toBe(false)
    expect((await d.etat()).comptes).toBe(1)
  })
})

describe('statistiques de comptes', () => {
  it('compte les inscrits, les sessions et les créations par jour', async () => {
    const d = depot()
    await d.inscrire('a@exemple.fr', MDP)
    await d.inscrire('b@exemple.fr', MDP)
    const s = await d.statistiques()
    expect(s.comptes).toBe(2)
    expect(s.sessionsActives).toBe(2)
    expect(s.creationsParJour).toHaveLength(1)
    expect(s.creationsParJour[0]!.nombre).toBe(2)
    expect(s.premierCompteLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('ne laisse fuir AUCUNE adresse, même partielle', async () => {
    // Le test central. Le fichier chiffre les adresses au repos pour qu'on ne
    // puisse pas les énumérer ; une fonction d'administration qui les
    // déchiffrerait en bloc annulerait cette protection, sur une base
    // d'utilisateurs mineurs (règle 3 de CLAUDE.md).
    const d = depot()
    await d.inscrire('eleve.unique@exemple.fr', MDP)
    const texte = JSON.stringify(await d.statistiques())
    for (const fuite of ['eleve.unique', 'exemple.fr', '@']) {
      expect(texte, `« ${fuite} » a fui dans les statistiques`).not.toContain(fuite)
    }
  })

  it('range la série des créations en ordre chronologique', async () => {
    const d = depot()
    const vieux = new Date(Date.now() - 3 * 86400_000)
    await d.inscrire('a@exemple.fr', MDP, vieux)
    await d.inscrire('b@exemple.fr', MDP)
    const jours = (await d.statistiques()).creationsParJour.map((c) => c.le)
    expect(jours).toEqual([...jours].sort())
  })

  it('compte les actifs des trente derniers jours', async () => {
    const d = depot()
    await d.inscrire('a@exemple.fr', MDP)
    expect((await d.statistiques()).actifs30j).toBe(1)
    // Quarante jours plus tard, le même compte n'est plus actif.
    const plusTard = new Date(Date.now() + 40 * 86400_000)
    expect((await d.statistiques(plusTard)).actifs30j).toBe(0)
  })

  it('annonce les comptes qui approchent de la purge', async () => {
    // Une durée de conservation qu'on ne voit pas approcher est une durée
    // qu'on découvre après coup.
    const d = depot()
    await d.inscrire('a@exemple.fr', MDP)
    expect((await d.statistiques()).bientotPurges).toBe(0)
    const presque = new Date(Date.now() + (PURGE_APRES_JOURS - 30) * 86400_000)
    expect((await d.statistiques(presque)).bientotPurges).toBe(1)
  })

  it('rend des compteurs vides, et pas une erreur, sans secret maître', async () => {
    const s = await depotSansSecret().statistiques()
    expect(s.configure).toBe(false)
    expect(s.comptes).toBe(0)
    expect(s.creationsParJour).toEqual([])
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
