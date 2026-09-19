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
import { obtenirQuestions } from './questions'
import {
  AideLogementIndisponibleErreur,
  calculerAidesLogement,
  type DemandeAideLogement,
} from './aideLogement'
import { extraireBulletin } from './bulletinScolaire'
import { chercherAvisLieux, type DemandeAvisLieu } from './avisLieu'
import { GardeAdmin } from './admin'
import { etatSysteme } from './etatSysteme'
import { Coffre, CoffreNonConfigure, estSecretGere } from './secrets'
import {
  DepotRetours,
  RetourEnDouble,
  RetourInvalide,
  millesimeCourant,
  type RequeteRetour,
} from './retours'
import {
  analyserBulletin,
  BulletinNonConfigure,
  type MediaType,
} from './bulletin'
import {
  ComptesNonConfigures,
  DepotComptes,
  EmailDejaInscrit,
  IdentifiantsRefuses,
  InscriptionInvalide,
  TropDEssais,
  jetonDeLEnTete,
} from './comptes.ts'

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
 *   POST /api/aide-logement body: DemandeAideLogement[] → aide au logement
 *                                        calculée par OpenFisca (KITETUDIANT)
 *   POST /api/bulletin-scolaire body: { fichier, mediaType }
 *                                        → notes + signaux seuls (KITETUDIANT)
 *   POST /api/retours body: RequeteRetour → dépose un retour d'étudiant
 *   GET  /api/retours?formation=         → archive année par année
 *   POST /api/retours/agregats body: string[] → agrégats de l'année en cours
 *   POST /api/avis-lieu body: DemandeAvisLieu[] → note publique du LIEU
 *                                        (jamais un critère de décision)
 *   POST /api/comptes/inscription body: {email, motDePasse} → {jeton, expireLe}
 *   POST /api/comptes/connexion   body: {email, motDePasse} → {jeton, expireLe}
 *   POST /api/comptes/deconnexion (en-tête Bearer)          → ferme la session
 *   GET  /api/comptes/moi         (en-tête Bearer)          → {connecte}
 *
 * Administration (HTTPS + jeton ADMIN_TOKEN, voir admin.ts) :
 *   GET    /api/admin/etat               → clés, barèmes, millésimes
 *   PUT    /api/admin/cles  body {nom, valeur} → enregistre une clé
 *   DELETE /api/admin/cles?nom=          → oublie une clé
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
// KITETUDIANT — un fichier par année universitaire, les années passées ne sont
// jamais réécrites.
const depotRetours = new DepotRetours(join(process.cwd(), '.data', 'retours'))
const coffre = new Coffre(join(process.cwd(), '.data', 'secrets.json'))
// KITETUDIANT — comptes élèves. Sans COMPTES_MASTER_KEY, le dépôt se déclare
// non configuré : l'inscription est alors impossible ET le détail du résultat
// reste ouvert, plutôt que de rendre le site inutilisable par omission. L'état
// est visible dans la console d'administration.
const depotComptes = new DepotComptes(
  join(process.cwd(), '.data', 'comptes.json'),
  process.env.COMPTES_MASTER_KEY,
)
const gardeAdmin = new GardeAdmin()



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

      if (url.pathname === '/api/questions' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const { profil, formations } = JSON.parse(corps) as {
          profil: ProfilResume
          formations: FormationResume[]
        }
        if (!profil || !Array.isArray(formations))
          return envoyerJson(res, 400, { erreur: 'profil et formations requis' })
        const questions = await obtenirQuestions(profil, formations.slice(0, 12))
        return envoyerJson(res, 200, questions)
      }

      // KITETUDIANT — aide au logement calculée par OpenFisca, côté serveur.
      // Le navigateur de l'élève ne parle pas à OpenFisca : seuls des
      // paramètres anonymes (commune, loyer, année de naissance) sortent d'ici.
      if (url.pathname === '/api/aide-logement' && req.method === 'POST') {
        // Le verrou d'inscription est ICI, et pas dans l'affichage.
        //
        // Le reste-à-vivre se calcule dans le navigateur, mais à partir de
        // l'aide au logement que seul ce serveur sait obtenir d'OpenFisca.
        // Fermer la porte à cet endroit rend le détail réellement inaccessible
        // sans compte : masquer un chiffre déjà envoyé au navigateur n'aurait
        // protégé personne. L'aperçu — formation, établissement, ville, taux
        // d'accès publié — reste libre : il ne passe pas par ici.
        if (depotComptes.configure) {
          const jeton = jetonDeLEnTete(req.headers.authorization)
          if (!(await depotComptes.sessionValide(jeton))) {
            return envoyerJson(res, 401, {
              erreur: 'Crée ton compte pour voir ce qu’il te restera pour vivre.',
              inscriptionRequise: true,
            })
          }
        }
        const corps = await lireCorps(req)
        const demandes = JSON.parse(corps) as DemandeAideLogement[]
        if (!Array.isArray(demandes))
          return envoyerJson(res, 400, { erreur: 'un tableau de demandes est attendu' })
        if (demandes.length > 120)
          return envoyerJson(res, 400, { erreur: 'au plus 120 demandes par appel' })
        try {
          const aides = await calculerAidesLogement(demandes)
          return envoyerJson(res, 200, aides)
        } catch (e) {
          if (e instanceof AideLogementIndisponibleErreur) {
            // 503 et non 500 : le service est indisponible, la demande est
            // valide. Le front doit afficher « donnée manquante », pas une
            // aide approchée.
            return envoyerJson(res, 503, { erreur: e.message })
          }
          throw e
        }
      }

      // KITETUDIANT — lecture de bulletin réduite aux notes et aux signaux.
      // Le texte des appréciations ne ressort pas d'ici (règle 3 de CLAUDE.md).
      if (url.pathname === '/api/bulletin-scolaire' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const { fichier, mediaType } = JSON.parse(corps) as {
          fichier: string
          mediaType: MediaType
        }
        if (!fichier || !mediaType)
          return envoyerJson(res, 400, { erreur: 'fichier et mediaType requis' })
        try {
          return envoyerJson(res, 200, await extraireBulletin(fichier, mediaType))
        } catch (e) {
          if (e instanceof BulletinNonConfigure)
            return envoyerJson(res, 503, { erreur: e.message })
          throw e
        }
      }

      // KITETUDIANT — retours d'étudiants, trois axes chiffrés, archivés par
      // année universitaire. Aucun texte libre, aucune note d'établissement.
      if (url.pathname === '/api/retours' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const requete = JSON.parse(corps) as RequeteRetour
        try {
          const retour = await depotRetours.ajouter(requete)
          return envoyerJson(res, 201, retour)
        } catch (e) {
          if (e instanceof RetourInvalide) return envoyerJson(res, 400, { erreur: e.message })
          if (e instanceof RetourEnDouble) return envoyerJson(res, 409, { erreur: e.message })
          throw e
        }
      }

      if (url.pathname === '/api/retours' && req.method === 'GET') {
        const formation = url.searchParams.get('formation')
        if (!formation) return envoyerJson(res, 400, { erreur: 'formation requise' })
        return envoyerJson(res, 200, {
          millesimeCourant: millesimeCourant(),
          archives: await depotRetours.archiveDe(formation),
        })
      }

      if (url.pathname === '/api/retours/agregats' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const formations = JSON.parse(corps) as string[]
        if (!Array.isArray(formations))
          return envoyerJson(res, 400, { erreur: 'un tableau de formations est attendu' })
        if (formations.length > 200)
          return envoyerJson(res, 400, { erreur: 'au plus 200 formations par appel' })
        return envoyerJson(res, 200, await depotRetours.agregatsCourants(formations))
      }

      // KITETUDIANT — note publique du lieu. Affichée dans le détail d'une
      // fiche, attribuée à Google, jamais dans un tri ni dans un score.
      // KITETUDIANT — comptes élèves. Aucune donnée scolaire ne transite ici :
      // seulement une adresse et un mot de passe (voir comptes.ts).
      if (url.pathname.startsWith('/api/comptes/')) {
        if (!depotComptes.configure && url.pathname !== '/api/comptes/moi') {
          return envoyerJson(res, 503, { erreur: new ComptesNonConfigures().message })
        }
        try {
          if (url.pathname === '/api/comptes/inscription' && req.method === 'POST') {
            const { email, motDePasse } = JSON.parse(await lireCorps(req)) as {
              email?: string
              motDePasse?: string
            }
            const session = await depotComptes.inscrire(email ?? '', motDePasse ?? '')
            return envoyerJson(res, 201, session)
          }
          if (url.pathname === '/api/comptes/connexion' && req.method === 'POST') {
            const { email, motDePasse } = JSON.parse(await lireCorps(req)) as {
              email?: string
              motDePasse?: string
            }
            const session = await depotComptes.connecter(email ?? '', motDePasse ?? '')
            return envoyerJson(res, 200, session)
          }
          if (url.pathname === '/api/comptes/deconnexion' && req.method === 'POST') {
            await depotComptes.deconnecter(jetonDeLEnTete(req.headers.authorization))
            return envoyerJson(res, 200, { deconnecte: true })
          }
          if (url.pathname === '/api/comptes/moi' && req.method === 'GET') {
            const connecte = await depotComptes.sessionValide(
              jetonDeLEnTete(req.headers.authorization),
            )
            return envoyerJson(res, 200, { connecte, comptesActifs: depotComptes.configure })
          }
        } catch (e) {
          if (e instanceof InscriptionInvalide) return envoyerJson(res, 400, { erreur: e.message })
          if (e instanceof EmailDejaInscrit) return envoyerJson(res, 409, { erreur: e.message })
          if (e instanceof IdentifiantsRefuses) return envoyerJson(res, 401, { erreur: e.message })
          if (e instanceof TropDEssais) return envoyerJson(res, 429, { erreur: e.message })
          if (e instanceof ComptesNonConfigures) return envoyerJson(res, 503, { erreur: e.message })
          throw e
        }
        return envoyerJson(res, 404, { erreur: 'route inconnue' })
      }

      if (url.pathname === '/api/avis-lieu' && req.method === 'POST') {
        const corps = await lireCorps(req)
        const demandes = JSON.parse(corps) as DemandeAvisLieu[]
        if (!Array.isArray(demandes))
          return envoyerJson(res, 400, { erreur: 'un tableau de demandes est attendu' })
        if (demandes.length > 20)
          return envoyerJson(res, 400, { erreur: 'au plus 20 lieux par appel' })
        return envoyerJson(res, 200, await chercherAvisLieux(demandes))
      }

      // ------------------------------------------------------ administration
      if (url.pathname.startsWith('/api/admin/')) {
        const refus = gardeAdmin.verifier(req)
        if (refus) return envoyerJson(res, refus.code, refus)

        if (url.pathname === '/api/admin/etat' && req.method === 'GET') {
          return envoyerJson(res, 200, await etatSysteme(coffre, depotRetours, depotComptes))
        }

        if (url.pathname === '/api/admin/cles' && req.method === 'PUT') {
          const corps = await lireCorps(req)
          const { nom, valeur } = JSON.parse(corps) as { nom: string; valeur: string }
          if (!estSecretGere(nom))
            return envoyerJson(res, 400, { erreur: `Clé « ${nom} » non gérée par la console.` })
          try {
            const etat = await coffre.enregistrer(nom, valeur)
            await coffre.hydraterEnvironnement()
            return envoyerJson(res, 200, etat)
          } catch (e) {
            if (e instanceof CoffreNonConfigure)
              return envoyerJson(res, 503, { erreur: e.message })
            return envoyerJson(res, 400, { erreur: (e as Error).message })
          }
        }

        if (url.pathname === '/api/admin/cles' && req.method === 'DELETE') {
          const nom = url.searchParams.get('nom') ?? ''
          if (!estSecretGere(nom))
            return envoyerJson(res, 400, { erreur: `Clé « ${nom} » non gérée par la console.` })
          await coffre.oublier(nom)
          // La valeur recopiée dans l'environnement doit partir aussi.
          coffre.deshydrater(nom)
          return envoyerJson(res, 200, { ok: true })
        }

        return envoyerJson(res, 404, { erreur: 'route d’administration inconnue' })
      }

      envoyerJson(res, 404, { erreur: 'route inconnue' })
    } catch (e) {
      envoyerJson(res, 500, { erreur: (e as Error).message })
    }
  })

  void coffre.hydraterEnvironnement()
  serveur.listen(PORT, () => {
    console.log(`API prix démarrée sur http://localhost:${PORT}`)
  })
}

demarrer()
