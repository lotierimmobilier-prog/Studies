/**
 * Note publique du LIEU.
 *
 * Ce n'est pas un avis sur la formation : c'est la note que le grand public a
 * donnée à l'adresse sur Google Maps. Elle agrège des visiteurs, des parents,
 * des passants, et une même étoile couvre souvent des dizaines de formations
 * très différentes du même établissement.
 *
 * Elle est donc rendue avec tout ce qu'il faut pour la lire correctement —
 * attribution, nombre d'avis, date de collecte, mise en garde — et elle
 * n'entre dans AUCUN tri et dans AUCUN score. Cette garantie n'est pas une
 * promesse de bonne conduite : la note ne revient jamais dans
 * `ResultatFormation`, donc le tri et les deux axes n'y ont structurellement
 * pas accès (règle 5 de CLAUDE.md, module M10 du cahier des charges).
 *
 * Elle n'est demandée que pour les fiches réellement regardées. Chaque appel
 * coûte une requête Places facturée : charger les quarante d'un coup ferait
 * payer trente-cinq établissements que l'élève ne verra jamais. Le serveur
 * garde ses réponses trente jours, donc l'élève suivant ne coûte rien.
 */

import { useEffect, useRef, useState } from 'react'

import { chercherAvisLieu, type AvisLieu, type AvisLieuIndisponible } from './donnees.ts'

function estIndisponible(r: AvisLieu | AvisLieuIndisponible): r is AvisLieuIndisponible {
  return 'raison' in r
}

/**
 * Dit si l'élément a été vu au moins une fois. Une fois vrai, reste vrai : on
 * ne redemande pas la note à chaque défilement.
 */
export function useVisible<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [vu, setVu] = useState(false)
  useEffect(() => {
    const cible = ref.current
    if (cible === null || vu) return
    // Navigateur sans IntersectionObserver : on considère l'élément vu plutôt
    // que de ne jamais rien afficher.
    if (typeof IntersectionObserver === 'undefined') {
      setVu(true)
      return
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) setVu(true)
      },
      { rootMargin: '150px' },
    )
    observateur.observe(cible)
    return () => observateur.disconnect()
  }, [vu])
  return [ref, vu]
}

/** La note d'une adresse, demandée seulement quand `actif` passe à vrai. */
export function useAvisLieu(
  etablissement: string,
  ville: string,
  actif: boolean,
): AvisLieu | null {
  const [avis, setAvis] = useState<AvisLieu | null>(null)
  useEffect(() => {
    if (!actif) return
    let vivant = true
    void chercherAvisLieu(etablissement, ville).then((r) => {
      // Service non configuré ou adresse introuvable : on ne montre rien.
      // Une section vide laisserait croire qu'il n'y a pas d'avis, ce qui
      // n'est pas la même chose, et un « 0/5 » serait faux.
      if (vivant && !estIndisponible(r)) setAvis(r)
    })
    return () => {
      vivant = false
    }
  }, [etablissement, ville, actif])
  return avis
}

/** Les étoiles, en pur texte lisible par un lecteur d'écran via le libellé. */
function Etoiles({ note }: { note: number }) {
  const pleines = Math.round(note)
  return (
    <span className="etoiles" aria-hidden="true">
      {'★★★★★'.slice(0, pleines)}
      <span className="etoiles-vides">{'★★★★★'.slice(pleines)}</span>
    </span>
  )
}

/**
 * La pastille compacte, sur la fiche elle-même.
 *
 * Elle dit « l'adresse », jamais « l'école » : c'est la seule formulation qui
 * ne laisse pas croire à une note sur l'enseignement.
 */
export function PastilleNote({ avis }: { avis: AvisLieu | null }) {
  if (avis === null) return null
  return (
    <p
      className="pastille-note"
      title={avis.miseEnGarde}
      aria-label={`Note publique de l’adresse : ${avis.note.toFixed(1)} sur 5, ${avis.nombreAvis} avis`}
    >
      <Etoiles note={avis.note} />
      <span className="pastille-note-valeur">{avis.note.toFixed(1)}</span>
      <span className="pastille-note-detail">
        · {avis.nombreAvis.toLocaleString('fr-FR')} avis sur l’adresse
      </span>
    </p>
  )
}

/** Le bloc complet, dans le détail d'une fiche : la note avec ses réserves. */
export function NoteDuLieu({ avis }: { avis: AvisLieu | null }) {
  if (avis === null) return null
  return (
    <div className="note-lieu">
      <h4>Note publique de l’adresse</h4>
      <p className="note-lieu-valeur">
        <strong>{avis.note.toFixed(1)}/5</strong> sur {avis.nombreAvis.toLocaleString('fr-FR')} avis
      </p>
      <p className="note">{avis.miseEnGarde}</p>
      <p className="note">
        {avis.source}, relevé le {new Date(avis.collecteLe).toLocaleDateString('fr-FR')}.
      </p>
    </div>
  )
}
