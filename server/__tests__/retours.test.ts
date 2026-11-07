import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { DepotRetours, RetourEnDouble, RetourInvalide, millesimeCourant } from '../retours'

const SEPTEMBRE_2026 = new Date('2026-09-19T10:00:00Z')
const MARS_2027 = new Date('2027-03-10T10:00:00Z')
const SEPTEMBRE_2027 = new Date('2027-09-02T10:00:00Z')

function requete(codFormation: string, cout: number, jeton: string) {
  return {
    codFormation,
    coutReelMensuel: cout,
    faciliteLogement: 3,
    ambiance: 4,
    anneeEtudes: 1,
    jetonContributeur: jeton,
  }
}

let dossier: string
let depot: DepotRetours

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'retours-'))
  depot = new DepotRetours(dossier)
})

describe('millésime', () => {
  it('bascule au 1er septembre, pas au 1er janvier', () => {
    expect(millesimeCourant(SEPTEMBRE_2026)).toBe('2026-2027')
    expect(millesimeCourant(MARS_2027)).toBe('2026-2027')
    expect(millesimeCourant(SEPTEMBRE_2027)).toBe('2027-2028')
  })
})

describe('validation', () => {
  it('refuse un coût hors bornes plutôt que de le tronquer', async () => {
    await expect(depot.ajouter(requete('2519', 99_999, 'jeton-long-1'), SEPTEMBRE_2026)).rejects.toBeInstanceOf(
      RetourInvalide,
    )
  })

  it('refuse une note hors de 1 à 5', async () => {
    await expect(
      depot.ajouter({ ...requete('2519', 500, 'jeton-long-1'), ambiance: 9 }, SEPTEMBRE_2026),
    ).rejects.toBeInstanceOf(RetourInvalide)
  })

  it('refuse un retour sans jeton de contributeur', async () => {
    await expect(depot.ajouter(requete('2519', 500, ''), SEPTEMBRE_2026)).rejects.toBeInstanceOf(
      RetourInvalide,
    )
  })
})

describe('un retour par formation et par an', () => {
  it('refuse un second retour du même contributeur sur la même formation', async () => {
    await depot.ajouter(requete('2519', 500, 'jeton-long-1'), SEPTEMBRE_2026)
    await expect(depot.ajouter(requete('2519', 600, 'jeton-long-1'), SEPTEMBRE_2026)).rejects.toBeInstanceOf(
      RetourEnDouble,
    )
  })

  it('accepte le même contributeur sur une autre formation', async () => {
    await depot.ajouter(requete('2519', 500, 'jeton-long-1'), SEPTEMBRE_2026)
    await expect(depot.ajouter(requete('9999', 500, 'jeton-long-1'), SEPTEMBRE_2026)).resolves.toBeTruthy()
  })

  it('accepte le même contributeur l’année suivante', async () => {
    await depot.ajouter(requete('2519', 500, 'jeton-long-1'), SEPTEMBRE_2026)
    await expect(depot.ajouter(requete('2519', 560, 'jeton-long-1'), SEPTEMBRE_2027)).resolves.toBeTruthy()
  })
})

describe('archives par année', () => {
  async function remplir() {
    for (const [i, cout] of [520, 540, 560, 600, 700].entries()) {
      await depot.ajouter(requete('2519', cout, `jeton-2026-${i}`), SEPTEMBRE_2026)
    }
    for (const [i, cout] of [560, 580, 600, 640, 760].entries()) {
      await depot.ajouter(requete('2519', cout, `jeton-2027-${i}`), SEPTEMBRE_2027)
    }
  }

  it('écrit un fichier par année universitaire', async () => {
    await remplir()
    const fichiers = (await readdir(dossier)).sort()
    expect(fichiers).toEqual(['retours-2026-2027.json', 'retours-2027-2028.json'])
  })

  it('ne réécrit jamais le fichier d’une année close', async () => {
    await remplir()
    const avant = await readFile(join(dossier, 'retours-2026-2027.json'), 'utf8')
    await depot.ajouter(requete('2519', 800, 'jeton-2027-tardif'), SEPTEMBRE_2027)
    expect(await readFile(join(dossier, 'retours-2026-2027.json'), 'utf8')).toBe(avant)
  })

  it('rend un agrégat par année, du plus récent au plus ancien', async () => {
    await remplir()
    const archives = await depot.archiveDe('2519', SEPTEMBRE_2027)
    expect(archives).toHaveLength(2)
    expect(archives[0]?.millesime).toBe('2027-2028')
    expect(archives[1]?.millesime).toBe('2026-2027')
    if (archives[0]?.statut !== 'publie' || archives[1]?.statut !== 'publie') {
      throw new Error('publications attendues')
    }
    expect(archives[1].coutReelMensuel.median).toBe(560)
    expect(archives[0].coutReelMensuel.median).toBe(600)
  })

  it('ne publie rien tant que le seuil n’est pas atteint', async () => {
    await depot.ajouter(requete('2519', 500, 'jeton-seul'), SEPTEMBRE_2026)
    const [agregat] = await depot.agregatsCourants(['2519'], SEPTEMBRE_2026)
    expect(agregat?.statut).toBe('trop_peu_de_retours')
  })
})

describe('ce qui est écrit sur le disque', () => {
  it('ne stocke jamais le jeton en clair', async () => {
    await depot.ajouter(requete('2519', 500, 'jeton-tres-identifiant'), SEPTEMBRE_2026)
    const brut = await readFile(join(dossier, 'retours-2026-2027.json'), 'utf8')
    expect(brut).not.toContain('jeton-tres-identifiant')
    expect(brut).toContain('empreinteContributeur')
  })

  it('ne renvoie pas l’empreinte à l’appelant', async () => {
    const retour = await depot.ajouter(requete('2519', 500, 'jeton-long-1'), SEPTEMBRE_2026)
    expect(retour).not.toHaveProperty('empreinteContributeur')
    expect(retour.millesime).toBe('2026-2027')
  })
})
