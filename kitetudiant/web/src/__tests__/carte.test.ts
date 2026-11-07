/**
 * La projection de la carte et son cadrage.
 *
 * Ces fonctions n'ont pas d'affichage : une erreur n'y produit pas d'écran
 * cassé mais une carte qui montre le mauvais endroit, ce qui ne se voit que
 * si l'on connaît déjà la réponse.
 */

import { describe, expect, it } from 'vitest'

import {
  cadrage,
  latitudeDeY,
  longitudeDeX,
  xDeLongitude,
  yDeLatitude,
  type PointCarte,
} from '../carte.tsx'

function point(cle: string, lat: number, lon: number): PointCarte {
  return { cle, lat, lon, libelle: cle }
}

describe('la projection Web Mercator', () => {
  it('place le méridien de Greenwich et l’équateur au centre', () => {
    // Au zoom 0, le planisphère tient dans une seule tuile : son centre est
    // donc à 0,5 dans les deux sens.
    expect(xDeLongitude(0, 0)).toBeCloseTo(0.5, 10)
    expect(yDeLatitude(0, 0)).toBeCloseTo(0.5, 10)
  })

  it('place les bords du planisphère aux extrémités', () => {
    expect(xDeLongitude(-180, 0)).toBeCloseTo(0, 10)
    expect(xDeLongitude(180, 0)).toBeCloseTo(1, 10)
  })

  it('revient sur ses pas', () => {
    // Un aller-retour qui dérive fait glisser la carte à chaque déplacement,
    // et l'école finit ailleurs qu'où elle est.
    for (const z of [8, 12, 15, 18]) {
      for (const [lat, lon] of [
        [45.83362, 1.26121], // Limoges
        [48.83151, 2.35528], // Paris 13e
        [-20.89, 55.54], // La Réunion
        [16.24, -61.53], // Guadeloupe
      ] as const) {
        expect(latitudeDeY(yDeLatitude(lat, z), z)).toBeCloseTo(lat, 8)
        expect(longitudeDeX(xDeLongitude(lon, z), z)).toBeCloseTo(lon, 8)
      }
    }
  })

  it('borne la latitude plutôt que de rendre l’infini', () => {
    // La projection diverge aux pôles : sans borne, tan(π/2) part à l'infini
    // et la carte entière disparaît.
    expect(Number.isFinite(yDeLatitude(90, 10))).toBe(true)
    expect(Number.isFinite(yDeLatitude(-90, 10))).toBe(true)
  })

  it('la latitude décroît quand y croît', () => {
    // L'axe des tuiles descend vers le sud : inverser le sens retourne la
    // carte sans qu'aucune coordonnée ne devienne invalide.
    expect(yDeLatitude(50, 10)).toBeLessThan(yDeLatitude(40, 10))
  })
})

describe('le cadrage initial', () => {
  it('sans point, montre la France entière', () => {
    const c = cadrage([])
    expect(c.zoom).toBeLessThanOrEqual(6)
    expect(c.lat).toBeGreaterThan(40)
    expect(c.lat).toBeLessThan(52)
  })

  it('sur un seul point, se pose dessus', () => {
    const c = cadrage([point('a', 45.83362, 1.26121)])
    expect(c.lat).toBeCloseTo(45.83362, 6)
    expect(c.lon).toBeCloseTo(1.26121, 6)
    expect(c.zoom).toBe(15)
  })

  it('sur plusieurs points, se centre entre eux', () => {
    const c = cadrage([point('a', 45, 1), point('b', 47, 3)])
    expect(c.lat).toBeCloseTo(46, 6)
    expect(c.lon).toBeCloseTo(2, 6)
  })

  it('s’éloigne d’autant plus que les points sont dispersés', () => {
    const serre = cadrage([point('a', 45.83, 1.26), point('b', 45.84, 1.27)])
    const large = cadrage([point('a', 43.3, -1.5), point('b', 50.6, 7.7)])
    expect(serre.zoom).toBeGreaterThan(large.zoom)
  })

  it('ne sort jamais des zooms disponibles', () => {
    // Deux points confondus donneraient une étendue nulle, donc un zoom
    // infini : le plancher d'étendue et les bornes l'en empêchent.
    const confondus = cadrage([point('a', 45, 1), point('b', 45, 1)])
    expect(confondus.zoom).toBeGreaterThanOrEqual(8)
    expect(confondus.zoom).toBeLessThanOrEqual(18)

    const antipodes = cadrage([point('a', -60, -179), point('b', 60, 179)])
    expect(antipodes.zoom).toBeGreaterThanOrEqual(8)
  })
})
