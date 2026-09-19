import { afterEach, describe, expect, it, vi } from 'vitest'

import { calculerAidesLogement, estIndisponible, AideLogementIndisponibleErreur } from '../aideLogement'

const LE_JOUR = new Date('2026-09-19T00:00:00Z')

function reponse(corps: unknown, ok = true, statut = 200): Response {
  return {
    ok,
    status: statut,
    json: async () => corps,
    text: async () => JSON.stringify(corps),
  } as Response
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('calculerAidesLogement', () => {
  it('n’appelle rien quand il n’y a rien à calculer', async () => {
    const appel = vi.fn()
    vi.stubGlobal('fetch', appel)
    expect(await calculerAidesLogement([], LE_JOUR)).toEqual([])
    expect(appel).not.toHaveBeenCalled()
  })

  it('envoie une seule requête pour plusieurs situations', async () => {
    const appel = vi.fn(async () =>
      reponse({
        familles: {
          f0: { aide_logement: { '2026-09': 199.88 } },
          f1: { aide_logement: { '2026-09': 239.1 } },
        },
      }),
    )
    vi.stubGlobal('fetch', appel)

    const resultats = await calculerAidesLogement(
      [
        { ref: 'limoges', codeInsee: '87085', loyerMensuel: 335, anneeNaissance: 2007 },
        { ref: 'paris', codeInsee: '75113', loyerMensuel: 817, anneeNaissance: 2007 },
      ],
      LE_JOUR,
    )

    expect(appel).toHaveBeenCalledTimes(1)
    expect(resultats).toHaveLength(2)
    const [limoges, paris] = resultats
    if (estIndisponible(limoges) || estIndisponible(paris)) throw new Error('aides attendues')
    expect(limoges.montant).toBe(199.88)
    expect(paris.montant).toBe(239.1)
    expect(limoges.millesime).toBe('2026-09')
    expect(limoges.source).toContain('OpenFisca')
    expect(limoges.hypothese).toContain('87085')
  })

  it('n’envoie que des paramètres anonymes', async () => {
    let envoye = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        envoye = String(init.body)
        return reponse({ familles: { f0: { aide_logement: { '2026-09': 150 } } } })
      }),
    )
    await calculerAidesLogement(
      [{ ref: 'r', codeInsee: '87085', loyerMensuel: 400, anneeNaissance: 2007 }],
      LE_JOUR,
    )
    const situation = JSON.parse(envoye) as Record<string, unknown>
    expect(Object.keys(situation).sort()).toEqual([
      'familles',
      'foyers_fiscaux',
      'individus',
      'menages',
    ])
    // Année seule : jamais une date de naissance réelle, jamais un nom.
    expect(envoye).toContain('2007-09-01')
    expect(envoye).not.toMatch(/nom|prenom|email|adresse/i)
  })

  it('rend une indisponibilité motivée quand OpenFisca ne calcule rien', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponse({ familles: { f0: {} } })))
    const [resultat] = await calculerAidesLogement(
      [{ ref: 'r', codeInsee: '97611', loyerMensuel: 400, anneeNaissance: 2007 }],
      LE_JOUR,
    )
    expect(estIndisponible(resultat)).toBe(true)
    if (!estIndisponible(resultat)) return
    expect(resultat.raison).toContain('97611')
  })

  it('lève une erreur explicite quand le service répond en erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponse({ erreur: 'boum' }, false, 500)))
    await expect(
      calculerAidesLogement(
        [{ ref: 'r', codeInsee: '87085', loyerMensuel: 400, anneeNaissance: 2007 }],
        LE_JOUR,
      ),
    ).rejects.toBeInstanceOf(AideLogementIndisponibleErreur)
  })

  it('choisit la rentrée de l’année universitaire en cours', async () => {
    let envoye = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        envoye = String(init.body)
        return reponse({ familles: { f0: { aide_logement: { '2025-09': 150 } } } })
      }),
    )
    // En mars 2026, l'année universitaire en cours a commencé en septembre 2025.
    const [r] = await calculerAidesLogement(
      [{ ref: 'r', codeInsee: '87085', loyerMensuel: 400, anneeNaissance: 2007 }],
      new Date('2026-03-15T00:00:00Z'),
    )
    expect(envoye).toContain('2025-09')
    if (estIndisponible(r)) throw new Error('aide attendue')
    expect(r.millesime).toBe('2025-09')
  })
})
