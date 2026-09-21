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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { bd, configuree, etat, fermer, panneDeConnexion } from '../bd.ts'

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

describe('une panne de base ne remonte jamais telle quelle à l’élève', () => {
  /* Constaté en production le 21/09/2026 : DATABASE_URL contenait des points
     de suspension — recopiés d'un exemple — et la fiche d'une formation
     affichait « getaddrinfo ENOTFOUND %E2%80%A6 » sous le bouton
     « Enregistrer dans mes vœux ».
     
     Deux fautes en une : le message ne veut rien dire pour un lycéen, et il
     porte le nom de l'hôte que nous avons configuré. */

  it('reconnaît les pannes de CONNEXION', () => {
    for (const code of [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'CONNECT_TIMEOUT',
      '28P01',
      '3D000',
      '57P03',
    ]) {
      expect(panneDeConnexion(Object.assign(new Error('peu importe'), { code }))).toBe(true)
    }
  })

  it('ne déguise PAS une faute de requête en panne passagère', () => {
    /* Une contrainte violée est un défaut de notre code : le dire
       « momentanément indisponible » ferait réessayer l'élève indéfiniment,
       et nous cacherait le bogue. */
    for (const code of ['23503', '23505', '42P01', '22001']) {
      expect(panneDeConnexion(Object.assign(new Error('x'), { code }))).toBe(false)
    }
    expect(panneDeConnexion(new Error('sans code'))).toBe(false)
    expect(panneDeConnexion(null)).toBe(false)
    expect(panneDeConnexion('ENOTFOUND')).toBe(false)
  })

  it('partage sa table avec le libellé de la console', () => {
    // Deux listes divergeraient, et la seconde laisserait alors passer vers
    // l'élève une erreur que la première sait nommer.
    const source = readFileSync(resolve(import.meta.dirname, '..', 'bd.ts'), 'utf8')
    expect(source.match(/const PANNES/g)).toHaveLength(1)
    expect(source).toContain('code in PANNES')
  })
})

describe('les routes de vœux traduisent la panne', () => {
  const INDEX = readFileSync(resolve(import.meta.dirname, '..', 'index.ts'), 'utf8')

  it('répondent 503 avec un texte lisible, aux deux endroits', () => {
    // La session d'abord, la liste ensuite : la panne peut surgir aux deux.
    expect(INDEX.match(/panneDeConnexion\(e\)/g)).toHaveLength(2)
    expect(INDEX.match(/erreur: BASE_EN_PANNE/g)).toHaveLength(2)
  })

  it('n’écrivent le vrai motif que dans le journal', () => {
    // Le code de panne sert à l'exploitant, jamais au visiteur.
    expect(INDEX).toContain("console.error('Base injoignable (session) :'")
    expect(INDEX).toContain("console.error('Base injoignable (vœux) :'")
    // Et le message rendu ne contient aucun code ni aucun hôte.
    const message = /const BASE_EN_PANNE = '([^']+)'/.exec(INDEX)?.[1] ?? ''
    expect(message).not.toMatch(/ENOTFOUND|ECONNREFUSED|postgres:|getaddrinfo/)
    expect(message.length).toBeGreaterThan(20)
  })

  it('distinguent « pas configurée » de « ne répond pas »', () => {
    /* Une base absente ne se répare pas par l'élève et ne se réparera pas en
       réessayant ; une base injoignable, si. Les deux messages doivent
       rester différents. */
    expect(INDEX).toContain('n’est pas encore activé sur ce serveur')
    expect(INDEX).toContain('momentanément indisponible')
  })
})
