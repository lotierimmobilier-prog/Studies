/**
 * Un chiffre qui défile jusqu'à sa valeur, une fois arrivé à l'écran.
 *
 * Purement décoratif : le chiffre est connu d'avance, et l'animation ne le
 * change pas. D'où trois garde-fous.
 *
 *   - `prefers-reduced-motion: reduce` affiche la valeur finale tout de suite.
 *     Une animation n'est jamais assez utile pour donner la nausée à qui a
 *     demandé qu'on s'en abstienne ;
 *   - les images intermédiaires sont `aria-hidden`, et la valeur exacte est
 *     annoncée une seule fois par un texte réservé aux lecteurs d'écran.
 *     Sans cela, le compteur bavarderait quarante chiffres faux ;
 *   - la dernière image tombe sur la cible elle-même. Voir compteur.ts.
 */

import { useEffect, useRef, useState } from 'react'

import { useVisible } from './avisLieu.tsx'
import { DUREE_MS, mouvementRefuse, valeurA } from './compteur.ts'
import { nombre } from './nombres.ts'

export function Compteur({ cible, duree = DUREE_MS }: { cible: number; duree?: number }) {
  const [ref, vu] = useVisible<HTMLSpanElement>()
  const [valeur, setValeur] = useState<number | null>(null)
  const image = useRef<number | null>(null)

  useEffect(() => {
    if (!vu || valeur !== null) return
    // Rien à faire défiler, ou mouvement refusé : on pose le chiffre.
    if (cible === 0 || mouvementRefuse()) {
      setValeur(cible)
      return
    }
    const depart = performance.now()
    const pas = (maintenant: number) => {
      const ecoule = maintenant - depart
      setValeur(valeurA(cible, ecoule, duree))
      if (ecoule < duree) image.current = requestAnimationFrame(pas)
    }
    image.current = requestAnimationFrame(pas)
    return () => {
      if (image.current !== null) cancelAnimationFrame(image.current)
    }
    // `valeur` est lu pour ne pas relancer une animation déjà faite ; le
    // relire en dépendance la relancerait à chaque image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vu, cible, duree])

  return (
    <span className="bandeau-chiffre" ref={ref}>
      <span aria-hidden="true">{nombre(valeur ?? 0)}</span>
      <span className="sr-only">{nombre(cible)}</span>
    </span>
  )
}
