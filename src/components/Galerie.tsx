import { useEffect, useState } from 'react'
import type { PhotoGalerie } from '../types'
import { urlMedia } from '../api'

/** Fenêtre d'agrandissement (lightbox) d'une photo. */
function Lightbox({
  photos,
  index,
  onFermer,
  onNaviguer,
}: {
  photos: PhotoGalerie[]
  index: number
  onFermer: () => void
  onNaviguer: (i: number) => void
}) {
  const photo = photos[index]

  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
      if (e.key === 'ArrowRight') onNaviguer((index + 1) % photos.length)
      if (e.key === 'ArrowLeft')
        onNaviguer((index - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [index, photos.length, onFermer, onNaviguer])

  return (
    <div className="lightbox" onClick={onFermer}>
      <button className="lightbox-fermer" onClick={onFermer} aria-label="Fermer">
        ✕
      </button>
      {photos.length > 1 && (
        <button
          className="lightbox-nav lightbox-nav--gauche"
          onClick={(e) => {
            e.stopPropagation()
            onNaviguer((index - 1 + photos.length) % photos.length)
          }}
          aria-label="Photo précédente"
        >
          ‹
        </button>
      )}
      <figure className="lightbox-contenu" onClick={(e) => e.stopPropagation()}>
        <img src={urlMedia(photo.url)} alt={photo.legende ?? 'Photo'} />
        {photo.legende && <figcaption>{photo.legende}</figcaption>}
      </figure>
      {photos.length > 1 && (
        <button
          className="lightbox-nav lightbox-nav--droite"
          onClick={(e) => {
            e.stopPropagation()
            onNaviguer((index + 1) % photos.length)
          }}
          aria-label="Photo suivante"
        >
          ›
        </button>
      )}
    </div>
  )
}

export default function SectionGalerie({
  galerie,
}: {
  galerie: PhotoGalerie[]
}) {
  const [ouvert, setOuvert] = useState<number | null>(null)

  return (
    <section className="section">
      <h1 className="section-titre">La maison en photos</h1>
      <p className="section-intro">
        Découvrez votre lieu de vacances avant même d'y poser vos valises.
      </p>

      {galerie.length === 0 ? (
        <p className="vide">Aucune photo pour le moment.</p>
      ) : (
        <div className="grille-galerie">
          {galerie.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              className="galerie-vignette"
              onClick={() => setOuvert(i)}
            >
              <img src={urlMedia(photo.url)} alt={photo.legende ?? 'Photo'} loading="lazy" />
              {photo.legende && (
                <span className="galerie-legende">{photo.legende}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {ouvert !== null && (
        <Lightbox
          photos={galerie}
          index={ouvert}
          onFermer={() => setOuvert(null)}
          onNaviguer={setOuvert}
        />
      )}
    </section>
  )
}
