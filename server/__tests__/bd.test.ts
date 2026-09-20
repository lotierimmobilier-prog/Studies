/**
 * La connexion à PostgreSQL.
 *
 * Deux choses sont vérifiées ici, et elles ont des enjeux très différents.
 *
 * La première est la propriété qui tient tout le plan de migration : SANS
 * `DATABASE_URL`, rien ne se connecte et rien ne change. Si elle cède, poser
 * la base en production cesse d'être une opération sans effet.
 *
 * La seconde est une question de secret. L'URL de connexion porte le mot de
 * passe de la base. Elle ne doit apparaître ni dans l'état affiché par la
 * console d'administration, ni dans un message d'erreur — ces deux-là
 * finissent dans des captures d'écran et des journaux.
 *
 * Les tests qui ont besoin d'une vraie base ne s'exécutent que si
 * `DATABASE_URL_TEST` est défini. Ailleurs, ils sont sautés et le disent :
 * un test qui se contente de ne pas s'exécuter donne une confiance qu'il
 * n'a pas méritée.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { bd, configuree, etat, fermer } from '../bd.ts'

const ORIGINE = process.env.DATABASE_URL

afterEach(async () => {
  await fermer()
  if (ORIGINE === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = ORIGINE
})

describe('sans base configurée', () => {
  it('ne se connecte à rien', async () => {
    delete process.env.DATABASE_URL
    await fermer()
    expect(configuree()).toBe(false)
    expect(bd()).toBeNull()
  })

  it('rend un état lisible plutôt que de lever', async () => {
    delete process.env.DATABASE_URL
    await fermer()
    const e = await etat()
    expect(e.configuree).toBe(false)
    expect(e.repond).toBe(false)
    expect(e.ou).toBeNull()
    expect(e.erreur).toBeNull()
  })
})

describe('le secret ne fuit pas', () => {
  // Une adresse injoignable attend le délai de connexion : le test doit lui
  // laisser plus que les cinq secondes par défaut de vitest.
  it('l’état ne montre que l’hôte et le nom de la base', { timeout: 20000 }, async () => {
    process.env.DATABASE_URL = 'postgres://kit:MotDePasseTresSecret@10.0.0.4:5432/kitetudiant'
    await fermer()
    const e = await etat()
    const tout = JSON.stringify(e)
    expect(tout).not.toContain('MotDePasseTresSecret')
    expect(tout).not.toContain('kit:')
    expect(e.ou).toBe('10.0.0.4:5432/kitetudiant')
  })

  it('une URL illisible se dit, elle ne s’affiche pas à moitié', async () => {
    process.env.DATABASE_URL = 'ceci-n-est-pas-une-url-secret123'
    await fermer()
    const e = await etat()
    expect(e.ou).toBe('adresse illisible')
    expect(JSON.stringify(e)).not.toContain('secret123')
  })

  it('une base injoignable donne une raison, pas le message du pilote', { timeout: 20000 }, async () => {
    // Le port 1 n'écoute jamais : la connexion est refusée tout de suite.
    process.env.DATABASE_URL = 'postgres://kit:SecretAbsolu@127.0.0.1:1/vide'
    await fermer()
    const e = await etat()
    expect(e.configuree).toBe(true)
    expect(e.repond).toBe(false)
    expect(e.erreur).not.toBeNull()
    expect(JSON.stringify(e)).not.toContain('SecretAbsolu')
  })
})

const URL_ESSAI = process.env.DATABASE_URL_TEST
const surUneVraieBase = URL_ESSAI ? describe : describe.skip

surUneVraieBase('sur une instance réelle', () => {
  it('répond et dit sa version', async () => {
    process.env.DATABASE_URL = URL_ESSAI
    await fermer()
    const e = await etat()
    expect(e.repond).toBe(true)
    expect(e.version).toMatch(/^PostgreSQL 1[6-9]/)
    expect(e.erreur).toBeNull()
  })

  it('liste les migrations appliquées, dans l’ordre', async () => {
    process.env.DATABASE_URL = URL_ESSAI
    await fermer()
    const e = await etat()
    expect(e.migrations.length).toBeGreaterThan(0)
    expect([...e.migrations]).toEqual([...e.migrations].sort())
  })

  it('interpole une valeur comme paramètre, jamais comme texte', async () => {
    // C'est LA raison du choix de ce pilote (décision D11). Une chaîne qui
    // fermerait la requête et en ouvrirait une autre doit ressortir telle
    // quelle, traitée comme une donnée.
    process.env.DATABASE_URL = URL_ESSAI
    await fermer()
    const sql = bd()!
    const malveillant = "'; drop table public.migration; --"
    const [ligne] = await sql<{ recu: string }[]>`select ${malveillant}::text as recu`
    expect(ligne?.recu).toBe(malveillant)
    // La table est toujours là : la chaîne n'a jamais été du SQL.
    const [reste] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.migration
    `
    expect(reste?.n).toBeGreaterThan(0)
  })
})
