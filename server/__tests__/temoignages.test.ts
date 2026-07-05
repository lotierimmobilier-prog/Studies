import { describe, it, expect } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DepotTemoignages,
  soumettreTemoignage,
  synthese,
  listerTous,
} from '../temoignages'
import type { Verdict } from '../moderation'

const now = () => Date.UTC(2025, 0, 1)
let compteur = 0
const id = () => `id-${++compteur}`

function depotTemp() {
  return new DepotTemoignages(join(tmpdir(), `temoignages-test-${Math.random().toString(36).slice(2)}.json`))
}

// Modération simulée : rejette si le texte contient « refuse », sinon approuve.
const modererFake = async (c: string): Promise<Verdict> =>
  c.includes('refuse') ? { statut: 'rejete', raison: 'refusé' } : { statut: 'approuve' }

const base = { depot: depotTemp(), now, id, moderer: modererFake }

describe('soumettreTemoignage', () => {
  it('stocke un avis approuvé et le rend visible dans la synthèse', async () => {
    const depot = depotTemp()
    const r = await soumettreTemoignage(
      { etablissement: 'EPITA', note: 4, commentaire: 'Bonne école', annee: 2024 },
      { ...base, depot },
    )
    expect(r.ok).toBe(true)
    const s = await synthese('EPITA', depot)
    expect(s.nombre).toBe(1)
    expect(s.moyenne).toBe(4)
    expect(s.temoignages[0].annee).toBe(2024)
  })

  it('refuse une note hors bornes', async () => {
    const r = await soumettreTemoignage(
      { etablissement: 'X', note: 9, commentaire: 'Correct et complet' },
      { ...base, depot: depotTemp() },
    )
    expect(r.ok).toBe(false)
  })

  it('ne stocke pas un commentaire rejeté par la modération', async () => {
    const depot = depotTemp()
    const r = await soumettreTemoignage(
      { etablissement: 'X', note: 3, commentaire: 'je refuse ce contenu' },
      { ...base, depot },
    )
    expect(r.ok).toBe(false)
    expect((await synthese('X', depot)).nombre).toBe(0)
  })

  it('ignore une année hors plage', async () => {
    const depot = depotTemp()
    await soumettreTemoignage(
      { etablissement: 'Y', note: 5, commentaire: 'Parfait vraiment', annee: 1800 },
      { ...base, depot },
    )
    expect((await synthese('Y', depot)).temoignages[0].annee).toBeUndefined()
  })

  it('calcule la moyenne sur plusieurs avis (même établissement, casse ignorée)', async () => {
    const depot = depotTemp()
    await soumettreTemoignage({ etablissement: 'Fac Lyon', note: 5, commentaire: 'Excellent' }, { ...base, depot })
    await soumettreTemoignage({ etablissement: 'fac lyon', note: 3, commentaire: 'Moyen mais ok' }, { ...base, depot })
    const s = await synthese('Fac Lyon', depot)
    expect(s.nombre).toBe(2)
    expect(s.moyenne).toBe(4)
  })
})

describe('modération (statut)', () => {
  it('n’affiche pas les avis en attente et permet de les approuver', async () => {
    const depot = depotTemp()
    // Modération renvoyant « en_attente ».
    const enAttente = async (): Promise<Verdict> => ({ statut: 'en_attente' })
    const r = await soumettreTemoignage(
      { etablissement: 'Z', note: 4, commentaire: 'À vérifier svp' },
      { depot, now, id, moderer: enAttente },
    )
    expect(r.ok).toBe(true)
    expect((await synthese('Z', depot)).nombre).toBe(0) // pas encore visible
    const enAttenteListe = await listerTous(depot, 'en_attente')
    expect(enAttenteListe).toHaveLength(1)

    await depot.majStatut(enAttenteListe[0].id, 'approuve')
    expect((await synthese('Z', depot)).nombre).toBe(1)
  })
})
