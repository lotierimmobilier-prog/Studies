import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Configuration, Sejour, SejourPublic } from './types'

/**
 * Chargement de la configuration des séjours et de la maison.
 *
 * Deux emplacements possibles, dans l'ordre de priorité :
 *   1. `.data/sejours.json`      → votre configuration réelle (non versionnée)
 *   2. `server/data/sejours.json` → l'exemple fourni (versionné)
 *
 * Pour mettre le portail en service, copiez l'exemple dans `.data/sejours.json`
 * et remplissez-le avec vos vraies informations (codes, Wi-Fi, séjours…).
 */

const CHEMIN_PERSO = join(process.cwd(), '.data', 'sejours.json')
const CHEMIN_EXEMPLE = join(process.cwd(), 'server', 'data', 'sejours.json')

let config: Configuration | null = null

export async function chargerConfiguration(): Promise<Configuration> {
  const chemin = existsSync(CHEMIN_PERSO) ? CHEMIN_PERSO : CHEMIN_EXEMPLE
  const brut = await readFile(chemin, 'utf8')
  config = JSON.parse(brut) as Configuration
  return config
}

function courante(): Configuration {
  if (!config) throw new Error('Configuration non chargée')
  return config
}

/** Retire le mot de passe avant d'envoyer un séjour au client. */
export function sansMotDePasse(s: Sejour): SejourPublic {
  const { motDePasse: _motDePasse, ...reste } = s
  return reste
}

/**
 * Vérifie un couple login / mot de passe (comparaison insensible à la casse et
 * aux espaces sur le login). Renvoie le séjour correspondant ou `null`.
 */
export function verifierIdentifiants(
  login: string,
  motDePasse: string,
): Sejour | null {
  const l = login.trim().toLowerCase()
  const sejour = courante().sejours.find(
    (s) => s.login.trim().toLowerCase() === l && s.motDePasse === motDePasse,
  )
  return sejour ?? null
}

/** Retrouve un séjour par son login (pour restaurer une session via jeton). */
export function sejourParLogin(login: string): Sejour | null {
  const l = login.trim().toLowerCase()
  return (
    courante().sejours.find((s) => s.login.trim().toLowerCase() === l) ?? null
  )
}

export function maison() {
  return courante().maison
}
