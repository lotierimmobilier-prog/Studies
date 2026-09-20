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
/**
 * Un toit. Le pictogramme des liens de logement.
 *
 * Dessiné au trait comme les autres : une maison pleine ferait une tache
 * sombre au milieu d'une ligne de liens, et attirerait l'œil plus que le
 * chiffre du reste-à-vivre, qui est la raison d'être de la fiche.
 */
/**
 * Les pictogrammes des liens sortants.
 *
 * Ils servent à RACCOURCIR les libellés, pas à les décorer. « Fiche
 * Parcoursup de la formation » et « Chercher le site de l'école » remplissent
 * une ligne à eux deux ; avec un picto qui dit la nature du lien, « Fiche
 * Parcoursup » et « Site de l'école » suffisent, et la rangée se lit d'un
 * coup d'œil.
 *
 * Tous au trait, tous au même gabarit, tous sans couleur propre : ils
 * héritent de celle du lien. Un picto qui apporterait sa propre teinte
 * ferait trois taches de couleur différentes sur une même ligne.
 */

/** Un document. La fiche officielle d'une formation. */
export function Fiche() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M14 3.5H7.2a1.2 1.2 0 0 0-1.2 1.2v14.6a1.2 1.2 0 0 0 1.2 1.2h9.6a1.2 1.2 0 0 0 1.2-1.2V7.5Z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3.5v4h4" fill="none" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 16h4" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Une étoile. Les avis du public sur une adresse. */
export function Etoile() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="m12 4 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7.9-5.6-4-3.9 5.6-.8Z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Une loupe. Une recherche, et non une destination connue. */
export function Loupe() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" fill="none" strokeWidth="1.8" />
      <path d="m15.4 15.4 4.1 4.1" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Un bâtiment. Une résidence universitaire. */
export function Residence() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M5 20.3V5.2a.8.8 0 0 1 .8-.8h8.4a.8.8 0 0 1 .8.8v15.1"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M15 10h3.2a.8.8 0 0 1 .8.8v9.5" fill="none" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8h1.5M8 12h1.5M8 16h1.5" fill="none" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3.5 20.3h17" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Une clé. Une location dans le parc privé. */
export function Cle() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <circle cx="8.2" cy="8.2" r="4" fill="none" strokeWidth="1.8" />
      <path
        d="m11 11 8 8M16.5 16.5l2-2M14 14l1.6-1.6"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Toit() {
  return (
    <svg className="illu-picto" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M3.5 10.8 12 4l8.5 6.8"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 12.5V19a.8.8 0 0 0 .8.8h10.8a.8.8 0 0 0 .8-.8v-6.5"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 19.8v-4.2h4v4.2" fill="none" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

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
