import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Coffre, CoffreNonConfigure, estSecretGere, jetonValide, SECRETS_GERES } from '../secrets'

const ENV = { ...process.env }
let dossier: string
let coffre: Coffre

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'coffre-'))
  coffre = new Coffre(join(dossier, 'secrets.json'))
  process.env.ADMIN_MASTER_KEY = 'un-secret-maitre-assez-long'
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.GOOGLE_MAPS_API_KEY
})

afterEach(() => {
  process.env = { ...ENV }
})

describe('liste fermée', () => {
  it('n’accepte que les clés prévues', () => {
    expect(estSecretGere('ANTHROPIC_API_KEY')).toBe(true)
    expect(estSecretGere('ADMIN_TOKEN')).toBe(false)
    expect(estSecretGere('PATH')).toBe(false)
  })
})

describe('sans secret maître', () => {
  it('refuse d’enregistrer plutôt que de stocker en clair', async () => {
    delete process.env.ADMIN_MASTER_KEY
    await expect(coffre.enregistrer('ANTHROPIC_API_KEY', 'sk-ant-123456')).rejects.toBeInstanceOf(
      CoffreNonConfigure,
    )
  })
})

describe('chiffrement au repos', () => {
  it('n’écrit jamais la valeur en clair sur le disque', async () => {
    await coffre.enregistrer('ANTHROPIC_API_KEY', 'sk-ant-valeur-tres-secrete')
    const brut = await readFile(join(dossier, 'secrets.json'), 'utf8')
    expect(brut).not.toContain('sk-ant-valeur-tres-secrete')
    expect(brut).toContain('valeurChiffree')
  })

  it('crée le fichier en 0600', async () => {
    await coffre.enregistrer('ANTHROPIC_API_KEY', 'sk-ant-123456789')
    const infos = await stat(join(dossier, 'secrets.json'))
    expect(infos.mode & 0o777).toBe(0o600)
  })

  it('relit la valeur avec le bon secret maître', async () => {
    await coffre.enregistrer('ANTHROPIC_API_KEY', 'sk-ant-123456789')
    expect(await coffre.valeur('ANTHROPIC_API_KEY')).toBe('sk-ant-123456789')
  })

  it('refuse de rendre une valeur si le secret maître a changé', async () => {
    await coffre.enregistrer('ANTHROPIC_API_KEY', 'sk-ant-123456789')
    process.env.ADMIN_MASTER_KEY = 'un-autre-secret-maitre-long'
    const relu = new Coffre(join(dossier, 'secrets.json'))
    expect(await relu.valeur('ANTHROPIC_API_KEY')).toBeNull()
  })

  it('refuse une valeur trop courte', async () => {
    await expect(coffre.enregistrer('ANTHROPIC_API_KEY', 'court')).rejects.toThrow()
  })
})

describe('ce que l’administration voit', () => {
  it('ne montre que les quatre derniers caractères', async () => {
    await coffre.enregistrer('ANTHROPIC_API_KEY', 'sk-ant-valeur-secrete-ABCD')
    const etat = await coffre.etat()
    const entree = etat.find((e) => e.nom === 'ANTHROPIC_API_KEY')
    expect(entree?.fin).toBe('ABCD')
    expect(JSON.stringify(etat)).not.toContain('valeur-secrete')
  })

  it('dit quelles clés ne sont pas configurées', async () => {
    const etat = await coffre.etat()
    expect(etat.every((e) => !e.configure)).toBe(true)
    // Une par clé gérée, quel que soit leur nombre : figer la liste ici
    // obligerait à toucher ce test à chaque clé ajoutée, sans rien vérifier
    // de plus.
    expect(etat).toHaveLength(SECRETS_GERES.length)
    expect(etat.map((e) => e.provenance)).toEqual(SECRETS_GERES.map(() => 'aucune'))
  })

  it('oublie une clé sur demande', async () => {
    await coffre.enregistrer('GOOGLE_MAPS_API_KEY', 'AIza-123456789')
    await coffre.oublier('GOOGLE_MAPS_API_KEY')
    expect(await coffre.valeur('GOOGLE_MAPS_API_KEY')).toBeNull()
  })
})

describe('priorité de l’environnement', () => {
  it('l’emporte sur le coffre, pour qu’on ne puisse pas l’écraser depuis le web', async () => {
    await coffre.enregistrer('GOOGLE_MAPS_API_KEY', 'AIza-depuis-le-coffre')
    process.env.GOOGLE_MAPS_API_KEY = 'AIza-depuis-l-environnement'
    expect(await coffre.valeur('GOOGLE_MAPS_API_KEY')).toBe('AIza-depuis-l-environnement')
    const etat = await coffre.etat()
    expect(etat.find((e) => e.nom === 'GOOGLE_MAPS_API_KEY')?.provenance).toBe('environnement')
  })
})

describe('comparaison de jeton', () => {
  it('accepte le jeton exact et refuse tout le reste', () => {
    expect(jetonValide('abcdef', 'abcdef')).toBe(true)
    expect(jetonValide('abcdeg', 'abcdef')).toBe(false)
    expect(jetonValide('abcde', 'abcdef')).toBe(false)
    expect(jetonValide('', 'abcdef')).toBe(false)
  })
})

describe('hydratation de l’environnement', () => {
  it('recopie la clé du coffre pour les modules qui lisent process.env', async () => {
    await coffre.enregistrer('GOOGLE_MAPS_API_KEY', 'AIza-depuis-le-coffre')
    expect(process.env.GOOGLE_MAPS_API_KEY).toBeUndefined()
    await coffre.hydraterEnvironnement()
    expect(process.env.GOOGLE_MAPS_API_KEY).toBe('AIza-depuis-le-coffre')
  })

  it('continue d’annoncer « coffre », et non « environnement », après hydratation', async () => {
    await coffre.enregistrer('GOOGLE_MAPS_API_KEY', 'AIza-depuis-le-coffre')
    await coffre.hydraterEnvironnement()
    const etat = await coffre.etat()
    expect(etat.find((e) => e.nom === 'GOOGLE_MAPS_API_KEY')?.provenance).toBe('coffre')
  })

  it('n’écrase jamais une clé posée par l’hébergeur', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'AIza-de-l-hebergeur'
    await coffre.enregistrer('GOOGLE_MAPS_API_KEY', 'AIza-depuis-le-coffre')
    await coffre.hydraterEnvironnement()
    expect(process.env.GOOGLE_MAPS_API_KEY).toBe('AIza-de-l-hebergeur')
    const etat = await coffre.etat()
    expect(etat.find((e) => e.nom === 'GOOGLE_MAPS_API_KEY')?.provenance).toBe('environnement')
  })

  it('retire de l’environnement une clé oubliée, mais laisse celle de l’hébergeur', async () => {
    await coffre.enregistrer('GOOGLE_MAPS_API_KEY', 'AIza-depuis-le-coffre')
    await coffre.hydraterEnvironnement()
    coffre.deshydrater('GOOGLE_MAPS_API_KEY')
    expect(process.env.GOOGLE_MAPS_API_KEY).toBeUndefined()

    process.env.ANTHROPIC_API_KEY = 'sk-ant-de-l-hebergeur'
    coffre.deshydrater('ANTHROPIC_API_KEY')
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-de-l-hebergeur')
  })
})
