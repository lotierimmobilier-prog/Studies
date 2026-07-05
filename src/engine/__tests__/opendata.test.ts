import { describe, it, expect } from 'vitest'
import {
  domaineDepuisLibelle,
  normaliserRegion,
  mapRecord,
  construireUrl,
  chargerFormations,
} from '../../data/opendata'

describe('domaineDepuisLibelle', () => {
  it('reconnaît les grands domaines par mots-clés', () => {
    expect(domaineDepuisLibelle('Licence Droit')).toBe('droit')
    expect(domaineDepuisLibelle('BUT Informatique')).toBe('informatique')
    expect(domaineDepuisLibelle('CPGE - MPSI')).toBe('ingenieur')
    expect(domaineDepuisLibelle('PASS accès santé')).toBe('sante')
    expect(domaineDepuisLibelle('Licence STAPS')).toBe('staps')
    expect(domaineDepuisLibelle('Licence LLCER Anglais')).toBe('langues')
  })

  it('retombe sur un domaine neutre pour un intitulé inconnu', () => {
    expect(domaineDepuisLibelle('Formation ovni')).toBe('sciences')
  })
})

describe('normaliserRegion', () => {
  it('normalise les variantes avec tirets et accents', () => {
    expect(normaliserRegion('Ile-de-France')).toBe('Île-de-France')
    expect(normaliserRegion('Grand-Est')).toBe('Grand Est')
    expect(normaliserRegion('Auvergne-Rhône-Alpes')).toBe('Auvergne-Rhône-Alpes')
  })

  it('renvoie null pour une région non reconnue', () => {
    expect(normaliserRegion('La Réunion')).toBeNull()
    expect(normaliserRegion(null)).toBeNull()
  })
})

describe('mapRecord', () => {
  const base = {
    taux_acces_ens: 42,
    lib_for_voe_ins: 'BUT Informatique',
    g_ea_lib_vx: 'IUT de Test',
    ville_etab: 'Testville',
    region_etab_aff: 'Occitanie',
    select_form: 'formation sélective',
    contrat_etab: 'Public',
    capa_fin: 30,
    g_olocalisation_des_formations: '43.6, 1.44',
  }

  it('mappe un enregistrement complet', () => {
    const f = mapRecord(base)!
    expect(f).not.toBeNull()
    expect(f.nom).toBe('BUT Informatique')
    expect(f.domaine).toBe('informatique')
    expect(f.tauxAccesBase).toBe(42)
    expect(f.selectivite).toBe('selective')
    expect(f.coords).toEqual([43.6, 1.44])
    expect(f.capacite).toBe(30)
    expect(f.prixIndicatif).toMatch(/Public/)
  })

  it('rejette un enregistrement sans taux d\'accès', () => {
    expect(mapRecord({ ...base, taux_acces_ens: null })).toBeNull()
  })

  it('rejette une région hors métropole', () => {
    expect(mapRecord({ ...base, region_etab_aff: 'Guadeloupe' })).toBeNull()
  })

  it('détecte la non-sélectivité', () => {
    const f = mapRecord({ ...base, select_form: 'formation non sélective' })!
    expect(f.selectivite).toBe('non-selective')
  })
})

describe('construireUrl', () => {
  it('inclut le taux, la pagination et le filtre région', () => {
    const url = construireUrl({ region: 'Bretagne' }, 0, 100)
    expect(url).toContain('taux_acces_ens')
    expect(url).toContain('limit=100')
    expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain(
      'region_etab_aff LIKE "Bretagne"',
    )
  })
})

describe('chargerFormations', () => {
  it('agrège et mappe les résultats via un fetch injecté', async () => {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              taux_acces_ens: 60,
              lib_for_voe_ins: 'Licence Informatique',
              g_ea_lib_vx: 'Université Test',
              region_etab_aff: 'Bretagne',
              ville_etab: 'Rennes',
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch

    const formations = await chargerFormations({ limite: 100, fetchImpl: fakeFetch })
    expect(formations).toHaveLength(1)
    expect(formations[0].nom).toBe('Licence Informatique')
  })

  it('propage une erreur API', async () => {
    const failFetch = (async () =>
      new Response('nope', { status: 500 })) as unknown as typeof fetch
    await expect(
      chargerFormations({ fetchImpl: failFetch }),
    ).rejects.toThrow(/500/)
  })
})
