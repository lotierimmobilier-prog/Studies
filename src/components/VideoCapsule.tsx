import type { SourceVideo } from '../types'
import { normaliserSource } from '../lienVideo'

/** Construit l'URL d'intégration selon la source de la vidéo. */
function urlEmbed(source: SourceVideo): string {
  const video = normaliserSource(source)
  switch (video.type) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${video.id}`
    case 'vimeo':
      return `https://player.vimeo.com/video/${video.id}`
    case 'fichier':
      return video.src
  }
}

/**
 * Lecteur de capsule vidéo. Affiche un iframe pour YouTube/Vimeo, ou une balise
 * <video> native pour un fichier hébergé.
 */
export default function VideoCapsule({ video }: { video: SourceVideo }) {
  if (video.type === 'fichier') {
    return (
      <div className="video-cadre">
        <video src={urlEmbed(video)} controls playsInline preload="metadata" />
      </div>
    )
  }
  return (
    <div className="video-cadre">
      <iframe
        src={urlEmbed(video)}
        title="Capsule vidéo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
