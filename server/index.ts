import { createServer } from 'node:http'
import { join } from 'node:path'
import type {
  AvisEcole,
  PrixFormation,
  RequeteAvis,
  RequetePrix,
  RequeteTemoignage,
  StatutTemoignage,
} from './types'
import { CacheDisque } from './cache'
import { obtenirPrix } from './service'
import { obtenirAvis } from './avis'
import {
  DepotTemoignages,
  soumettreTemoignage,
  synthese,
  listerTous,
} from './temoignages'
import {
  obtenirConseil,
  type FormationResume,
  type ProfilResume,
} from './conseiller'
import {
  analyserBulletin,
  BulletinNonConfigure,
  type MediaType,
} from './bulletin'

/**
 * Serveur HTTP minimal (sans dépendance) exposant l'API de prix.
 *
 *   GET  /api/sante                     → { ok: true }
 *   GET  /api/prix?etablissement=&statut=&fili=&formation=
 *                                        → PrixFormation
 *   POST /api/prix   body: RequetePrix[] → PrixFormation[]  (lot)
 *   GET  /api/avis?etablissement=&ville= → AvisEcole  (note Google ⭐)
 *   POST /api/avis   body: RequeteAvis[] → AvisEcole[]  (lot)
 *   GET  /api/temoignages?etablissement= → SyntheseTemoignages (avis étudiants)
 *   POST /api/temoignages body: RequeteTemoignage → soumission modérée
 *   GET/POST /api/temoignages/moderation → modération (jeton MODERATION_TOKEN)
 *
 * Le scraping des sites d'écoles et l'appel à l'API Google Places se font ici,
 * côté serveur (le navigateur en est empêché par CORS). Cache 30 jours.
 */

const PORT = Number(process.env.PORT ?? 8787)
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30 // 30 jours
const cache = new CacheDisque<PrixFormation>(
  join(process.cwd(), '.cache', 'prix.json'),
  CACHE_TTL,
)
const cacheAvis = new CacheDisque<AvisEcole>(
  join(process.cwd(), '.cache', 'avis.json'),
  CACHE_TTL,
)
const depotTemoignages = new DepotTemoignages(
  join(process.cwd(), '.data', 'temoignages.json'),
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

const TAILLE_MAX_CORPS = 12 * 1024 * 1024 // 12 Mo (bulletins encodés en base64)

async function lireCorps(req: import('node:http').IncomingMessage): Promise<string> {
  const morceaux: Buffer[] = []
  let total = 0
  for await (const c of req) {
    total += (c as Buffer).length
    if (total > TAILLE_MAX_CORPS) throw new Error('Corps de requête trop volumineux')
    morceaux.push(c as Buffer)
  }
  return Buffer.concat(morceaux).toString('utf8')
}

async function demarrer(): Promise<void> {
  await cache.initialiser()
  await cacheAvis.initialiser()
  await depotTemoignages.charger()

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

      if (url.pathname === '/api/avis' && req.method === 'GET') {
        const etablissement = url.searchParams.get('etablissement') ?? ''
        if (!etablissement)
          return envoyerJson(res, 400, { erreur: 'etablissement requis' })
        const avis = await obtenirAvis(
          {
            etablissement,
            ville: url.searchParams.get('ville') ?? undefined,
          },
          { cache: cacheAvis },
        )
        return envoyerJson(res, 200, avis)
      }

      if (url.pathname === '/api/avis' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const liste = JSON.parse(corps) as RequeteAvis[]
        if (!Array.isArray(liste))
          return envoyerJson(res, 400, { erreur: 'tableau attendu' })
        const resultats = await Promise.all(
          liste.slice(0, 50).map((r) => obtenirAvis(r, { cache: cacheAvis })),
        )
        return envoyerJson(res, 200, resultats)
      }

      if (url.pathname === '/api/temoignages' && req.method === 'GET') {
        const etablissement = url.searchParams.get('etablissement') ?? ''
        if (!etablissement)
          return envoyerJson(res, 400, { erreur: 'etablissement requis' })
        return envoyerJson(res, 200, await synthese(etablissement, depotTemoignages))
      }

      if (url.pathname === '/api/temoignages' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const req2 = JSON.parse(corps) as RequeteTemoignage
        const resultat = await soumettreTemoignage(req2, { depot: depotTemoignages })
        // 201 si publié/en attente, 422 si refusé par la modération.
        return envoyerJson(res, resultat.ok ? 201 : 422, resultat)
      }

      // Modération (privé) : lister / changer le statut. Protégé par un jeton.
      if (url.pathname === '/api/temoignages/moderation') {
        const jeton = process.env.MODERATION_TOKEN
        const fourni = req.headers['x-moderation-token']
        if (!jeton || fourni !== jeton)
          return envoyerJson(res, 401, { erreur: 'non autorisé' })

        if (req.method === 'GET') {
          const statut = (url.searchParams.get('statut') ?? undefined) as
            | StatutTemoignage
            | undefined
          return envoyerJson(res, 200, await listerTous(depotTemoignages, statut))
        }
        if (req.method === 'POST') {
          const corps = await lireCorps(req)
          const { id, statut } = JSON.parse(corps) as {
            id: string
            statut: StatutTemoignage
          }
          if (!id || !statut)
            return envoyerJson(res, 400, { erreur: 'id et statut requis' })
          const ok = await depotTemoignages.majStatut(id, statut)
          return envoyerJson(res, ok ? 200 : 404, { ok })
        }
      }

      if (url.pathname === '/api/bulletin' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const { fichier, mediaType } = JSON.parse(corps) as {
          fichier: string
          mediaType: MediaType
        }
        if (!fichier || !mediaType)
          return envoyerJson(res, 400, { erreur: 'fichier et mediaType requis' })
        try {
          const analyse = await analyserBulletin(fichier, mediaType)
          return envoyerJson(res, 200, analyse)
        } catch (e) {
          if (e instanceof BulletinNonConfigure)
            return envoyerJson(res, 503, {
              erreur: e.message,
              configRequise: true,
            })
          throw e
        }
      }

      if (url.pathname === '/api/conseil' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const { profil, formations } = JSON.parse(corps) as {
          profil: ProfilResume
          formations: FormationResume[]
        }
        if (!profil || !Array.isArray(formations))
          return envoyerJson(res, 400, { erreur: 'profil et formations requis' })
        const conseil = await obtenirConseil(profil, formations.slice(0, 12))
        return envoyerJson(res, 200, conseil)
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
