import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { ARTICLES } from '../../../packages/articles/src/index.ts'

/**
 * Les cartes de partage.
 *
 * Elles sont fabriquées à la main (kitetudiant/scripts/visuels-partage.ts) et
 * versionnées, parce que leur rendu demande un navigateur sans interface que
 * le serveur de déploiement n'a pas. Ce choix a un revers : rien n'oblige
 * quelqu'un qui ajoute un article à relancer le script, et l'article partirait
 * alors avec un aperçu nu sans que rien ne le signale.
 *
 * Ces tests sont la contrepartie de ce choix. Ils tombent à l'ajout d'un
 * article sans carte, et à la suppression d'un article dont la carte reste.
 */

const PARTAGE = resolve(import.meta.dirname, '..', '..', 'public', 'partage')

/** Les deux pages qui ne sont pas des articles mais qui se partagent autant. */
const PAGES = ['accueil', 'blog'] as const

const FICHIERS = readdirSync(PARTAGE).filter((f) => f.endsWith('.png'))

/**
 * Largeur et hauteur d'un PNG, lues dans son en-tête IHDR.
 *
 * Huit octets de signature, quatre de longueur, quatre de type, puis la
 * largeur et la hauteur sur quatre octets chacune, en gros-boutiste.
 */
function dimensions(fichier: string): { largeur: number; hauteur: number } {
  const octets = readFileSync(join(PARTAGE, fichier))
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(octets.subarray(0, 8).equals(signature), `${fichier} n’est pas un PNG`).toBe(true)
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) }
}

describe('les cartes de partage', () => {
  it.each(ARTICLES.map((a) => a.slug))('%s a la sienne', (slug) => {
    expect(
      FICHIERS,
      `Aucune carte pour « ${slug} » : partagé, cet article n’aurait aucun aperçu. ` +
        'Relance « npx tsx kitetudiant/scripts/visuels-partage.ts ».',
    ).toContain(`${slug}.png`)
  })

  it.each(PAGES)('la page « %s » a la sienne', (nom) => {
    // L'accueil est le lien le plus souvent envoyé — à un ami, à ses parents.
    expect(FICHIERS).toContain(`${nom}.png`)
  })

  it('n’en garde aucune qui ne corresponde plus à rien', () => {
    const attendues = new Set([...ARTICLES.map((a) => `${a.slug}.png`), ...PAGES.map((p) => `${p}.png`)])
    const orphelines = FICHIERS.filter((f) => !attendues.has(f))
    expect(
      orphelines,
      'Une carte sans article ni page alourdit le dépôt sans jamais s’afficher.',
    ).toEqual([])
  })

  it('mesurent toutes 1200 × 630', () => {
    // C'est le format qu'attendent les générateurs d'aperçu. Une carte d'un
    // autre rapport est recadrée par eux, au centre, sans égard pour le texte.
    for (const fichier of FICHIERS) {
      expect(dimensions(fichier), fichier).toEqual({ largeur: 1200, hauteur: 630 })
    }
  })

  it('restent raisonnables, une par une et au total', () => {
    // Elles sont versionnées : leur poids entre dans l'historique pour de bon.
    // Au-delà, c'est qu'une photographie s'est glissée dans la composition.
    for (const fichier of FICHIERS) {
      const poids = statSync(join(PARTAGE, fichier)).size
      expect(Math.round(poids / 1024), `${fichier}`).toBeLessThan(120)
    }
    const total = FICHIERS.reduce((n, f) => n + statSync(join(PARTAGE, f)).size, 0)
    expect(
      Math.round(total / 1024),
      `${FICHIERS.length} cartes — au-delà d’un méga-octet, il faut une bonne raison.`,
    ).toBeLessThan(1024)
  })
})

describe('le pré-rendu', () => {
  const script = readFileSync(
    resolve(import.meta.dirname, '..', '..', '..', 'scripts', 'prerendre.ts'),
    'utf8',
  )

  it('pose une adresse d’image absolue, construite et non écrite en dur', () => {
    // Un aperçu est fabriqué par un serveur tiers : il n'a aucun moyen de
    // résoudre « /partage/x.png » contre l'adresse de la page. Et l'écrire en
    // dur la rendrait fausse le jour où la base de déploiement change.
    expect(script).toContain('og:image')
    expect(script).toMatch(/\$\{ORIGINE\}\$\{BASE\}partage\//)
    expect(script).not.toMatch(/https:\/\/kitetudiant\.fr\/partage/)
  })

  it('demande le grand format d’aperçu', () => {
    // Sans cette ligne, l'aperçu se réduit à une vignette carrée : la carte
    // est composée pour le grand format, pas pour un timbre-poste.
    expect(script).toContain('summary_large_image')
  })

  it('annonce les dimensions réelles des cartes', () => {
    expect(script).toMatch(/og:image:width"\s+content="1200"/)
    expect(script).toMatch(/og:image:height"\s+content="630"/)
  })
})
