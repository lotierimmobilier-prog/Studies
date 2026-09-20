/**
 * Une carte, pour situer un établissement.
 *
 * ══ Pourquoi pas MapLibre ════════════════════════════════════════════════
 *
 * Parce qu'il pèse environ deux cents kilooctets compressés — plus que tout
 * le reste du site réuni — pour afficher UN point. Le projet n'a que React
 * comme dépendance de façade, et CLAUDE.md demande qu'on n'en ajoute pas sans
 * raison.
 *
 * Ce lecteur fait ce dont on a besoin : des tuiles, un déplacement à la
 * souris ou au doigt, deux niveaux de zoom, un repère. Ce qu'il ne fait pas,
 * et qu'il faudrait MapLibre pour avoir : la rotation, l'inclinaison, les
 * couches vectorielles, le rendu d'itinéraires. Rien de tout cela ne sert à
 * dire « l'école est ici ».
 *
 * ══ Les tuiles viennent de l'IGN ═════════════════════════════════════════
 *
 * Géoplateforme, service public français, sans clé d'API et sans compte. Les
 * adresses IP des élèves restent donc en France et chez un opérateur public,
 * ce qu'exige la règle 3 de CLAUDE.md pour des données de mineurs.
 *
 * ══ Rien n'est chargé avant le clic ══════════════════════════════════════
 *
 * La carte ne se monte QUE si l'élève la demande. Tant qu'il ne clique pas,
 * aucune requête ne part vers l'IGN, et son adresse IP n'est connue de
 * personne. C'est ce qui permet au site de continuer à promettre qu'il ne
 * charge rien d'un tiers sans qu'on le lui demande — et le bouton le dit
 * avant d'être cliqué, plutôt qu'après.
 */

import { useEffect, useRef, useState } from 'react'

const TUILE = 256
const ZOOM_MIN = 8
const ZOOM_MAX = 18

/**
 * Les classes CSS de ce module sont préfixées « plan- », pas « carte- ».
 *
 * « carte » est déjà pris par les cartes à collectionner, vingt-huit fois
 * dans styles.css. Réutiliser le nom n'aurait rien cassé au build : la carte
 * géographique aurait simplement hérité de la mise en page d'une vignette de
 * récompense, en silence. styles.test.ts existe précisément pour attraper ce
 * genre de collision, qui s'est déjà produite une fois sur ce projet.
 *
 * « plan » est aussi le nom que l'IGN donne à la couche : Plan IGN.
 */
export const SOURCE_CARTE = 'Plan IGN — Géoplateforme, IGN'

function urlTuile(z: number, x: number, y: number): string {
  const p = new URLSearchParams({
    SERVICE: 'WMTS',
    REQUEST: 'GetTile',
    VERSION: '1.0.0',
    LAYER: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
    STYLE: 'normal',
    TILEMATRIXSET: 'PM',
    FORMAT: 'image/png',
    TILEMATRIX: String(z),
    TILEROW: String(y),
    TILECOL: String(x),
  })
  return `https://data.geopf.fr/wmts?${p.toString()}`
}

/* --------------------------------------------- projection Web Mercator */

/** Abscisse de tuile, en fraction : la partie décimale place au pixel près. */
export function xDeLongitude(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z
}

/** Ordonnée de tuile, en fraction. */
export function yDeLatitude(lat: number, z: number): number {
  const phi = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180
  return ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * 2 ** z
}

export function longitudeDeX(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180
}

export function latitudeDeY(y: number, z: number): number {
  const n = Math.PI - 2 * Math.PI * (y / 2 ** z)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

/* ------------------------------------------------------------ la carte */

export function Carte({
  lat,
  lon,
  libelle,
  hauteur = 280,
}: {
  readonly lat: number
  readonly lon: number
  readonly libelle: string
  readonly hauteur?: number
}) {
  const [zoom, setZoom] = useState(15)
  const [centre, setCentre] = useState({ lat, lon })
  const [largeur, setLargeur] = useState(600)
  const cadre = useRef<HTMLDivElement>(null)
  const glisse = useRef<{ x: number; y: number } | null>(null)

  // La largeur réelle décide du nombre de tuiles : la deviner en donnerait
  // trop sur un téléphone, et des trous sur un grand écran.
  useEffect(() => {
    const el = cadre.current
    if (el === null) return
    const mesurer = (): void => setLargeur(el.clientWidth)
    mesurer()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(mesurer)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const cx = xDeLongitude(centre.lon, zoom)
  const cy = yDeLatitude(centre.lat, zoom)
  // Coin supérieur gauche de la fenêtre, en coordonnées de tuiles.
  const gauche = cx - largeur / 2 / TUILE
  const haut = cy - hauteur / 2 / TUILE

  const tuiles: { cle: string; x: number; y: number; gx: number; gy: number }[] = []
  const max = 2 ** zoom
  for (let ty = Math.floor(haut); ty < haut + hauteur / TUILE + 1; ty += 1) {
    for (let tx = Math.floor(gauche); tx < gauche + largeur / TUILE + 1; tx += 1) {
      // Hors du planisphère : pas de tuile, plutôt qu'une image cassée.
      if (ty < 0 || ty >= max) continue
      const x = ((tx % max) + max) % max
      tuiles.push({
        cle: `${zoom}-${tx}-${ty}`,
        x,
        y: ty,
        gx: (tx - gauche) * TUILE,
        gy: (ty - haut) * TUILE,
      })
    }
  }

  // Position du repère : l'école ne bouge pas, c'est la fenêtre qui se déplace.
  const rx = (xDeLongitude(lon, zoom) - gauche) * TUILE
  const ry = (yDeLatitude(lat, zoom) - haut) * TUILE
  const visible = rx >= 0 && rx <= largeur && ry >= 0 && ry <= hauteur

  function deplacer(dx: number, dy: number): void {
    const nx = cx - dx / TUILE
    const ny = cy - dy / TUILE
    setCentre({ lon: longitudeDeX(nx, zoom), lat: latitudeDeY(ny, zoom) })
  }

  return (
    <div className="plan">
      <div
        className="plan-cadre"
        ref={cadre}
        style={{ height: `${hauteur}px` }}
        role="img"
        aria-label={`Carte situant ${libelle}`}
        onPointerDown={(ev) => {
          glisse.current = { x: ev.clientX, y: ev.clientY }
          ev.currentTarget.setPointerCapture(ev.pointerId)
        }}
        onPointerMove={(ev) => {
          const d = glisse.current
          if (d === null) return
          deplacer(ev.clientX - d.x, ev.clientY - d.y)
          glisse.current = { x: ev.clientX, y: ev.clientY }
        }}
        onPointerUp={() => {
          glisse.current = null
        }}
        onPointerCancel={() => {
          glisse.current = null
        }}
      >
        {tuiles.map((t) => (
          <img
            key={t.cle}
            className="plan-tuile"
            src={urlTuile(zoom, t.x, t.y)}
            alt=""
            aria-hidden="true"
            draggable={false}
            // La tuile fait toujours 256 px de côté : le déclarer réserve la
            // place avant que l'image arrive, et évite que la carte se
            // recompose sous les doigts pendant le chargement.
            width={TUILE}
            height={TUILE}
            style={{ left: `${t.gx}px`, top: `${t.gy}px` }}
          />
        ))}

        {visible ? (
          <span className="plan-repere" style={{ left: `${rx}px`, top: `${ry}px` }} />
        ) : null}

        <div className="plan-zooms">
          <button
            type="button"
            aria-label="Agrandir"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 1))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Réduire"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 1))}
          >
            −
          </button>
          <button
            type="button"
            className="plan-recentrer"
            onClick={() => {
              setCentre({ lat, lon })
              setZoom(15)
            }}
          >
            Recentrer
          </button>
        </div>
      </div>

      {/* La mention est imposée par les conditions de la Géoplateforme, et
          elle est de toute façon la règle de ce site : toute donnée affichée
          dit d'où elle vient. */}
      <p className="note plan-mention">{SOURCE_CARTE}</p>
    </div>
  )
}

/**
 * Le bouton qui fait apparaître la carte, et la carte ensuite.
 *
 * Tant qu'on n'a pas cliqué, RIEN n'est demandé à l'IGN. Le libellé le dit
 * avant le clic et non après : prévenir quelqu'un de ce qui va partir une
 * fois que c'est parti n'est pas le prévenir.
 */
export function CarteALaDemande({
  lat,
  lon,
  libelle,
}: {
  readonly lat: number
  readonly lon: number
  readonly libelle: string
}) {
  const [ouverte, setOuverte] = useState(false)
  if (ouverte) return <Carte lat={lat} lon={lon} libelle={libelle} />
  return (
    <div className="plan-demande">
      <button type="button" className="secondaire plan-bouton" onClick={() => setOuverte(true)}>
        Voir sur la carte
      </button>
      <span className="note">
        Les fonds de carte viennent de l’IGN. Rien ne leur est demandé tant que tu n’as pas
        cliqué.
      </span>
    </div>
  )
}
