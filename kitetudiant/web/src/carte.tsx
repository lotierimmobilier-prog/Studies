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

export interface PointCarte {
  readonly cle: string
  readonly lat: number
  readonly lon: number
  readonly libelle: string
}

/**
 * Le cadrage initial : centre et zoom qui montrent tous les points.
 *
 * Calculé une fois, au montage. Le recalculer à chaque rendu ramènerait la
 * carte à sa position de départ dès qu'on la déplace — le bogue classique
 * d'une carte « contrôlée » par ses données.
 *
 * Le zoom se déduit de l'étendue en longitude et en latitude, la plus
 * contraignante des deux l'emportant. On retire un cran de marge : sans lui,
 * les points extrêmes tombent pile sur le bord, où ils se lisent mal.
 */
export function cadrage(points: readonly PointCarte[]): { lat: number; lon: number; zoom: number } {
  const premier = points[0]
  if (premier === undefined) return { lat: 46.6, lon: 2.4, zoom: 5 }
  if (points.length === 1) return { lat: premier.lat, lon: premier.lon, zoom: 15 }

  let latMin = premier.lat
  let latMax = premier.lat
  let lonMin = premier.lon
  let lonMax = premier.lon
  for (const p of points) {
    latMin = Math.min(latMin, p.lat)
    latMax = Math.max(latMax, p.lat)
    lonMin = Math.min(lonMin, p.lon)
    lonMax = Math.max(lonMax, p.lon)
  }
  const etendue = Math.max(lonMax - lonMin, (latMax - latMin) * 1.6, 0.002)
  // 360° tiennent dans une tuile au zoom 0 : chaque cran divise par deux.
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(Math.log2(360 / etendue)) - 1))
  return { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2, zoom }
}

export function Carte({
  points,
  hauteur = 280,
  onPoint,
}: {
  readonly points: readonly PointCarte[]
  readonly hauteur?: number
  /** Appelé au clic sur un repère. Absent : les repères ne sont pas cliquables. */
  readonly onPoint?: (cle: string) => void
}) {
  const depart = useRef(cadrage(points)).current
  const [zoom, setZoom] = useState(depart.zoom)
  const [centre, setCentre] = useState({ lat: depart.lat, lon: depart.lon })
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

  /* Les écoles ne bougent pas : c'est la fenêtre qui se déplace. Les repères
     hors cadre sont écartés plutôt que posés en dehors, où ils déborderaient
     et se poseraient sur le texte de la page.
  
     Le regroupement se fait À L'ÉCRAN, pas sur les coordonnées : deux points
     distants de trente mètres se superposent au zoom 10 et se séparent au
     zoom 16. Regrouper sur les coordonnées ne traiterait que les adresses
     rigoureusement identiques et laisserait, partout ailleurs, une tache de
     repères empilés dont on ne peut rien cliquer.
  
     La grille vaut une fois et demie la taille d'un repère : assez pour
     qu'ils ne se recouvrent plus, assez peu pour ne pas rassembler des écoles
     de quartiers différents. */
  const MAILLE = 30
  const groupes = new Map<string, { membres: PointCarte[]; sx: number; sy: number }>()
  for (const p of points) {
    const x = (xDeLongitude(p.lon, zoom) - gauche) * TUILE
    const y = (yDeLatitude(p.lat, zoom) - haut) * TUILE
    if (x < 0 || x > largeur || y < 0 || y > hauteur) continue
    const cle = `${Math.round(x / MAILLE)}:${Math.round(y / MAILLE)}`
    const deja = groupes.get(cle)
    if (deja === undefined) groupes.set(cle, { membres: [p], sx: x, sy: y })
    else {
      deja.membres.push(p)
      deja.sx += x
      deja.sy += y
    }
  }
  // Le repère se pose au barycentre de son groupe, et non sur son premier
  // membre : sinon il saute d'un point à l'autre au moindre déplacement.
  const reperes = [...groupes.values()].map((g) => ({
    membres: g.membres,
    tete: g.membres[0]!,
    x: g.sx / g.membres.length,
    y: g.sy / g.membres.length,
  }))

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
        aria-label={
          points.length === 1
            ? `Carte situant ${points[0]!.libelle}`
            : `Carte situant ${points.length} formations`
        }
        onPointerDown={(ev) => {
          /* Ne pas capturer le pointeur quand il tombe sur un bouton — un
             repère cliquable, les zooms, « Recentrer ». La capture détourne
             tous les événements suivants vers le cadre, y compris le
             « pointerup » qui devait faire naître le clic : le bouton ne
             réagissait jamais, sans que rien ne le signale. */
          if ((ev.target as HTMLElement).closest('button') !== null) return
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

        {reperes.map((r) => {
          const seul = r.membres.length === 1
          const nom = seul
            ? r.tete.libelle
            : `${r.membres.length} formations à cet endroit — agrandir pour les séparer`
          if (onPoint === undefined) {
            return (
              <span
                key={r.tete.cle}
                className="plan-repere"
                style={{ left: `${r.x}px`, top: `${r.y}px` }}
              />
            )
          }
          // Un vrai bouton : il s'atteint au clavier, et son nom dit ce qu'il
          // désigne. Un repère cliquable qui n'est qu'un `div` n'existe pas
          // pour qui n'utilise pas de souris.
          return (
            <button
              key={r.tete.cle}
              type="button"
              className={
                seul
                  ? 'plan-repere plan-repere-actif'
                  : 'plan-repere plan-repere-actif plan-repere-groupe'
              }
              style={{ left: `${r.x}px`, top: `${r.y}px` }}
              title={nom}
              aria-label={nom}
              onClick={() => {
                if (seul) {
                  onPoint(r.tete.cle)
                  return
                }
                // Un groupe ne mène nulle part : on ne peut pas choisir pour
                // l'élève laquelle des dix formations il visait. On agrandit
                // et on recentre, ce qui les sépare.
                setCentre({
                  lon: longitudeDeX(gauche + r.x / TUILE, zoom),
                  lat: latitudeDeY(haut + r.y / TUILE, zoom),
                })
                setZoom((z) => Math.min(ZOOM_MAX, z + 2))
              }}
            >
              {r.membres.length > 1 ? (
                <span className="plan-repere-compte">{r.membres.length}</span>
              ) : null}
            </button>
          )
        })}

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
              setCentre({ lat: depart.lat, lon: depart.lon })
              setZoom(depart.zoom)
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
  points,
  hauteur,
  onPoint,
  libelleBouton = 'Voir sur la carte',
}: {
  readonly points: readonly PointCarte[]
  readonly hauteur?: number
  readonly onPoint?: (cle: string) => void
  readonly libelleBouton?: string
}) {
  const [ouverte, setOuverte] = useState(false)
  if (points.length === 0) return null
  if (ouverte) {
    return (
      <Carte
        points={points}
        {...(hauteur === undefined ? {} : { hauteur })}
        {...(onPoint === undefined ? {} : { onPoint })}
      />
    )
  }
  return (
    <div className="plan-demande">
      <button type="button" className="secondaire plan-bouton" onClick={() => setOuverte(true)}>
        {libelleBouton}
      </button>
      <span className="note">
        Les fonds de carte viennent de l’IGN. Rien ne leur est demandé tant que tu n’as pas
        cliqué.
      </span>
    </div>
  )
}
