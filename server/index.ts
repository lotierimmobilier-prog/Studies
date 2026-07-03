import { createServer } from 'node:http'
import { join } from 'node:path'
import type { PrixFormation, RequetePrix } from './types'
import { CacheDisque } from './cache'
import { obtenirPrix } from './service'

/**
 * Serveur HTTP minimal (sans dépendance) exposant l'API de prix.
 *
 *   GET  /api/sante                     → { ok: true }
 *   GET  /api/prix?etablissement=&statut=&fili=&formation=
 *                                        → PrixFormation
 *   POST /api/prix   body: RequetePrix[] → PrixFormation[]  (lot)
 *
 * Le scraping des sites d'écoles se fait ici, côté serveur (le navigateur en est
 * empêché par CORS). Les résultats sont mis en cache 30 jours.
 */

const PORT = Number(process.env.PORT ?? 8787)
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30 // 30 jours
const cache = new CacheDisque<PrixFormation>(
  join(process.cwd(), '.cache', 'prix.json'),
  CACHE_TTL,
)

function cors(res: import('node:http').ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function envoyerJson(
  res: import('node:http').ServerResponse,
  code: number,
  data: unknown,
): void {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function lireCorps(req: import('node:http').IncomingMessage): Promise<string> {
  const morceaux: Buffer[] = []
  for await (const c of req) morceaux.push(c as Buffer)
  return Buffer.concat(morceaux).toString('utf8')
}

async function demarrer(): Promise<void> {
  await cache.initialiser()

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

      if (url.pathname === '/api/prix' && req.method === 'GET') {
        const etablissement = url.searchParams.get('etablissement') ?? ''
        if (!etablissement)
          return envoyerJson(res, 400, { erreur: 'etablissement requis' })
        const prix = await obtenirPrix(
          {
            etablissement,
            statut: url.searchParams.get('statut') ?? undefined,
            fili: url.searchParams.get('fili') ?? undefined,
            formation: url.searchParams.get('formation') ?? undefined,
          },
          { cache },
        )
        return envoyerJson(res, 200, prix)
      }

      if (url.pathname === '/api/prix' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const liste = JSON.parse(corps) as RequetePrix[]
        if (!Array.isArray(liste))
          return envoyerJson(res, 400, { erreur: 'tableau attendu' })
        const resultats = await Promise.all(
          liste.slice(0, 50).map((r) => obtenirPrix(r, { cache })),
        )
        return envoyerJson(res, 200, resultats)
      }

      envoyerJson(res, 404, { erreur: 'route inconnue' })
    } catch (e) {
      envoyerJson(res, 500, { erreur: (e as Error).message })
    }
  })

  serveur.listen(PORT, () => {
    console.log(`API prix démarrée sur http://localhost:${PORT}`)
  })
}

demarrer()
