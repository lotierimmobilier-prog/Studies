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
  /**
   * Nombre de lignes dans chaque table de référence, ou `null` si on n'a pas
   * pu compter.
   *
   * ── Pourquoi ce champ existe ───────────────────────────────────────────
   *
   * `postgres-setup.sh` crée la base et applique les migrations. Il ne charge
   * PAS les données de référence — c'est `charger.sh`, et il le dit à la fin.
   * Quand on saute cette étape, la base est configurée, répond, et porte
   * toutes ses migrations : l'état affichait donc tout au vert.
   *
   * Pendant ce temps, « Enregistrer dans mes vœux » échouait pour TOUTE
   * formation, sur une violation de clé étrangère vers une table vide.
   * L'exploitant voyait une console verte et un site cassé.
   *
   * C'est le même défaut que le minuteur de mise à jour qu'on croyait actif :
   * un état qui rassure sans rien vérifier est pire qu'une absence d'état.
   */
  readonly reference: Readonly<Record<string, number | null>> | null
  readonly erreur: string | null
}

/**
 * Les tables sans lesquelles le site ne peut rien enregistrer.
 *
 * `formation` d'abord : c'est sa clé étrangère que viole un vœu quand le
 * chargement n'a pas eu lieu.
 */
const TABLES_DE_REFERENCE = ['formation', 'etablissement', 'commune'] as const

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
    reference: null as Record<string, number | null> | null,
    erreur: null,
  }
  const sql = bd()
  if (sql === null) return base
  try {
    const [v] = await sql<{ version: string }[]>`select version() as version`
    const appliquees = await sql<{ nom: string }[]>`
      select nom from public.migration order by applique_le
    `.catch(() => [] as { nom: string }[])
    /* Un comptage par table, chacun rattrapé séparément : une table absente
       — migration plus récente pas encore appliquée — ne doit pas faire
       perdre le compte des autres. `null` dit « pas pu compter », ce qui
       n'est pas la même chose que zéro. */
    const reference: Record<string, number | null> = {}
    for (const table of TABLES_DE_REFERENCE) {
      const [ligne] = await sql<{ n: number }[]>`
        select count(*)::int as n from reference.${sql(table)}
      `.catch(() => [] as { n: number }[])
      reference[table] = ligne?.n ?? null
    }
    return {
      ...base,
      repond: true,
      version: v?.version.split(' ').slice(0, 2).join(' ') ?? null,
      migrations: appliquees.map((m) => m.nom),
      reference,
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

/**
 * Les pannes de CONNEXION, par code, avec ce qu'on en dit à l'exploitant.
 *
 * Une seule table pour deux usages : le libellé que la console affiche, et
 * la reconnaissance de la panne par `panneDeConnexion`. Deux listes
 * finiraient par diverger, et la seconde laisserait alors passer vers
 * l'élève une erreur que la première sait nommer.
 */
const PANNES: Readonly<Record<string, string>> = {
  ECONNREFUSED: 'connexion refusée : la base n’écoute pas à cette adresse',
  ENOTFOUND: 'hôte introuvable',
  ETIMEDOUT: 'délai dépassé',
  CONNECT_TIMEOUT: 'délai dépassé',
  '28P01': 'authentification refusée',
  '3D000': 'cette base n’existe pas',
  '57P03': 'la base démarre encore',
}

/** Le type de panne, jamais le message brut du pilote. */
function raison(e: unknown): string {
  const code = (e as { code?: string }).code
  if (code !== undefined && code in PANNES) return PANNES[code] as string
  return code ? `erreur ${code}` : 'erreur de connexion'
}

/**
 * Cette erreur est-elle une panne de connexion, et non une faute de requête ?
 *
 * Ce qui la distingue compte : une base injoignable n'est pas la faute de
 * l'élève et se répare toute seule ; une contrainte violée, elle, est un
 * défaut de notre code qu'il ne faut pas déguiser en panne passagère.
 *
 * Sans cette distinction, un hôte mal saisi dans DATABASE_URL affiche
 * « getaddrinfo ENOTFOUND … » sur la fiche d'une formation. Constaté en
 * production le 21/09/2026 : le message brut du pilote, et le nom de l'hôte
 * configuré avec lui, sous le bouton « Enregistrer dans mes vœux ».
 */
export function panneDeConnexion(e: unknown): boolean {
  if (e === null || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  return typeof code === 'string' && code in PANNES
}

/** Ferme la connexion. Pour les tests et l'arrêt propre du serveur. */
export async function fermer(): Promise<void> {
  const sql = instance
  instance = null
  tentee = false
  if (sql !== null) await sql.end({ timeout: 5 })
}
