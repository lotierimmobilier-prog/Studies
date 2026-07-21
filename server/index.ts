import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { creerJeton, verifierJeton } from './auth'
import {
  chargerConfiguration,
  maison,
  sansMotDePasse,
  sejourParLogin,
  verifierIdentifiants,
} from './sejours'
import type { ReponseConnexion } from './types'

/**
 * Serveur HTTP minimal (sans dépendance) pour le portail voyageurs.
 *
 *   GET  /api/sante         → { ok: true }
 *   POST /api/connexion     body { login, motDePasse } → { jeton, sejour, maison }
 *   GET  /api/sejour        header Authorization: Bearer <jeton>
 *                            → { sejour, maison }  (restaure une session)
 *
 * Les informations sensibles de la maison (codes, Wi-Fi, adresse) ne sont
 * renvoyées qu'après authentification.
 */

const PORT = Number(process.env.PORT ?? 8788)

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function envoyerJson(res: ServerResponse, code: number, data: unknown): void {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

const TAILLE_MAX_CORPS = 64 * 1024

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

      // Connexion : vérifie login/mot de passe et renvoie un jeton + les infos.
      if (url.pathname === '/api/connexion' && req.method === 'POST') {
        const { login, motDePasse } = JSON.parse(await lireCorps(req)) as {
          login?: string
          motDePasse?: string
        }
        if (!login || !motDePasse)
          return envoyerJson(res, 400, {
            erreur: 'Login et mot de passe requis.',
          })

        const sejour = verifierIdentifiants(login, motDePasse)
        if (!sejour)
          return envoyerJson(res, 401, {
            erreur: 'Identifiant ou mot de passe incorrect.',
          })

        const reponse: ReponseConnexion = {
          jeton: creerJeton(sejour.login),
          sejour: sansMotDePasse(sejour),
          maison: maison(),
        }
        return envoyerJson(res, 200, reponse)
      }

      // Restaure une session à partir d'un jeton (au rechargement de la page).
      if (url.pathname === '/api/sejour' && req.method === 'GET') {
        const login = verifierJeton(jetonDepuisEntete(req))
        if (!login)
          return envoyerJson(res, 401, { erreur: 'Session expirée.' })

        const sejour = sejourParLogin(login)
        if (!sejour)
          return envoyerJson(res, 401, { erreur: 'Séjour introuvable.' })

        return envoyerJson(res, 200, {
          sejour: sansMotDePasse(sejour),
          maison: maison(),
        })
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
