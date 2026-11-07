import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DepotPartenaires, LienRefuse, PartenaireInconnu } from '../partenaires.ts'
import { LEBONCOIN, PAPERNEST } from '../../kitetudiant/packages/partenaires/src/index.ts'

/**
 * Le dépôt des adresses d'affiliation.
 *
 * Il ne garde QUE des adresses. La mention de rémunération, le nom et le logo
 * restent dans le code : un lien payé ne doit jamais pouvoir perdre sa phrase
 * depuis un écran d'administration, sans relecture et sans trace.
 */

let dossier: string
let depot: DepotPartenaires

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'kit-partenaires-'))
  depot = new DepotPartenaires(join(dossier, 'partenaires.json'))
})

afterEach(() => {
  rmSync(dossier, { recursive: true, force: true })
})

describe('sans aucun réglage', () => {
  it('rend les adresses du dépôt de code', async () => {
    const etats = await depot.lister()
    expect(etats.map((e) => e.nom)).toEqual(['papernest', 'leboncoin'])
    expect(etats[0]!.lien).toBe(PAPERNEST.lien)
    expect(etats[0]!.personnalise).toBe(false)
    expect(etats[1]!.lien).toBe(LEBONCOIN.lien)
  })

  it('n’annonce aucune adresse au site public', async () => {
    /* Le navigateur a déjà celles du dépôt. Les renvoyer quand même ferait
       croire à un réglage là où il n'y en a pas. */
    expect(await depot.liens()).toEqual({})
  })
})

describe('régler une adresse', () => {
  it('la garde, datée, et l’annonce au site public', async () => {
    const etat = await depot.definir(
      'papernest',
      'https://app.papernest.com/onboarding?campagne=rentree',
      new Date('2026-09-22T08:00:00Z'),
    )
    expect(etat.lien).toBe('https://app.papernest.com/onboarding?campagne=rentree')
    expect(etat.personnalise).toBe(true)
    expect(etat.modifieLe).toBe('2026-09-22T08:00:00.000Z')
    expect(etat.lienParDefaut).toBe(PAPERNEST.lien)

    expect(await depot.liens()).toEqual({
      papernest: 'https://app.papernest.com/onboarding?campagne=rentree',
    })
  })

  it('survit à un redémarrage', async () => {
    const fichier = join(dossier, 'partenaires.json')
    await depot.definir('papernest', 'https://app.papernest.com/x')
    const autre = new DepotPartenaires(fichier)
    expect((await autre.liens()).papernest).toBe('https://app.papernest.com/x')
  })

  it('n’écrit jamais la mention de rémunération sur le disque', async () => {
    /* L'invariant central, vérifié là où il se vérifie vraiment : dans le
       fichier. Le jour où la mention y atterrirait, elle deviendrait
       modifiable en éditant ce fichier — et le lien pourrait perdre sa
       phrase sans que le dépôt de code en sache rien. */
    await depot.definir('papernest', 'https://app.papernest.com/x')
    const ecrit = readFileSync(join(dossier, 'partenaires.json'), 'utf8')
    expect(ecrit).not.toContain('rémunèr')
    expect(ecrit).not.toContain('gratuit')
    expect(JSON.parse(ecrit)).toEqual({
      papernest: { lien: 'https://app.papernest.com/x', modifieLe: expect.any(String) },
    })
  })

  it('refuse une adresse hors du domaine du partenaire', async () => {
    /* Le logo reste celui du dépôt : une adresse ailleurs mettrait le logo de
       papernest au-dessus d'un bouton menant autre part. */
    await expect(depot.definir('papernest', 'https://ailleurs.fr/offre')).rejects.toThrow(
      LienRefuse,
    )
    expect(await depot.liens()).toEqual({})
  })

  it('refuse le http simple et ce qui n’est pas une adresse', async () => {
    for (const mauvais of ['http://app.papernest.com/x', 'app.papernest.com', '']) {
      await expect(depot.definir('papernest', mauvais)).rejects.toThrow(LienRefuse)
    }
  })

  it('refuse un partenaire qui n’est pas dans la liste', async () => {
    await expect(depot.definir('ailleurs', 'https://ailleurs.fr/')).rejects.toThrow(
      PartenaireInconnu,
    )
  })
})

describe('rétablir l’adresse du dépôt', () => {
  it('efface le réglage', async () => {
    await depot.definir('papernest', 'https://app.papernest.com/x')
    const etat = await depot.retablir('papernest')
    expect(etat.personnalise).toBe(false)
    expect(etat.lien).toBe(PAPERNEST.lien)
    expect(await depot.liens()).toEqual({})
  })

  it('ne rétablit pas un partenaire inconnu', async () => {
    await expect(depot.retablir('ailleurs')).rejects.toThrow(PartenaireInconnu)
  })
})

describe('un fichier qui ne dit pas ce qu’il faut', () => {
  it('ignore un réglage devenu hors domaine au lieu de l’afficher', async () => {
    /* Le domaine d'un partenaire peut changer dans le code. Une adresse
       devenue hors domaine ne doit pas continuer de s'afficher sous un logo
       qui ne lui correspond plus — et la corriger silencieusement serait
       pire : personne ne saurait qu'elle a changé. */
    writeFileSync(
      join(dossier, 'partenaires.json'),
      JSON.stringify({ papernest: { lien: 'https://ailleurs.fr/x', modifieLe: '2026-01-01' } }),
      'utf8',
    )
    const etats = await new DepotPartenaires(join(dossier, 'partenaires.json')).lister()
    expect(etats[0]!.lien).toBe(PAPERNEST.lien)
    expect(etats[0]!.personnalise).toBe(false)
  })

  it('retombe sur les adresses du dépôt si le fichier est illisible', async () => {
    writeFileSync(join(dossier, 'partenaires.json'), '{ pas du json', 'utf8')
    const etats = await new DepotPartenaires(join(dossier, 'partenaires.json')).lister()
    expect(etats[0]!.lien).toBe(PAPERNEST.lien)
  })
})
