import type { SourceVideo } from './types'

/**
 * Extraction d'identifiants de vidéo à partir d'un **lien collé** (ou d'un ID
 * déjà saisi). Permet à l'hôte de coller directement l'adresse d'une vidéo
 * YouTube ou Vimeo, sans avoir à en extraire l'identifiant lui-même.
 */

/** Extrait l'ID d'une vidéo YouTube depuis une URL, sinon renvoie l'entrée nettoyée. */
export function extraireIdYoutube(entree: string): string {
  const t = entree.trim()
  if (!t) return ''
  const motifs = [
    /[?&]v=([\w-]{11})/, // ...watch?v=ID
    /youtu\.be\/([\w-]{11})/, // youtu.be/ID
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/, // /embed|shorts|live/ID
  ]
  for (const m of motifs) {
    const r = t.match(m)
    if (r) return r[1]
  }
  // Pas une URL reconnue : peut-être déjà un ID (11 caractères).
  return t
}

/** Extrait l'ID numérique d'une vidéo Vimeo depuis une URL, sinon l'entrée. */
export function extraireIdVimeo(entree: string): string {
  const t = entree.trim()
  if (!t) return ''
  const r = t.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (r) return r[1]
  const chiffres = t.match(/^(\d+)$/)
  return chiffres ? chiffres[1] : t
}

/**
 * Devine la source d'une vidéo à partir d'un lien collé (détecte YouTube ou
 * Vimeo). Renvoie `null` si ce n'est pas un lien reconnu.
 */
export function devinerSourceDepuisLien(entree: string): SourceVideo | null {
  const t = entree.trim()
  if (!t) return null
  if (/youtu\.?be/.test(t)) return { type: 'youtube', id: extraireIdYoutube(t) }
  if (/vimeo\.com/.test(t)) return { type: 'vimeo', id: extraireIdVimeo(t) }
  return null
}

/** Normalise une source vidéo (au cas où un ID contiendrait encore une URL). */
export function normaliserSource(video: SourceVideo): SourceVideo {
  if (video.type === 'youtube')
    return { type: 'youtube', id: extraireIdYoutube(video.id) }
  if (video.type === 'vimeo')
    return { type: 'vimeo', id: extraireIdVimeo(video.id) }
  return video
}
