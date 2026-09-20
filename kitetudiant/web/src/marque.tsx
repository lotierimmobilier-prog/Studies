/**
 * Le logo KitEtudiant.fr.
 *
 * Le fichier fourni est un bloc empilé sur fond blanc. Il a été découpé en
 * deux morceaux — le dessin et le nom — pour composer un bandeau horizontal
 * qui tient dans un en-tête, et son fond a été détouré par propagation depuis
 * les bords : le blanc ENFERMÉ dans le dessin (le contour du sac, le trait de
 * la poche) reste blanc, celui des contre-formes des lettres devient
 * transparent. Rien d'autre n'a été retouché.
 *
 * Une seconde version existe pour le thème sombre, où le marine du logo
 * (#05335C) serait illisible sur un fond presque noir. Seul ce marine est
 * éclairci ; le turquoise et le corail sont laissés tels quels, ils passent
 * très bien sur fond sombre (6,4:1 et 6,0:1).
 *
 * La bascule passe par `<picture>` : le navigateur ne télécharge que la
 * version dont il a besoin. Elle suit la préférence système. Si un jour un
 * sélecteur de thème écrit `data-theme` sur la racine — la feuille de style
 * le prévoit déjà —, il faudra basculer ces images en CSS, `<picture>` ne
 * sachant pas lire un attribut.
 */

import dessin from './images/logo-marque.png'
import dessinSombre from './images/logo-marque-sombre.png'
import mot from './images/logo-nom.png'
import motSombre from './images/logo-nom-sombre.png'

/** Dimensions natives des deux découpes, portées sur les balises. */
const DESSIN = { largeur: 94, hauteur: 112 }
const MOT = { largeur: 548, hauteur: 72 }

const SOMBRE = '(prefers-color-scheme: dark)'

/**
 * Le nom du site, en logo.
 *
 * `compact` masque le dessin et ne garde que le nom : sur un en-tête étroit,
 * le nom seul reste identifiable, le dessin seul ne l'est pas.
 */
export function Marque({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`marque-logo${compact ? ' marque-logo-compact' : ''}`}>
      <picture>
        <source srcSet={dessinSombre} media={SOMBRE} />
        {/* Décoratif : le nom juste à côté porte déjà le sens. */}
        <img
          className="marque-dessin"
          src={dessin}
          alt=""
          aria-hidden="true"
          width={DESSIN.largeur}
          height={DESSIN.hauteur}
          decoding="async"
        />
      </picture>
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
    </span>
  )
}
