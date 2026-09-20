/**
 * La connexion à PostgreSQL.
 *
 * ── La propriété qui tient tout le reste ─────────────────────────────────
 *
 * Sans `DATABASE_URL`, ce module ne se connecte à rien et `bd()` rend `null`.
 * Le site fonctionne alors exactement comme avant : comptes dans le fichier
 * chiffré, formations interrogées chez le ministère. C'est ce qui permet de
 * poser la base en production sans rien casser, puis de basculer écran par
 * écran — le plan de migration de docs/architecture-cible.md.
 *
 * Tout appelant DOIT donc traiter le `null`. Ce n'est pas une précaution
 * défensive : c'est le mode de fonctionnement normal tant que la bascule
 * n'est pas faite, et ce sera encore le mode de secours après.
 *
 * ── Le pilote ───────────────────────────────────────────────────────────
 *
 * `postgres` (porsager), décision D11. Deux raisons, et la seconde compte
 * plus que la première :
 *
 *   - aucune dépendance transitive : une de plus dans un projet qui en
 *     comptait trois, pas une arborescence ;
 *   - les valeurs interpolées dans un gabarit `sql`…`` deviennent des
 *     PARAMÈTRES, jamais du texte concaténé. `sql`select … where id =
 *     ${saisie}`` est sûr même si `saisie` vient d'un formulaire. Avec une
 *     API qui prend une chaîne, il faut y penser à chaque requête ; ici il
 *     faut faire un effort pour se tromper. Sur un service qui stockera les
 *     vœux de mineurs, ce n'est pas un détail de confort.
 *
 * ── Ce qui n'est jamais journalisé ──────────────────────────────────────
 *
 * L'URL de connexion porte le mot de passe. Elle n'apparaît nulle part dans
 * les messages d'erreur de ce module, et `etat()` n'en rend que l'hôte et le
 * nom de la base — jamais l'identifiant, jamais le secret.
 */

import postgres from 'postgres'

export type Bd = ReturnType<typeof postgres>

/** Nombre de connexions simultanées. Un petit VPS n'a rien à faire d'un
 *  pool de vingt : chacune coûte un processus côté PostgreSQL. */
const CONNEXIONS_MAX = 8

/**
 * Au-delà, la connexion échoue plutôt que de laisser une page tourner.
 *
 * Cinq secondes et pas dix : au-delà, l'élève a déjà rechargé la page, et on
 * lui doit un message d'erreur plutôt qu'une roue qui tourne.
 */
const DELAI_SECONDES = 5

let instance: Bd | null = null
let tentee = false

/**
 * La connexion, ou `null` quand la base n'est pas configurée.
 *
 * L'instance est unique et paresseuse : on ne se connecte qu'à la première
 * requête, et jamais au démarrage. Un serveur qui refuse de démarrer parce
 * qu'une base est momentanément injoignable est un serveur qui transforme
 * une panne de base en panne de site.
 */
export function bd(): Bd | null {
  if (tentee) return instance
  tentee = true
  const url = process.env.DATABASE_URL
  if (!url) return null
  try {
    instance = postgres(url, {
      max: CONNEXIONS_MAX,
      idle_timeout: 30,
      connect_timeout: DELAI_SECONDES,
      // Les avis du serveur (« NOTICE: … ») n'ont rien à faire dans nos
      // journaux : ils y noieraient les erreurs réelles.
      onnotice: () => {},
      // `prepare: false` serait nécessaire derrière un mandataire en mode
      // transaction (PgBouncer). Nous n'en avons pas, et les requêtes
      // préparées sont précisément ce qu'on veut garder.
    })
  } catch {
    /* Le pilote analyse l'URL tout de suite et lève si elle est malformée.
       Le laisser remonter ferait échouer la page d'état — celle-là même qui
       doit dire ce qui ne va pas — et le message du pilote contiendrait
       l'URL, donc le mot de passe. On traite donc une URL illisible comme
       une base absente, et `etat()` dit « adresse illisible ». */
    instance = null
  }
  return instance
}

/** Vrai quand une base est configurée. Ne dit pas qu'elle répond. */
export function configuree(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export interface EtatBd {
  readonly configuree: boolean
  readonly repond: boolean
  /** Hôte et nom de la base, sans identifiant ni mot de passe. */
  readonly ou: string | null
  readonly version: string | null
  /** Migrations appliquées, la plus récente en dernier. */
  readonly migrations: readonly string[]
  readonly erreur: string | null
}

/**
 * Ce que la console d'administration affiche.
 *
 * Elle ne lève jamais : une base injoignable est un état à montrer, pas une
 * erreur qui ferait échouer la page d'état tout entière — celle-là doit
 * justement rester lisible quand quelque chose ne va pas.
 */
export async function etat(): Promise<EtatBd> {
  const base = {
    configuree: configuree(),
    repond: false,
    ou: lieu(),
    version: null,
    migrations: [] as string[],
    erreur: null,
  }
  const sql = bd()
  if (sql === null) return base
  try {
    const [v] = await sql<{ version: string }[]>`select version() as version`
    const appliquees = await sql<{ nom: string }[]>`
      select nom from public.migration order by applique_le
    `.catch(() => [] as { nom: string }[])
    return {
      ...base,
      repond: true,
      version: v?.version.split(' ').slice(0, 2).join(' ') ?? null,
      migrations: appliquees.map((m) => m.nom),
    }
  } catch (e) {
    // Le message du pilote peut contenir l'URL : on ne garde que le type de
    // panne, qui suffit à diagnostiquer sans rien divulguer.
    return { ...base, erreur: raison(e) }
  }
}

/** Hôte et base, extraits de l'URL sans son identifiant ni son secret. */
function lieu(): string | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  try {
    const u = new URL(url)
    const nom = u.pathname.replace(/^\//, '')
    return `${u.hostname}${u.port ? `:${u.port}` : ''}/${nom}`
  } catch {
    // URL illisible : on le dit, plutôt que d'en afficher un morceau.
    return 'adresse illisible'
  }
}

/** Le type de panne, jamais le message brut du pilote. */
function raison(e: unknown): string {
  const code = (e as { code?: string }).code
  switch (code) {
    case 'ECONNREFUSED':
      return 'connexion refusée : la base n’écoute pas à cette adresse'
    case 'ENOTFOUND':
      return 'hôte introuvable'
    case 'ETIMEDOUT':
    case 'CONNECT_TIMEOUT':
      return 'délai dépassé'
    case '28P01':
      return 'authentification refusée'
    case '3D000':
      return 'cette base n’existe pas'
    default:
      return code ? `erreur ${code}` : 'erreur de connexion'
  }
}

/** Ferme la connexion. Pour les tests et l'arrêt propre du serveur. */
export async function fermer(): Promise<void> {
  const sql = instance
  instance = null
  tentee = false
  if (sql !== null) await sql.end({ timeout: 5 })
}
