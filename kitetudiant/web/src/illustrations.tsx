/**
 * Illustrations de la page d'accueil.
 *
 * Elles sont dessinées ici, en SVG, plutôt que chargées depuis une banque
 * d'images. Trois raisons, dans cet ordre :
 *
 *   1. Le site s'adresse à des mineurs et promet « aucun traceur ». Charger une
 *      photo depuis un service tiers enverrait l'adresse IP de chaque élève à
 *      ce service à chaque visite. Une promesse qu'on tient à moitié n'est pas
 *      une promesse.
 *   2. Ces dessins sont notre travail : aucune licence à vérifier, aucune
 *      attribution à afficher, aucun risque de retrait.
 *   3. Ils pèsent quelques kilo-octets, s'adaptent au thème clair comme au
 *      thème sombre, et restent nets sur n'importe quel écran.
 *
 * Elles sont purement décoratives — le sens est porté par le texte —, donc
 * `aria-hidden` : un lecteur d'écran les saute au lieu de les annoncer.
 */

/** Silhouette de ville : la promesse du site tient à la ville autant qu'à l'école. */
export function Ville() {
  return (
    <svg className="illu illu-ville" viewBox="0 0 320 170" role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="illu-ciel-haut" />
          <stop offset="100%" className="illu-ciel-bas" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="170" rx="14" fill="url(#ciel)" />
      <circle cx="258" cy="42" r="20" className="illu-astre" />

      {/* Immeubles, du plus lointain au plus proche. */}
      <g className="illu-loin">
        <rect x="18" y="72" width="38" height="70" rx="3" />
        <rect x="64" y="56" width="30" height="86" rx="3" />
        <rect x="228" y="66" width="34" height="76" rx="3" />
        <rect x="270" y="84" width="32" height="58" rx="3" />
      </g>
      <g className="illu-pres">
        <rect x="100" y="40" width="46" height="102" rx="4" />
        <rect x="154" y="64" width="34" height="78" rx="4" />
        <rect x="194" y="52" width="28" height="90" rx="4" />
      </g>

      {/* Fenêtres allumées : ce sont des studios d'étudiants. */}
      <g className="illu-fenetres">
        {[
          [108, 52], [124, 52], [108, 70], [124, 70], [108, 88], [124, 88], [108, 106],
          [162, 76], [174, 76], [162, 94], [174, 94], [162, 112],
          [200, 64], [210, 64], [200, 82], [210, 82], [200, 100],
          [26, 84], [38, 84], [26, 102], [72, 68], [82, 68], [72, 86],
          [236, 78], [248, 78], [236, 96], [278, 96], [290, 96],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="9" rx="1.5" />
        ))}
      </g>

      {/* Le sol, et un chemin qui s'en va vers la ville. */}
      <rect x="0" y="142" width="320" height="28" className="illu-sol" />
      <path d="M126 170 L146 142 L172 142 L162 170 Z" className="illu-chemin" />
    </svg>
  )
}

/** Épingle de carte — le choix géographique. */
export function Epingle() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 2.8c-3.6 0-6.5 2.9-6.5 6.5 0 4.6 5.6 10.5 6.1 11 .2.2.6.2.8 0 .5-.5 6.1-6.4 6.1-11 0-3.6-2.9-6.5-6.5-6.5Z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.3" r="2.6" fill="none" strokeWidth="1.8" />
    </svg>
  )
}

/** Boussole — le choix stratégique. */
export function Boussole() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="1.8" />
      <path d="M15.6 8.4 13.8 13.8 8.4 15.6 10.2 10.2 Z" fill="none" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

/** Porte-monnaie — le choix économique. */
export function PorteMonnaie() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M4 8.5C4 7.1 5.1 6 6.5 6h11A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5Z"
        fill="none"
        strokeWidth="1.8"
      />
      <path d="M4 9.5h13a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5H4" fill="none" strokeWidth="1.8" />
      <circle cx="15.5" cy="12" r="1.1" />
    </svg>
  )
}

/** Carnet de notes — l'étape « tes notes ». */
export function Carnet() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 17 20.5H6Z" fill="none" strokeWidth="1.8" />
      <path d="M6 3.5v17" fill="none" strokeWidth="1.8" />
      <path d="M9.5 8.5h6M9.5 12h6M9.5 15.5h3.5" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
