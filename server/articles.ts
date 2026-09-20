/**
 * Les articles écrits depuis la console d'administration.
 *
 * Les onze articles de fond vivent dans le dépôt (kitetudiant/packages/
 * articles) : ils sont versionnés, relus, et pré-rendus au build. Ce dépôt-ci
 * ne contient que ceux ajoutés après coup depuis la console.
 *
 * Les deux se complètent plutôt que de se remplacer : un article du dépôt et
 * un article écrit en console peuvent partager un slug, et c'est alors celui
 * de la console qui l'emporte — c'est ainsi qu'on corrige un texte publié sans
 * attendre un déploiement.
 *
 * ── Ce qui est volontairement absent ─────────────────────────────────────
 *
 * Aucun HTML n'est stocké. Le corps est une suite de blocs typés, produite par
 * `articleDepuisSaisie`, et rendue par des composants React. Il n'y a donc
 * aucun chemin par lequel un article publié pourrait exécuter du script chez
 * un visiteur, quoi qu'on tape dans le formulaire.
 *
 * Aucune donnée personnelle non plus : un article n'a pas d'auteur nominatif.
 * La console est déjà protégée, et savoir QUI a écrit quoi n'apporte rien au
 * lecteur tout en créant une donnée à protéger.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  ArticleInvalide,
  articleDepuisSaisie,
  type Article,
} from '../kitetudiant/packages/articles/src/index.ts'

export { ArticleInvalide }

export class ArticleIntrouvable extends Error {
  constructor(slug: string) {
    super(`Aucun article publié sous « ${slug} ».`)
    this.name = 'ArticleIntrouvable'
  }
}

/** Ce qu'on garde sur le disque, en plus de l'article lui-même. */
interface Enregistre extends Article {
  /** Date ISO de la dernière écriture. */
  readonly ecritLe: string
}

export class DepotArticles {
  private readonly fichier: string
  private cache: Enregistre[] | null = null

  constructor(fichier: string) {
    this.fichier = fichier
  }

  private async charger(): Promise<Enregistre[]> {
    if (this.cache !== null) return this.cache
    try {
      const brut = await readFile(this.fichier, 'utf8')
      const lu: unknown = JSON.parse(brut)
      // Un fichier corrompu vaut « aucun article » : la console repart de
      // zéro plutôt que de faire tomber l'API au démarrage.
      this.cache = Array.isArray(lu) ? (lu as Enregistre[]) : []
    } catch {
      this.cache = []
    }
    return this.cache
  }

  private async ecrire(articles: Enregistre[]): Promise<void> {
    this.cache = articles
    await mkdir(dirname(this.fichier), { recursive: true })
    await writeFile(this.fichier, JSON.stringify(articles, null, 2), 'utf8')
  }

  /** Tous les articles de la console, du plus récent au plus ancien. */
  async lister(): Promise<Article[]> {
    const articles = await this.charger()
    return [...articles]
      .sort((a, b) => b.publieLe.localeCompare(a.publieLe))
      .map(({ ecritLe: _ecritLe, ...article }) => article)
  }

  /**
   * Publie un article, ou remplace celui qui porte le même identifiant.
   *
   * Remplacer conserve la date de publication d'origine et note la date de
   * révision : un article corrigé ne doit pas remonter en tête de liste ni
   * repartir à neuf aux yeux d'un moteur de recherche.
   */
  async publier(saisie: unknown): Promise<Article> {
    if (typeof saisie !== 'object' || saisie === null) {
      throw new ArticleInvalide('Requête vide.')
    }
    const article = articleDepuisSaisie(saisie as Record<string, unknown>)
    const articles = await this.charger()
    const existant = articles.find((a) => a.slug === article.slug)
    const aujourdHui = new Date().toISOString().slice(0, 10)
    const enregistre: Enregistre = {
      ...article,
      publieLe: existant?.publieLe ?? article.publieLe,
      revuLe: existant === undefined ? null : aujourdHui,
      ecritLe: new Date().toISOString(),
    }
    await this.ecrire([...articles.filter((a) => a.slug !== article.slug), enregistre])
    const { ecritLe: _ecritLe, ...sansTrace } = enregistre
    return sansTrace
  }

  async retirer(slug: string): Promise<void> {
    const articles = await this.charger()
    if (!articles.some((a) => a.slug === slug)) throw new ArticleIntrouvable(slug)
    await this.ecrire(articles.filter((a) => a.slug !== slug))
  }

  /** Pour la console : combien d'articles, et quand le dernier a été écrit. */
  async etat(): Promise<{ readonly nombre: number; readonly dernierLe: string | null }> {
    const articles = await this.charger()
    const dates = articles.map((a) => a.ecritLe).sort()
    return { nombre: articles.length, dernierLe: dates[dates.length - 1] ?? null }
  }
}
