/**
 * Ce qu'un moteur de recherche et un réseau social lisent de chaque écran.
 *
 * ── Pourquoi un module, et pas une fonction dans chaque écran ────────────
 *
 * Trois écrans écrivaient la même logique — le blog, la fiche de formation,
 * la fiche d'établissement — et les trois versions divergeaient déjà :
 *
 *   - le blog posait titre, description et canonique ;
 *   - les deux fiches posaient titre et canonique, jamais de description,
 *     si bien que toutes les fiches du site héritaient de celle de l'accueil ;
 *   - aucun des trois ne RESTITUAIT la description ni le canonique au
 *     démontage. Aller d'un article vers l'accueil laissait donc l'accueil
 *     avec le canonique de l'article et le chapô de l'article. Pour un
 *     moteur, c'est l'accueil qui se déclarait copie de l'article.
 *
 * Cinq autres écrans n'en posaient aucune, et se présentaient aux moteurs
 * avec le titre et la description de l'accueil — des doublons stricts.
 *
 * ── Ce que le démontage restitue ─────────────────────────────────────────
 *
 * La valeur lue AU MONTAGE, pas une valeur codée en dur : l'écran d'où l'on
 * vient peut être n'importe lequel. Une constante mettrait à jour l'accueil
 * même en revenant sur une fiche.
 */

import { useEffect } from 'react'

/** Pose ou remplace une balise `meta`/`link` de l'en-tête du document. */
function poser(selecteur: string, creer: () => Element, appliquer: (e: Element) => void): void {
  let element = document.head.querySelector(selecteur)
  if (element === null) {
    element = creer()
    document.head.append(element)
  }
  appliquer(element)
}

function lire(selecteur: string, attribut: string): string | null {
  return document.head.querySelector(selecteur)?.getAttribute(attribut) ?? null
}

function poserDescription(valeur: string): void {
  poser(
    'meta[name="description"]',
    () => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'description')
      return m
    },
    (e) => e.setAttribute('content', valeur),
  )
}

function poserCanonique(valeur: string): void {
  poser(
    'link[rel="canonical"]',
    () => {
      const l = document.createElement('link')
      l.setAttribute('rel', 'canonical')
      return l
    },
    (e) => e.setAttribute('href', valeur),
  )
}

function poserRobots(valeur: string | null): void {
  const existant = document.head.querySelector('meta[name="robots"]')
  if (valeur === null) {
    existant?.remove()
    return
  }
  poser(
    'meta[name="robots"]',
    () => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'robots')
      return m
    },
    (e) => e.setAttribute('content', valeur),
  )
}

export interface Metadonnees {
  readonly titre: string
  readonly description: string
  /**
   * L'adresse qui fait foi. Absente sur un écran privé : une page qu'on ne
   * veut pas voir indexée n'a pas besoin de désigner sa forme canonique.
   */
  readonly canonique?: string
  /**
   * `true` pour les écrans privés — compte, vœux, cartes, connexion.
   *
   * `Disallow` dans robots.txt empêche une NOUVELLE exploration ; il ne
   * désindexe pas une page déjà connue, et une page interdite d'exploration
   * peut même rester listée sans description. Le `noindex` la retire.
   */
  readonly prive?: boolean
}

/**
 * Applique les métadonnées d'un écran, et rétablit les précédentes en
 * partant.
 */
export function useMetadonnees({ titre, description, canonique, prive }: Metadonnees): void {
  useEffect(() => {
    const avant = {
      titre: document.title,
      description: lire('meta[name="description"]', 'content'),
      canonique: lire('link[rel="canonical"]', 'href'),
      robots: lire('meta[name="robots"]', 'content'),
    }

    document.title = titre
    poserDescription(description)
    if (canonique !== undefined) poserCanonique(canonique)
    poserRobots(prive === true ? 'noindex, follow' : avant.robots)

    return () => {
      document.title = avant.titre
      if (avant.description !== null) poserDescription(avant.description)
      if (avant.canonique !== null) poserCanonique(avant.canonique)
      poserRobots(avant.robots)
    }
  }, [titre, description, canonique, prive])
}
