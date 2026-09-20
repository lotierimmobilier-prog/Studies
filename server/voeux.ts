/**
 * Les listes de vœux, en base.
 *
 * ── Ce qui monte, et ce qui ne monte pas ─────────────────────────────────
 *
 * Décision D1 : le serveur garde ce qui identifie un CHOIX, jamais ce qui
 * décrit une PERSONNE. Une ligne de vœu porte donc un code de formation, une
 * session, un rang, et rien d'autre. Ni note, ni moyenne, ni bourse, ni
 * reste-à-vivre.
 *
 * Le RAV n'est PAS stocké à côté d'un vœu : il se calcule dans le navigateur
 * à partir de données qui ne montent pas. La liste affiche donc le montant
 * quand l'appareil le connaît, et dit pourquoi quand il ne le connaît pas.
 * Recalculer côté serveur avec des hypothèses qu'on n'a pas serait inventer
 * un montant (règle 1).
 *
 * ── La recopie paresseuse des comptes ────────────────────────────────────
 *
 * Étape D du plan de migration. Les comptes vivent encore dans le fichier
 * chiffré ; un compte qui se sert de ses vœux est recopié dans
 * `eleve.compte` au passage, et le fichier reste la source d'autorité pour
 * la connexion.
 *
 * La recopie ne DÉCHIFFRE RIEN : la base reçoit le chiffré, son nonce et sa
 * balise d'authentification tels quels. Le secret maître ne sort pas de
 * comptes.ts, et il n'existe aucun instant où une adresse est en clair.
 *
 * ── Aucun vœu n'est jamais retiré par un calcul ──────────────────────────
 *
 * Règle 4. Ce module sait retirer un vœu, mais uniquement sur demande
 * explicite de l'élève. `signaler` pose un texte à côté d'un vœu ; il ne le
 * sort pas de la liste, et aucune fonction ici ne permet à un classement
 * d'en écarter un.
 */

import { randomUUID } from 'node:crypto'

import { bd, type Bd } from './bd.ts'
import type { CompteStocke, DepotComptes } from './comptes.ts'

/** Comme Parcoursup : dix vœux au plus. La base le vérifie aussi. */
export const VOEUX_MAX = 10

/** Purge d'un compte inactif, alignée sur celle du fichier chiffré. */
const PURGE_APRES_JOURS = 3 * 365

export class BaseIndisponible extends Error {
  constructor() {
    super('La liste de vœux n’est pas disponible : la base n’est pas configurée.')
  }
}

export class ListeComplete extends Error {
  constructor() {
    super(`Dix vœux au maximum, comme sur Parcoursup.`)
  }
}

/**
 * Levée quand le code de formation n'existe pas dans la table de référence.
 *
 * Deux causes, et l'élève ne peut rien à ni l'une ni l'autre : soit le code
 * a changé d'une session à l'autre, soit l'import de référence n'a pas été
 * chargé sur ce serveur. Dans les deux cas on le lui dit en français plutôt
 * que de laisser remonter le message de PostgreSQL — qui, lui, parle de
 * « foreign key constraint » et de noms de tables.
 */
export class FormationInconnue extends Error {
  constructor(code: string) {
    super(
      `La formation ${code} n’est pas dans les données chargées sur ce serveur : ` +
        'impossible de l’enregistrer dans tes vœux.',
    )
  }
}

/** Violation de clé étrangère, telle que PostgreSQL la code. */
const CLE_ETRANGERE = '23503'

export interface Voeu {
  readonly rang: number
  readonly codeFormation: string
  readonly session: number
  readonly signalement: string | null
  readonly ajouteLe: string
}

/* ───────────────────────────────────────────────── le compte, en base */

/**
 * L'identifiant en base du titulaire d'une session, recopié au besoin.
 *
 * `null` quand la session est invalide ou que la base n'est pas configurée —
 * l'appelant décide alors quoi répondre, et dans le second cas ce n'est pas
 * une erreur de l'élève.
 */
export async function compteDeSession(
  depot: DepotComptes,
  jeton: string,
  maintenant: Date = new Date(),
): Promise<string | null> {
  const sql = bd()
  if (sql === null) return null
  const stocke = await depot.enregistrementDeSession(jeton, maintenant)
  if (stocke === null) return null
  return recopier(sql, stocke, maintenant)
}

async function recopier(sql: Bd, compte: CompteStocke, maintenant: Date): Promise<string> {
  const [existant] = await sql<{ id: string }[]>`
    select id from eleve.compte where email_empreinte = ${compte.index}
  `
  if (existant !== undefined) {
    // Une visite récente prolonge la purge, comme dans le fichier.
    await sql`
      update eleve.compte
         set vu_le = ${maintenant.toISOString()},
             purge_prevue_le = ${purgePrevue(maintenant)}
       where id = ${existant.id}
    `
    return existant.id
  }

  /* Le chiffré et sa balise d'authentification sont concaténés, comme le
     veut l'usage pour AES-GCM : le déchiffrement relit les seize derniers
     octets comme balise. Les garder dans deux colonnes n'apporterait rien et
     laisserait la porte ouverte à en perdre une. */
  const chiffre = Buffer.concat([
    Buffer.from(compte.emailChiffre, 'base64'),
    Buffer.from(compte.baliseAuth, 'base64'),
  ])
  const id = randomUUID()
  await sql`
    insert into eleve.compte
      (id, email_empreinte, email_chiffre, email_nonce, fournisseur,
       sel_mot_de_passe, empreinte_mot_de_passe, cree_le, vu_le, purge_prevue_le)
    values
      (${id}, ${compte.index}, ${chiffre}, ${Buffer.from(compte.nonce, 'base64')}, 'local',
       ${compte.selMotDePasse}, ${compte.empreinteMotDePasse},
       ${compte.inscritLe}, ${maintenant.toISOString()}, ${purgePrevue(maintenant)})
    on conflict (email_empreinte) do nothing
  `
  // `do nothing` plutôt qu'une erreur : deux requêtes simultanées du même
  // élève recopieraient le même compte, et la seconde doit simplement
  // retrouver ce que la première a écrit.
  const [pose] = await sql<{ id: string }[]>`
    select id from eleve.compte where email_empreinte = ${compte.index}
  `
  return pose!.id
}

function purgePrevue(maintenant: Date): string {
  const d = new Date(maintenant.getTime())
  d.setUTCDate(d.getUTCDate() + PURGE_APRES_JOURS)
  return d.toISOString().slice(0, 10)
}

/* ────────────────────────────────────────────────────────── la liste */

async function panierDe(sql: Bd, compteId: string): Promise<string> {
  const [existant] = await sql<{ id: string }[]>`
    select id from eleve.panier where compte_id = ${compteId}
  `
  if (existant !== undefined) return existant.id
  const id = randomUUID()
  await sql`
    insert into eleve.panier (id, compte_id) values (${id}, ${compteId})
    on conflict (compte_id) do nothing
  `
  const [pose] = await sql<{ id: string }[]>`
    select id from eleve.panier where compte_id = ${compteId}
  `
  return pose!.id
}

export async function lire(compteId: string): Promise<Voeu[]> {
  const sql = bd()
  if (sql === null) throw new BaseIndisponible()
  const panier = await panierDe(sql, compteId)
  const lignes = await sql<
    { rang: number; cod_aff_form: string; session: number; signalement: string | null; ajoute_le: Date }[]
  >`
    select rang, cod_aff_form, session, signalement, ajoute_le
      from eleve.panier_voeu
     where panier_id = ${panier}
     order by rang
  `
  return lignes.map((l) => ({
    rang: l.rang,
    codeFormation: l.cod_aff_form,
    session: l.session,
    signalement: l.signalement,
    ajouteLe: l.ajoute_le.toISOString(),
  }))
}

/**
 * Ajoute un vœu à la fin de la liste.
 *
 * Ajouter deux fois la même formation ne fait rien et ne lève pas : l'élève
 * a cliqué deux fois, ce n'est pas une erreur à lui signaler.
 */
export async function ajouter(
  compteId: string,
  codeFormation: string,
  session: number,
): Promise<Voeu[]> {
  const sql = bd()
  if (sql === null) throw new BaseIndisponible()
  const panier = await panierDe(sql, compteId)
  const [deja] = await sql<{ rang: number }[]>`
    select rang from eleve.panier_voeu
     where panier_id = ${panier} and cod_aff_form = ${codeFormation} and session = ${session}
  `
  if (deja !== undefined) return lire(compteId)

  const [compte] = await sql<{ n: number }[]>`
    select count(*)::int as n from eleve.panier_voeu where panier_id = ${panier}
  `
  if ((compte?.n ?? 0) >= VOEUX_MAX) throw new ListeComplete()

  const [dernier] = await sql<{ rang: number | null }[]>`
    select max(rang) as rang from eleve.panier_voeu where panier_id = ${panier}
  `
  try {
    await sql`
      insert into eleve.panier_voeu (panier_id, rang, cod_aff_form, session)
      values (${panier}, ${(dernier?.rang ?? 0) + 1}, ${codeFormation}, ${session})
    `
  } catch (e) {
    /* La clé étrangère garantit qu'un vœu désigne une formation RÉELLE. La
       laisser remonter telle quelle afficherait « violates foreign key
       constraint panier_voeu_cod_aff_form_session_fkey » à un lycéen — vu au
       navigateur avant d'écrire ces lignes. On traduit, et on ne retire
       surtout pas la contrainte : c'est elle qui empêche d'enregistrer un
       vœu vers rien. */
    if ((e as { code?: string }).code === CLE_ETRANGERE) {
      throw new FormationInconnue(codeFormation)
    }
    throw e
  }
  await sql`update eleve.panier set maj_le = now() where id = ${panier}`
  return lire(compteId)
}

/**
 * Retire un vœu, et resserre les rangs derrière lui.
 *
 * Sans ce resserrement, retirer le vœu 3 laisserait un trou, et le dixième
 * ajout suivant viserait le rang 11 — que la contrainte refuse. Le trou
 * serait invisible à l'écran et la panne, incompréhensible.
 *
 * Ce retrait est toujours demandé par l'élève. Aucun calcul de ce dépôt
 * n'appelle cette fonction (règle 4 de CLAUDE.md).
 */
export async function retirer(compteId: string, rang: number): Promise<Voeu[]> {
  const sql = bd()
  if (sql === null) throw new BaseIndisponible()
  const panier = await panierDe(sql, compteId)
  await sql.begin(async (tx) => {
    await tx`delete from eleve.panier_voeu where panier_id = ${panier} and rang = ${rang}`
    // Les rangs se décalent un par un, du plus petit au plus grand : les
    // décaler d'un coup violerait l'unicité (panier_id, rang) en chemin.
    const restants = await tx<{ rang: number }[]>`
      select rang from eleve.panier_voeu where panier_id = ${panier} and rang > ${rang} order by rang
    `
    for (const r of restants) {
      await tx`
        update eleve.panier_voeu set rang = ${r.rang - 1}
         where panier_id = ${panier} and rang = ${r.rang}
      `
    }
    await tx`update eleve.panier set maj_le = now() where id = ${panier}`
  })
  return lire(compteId)
}

/**
 * Déplace un vœu d'un rang.
 *
 * ── Pourquoi une suppression-réinsertion ────────────────────────────────
 *
 * Le rang est la clé primaire du vœu dans son panier : écrire le premier
 * échange avant le second violerait son unicité entre les deux écritures.
 *
 * Le contournement habituel — poser l'un sur un rang d'abri, échanger, puis
 * le ramener — ne marche PAS ici, et c'est voulu : la contrainte
 * `panier_voeu_rang_parcoursup` n'autorise que les rangs 1 à 10. Il n'existe
 * donc aucun rang libre où se garer, ce qui est exactement ce qu'on lui
 * demande. Essayé, refusé par la base, et tant mieux.
 *
 * On supprime donc les deux lignes et on les réinsère échangées, dans la même
 * transaction. Leurs autres colonnes — le signalement, la date d'ajout — sont
 * relues d'abord et reposées telles quelles : un déplacement ne doit rien
 * effacer d'autre.
 */
export async function deplacer(
  compteId: string,
  rang: number,
  vers: 'haut' | 'bas',
): Promise<Voeu[]> {
  const sql = bd()
  if (sql === null) throw new BaseIndisponible()
  const panier = await panierDe(sql, compteId)
  const voisin = vers === 'haut' ? rang - 1 : rang + 1
  if (voisin < 1 || voisin > VOEUX_MAX) return lire(compteId)

  await sql.begin(async (tx) => {
    const lignes = await tx<
      {
        rang: number
        cod_aff_form: string
        session: number
        signalement: string | null
        ajoute_le: Date
      }[]
    >`
      select rang, cod_aff_form, session, signalement, ajoute_le
        from eleve.panier_voeu
       where panier_id = ${panier} and rang in (${rang}, ${voisin})
    `
    // Il en faut deux : déplacer le dernier vers le bas ne fait rien, et
    // c'est le bon comportement — pas une erreur à signaler.
    if (lignes.length !== 2) return

    await tx`
      delete from eleve.panier_voeu
       where panier_id = ${panier} and rang in (${rang}, ${voisin})
    `
    for (const l of lignes) {
      await tx`
        insert into eleve.panier_voeu
          (panier_id, rang, cod_aff_form, session, signalement, ajoute_le)
        values (${panier}, ${l.rang === rang ? voisin : rang}, ${l.cod_aff_form},
                ${l.session}, ${l.signalement}, ${l.ajoute_le})
      `
    }
    await tx`update eleve.panier set maj_le = now() where id = ${panier}`
  })
  return lire(compteId)
}

/**
 * Pose ou retire un signalement sur un vœu.
 *
 * Un signalement dit pourquoi ce vœu mérite d'être regardé de plus près. Il
 * ne le sort PAS de la liste, et rien ici ne permet de l'en sortir
 * automatiquement : règle 4 de CLAUDE.md, tenue par le schéma comme par ce
 * module.
 */
export async function signaler(
  compteId: string,
  rang: number,
  texte: string | null,
): Promise<Voeu[]> {
  const sql = bd()
  if (sql === null) throw new BaseIndisponible()
  const panier = await panierDe(sql, compteId)
  const propre = texte === null ? null : texte.trim().slice(0, 300) || null
  await sql`
    update eleve.panier_voeu set signalement = ${propre}
     where panier_id = ${panier} and rang = ${rang}
  `
  return lire(compteId)
}
