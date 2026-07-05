import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Cache disque simple avec TTL, pour éviter de re-scraper les sites d'écoles
 * à chaque requête (respect des serveurs distants + rapidité).
 */

interface Entree<T> {
  expire: number
  valeur: T
}

export class CacheDisque<T> {
  private memoire = new Map<string, Entree<T>>()

  constructor(
    private fichier: string,
    private ttlMs: number,
  ) {}

  /** Charge le cache depuis le disque au démarrage (best-effort). */
  async initialiser(): Promise<void> {
    try {
      const brut = await readFile(this.fichier, 'utf8')
      const obj = JSON.parse(brut) as Record<string, Entree<T>>
      for (const [k, v] of Object.entries(obj)) this.memoire.set(k, v)
    } catch {
      // Pas de cache existant : on démarre à vide.
    }
  }

  /** Retourne la valeur si présente et non expirée, sinon undefined. */
  get(clef: string, maintenant: number): T | undefined {
    const e = this.memoire.get(clef)
    if (!e) return undefined
    if (e.expire <= maintenant) {
      this.memoire.delete(clef)
      return undefined
    }
    return e.valeur
  }

  /** Enregistre une valeur et persiste le cache (best-effort). */
  async set(clef: string, valeur: T, maintenant: number): Promise<void> {
    this.memoire.set(clef, { valeur, expire: maintenant + this.ttlMs })
    await this.persister()
  }

  private async persister(): Promise<void> {
    try {
      await mkdir(dirname(this.fichier), { recursive: true })
      const obj = Object.fromEntries(this.memoire)
      await writeFile(this.fichier, JSON.stringify(obj), 'utf8')
    } catch {
      // Persistance best-effort : on ignore les erreurs disque.
    }
  }
}
