/**
 * Les listes de vœux, sur une vraie base.
 *
 * Tout ce qui est vérifié ici l'est contre PostgreSQL, jamais contre un
 * simulacre : les propriétés qui comptent — l'unicité d'un rang, le
 * resserrement après un retrait, la cascade à la suppression d'un compte —
 * sont tenues par le schéma, et un simulacre les tiendrait toutes par
 * construction sans rien prouver.
 *
 * Sans `DATABASE_URL_TEST`, ces tests sont sautés et le disent.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { bd, fermer } from '../bd.ts'
import { DepotComptes } from '../comptes.ts'
import {
  FormationInconnue,
  ListeComplete,
  VOEUX_MAX,
  ajouter,
  compteDeSession,
  deplacer,
  lire,
  retirer,
  signaler,
} from '../voeux.ts'

const URL_ESSAI = process.env.DATABASE_URL_TEST
const surUneVraieBase = URL_ESSAI ? describe : describe.skip

const SECRET = 'un-secret-maitre-de-tests-assez-long'

/**
 * Les formations d'essai.
 *
 * Le test les sème lui-même plutôt que de compter sur un import : la clé
 * étrangère `panier_voeu → reference.formation` refuse un code inconnu, et un
 * test qui dépend de ce qu'une autre commande a bien voulu charger échoue
 * pour une raison qui n'est pas la sienne.
 *
 * Douze, soit un de plus que le plafond de dix : c'est ce qu'il faut pour
 * éprouver le refus du onzième.
 */
const CODES = Array.from({ length: 12 }, (_, i) => `ESSAI${String(i + 1).padStart(2, '0')}`)
const SESSION = 2025
const UAI_ESSAI = '0000000X'

let dossier: string
let depot: DepotComptes

async function semerFormations(): Promise<void> {
  const sql = bd()!
  await sql`
    insert into reference.etablissement
      (uai, millesime, nom, statut, collecte_le, source)
    values (${UAI_ESSAI}, ${SESSION}, 'Établissement d''essai', 'Public', current_date, 'tests')
    on conflict do nothing
  `
  for (const code of CODES) {
    await sql`
      insert into reference.formation
        (cod_aff_form, session, uai, filiere, libelle, selective, collecte_le, source)
      values (${code}, ${SESSION}, ${UAI_ESSAI}, 'Licence', ${`Formation ${code}`},
              false, current_date, 'tests')
      on conflict do nothing
    `
  }
}

async function comptePret(email = 'eleve@example.fr'): Promise<string> {
  const session = await depot.inscrire(email, 'motdepassesolide')
  const id = await compteDeSession(depot, session.jeton)
  expect(id).not.toBeNull()
  return id!
}

surUneVraieBase('les vœux', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = URL_ESSAI
    await fermer()
    const sql = bd()!
    // Table vierge à chaque essai : la cascade emporte paniers et vœux.
    await sql`delete from eleve.compte`
    await semerFormations()
    dossier = await mkdtemp(join(tmpdir(), 'voeux-'))
    depot = new DepotComptes(join(dossier, 'comptes.json'), SECRET)
  })

  afterAll(async () => {
    await fermer()
    if (dossier) await rm(dossier, { recursive: true, force: true })
  })

  it('recopie le compte sans jamais déchiffrer son adresse', async () => {
    const id = await comptePret('cle@example.fr')
    const sql = bd()!
    const [ligne] = await sql<{ email_chiffre: Buffer; email_nonce: Buffer }[]>`
      select email_chiffre, email_nonce from eleve.compte where id = ${id}
    `
    // L'adresse ne doit apparaître en clair nulle part dans la ligne.
    expect(ligne!.email_chiffre.toString('utf8')).not.toContain('cle@example.fr')
    expect(ligne!.email_nonce.length).toBe(12)
  })

  it('recopie une seule fois, même appelé deux fois', async () => {
    const session = await depot.inscrire('deux@example.fr', 'motdepassesolide')
    const a = await compteDeSession(depot, session.jeton)
    const b = await compteDeSession(depot, session.jeton)
    expect(a).toBe(b)
    const sql = bd()!
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from eleve.compte`
    expect(n!.n).toBe(1)
  })

  it('ignore une session inconnue', async () => {
    expect(await compteDeSession(depot, 'jeton-invente')).toBeNull()
  })

  it('ajoute à la suite, et ne compte pas deux fois la même formation', async () => {
    const id = await comptePret()
    await ajouter(id, CODES[0]!, SESSION)
    await ajouter(id, CODES[1]!, SESSION)
    // Deuxième clic sur le même bouton : ce n'est pas une erreur à signaler.
    const liste = await ajouter(id, CODES[0]!, SESSION)
    expect(liste.map((v) => v.codeFormation)).toEqual([CODES[0], CODES[1]])
    expect(liste.map((v) => v.rang)).toEqual([1, 2])
  })

  it('refuse le onzième vœu, comme Parcoursup', async () => {
    const id = await comptePret()
    for (const code of CODES.slice(0, VOEUX_MAX)) await ajouter(id, code, SESSION)
    await expect(ajouter(id, CODES[VOEUX_MAX]!, SESSION)).rejects.toBeInstanceOf(ListeComplete)
  })

  it('resserre les rangs après un retrait', async () => {
    // Sans ce resserrement, un trou reste : le dixième ajout suivant viserait
    // le rang 11, que la contrainte refuse, et la panne serait
    // incompréhensible.
    const id = await comptePret()
    for (const c of CODES.slice(0, 3)) await ajouter(id, c, SESSION)
    const apres = await retirer(id, 2)
    expect(apres.map((v) => [v.rang, v.codeFormation])).toEqual([
      [1, CODES[0]],
      [2, CODES[2]],
    ])
  })

  it('échange deux rangs sans violer leur unicité', async () => {
    const id = await comptePret()
    for (const c of CODES.slice(0, 2)) await ajouter(id, c, SESSION)
    const apres = await deplacer(id, 2, 'haut')
    expect(apres.map((v) => v.codeFormation)).toEqual([CODES[1], CODES[0]])
  })

  it('ne déplace rien au-delà des bords', async () => {
    const id = await comptePret()
    await ajouter(id, CODES[0]!, SESSION)
    expect((await deplacer(id, 1, 'haut')).map((v) => v.rang)).toEqual([1])
    expect((await deplacer(id, 1, 'bas')).map((v) => v.rang)).toEqual([1])
  })

  it('signale un vœu SANS le retirer de la liste', async () => {
    // Règle 4 de CLAUDE.md : un vœu se signale, il ne se supprime jamais par
    // un calcul.
    const id = await comptePret()
    await ajouter(id, CODES[0]!, SESSION)
    const apres = await signaler(id, 1, 'budget très tendu')
    expect(apres).toHaveLength(1)
    expect(apres[0]!.signalement).toBe('budget très tendu')
    expect((await signaler(id, 1, null))[0]!.signalement).toBeNull()
  })

  it('n’enregistre ni note, ni montant, ni appréciation', async () => {
    // La vérification porte sur les COLONNES, pas sur leur contenu : une
    // colonne absente ne peut pas être remplie par erreur plus tard.
    const sql = bd()!
    const colonnes = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
       where table_schema = 'eleve' and table_name in ('panier', 'panier_voeu')
    `
    const noms = colonnes.map((c) => c.column_name).join(' ')
    for (const interdit of ['moyenne', 'note', 'rav', 'montant', 'budget', 'bourse']) {
      expect(noms, `« ${interdit} » n’a rien à faire dans une liste de vœux`).not.toContain(
        interdit,
      )
    }
  })

  it('supprimer le compte emporte ses vœux', async () => {
    const id = await comptePret()
    await ajouter(id, CODES[0]!, SESSION)
    const sql = bd()!
    await sql`delete from eleve.compte where id = ${id}`
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from eleve.panier_voeu`
    expect(n!.n).toBe(0)
  })

  it('deux élèves ne voient pas la liste l’un de l’autre', async () => {
    const a = await comptePret('a@example.fr')
    const b = await comptePret('b@example.fr')
    await ajouter(a, CODES[0]!, SESSION)
    await ajouter(b, CODES[1]!, SESSION)
    expect((await lire(a)).map((v) => v.codeFormation)).toEqual([CODES[0]])
    expect((await lire(b)).map((v) => v.codeFormation)).toEqual([CODES[1]])
  })
})

surUneVraieBase('les erreurs parlent français', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = URL_ESSAI
    await fermer()
    const sql = bd()!
    await sql`delete from eleve.compte`
    await semerFormations()
    dossier = await mkdtemp(join(tmpdir(), 'voeux-err-'))
    depot = new DepotComptes(join(dossier, 'comptes.json'), SECRET)
  })

  it('un code de formation inconnu ne renvoie pas le message de PostgreSQL', async () => {
    // Sans traduction, l'élève lisait « violates foreign key constraint
    // panier_voeu_cod_aff_form_session_fkey ». Constaté au navigateur.
    const id = await comptePret('inconnu@example.fr')
    await expect(ajouter(id, 'CE-CODE-N-EXISTE-PAS', SESSION)).rejects.toBeInstanceOf(
      FormationInconnue,
    )
    await expect(ajouter(id, 'CE-CODE-N-EXISTE-PAS', SESSION)).rejects.toThrow(
      /n’est pas dans les données chargées/,
    )
    // Et surtout : rien du jargon de la base ne doit transparaître.
    await expect(ajouter(id, 'CE-CODE-N-EXISTE-PAS', SESSION)).rejects.not.toThrow(
      /foreign key|constraint|panier_voeu_/,
    )
  })

  it('dit autre chose quand AUCUNE formation n’est chargée', async () => {
    /* Deux situations sans rapport, et le message ne disait que la première.

       Constaté en production : `postgres-setup.sh` crée la base et applique
       les migrations, mais ne charge PAS les données de référence — c'est
       `charger.sh`. Table vide, donc « Enregistrer dans mes vœux » échouait
       pour CHAQUE formation, en accusant la formation.

       Un élève à qui l'on dit « la formation 12 n'est pas dans les données »
       en essaie une autre, échoue pareil, et croit avoir mal choisi. */
    const sql = bd()!
    const id = await comptePret('base-vide@example.fr')
    await sql`delete from eleve.panier_voeu`
    await sql`delete from reference.formation`
    try {
      await expect(ajouter(id, CODES[0]!, SESSION)).rejects.toThrow(
        /ne sont pas chargées sur ce serveur/,
      )
      // Et surtout : il ne doit plus accuser le vœu de l'élève.
      await expect(ajouter(id, CODES[0]!, SESSION)).rejects.not.toThrow(
        /La formation .* n’est pas dans les données/,
      )
      await expect(ajouter(id, CODES[0]!, SESSION)).rejects.toThrow(
        /Ce n’est pas ton vœu qui est en cause/,
      )
    } finally {
      await semerFormations()
    }
  })

  it('la contrainte reste en place : un vœu désigne une formation réelle', async () => {
    // La tentation, devant cette erreur, est de retirer la clé étrangère.
    // Ce test existe pour que ça ne se fasse pas en silence.
    const sql = bd()!
    const [fk] = await sql<{ n: number }[]>`
      select count(*)::int as n
        from information_schema.table_constraints
       where table_schema = 'eleve' and table_name = 'panier_voeu'
         and constraint_type = 'FOREIGN KEY'
    `
    expect(fk!.n).toBeGreaterThan(0)
  })
})
