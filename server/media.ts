import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join, basename, extname } from 'node:path'

/**
 * Stockage et service des images uploadées (ex. photo de la façade).
 * Les fichiers sont enregistrés dans `.data/uploads/` (non versionné) et servis
 * publiquement via GET /api/media/<nom>.
 */

const DOSSIER = join(process.cwd(), '.data', 'uploads')

/** Taille maximale d'un fichier téléversé : 20 Mo (images et PDF). */
export const TAILLE_MAX_IMAGE = 20 * 1024 * 1024

/** Types acceptés (images + PDF) → extension de fichier. */
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
}

const EXT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  pdf: 'application/pdf',
}

export function typeAccepte(contentType: string): boolean {
  return contentType.split(';')[0].trim() in TYPES
}

/** Enregistre une image et renvoie son chemin relatif (`api/media/<nom>`). */
export async function enregistrerImage(
  donnees: Buffer,
  contentType: string,
): Promise<string> {
  const ext = TYPES[contentType.split(';')[0].trim()] ?? 'jpg'
  await mkdir(DOSSIER, { recursive: true })
  const nom = `${randomBytes(12).toString('hex')}.${ext}`
  await writeFile(join(DOSSIER, nom), donnees)
  return `api/media/${nom}`
}

/** Lit une image par son nom (avec garde anti-traversée de chemin). */
export async function lireImage(
  nom: string,
): Promise<{ donnees: Buffer; contentType: string } | null> {
  // On ne garde que le nom de fichier (empêche ../ et chemins absolus).
  const sur = basename(nom)
  if (!/^[\w.-]+$/.test(sur)) return null
  const chemin = join(DOSSIER, sur)
  if (!existsSync(chemin)) return null
  const ext = extname(sur).slice(1).toLowerCase()
  const contentType = EXT_TYPES[ext] ?? 'application/octet-stream'
  return { donnees: await readFile(chemin), contentType }
}
