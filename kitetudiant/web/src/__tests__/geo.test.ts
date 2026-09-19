import { describe, it, expect } from 'vitest'

import { communeLaPlusProche, distanceKm, localiser } from '../geo.ts'
import { communesPositionnees } from '../donnees.ts'

const LIMOGES = { codeInsee: '87085', nom: 'Limoges', lat: 45.85, lon: 1.25 }
const TOULOUSE = { codeInsee: '31555', nom: 'Toulouse', lat: 43.6, lon: 1.43 }
const PARIS_13 = { codeInsee: '75113', nom: 'Paris 13e Arrondissement', lat: 48.86, lon: 2.34 }
const TROIS = [LIMOGES, TOULOUSE, PARIS_13]

describe('distanceKm', () => {
  it('donne zéro pour un point et lui-même', () => {
    expect(distanceKm(45.85, 1.25, 45.85, 1.25)).toBe(0)
  })

  it('retrouve une distance connue à quelques kilomètres près', () => {
    // Limoges — Toulouse : environ 250 km à vol d'oiseau.
    const d = distanceKm(LIMOGES.lat, LIMOGES.lon, TOULOUSE.lat, TOULOUSE.lon)
    expect(d).toBeGreaterThan(240)
    expect(d).toBeLessThan(260)
  })

  it('est symétrique', () => {
    const aller = distanceKm(45.85, 1.25, 48.86, 2.34)
    const retour = distanceKm(48.86, 2.34, 45.85, 1.25)
    expect(Math.abs(aller - retour)).toBeLessThan(0.001)
  })
})

describe('communeLaPlusProche', () => {
  it('trouve la ville où l’on se tient', () => {
    const r = communeLaPlusProche(45.84, 1.26, TROIS)
    expect(r?.codeInsee).toBe('87085')
    expect(r?.distanceKm).toBeLessThanOrEqual(2)
  })

  it('choisit la bonne parmi plusieurs', () => {
    // Un point près de Toulouse, loin des deux autres.
    expect(communeLaPlusProche(43.7, 1.4, TROIS)?.codeInsee).toBe('31555')
  })

  it('ne renvoie rien plutôt qu’une commune arbitraire quand la liste est vide', () => {
    expect(communeLaPlusProche(45.85, 1.25, [])).toBeNull()
  })

  it('fonctionne sur le vrai jeu embarqué', () => {
    const toutes = communesPositionnees()
    expect(toutes.length).toBeGreaterThan(1000)
    // Toutes les communes du jeu doivent porter une position : une entrée sans
    // coordonnées disparaîtrait silencieusement du classement par distance.
    const r = communeLaPlusProche(43.3, 5.4, toutes)
    expect(r?.nom).toMatch(/Marseille/)
  })
})

describe('localiser', () => {
  /** Faux service de géolocalisation, qui compte aussi les appels réseau. */
  function geoQuiRepond(coords: { latitude: number; longitude: number }): Geolocation {
    return {
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords, timestamp: 0 } as unknown as GeolocationPosition),
      watchPosition: () => 0,
      clearWatch: () => undefined,
    }
  }

  function geoQuiRefuse(code: number): Geolocation {
    return {
      getCurrentPosition: (_ok: PositionCallback, ko?: PositionErrorCallback | null) =>
        ko?.({ code, message: 'refus' } as GeolocationPositionError),
      watchPosition: () => 0,
      clearWatch: () => undefined,
    }
  }

  it('rapproche la position d’une commune', async () => {
    const r = await localiser(geoQuiRepond({ latitude: 45.84, longitude: 1.26 }), TROIS)
    expect(r).toEqual({ etat: 'trouvee', codeInsee: '87085', nom: 'Limoges', distanceKm: 1 })
  })

  it('distingue un refus d’une panne', async () => {
    // 1 = PERMISSION_DENIED : dire non n'est pas une erreur, et ne doit pas
    // afficher de message d'échec à l'élève.
    expect(await localiser(geoQuiRefuse(1), TROIS)).toEqual({ etat: 'refusee' })
    expect((await localiser(geoQuiRefuse(2), TROIS)).etat).toBe('indisponible')
  })

  it('se passe d’un navigateur qui ne sait pas géolocaliser', async () => {
    const r = await localiser(undefined, TROIS)
    expect(r.etat).toBe('indisponible')
  })

  it('n’envoie la position à personne', async () => {
    // La garantie centrale de ce module. On remplace fetch par un mouchard :
    // s'il est appelé une seule fois, la position a fui.
    const vraiFetch = globalThis.fetch
    let appels = 0
    globalThis.fetch = (() => {
      appels += 1
      return Promise.reject(new Error('aucun appel réseau ne devrait partir d’ici'))
    }) as typeof fetch
    try {
      await localiser(geoQuiRepond({ latitude: 48.86, longitude: 2.34 }), TROIS)
    } finally {
      globalThis.fetch = vraiFetch
    }
    expect(appels).toBe(0)
  })
})
