/**
 * Pictogrammes de l'interface.
 *
 * Dessinés ici, en SVG : quelques centaines d'octets, les couleurs viennent
 * des variables de thème — donc ils suivent le mode clair comme le mode
 * sombre sans seconde version —, et ils restent nets sur n'importe quel écran.
 *
 * Ils sont purement décoratifs : le sens est porté par le texte qu'ils
 * accompagnent. D'où `aria-hidden` — un lecteur d'écran les saute au lieu de
 * les annoncer.
 *
 * Ce fichier a longtemps contenu aussi quatre grandes illustrations dessinées
 * et une silhouette de ville. Elles ont été retirées le 20/09/2026 : sur un
 * site qui s'adresse à de futurs adultes et dont la crédibilité tient à ses
 * chiffres, un dessin de campus tirait la page vers l'application pour
 * adolescents. La page repose désormais sur sa typographie et ses données.
 * L'historique git les garde, et de vraies photographies pourront prendre
 * leur place.
 */

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
