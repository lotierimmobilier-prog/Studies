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
import { GardeAdmin, estAdministrateur } from './admin'
import { etatSysteme } from './etatSysteme'
import { Coffre, CoffreNonConfigure, estSecretGere } from './secrets'
import { ArticleIntrouvable, ArticleInvalide, DepotArticles } from './articles'
import { emailDepuisCode, GoogleRefuse, reglagesGoogle, urlDeDepart } from './googleIdentite.ts'
import { avecParametre, etatsGoogle, retourSur, ticketsGoogle } from './googleSessions.ts'
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
import { DepotReleves } from './releves.ts'
import { bd, configuree as baseConfiguree, panneDeConnexion } from './bd.ts'
import {
  ClientEmploi,
  EmploiNonConfigure,
  SOURCE_EMPLOI,
  lienOffres,
  somme,
} from './emploi.ts'
import { metiersDuTheme, themeMetiers } from '../kitetudiant/packages/metiers/src/index.ts'
import {
  BaseIndisponible,
  FormationInconnue,
  ListeComplete,
  ajouter as ajouterVoeu,
  compteDeSession,
  deplacer as deplacerVoeu,
  lire as lireVoeux,
  retirer as retirerVoeu,
  signaler as signalerVoeu,
} from './voeux.ts'
import {
  ReleveInvalide,
  relevesEnCsv,
} from '../kitetudiant/packages/statistiques/src/index.ts'

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
 *   POST   /api/admin/emploi/essai       → éprouve la connexion France Travail
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
// KITETUDIANT — relevés ANONYMES d'usage. Aucun identifiant, aucune note
// exacte, aucune adresse IP : voir kitetudiant/packages/statistiques.
const depotReleves = new DepotReleves(join(process.cwd(), '.data', 'releves'))
const coffre = new Coffre(join(process.cwd(), '.data', 'secrets.json'))
const clientEmploi = new ClientEmploi(coffre)

/**
 * Le code INSEE de région d'une commune, ou `null`.
 *
 * Lu dans la table de référence quand la base est là. Sans base, on rend
 * `null` et l'écran n'affiche que le compte national : une échelle annoncée
 * vaut mieux qu'une seconde devinée.
 */
/**
 * Spécialités comptées au plus pour un établissement.
 *
 * Cinq, et pas seize : chaque domaine ROME coûte un appel par échelle, le
 * quota est de dix par seconde, et les seize thèmes couvrent quarante-sept
 * domaines. Compter tout ferait attendre près de dix secondes pour une page
 * qui, de toute façon, ne se lit pas au-delà de quelques lignes.
 *
 * Cinq tient en trois secondes au premier chargement, et en rien du tout
 * ensuite — le cache de six heures est partagé entre toutes les écoles.
 */
const THEMES_MAX = 5

/**
 * Rayon de recherche des annonces, en kilomètres.
 *
 * Trente : la distance qu'on accepte de faire tous les jours pour aller
 * travailler, et celle qui fait d'une annonce un débouché plausible plutôt
 * qu'une curiosité. Fixé ici plutôt que laissé au navigateur — chaque valeur
 * distincte est une entrée de cache de plus, et personne n'a besoin de
 * régler ce rayon au kilomètre près.
 */
const DISTANCE_OFFRES_KM = 30

/** Annonces rendues. Six remplit une grille de deux ou trois colonnes. */
const OFFRES_MAX = 6

/**
 * Ce qu'on dit à l'élève quand la base ne répond pas.
 *
 * Jamais le message du pilote : « getaddrinfo ENOTFOUND … » ne veut rien dire
 * pour un lycéen, porte le nom de l'hôte que nous avons configuré, et se lit
 * comme une panne de SON côté. Le vrai motif part dans le journal du serveur,
 * où l'exploitant le lira — et la console d'administration le nomme déjà.
 */
const BASE_EN_PANNE = 'L’enregistrement des vœux est momentanément indisponible. Réessaie dans un moment.'

async function regionDe(codeInsee: string): Promise<string | null> {
  const sql = bd()
  if (sql === null || !/^[0-9AB]{5}$/i.test(codeInsee)) return null
  try {
    const [ligne] = await sql<{ code_region: string | null }[]>`
      select code_region from reference.commune
       where code_insee = ${codeInsee.toUpperCase()}
       order by millesime desc
       limit 1
    `
    return ligne?.code_region ?? null
  } catch {
    return null
  }
}
const depotArticles = new DepotArticles(join(process.cwd(), '.data', 'articles.json'))
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

      // KITETUDIANT — dépôt d'un relevé ANONYME, après une simulation.
      //
      // Publique et sans jeton, à dessein : exiger une session rattacherait
      // le relevé à un compte, et il cesserait d'être anonyme. Le corps est
      // reconstruit champ par champ à partir des seules valeurs permises
      // (voir le paquet statistiques), donc rien d'autre ne peut entrer.
      if (url.pathname === '/api/releves' && req.method === 'POST') {
        try {
          const corps = await lireCorps(req)
          if (corps.length > 8_000) {
            return envoyerJson(res, 413, { erreur: 'Relevé trop volumineux.' })
          }
          await depotReleves.deposer(JSON.parse(corps))
          return envoyerJson(res, 204, {})
        } catch (e) {
          if (e instanceof ReleveInvalide) return envoyerJson(res, 400, { erreur: e.message })
          // Un relevé qui échoue ne doit JAMAIS gêner l'élève : c'est une
          // mesure d'usage, pas une étape de son parcours.
          return envoyerJson(res, 204, {})
        }
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
      // KITETUDIANT — les offres d'emploi par métier.
      //
      // Le navigateur n'appelle JAMAIS France Travail : il appelle ce
      // serveur, qui appelle France Travail. Sans cela, la clé secrète
      // serait dans le paquet JavaScript, donc publique.
      if (url.pathname === '/api/emploi' && req.method === 'GET') {
        const theme = url.searchParams.get('theme') ?? ''
        const infos = themeMetiers(theme)
        if (infos === null) {
          return envoyerJson(res, 400, { erreur: 'Thème inconnu.' })
        }
        if (!(await clientEmploi.configure())) {
          return envoyerJson(res, 503, { erreur: new EmploiNonConfigure().message })
        }
        try {
          // La région se déduit de la commune de la formation, via la table
          // de référence. Sans base, on compte la France entière et l'écran
          // le dit : mieux vaut une seule échelle annoncée qu'une seconde
          // devinée.
          const insee = url.searchParams.get('insee')
          const region = insee === null ? null : await regionDe(insee)
          /* Le chiffre de tête vient des DOMAINES, pas de la somme des
             métiers affichés : huit métiers sur quatre-vingt-seize ne font
             pas un secteur, et additionner ceux qu'on montre donnerait un
             total faux, plus petit que la réalité. */
          const totaux = await clientEmploi.totaux(infos.domaines, region)
          const metiers = metiersDuTheme(theme, await clientEmploi.metiers())
          return envoyerJson(res, 200, {
            theme: infos.cle,
            note: infos.note,
            region,
            source: SOURCE_EMPLOI,
            releveLe: new Date().toISOString().slice(0, 10),
            total: {
              enFrance: somme(totaux.map((t) => t.enFrance)),
              enRegion: region === null ? null : somme(totaux.map((t) => t.enRegion)),
            },
            metiers: (await clientEmploi.comptages(metiers, region)).map((c) => ({
              ...c,
              lien: lienOffres(c.libelle, region),
            })),
          })
        } catch (e) {
          if (e instanceof EmploiNonConfigure) {
            return envoyerJson(res, 503, { erreur: e.message })
          }
          return envoyerJson(res, 502, {
            erreur: 'France Travail n’a pas répondu. Réessaie dans un moment.',
          })
        }
      }

      /* KITETUDIANT — les annonces elles-mêmes, près d'un lieu.
         
         D15 disait « le compteur, pas les annonces », parce qu'une offre est
         pourvue en quelques jours. Le motif reste vrai et dicte la forme :
         cache d'une heure au lieu de six, date de mise à jour sur chaque
         carte, et lien vers l'annonce d'origine — c'est là qu'on voit qu'un
         poste est pris.
         
         `commune` peut venir de l'école affichée OU de la commune que
         l'élève a saisie dans son parcours. Dans le second cas elle traverse
         ce serveur sans y être écrite : ni journal, ni base. Le seul usage
         qui en est fait est le paramètre passé à France Travail. */
      if (url.pathname === '/api/emploi/offres' && req.method === 'GET') {
        const infos = themeMetiers(url.searchParams.get('theme') ?? '')
        if (infos === null || infos.domaines.length === 0) {
          return envoyerJson(res, 400, { erreur: 'Thème inconnu.' })
        }
        // Validée avant tout : un code INSEE est cinq caractères, et la Corse
        // en met deux de lettres (2A, 2B). Tout le reste est refusé plutôt
        // que transmis tel quel à France Travail.
        const brute = url.searchParams.get('commune')
        const commune = brute !== null && /^[0-9]{2}[0-9AB][0-9]{2}$/i.test(brute)
          ? brute.toUpperCase()
          : null
        if (!(await clientEmploi.configure())) {
          return envoyerJson(res, 503, { erreur: new EmploiNonConfigure().message })
        }
        try {
          const offres = await clientEmploi.offres(
            infos.domaines,
            commune,
            DISTANCE_OFFRES_KM,
            OFFRES_MAX,
          )
          return envoyerJson(res, 200, {
            theme: infos.cle,
            // Ce qu'on a VRAIMENT interrogé : l'écran doit pouvoir dire
            // « autour de l'école » ou « partout en France », sans le
            // deviner d'après ce qu'il avait demandé.
            autour: commune,
            distanceKm: commune === null ? null : DISTANCE_OFFRES_KM,
            source: SOURCE_EMPLOI,
            releveLe: new Date().toISOString(),
            offres,
          })
        } catch (e) {
          if (e instanceof EmploiNonConfigure) {
            return envoyerJson(res, 503, { erreur: e.message })
          }
          return envoyerJson(res, 502, {
            erreur: 'France Travail n’a pas répondu. Réessaie dans un moment.',
          })
        }
      }

      /* KITETUDIANT — les débouchés d'un établissement, spécialité par
         spécialité.
         
         Distinct de /api/emploi, qui traite UN thème et échantillonne ses
         métiers. Ici on ne rend que le total par spécialité : une école en
         couvre plusieurs, et lui demander l'échantillon de chacune coûterait
         une seconde par spécialité.
         
         ── Le plafond, et pourquoi il existe ──────────────────────────────
         
         Chaque domaine ROME coûte un appel par échelle, et le quota est de
         dix par seconde. Une grande université touche les seize thèmes,
         soit quarante-sept domaines : près de dix secondes d'attente pour
         une page. On en garde donc au plus THEMES_MAX, et l'écran dit qu'il
         y en a d'autres — plutôt que de faire patienter, ou de laisser
         croire que l'école ne fait que ça.
         
         Le cache de six heures fait le reste : les domaines partagés entre
         spécialités ne sont comptés qu'une fois, et le deuxième visiteur
         n'attend pas. */
      if (url.pathname === '/api/emploi/etablissement' && req.method === 'GET') {
        const demandes = (url.searchParams.get('themes') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
        // Les thèmes arrivent du navigateur : on ne garde que ceux de la
        // table, et on les dédoublonne. Un thème inconnu n'est pas une
        // erreur — il est ignoré, comme une formation sans correspondance.
        const connus = [...new Set(demandes)]
          .map((cle) => themeMetiers(cle))
          .filter((t): t is NonNullable<typeof t> => t !== null)
          .filter((t) => t.domaines.length > 0)
        if (connus.length === 0) {
          return envoyerJson(res, 400, { erreur: 'Aucune spécialité reconnue.' })
        }
        if (!(await clientEmploi.configure())) {
          return envoyerJson(res, 503, { erreur: new EmploiNonConfigure().message })
        }
        try {
          const insee = url.searchParams.get('insee')
          const region = insee === null ? null : await regionDe(insee)
          const retenus = connus.slice(0, THEMES_MAX)
          const specialites = []
          for (const theme of retenus) {
            const totaux = await clientEmploi.totaux(theme.domaines, region)
            specialites.push({
              cle: theme.cle,
              note: theme.note,
              enFrance: somme(totaux.map((t) => t.enFrance)),
              enRegion: region === null ? null : somme(totaux.map((t) => t.enRegion)),
            })
          }
          return envoyerJson(res, 200, {
            region,
            source: SOURCE_EMPLOI,
            releveLe: new Date().toISOString().slice(0, 10),
            // Le nombre DEMANDÉ, pour que l'écran puisse dire « et trois
            // autres » sans recompter lui-même ce qu'il a envoyé.
            demandees: connus.length,
            specialites,
          })
        } catch (e) {
          if (e instanceof EmploiNonConfigure) {
            return envoyerJson(res, 503, { erreur: e.message })
          }
          return envoyerJson(res, 502, {
            erreur: 'France Travail n’a pas répondu. Réessaie dans un moment.',
          })
        }
      }

      // KITETUDIANT — les vœux.
      //
      // Tout passe par un seul chemin, avec la méthode pour verbe : une
      // liste de dix éléments n'a pas besoin de cinq routes, et une seule
      // permet de renvoyer la liste À JOUR après chaque modification.
      // L'écran n'a donc jamais à deviner ce que le serveur a fait.
      if (url.pathname === '/api/voeux') {
        const jeton = jetonDeLEnTete(req.headers.authorization)
        let compte: string | null
        try {
          compte = await compteDeSession(depotComptes, jeton)
        } catch (e) {
          if (e instanceof BaseIndisponible) {
            return envoyerJson(res, 503, { erreur: e.message })
          }
          if (panneDeConnexion(e)) {
            console.error('Base injoignable (session) :', (e as { code?: string }).code)
            return envoyerJson(res, 503, { erreur: BASE_EN_PANNE })
          }
          throw e
        }
        if (compte === null) {
          // Deux causes possibles, et l'écran doit pouvoir les
          // distinguer : une session finie se répare en se reconnectant,
          // une base absente ne se répare pas par l'élève.
          if (!baseConfiguree()) {
            return envoyerJson(res, 503, {
              erreur:
                'L’enregistrement des vœux n’est pas encore activé sur ce serveur.',
            })
          }
          return envoyerJson(res, 401, { erreur: 'Session expirée ou invalide.' })
        }

        try {
          if (req.method === 'GET') {
            return envoyerJson(res, 200, { voeux: await lireVoeux(compte) })
          }
          if (req.method === 'POST') {
            const { code, session } = JSON.parse(await lireCorps(req)) as {
              code?: string
              session?: number
            }
            if (!code || typeof session !== 'number') {
              return envoyerJson(res, 400, { erreur: 'Formation ou session manquante.' })
            }
            return envoyerJson(res, 200, { voeux: await ajouterVoeu(compte, code, session) })
          }
          if (req.method === 'PATCH') {
            const { rang, vers, signalement } = JSON.parse(await lireCorps(req)) as {
              rang?: number
              vers?: 'haut' | 'bas'
              signalement?: string | null
            }
            if (typeof rang !== 'number') {
              return envoyerJson(res, 400, { erreur: 'Rang manquant.' })
            }
            if (vers === 'haut' || vers === 'bas') {
              return envoyerJson(res, 200, {
                voeux: await deplacerVoeu(compte, rang, vers),
              })
            }
            if (signalement !== undefined) {
              return envoyerJson(res, 200, {
                voeux: await signalerVoeu(compte, rang, signalement),
              })
            }
            return envoyerJson(res, 400, { erreur: 'Rien à modifier.' })
          }
          if (req.method === 'DELETE') {
            const rang = Number(url.searchParams.get('rang'))
            if (!Number.isInteger(rang)) {
              return envoyerJson(res, 400, { erreur: 'Rang manquant.' })
            }
            return envoyerJson(res, 200, { voeux: await retirerVoeu(compte, rang) })
          }
        } catch (e) {
          if (e instanceof ListeComplete) {
            return envoyerJson(res, 409, { erreur: e.message })
          }
          if (e instanceof FormationInconnue) {
            return envoyerJson(res, 404, { erreur: e.message })
          }
          if (e instanceof BaseIndisponible) {
            return envoyerJson(res, 503, { erreur: e.message })
          }
          if (panneDeConnexion(e)) {
            console.error('Base injoignable (vœux) :', (e as { code?: string }).code)
            return envoyerJson(res, 503, { erreur: BASE_EN_PANNE })
          }
          throw e
        }
        return envoyerJson(res, 405, { erreur: 'Méthode non autorisée.' })
      }

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

          // ------------------------------------------- espace personnel
          // Ce que le site sait de l'élève, et rien de plus : une adresse et
          // trois dates. Pas de nom, pas d'adresse postale, pas de téléphone
          // — la règle 3 de CLAUDE.md impose la minimisation parce que les
          // titulaires sont mineurs (voir ProfilCompte dans comptes.ts).
          if (url.pathname === '/api/comptes/profil' && req.method === 'GET') {
            const profil = await depotComptes.profil(jetonDeLEnTete(req.headers.authorization))
            if (profil === null) {
              return envoyerJson(res, 401, { erreur: 'Session expirée ou invalide.' })
            }
            /* `administrateur` sert à AFFICHER le lien vers la console, pas à
               en protéger l'entrée : GardeAdmin refait la vérification à
               chaque appel de /api/admin/*. Cacher un lien ne protège rien —
               l'adresse de la console est publique. */
            return envoyerJson(res, 200, {
              ...profil,
              administrateur: estAdministrateur(profil.email),
            })
          }

          if (url.pathname === '/api/comptes/mot-de-passe' && req.method === 'POST') {
            const { ancien, nouveau } = JSON.parse(await lireCorps(req)) as {
              ancien?: string
              nouveau?: string
            }
            await depotComptes.changerMotDePasse(
              jetonDeLEnTete(req.headers.authorization),
              ancien ?? '',
              nouveau ?? '',
            )
            return envoyerJson(res, 200, { change: true })
          }

          // DELETE et non POST : l'effacement d'un compte est exactement ce
          // que ce verbe désigne, et le choisir empêche qu'un lien ou un
          // formulaire tiers le déclenche par une simple navigation.
          if (url.pathname === '/api/comptes/moi' && req.method === 'DELETE') {
            const supprime = await depotComptes.supprimerCompte(
              jetonDeLEnTete(req.headers.authorization),
            )
            if (!supprime) return envoyerJson(res, 401, { erreur: 'Session expirée ou invalide.' })
            return envoyerJson(res, 200, { supprime: true })
          }
          // ------------------------------------------------- Google
          // Aucun script de Google n'est servi au navigateur : le bouton du
          // site est un simple lien vers « /debut ». Google n'apprend donc
          // l'existence d'un élève qu'au moment où celui-ci clique, et non à
          // chaque visite (voir googleIdentite.ts).
          if (url.pathname === '/api/comptes/google/debut' && req.method === 'GET') {
            const reglages = reglagesGoogle()
            if (reglages === null) {
              return envoyerJson(res, 503, {
                erreur: 'La connexion par compte Google n’est pas configurée sur ce serveur.',
              })
            }
            // `retourSur` ferme la redirection ouverte : sans lui, un lien
            // forgé renverrait l'élève — et son ticket — chez un tiers.
            const etat = etatsGoogle.creer({ retour: retourSur(url.searchParams.get('retour')) })
            res.writeHead(302, { Location: urlDeDepart(reglages, etat) })
            return res.end()
          }

          if (url.pathname === '/api/comptes/google/retour' && req.method === 'GET') {
            const reglages = reglagesGoogle()
            if (reglages === null) return envoyerJson(res, 503, { erreur: 'Google non configuré.' })

            const depart = etatsGoogle.consommer(url.searchParams.get('state') ?? '')
            // Un retour sans état valide n'est pas le nôtre : il peut venir
            // d'un lien fabriqué par un tiers. On refuse sans rien ouvrir.
            if (depart === null) {
              return envoyerJson(res, 400, {
                erreur: 'Connexion expirée ou invalide. Recommence depuis le site.',
              })
            }
            // L'élève a pu refuser l'autorisation chez Google : ce n'est pas
            // une erreur, c'est une décision. On le ramène sans drame.
            const code = url.searchParams.get('code') ?? ''
            if (code === '') {
              res.writeHead(302, {
                Location: avecParametre(depart.retour, 'connexion', 'annulee'),
              })
              return res.end()
            }

            const email = await emailDepuisCode(reglages, code)
            const session = await depotComptes.ouvrirParFournisseur(email)
            // Le jeton ne part PAS dans l'adresse : seul un ticket à usage
            // unique, valable une minute, que l'application échange aussitôt.
            const ticket = ticketsGoogle.creer(session)
            res.writeHead(302, { Location: avecParametre(depart.retour, 'ticket', ticket) })
            return res.end()
          }

          if (url.pathname === '/api/comptes/google/session' && req.method === 'POST') {
            const { ticket } = JSON.parse(await lireCorps(req)) as { ticket?: string }
            const session = ticketsGoogle.consommer(ticket ?? '')
            if (session === null) {
              return envoyerJson(res, 400, { erreur: 'Ticket de connexion expiré ou déjà utilisé.' })
            }
            return envoyerJson(res, 200, session)
          }

          if (url.pathname === '/api/comptes/moi' && req.method === 'GET') {
            const connecte = await depotComptes.sessionValide(
              jetonDeLEnTete(req.headers.authorization),
            )
            // « google » dit à l'interface s'il faut afficher le bouton. Un
            // bouton qui mène à un mur est pire que pas de bouton du tout.
            return envoyerJson(res, 200, {
              connecte,
              comptesActifs: depotComptes.configure,
              google: reglagesGoogle() !== null,
            })
          }
        } catch (e) {
          if (e instanceof InscriptionInvalide) return envoyerJson(res, 400, { erreur: e.message })
          if (e instanceof EmailDejaInscrit) return envoyerJson(res, 409, { erreur: e.message })
          if (e instanceof IdentifiantsRefuses) return envoyerJson(res, 401, { erreur: e.message })
          if (e instanceof TropDEssais) return envoyerJson(res, 429, { erreur: e.message })
          if (e instanceof GoogleRefuse) return envoyerJson(res, 400, { erreur: e.message })
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

      // -------------------------------------------------------------- blog
      // Publique : le front fusionne ces articles avec ceux du dépôt. Aucune
      // donnée personnelle ici, rien à protéger en lecture.
      if (url.pathname === '/api/articles' && req.method === 'GET') {
        return envoyerJson(res, 200, await depotArticles.lister())
      }

      // ------------------------------------------------------ administration
      if (url.pathname.startsWith('/api/admin/')) {
        // La console accepte le jeton d'exploitation, ou la session d'un
        // compte dont l'adresse figure dans ADMIN_EMAILS.
        const refus = await gardeAdmin.verifier(req, (jeton) =>
          depotComptes.emailDeSession(jeton),
        )
        if (refus) return envoyerJson(res, refus.code, refus)

        if (url.pathname === '/api/admin/etat' && req.method === 'GET') {
          return envoyerJson(res, 200, await etatSysteme(coffre, depotRetours, depotComptes))
        }

        // Les statistiques : compteurs de comptes (sans aucune adresse) et
        // agrégats des relevés anonymes.
        if (url.pathname === '/api/admin/statistiques' && req.method === 'GET') {
          const depuis = url.searchParams.get('depuis') ?? undefined
          const jusqua = url.searchParams.get('jusqua') ?? undefined
          return envoyerJson(res, 200, {
            comptes: await depotComptes.statistiques(),
            releves: await depotReleves.agregat(depuis, jusqua),
            mois: await depotReleves.moisConnus(),
          })
        }

        // L'export. Les relevés sortent TELS QUELS parce qu'ils sont
        // anonymes : il n'y a rien à caviarder, et c'est la preuve que la
        // conception tient.
        if (url.pathname === '/api/admin/statistiques.csv' && req.method === 'GET') {
          const depuis = url.searchParams.get('depuis') ?? undefined
          const jusqua = url.searchParams.get('jusqua') ?? undefined
          const csv = relevesEnCsv(await depotReleves.lire(depuis, jusqua))
          cors(res)
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="kitetudiant-releves.csv"',
          })
          // La marque d'ordre des octets : sans elle, un tableur français
          // ouvre le fichier en latin-1 et « académie » devient « acadÃ©mie ».
          return res.end(`\uFEFF${csv}`)
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

        /* Essayer la connexion France Travail depuis la console.
        
           POST et non GET : cet appel CONSOMME du quota chez France Travail
           (un jeton, le référentiel, un comptage). Un GET serait rejoué par
           un rafraîchissement de page ou un préchargement de navigateur, et
           l'exploitant verrait son quota fondre sans comprendre. */
        if (url.pathname === '/api/admin/emploi/essai' && req.method === 'POST') {
          return envoyerJson(res, 200, await clientEmploi.essayer())
        }

        if (url.pathname === '/api/admin/articles' && req.method === 'GET') {
          return envoyerJson(res, 200, await depotArticles.lister())
        }

        if (url.pathname === '/api/admin/articles' && req.method === 'POST') {
          const corps = await lireCorps(req)
          try {
            return envoyerJson(res, 201, await depotArticles.publier(JSON.parse(corps)))
          } catch (e) {
            // Une saisie refusée est une erreur d'écriture, pas une panne : on
            // renvoie la raison telle quelle, pour que la console l'affiche
            // au rédacteur.
            if (e instanceof ArticleInvalide)
              return envoyerJson(res, 400, { erreur: e.message })
            throw e
          }
        }

        if (url.pathname === '/api/admin/articles' && req.method === 'DELETE') {
          const slug = url.searchParams.get('slug') ?? ''
          try {
            await depotArticles.retirer(slug)
            return envoyerJson(res, 200, { ok: true })
          } catch (e) {
            if (e instanceof ArticleIntrouvable)
              return envoyerJson(res, 404, { erreur: e.message })
            throw e
          }
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
