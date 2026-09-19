/**
 * Note publique du lieu, dans le détail d'une fiche uniquement.
 *
 * Jamais sur la carte, jamais dans le tri, jamais mêlée aux deux axes. Elle
 * arrive avec son attribution, son effectif, sa date et sa mise en garde —
 * sans quoi elle serait lue comme un jugement sur la formation, ce qu'elle
 * n'est pas.
 */

import { useEffect, useState } from 'react'

import { chercherAvisLieu, type AvisLieu, type AvisLieuIndisponible } from './donnees.ts'

function estIndisponible(r: AvisLieu | AvisLieuIndisponible): r is AvisLieuIndisponible {
  return 'raison' in r
}

export function NoteDuLieu({ etablissement, ville }: { etablissement: string; ville: string }) {
  const [avis, setAvis] = useState<AvisLieu | AvisLieuIndisponible | null>(null)

  useEffect(() => {
    let vivant = true
    void chercherAvisLieu(etablissement, ville).then((r) => {
      if (vivant) setAvis(r)
    })
    return () => {
      vivant = false
    }
  }, [etablissement, ville])

  // Tant qu'on ne sait rien, on n'affiche rien : une section vide laisserait
  // croire qu'il n'y a pas d'avis, ce qui n'est pas la même chose.
  if (avis === null || estIndisponible(avis)) return null

  return (
    <div className="note-lieu">
      <h4>Note publique de l’adresse</h4>
      <p className="note-lieu-valeur">
        <strong>{avis.note.toFixed(1)}/5</strong> sur {avis.nombreAvis.toLocaleString('fr-FR')} avis
      </p>
      <p className="note">{avis.miseEnGarde}</p>
      <p className="note">
        {avis.source}, relevé le {new Date(avis.collecteLe).toLocaleDateString('fr-FR')}.
        {avis.urlMaps ? (
          <>
            {' '}
            <a href={avis.urlMaps} target="_blank" rel="noreferrer">
              Voir la fiche
            </a>
            .
          </>
        ) : null}
      </p>
    </div>
  )
}
