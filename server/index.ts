import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { creerJeton, verifierJeton } from './auth'
import {
  chargerConfiguration,
  configurationComplete,
  contenuVoyageur,
  enregistrerConfiguration,
  sejourParCode,
  verifierAdmin,
} from './config'
import {
  enregistrerImage,
  lireImage,
  typeAccepte,
  TAILLE_MAX_IMAGE,
} from './media'
import type { Configuration, ReponseConnexion } from './types'

/**
 * Serveur HTTP minimal (sans dépendance) pour le portail voyageurs.
 *
 * Côté voyageur (connexion par simple code) :
 *   GET  /api/sante                → { ok: true }
 *   POST /api/connexion  { code }  → { jeton, sejour, maison, tutoriels, tourisme }
 *   GET  /api/sejour               → restaure la session (jeton voyageur)
 *
 * Côté administration (protégé par mot de passe ADMIN_PASSWORD) :
 *   POST /api/admin/connexion { motDePasse } → { jeton }
 *   GET  /api/admin/config                    → Configuration complète
 *   PUT  /api/admin/config    body Config     → enregistre (et recharge)
 */

const PORT = Number(process.env.PORT ?? 8788)

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function envoyerJson(res: ServerResponse, code: number, data: unknown): void {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

const TAILLE_MAX_CORPS = 1 * 1024 * 1024 // 1 Mo (config complète)

async function lireCorps(req: IncomingMessage): Promise<string> {
  const morceaux: Buffer[] = []
  let total = 0
  for await (const c of req) {
    total += (c as Buffer).length
    if (total > TAILLE_MAX_CORPS) throw new Error('Corps de requête trop volumineux')
    morceaux.push(c as Buffer)
  }
  return Buffer.concat(morceaux).toString('utf8')
}

/** Lit le corps brut (binaire) d'une requête, jusqu'à `max` octets. */
async function lireCorpsBinaire(
  req: IncomingMessage,
  max: number,
): Promise<Buffer> {
  const morceaux: Buffer[] = []
  let total = 0
  for await (const c of req) {
    total += (c as Buffer).length
    if (total > max) throw new Error('Fichier trop volumineux')
    morceaux.push(c as Buffer)
  }
  return Buffer.concat(morceaux)
}

function jetonDepuisEntete(req: IncomingMessage): string | undefined {
  const entete = req.headers['authorization']
  if (!entete) return undefined
  const [type, valeur] = entete.split(' ')
  return type === 'Bearer' ? valeur : undefined
}

async function demarrer(): Promise<void> {
  await chargerConfiguration()

  const serveur = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

      if (req.method === 'OPTIONS') {
        cors(res)
        res.writeHead(204)
        res.end()
        return
      }

      if (url.pathname === '/api/sante') {
        return envoyerJson(res, 200, { ok: true })
      }

      // Service public des images uploadées (photo de façade…).
      if (url.pathname.startsWith('/api/media/') && req.method === 'GET') {
        const nom = decodeURIComponent(
          url.pathname.slice('/api/media/'.length),
        )
        const image = await lireImage(nom)
        if (!image) return envoyerJson(res, 404, { erreur: 'Image introuvable' })
        cors(res)
        res.writeHead(200, {
          'Content-Type': image.contentType,
          'Cache-Control': 'public, max-age=86400',
        })
        return res.end(image.donnees)
      }

      // ------------------------------------------------------------- voyageur

      // Connexion par code : renvoie un jeton + tout le contenu du séjour.
      if (url.pathname === '/api/connexion' && req.method === 'POST') {
        const { code } = JSON.parse(await lireCorps(req)) as { code?: string }
        if (!code)
          return envoyerJson(res, 400, { erreur: 'Code requis.' })

        const sejour = sejourParCode(code)
        if (!sejour)
          return envoyerJson(res, 401, { erreur: 'Code invalide.' })

        const reponse: ReponseConnexion = {
          jeton: creerJeton(sejour.code, 'voyageur'),
          ...contenuVoyageur(sejour),
        }
        return envoyerJson(res, 200, reponse)
      }

      // Restaure une session voyageur à partir d'un jeton.
      if (url.pathname === '/api/sejour' && req.method === 'GET') {
        const charge = verifierJeton(jetonDepuisEntete(req))
        if (!charge || charge.role !== 'voyageur')
          return envoyerJson(res, 401, { erreur: 'Session expirée.' })

        const sejour = sejourParCode(charge.sub)
        if (!sejour)
          return envoyerJson(res, 401, { erreur: 'Séjour introuvable.' })

        return envoyerJson(res, 200, contenuVoyageur(sejour))
      }

      // ----------------------------------------------------------------- admin

      // Connexion administrateur : renvoie un jeton admin.
      if (url.pathname === '/api/admin/connexion' && req.method === 'POST') {
        const { motDePasse } = JSON.parse(await lireCorps(req)) as {
          motDePasse?: string
        }
        if (!motDePasse || !verifierAdmin(motDePasse))
          return envoyerJson(res, 401, { erreur: 'Mot de passe incorrect.' })
        return envoyerJson(res, 200, { jeton: creerJeton('admin', 'admin') })
      }

      // Upload d'une image (jeton admin requis). Corps = octets bruts de l'image.
      if (url.pathname === '/api/admin/media' && req.method === 'POST') {
        const charge = verifierJeton(jetonDepuisEntete(req))
        if (!charge || charge.role !== 'admin')
          return envoyerJson(res, 401, { erreur: 'Non autorisé.' })

        const contentType = req.headers['content-type'] ?? ''
        if (!typeAccepte(contentType))
          return envoyerJson(res, 415, {
            erreur: 'Format d’image non pris en charge (JPEG, PNG, WebP…).',
          })
        const donnees = await lireCorpsBinaire(req, TAILLE_MAX_IMAGE)
        const url2 = await enregistrerImage(donnees, contentType)
        return envoyerJson(res, 201, { url: url2 })
      }

      // Lecture / écriture de la configuration complète (jeton admin requis).
      if (url.pathname === '/api/admin/config') {
        const charge = verifierJeton(jetonDepuisEntete(req))
        if (!charge || charge.role !== 'admin')
          return envoyerJson(res, 401, { erreur: 'Non autorisé.' })

        if (req.method === 'GET') {
          return envoyerJson(res, 200, configurationComplete())
        }
        if (req.method === 'PUT') {
          const nouvelle = JSON.parse(await lireCorps(req)) as Configuration
          await enregistrerConfiguration(nouvelle)
          return envoyerJson(res, 200, { ok: true })
        }
      }

      envoyerJson(res, 404, { erreur: 'Route inconnue' })
    } catch (e) {
      envoyerJson(res, 500, { erreur: (e as Error).message })
    }
  })

  serveur.listen(PORT, () => {
    console.log(`Portail voyageurs — API démarrée sur http://localhost:${PORT}`)
  })
}

demarrer()
