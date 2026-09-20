/**
 * Le logo KitEtudiant.fr.
 *
 * Le fichier fourni est un bandeau horizontal sur fond blanc : le nom, toque
 * comprise, puis la signature en dessous. Seul le nom est découpé en image —
 * son dessin fait la marque. La signature, elle, est du texte : elle reste
 * nette à toute taille, se lit par un lecteur d'écran, et se traduit.
 *
 * Le fond est détouré par propagation depuis les bords, et les contre-formes
 * des lettres — le trou du « d », du « a » — sont rendues transparentes : sur
 * fond sombre, elles seraient apparues en pastilles blanches.
 *
 * Une seconde version sert au thème sombre. Le marine du nom (#19304A) et le
 * « .fr » presque noir (#1F1F1F) y seraient illisibles : eux seuls sont
 * éclaircis. Le teal (#1F969A) et l'ambre du point sont laissés tels quels.
 *
 * La bascule passe par `<picture>` : le navigateur ne télécharge qu'une
 * version, et elle suit la préférence système. Si un sélecteur de thème
 * écrivait un jour `data-theme` sur la racine — la feuille de style le prévoit
 * déjà —, il faudrait basculer ces images en CSS : `<picture>` ne sait pas
 * lire un attribut.
 */

import { cheminDe, type Route } from './routes.ts'

import mot from './images/logo-nom.png'
import motSombre from './images/logo-nom-sombre.png'

/** Dimensions natives de la découpe, portées sur la balise. */
const MOT = { largeur: 665, hauteur: 96 }

const SOMBRE = '(prefers-color-scheme: dark)'

/** La signature de la marque, telle qu'elle figure sous le logo. */
export const SIGNATURE = 'Tout pour bien démarrer ta vie étudiante'

/**
 * La marque, cliquable, qui ramène à l'accueil.
 *
 * C'est la convention la mieux établie du web : un logo en haut à gauche
 * ramène chez soi, et les gens l'essaient sans y penser. Quand il ne réagit
 * pas, ils ne se disent pas « ce logo n'est pas un lien » — ils cliquent deux
 * fois, puis cherchent un bouton.
 *
 * Un VRAI lien, avec son adresse : on peut donc l'ouvrir dans un onglet, le
 * mettre en favori, et le clic modifié reste au navigateur. Le clic ordinaire
 * est intercepté pour naviguer sans recharger.
 *
 * Sur l'accueil lui-même, on n'emploie PAS ce composant mais `Marque` :
 * un lien vers la page où l'on se trouve déjà n'a nulle part où mener, et un
 * lecteur d'écran l'annonce quand même comme une destination.
 */
export function MarqueLien({
  signature = false,
  onNaviguer,
}: {
  signature?: boolean
  onNaviguer: (route: Route) => void
}) {
  const accueil: Route = { vue: 'accueil' }
  return (
    <a
      className="marque-lien"
      href={cheminDe(accueil)}
      aria-label="KitEtudiant.fr — retour à l’accueil"
      onClick={(ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
        ev.preventDefault()
        onNaviguer(accueil)
      }}
    >
      <Marque signature={signature} />
    </a>
  )
}

export function Marque({ signature = false }: { signature?: boolean }) {
  return (
    <span className={`marque-logo${signature ? ' marque-logo-signee' : ''}`}>
      <picture>
        <source srcSet={motSombre} media={SOMBRE} />
        <img
          className="marque-mot"
          src={mot}
          alt="KitEtudiant.fr"
          width={MOT.largeur}
          height={MOT.hauteur}
          decoding="async"
        />
      </picture>
      {signature ? <span className="marque-signature">{SIGNATURE}</span> : null}
    </span>
  )
}
