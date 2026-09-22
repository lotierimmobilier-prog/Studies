/**
 * Les adresses d'affiliation réglées depuis la console.
 *
 * ── Ce que ce dépôt contient, et ce qu'il ne contient pas ────────────────
 *
 * UNIQUEMENT des adresses. Le nom, le logo, la description et la mention de
 * rémunération de chaque partenaire vivent dans le dépôt de code
 * (`kitetudiant/web/src/partenaires.ts`), versionnés et relus.
 *
 * La raison est dans ce fichier-là, et elle vaut d'être redite ici : rendre
 * la mention réglable en même temps que le lien, ce serait rendre possible un
 * lien payé dont la phrase a été effacée — depuis un écran d'administration,
 * sans relecture et sans trace. Le lien voyage donc avec une mention qu'on ne
 * peut pas lui retirer.
 *
 * ── Pourquoi pas le coffre ──────────────────────────────────────────────
 *
 * `secrets.ts` chiffre des clés d'API. Une adresse d'affiliation n'est pas un
 * secret : elle est imprimée dans le HTML de la page d'accueil, visible par
 * quiconque ouvre le site. L'y ranger ferait croire à une confidentialité qui
 * n'existe pas, et ouvrirait la liste fermée de `SECRETS_GERES` à autre chose
 * que des secrets.
 *
 * ── Pourquoi pas la base ────────────────────────────────────────────────
 *
 * Le site tourne encore sans `DATABASE_URL`, et le lien partenaire doit
 * fonctionner dans les deux modes. Un fichier JSON, comme les articles écrits
 * en console (`articles.ts`) : même besoin, même durée de vie, même endroit.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  PARTENAIRES_GERES,
  lienAutorise,
  partenaireGere,
} from '../kitetudiant/packages/partenaires/src/index.ts'

export class PartenaireInconnu extends Error {
  constructor(nom: string) {
    super(`« ${nom} » n’est pas un partenaire de la liste.`)
    this.name = 'PartenaireInconnu'
  }
}

export class LienRefuse extends Error {
  constructor(raison: string) {
    super(raison)
    this.name = 'LienRefuse'
  }
}

/** Ce qu'on garde par partenaire réglé. */
interface Reglage {
  readonly lien: string
  readonly modifieLe: string
}

/** Ce que la console affiche, et ce que le site public consomme. */
export interface EtatPartenaire {
  readonly nom: string
  /** L'adresse effectivement posée sur le bouton. */
  readonly lien: string
  /** Celle du dépôt, pour que la console montre ce qu'un retrait rétablirait. */
  readonly lienParDefaut: string
  readonly personnalise: boolean
  readonly modifieLe: string | null
  readonly domaine: string
  /** `null` quand le lien ne nous rapporte rien. Non modifiable ici. */
  readonly remuneration: string | null
}

export class DepotPartenaires {
  private cache: Record<string, Reglage> | null = null

  constructor(private readonly fichier: string) {}

  private async charger(): Promise<Record<string, Reglage>> {
    if (this.cache !== null) return this.cache
    try {
      const lu: unknown = JSON.parse(await readFile(this.fichier, 'utf8'))
      /* Un fichier corrompu vaut « aucun réglage » : on retombe sur les
         adresses du dépôt, qui sont des valeurs déclarées et lisibles — pas
         un repli inventé. Faire tomber l'API priverait le site de sa page
         d'accueil pour une virgule. */
      this.cache =
        typeof lu === 'object' && lu !== null && !Array.isArray(lu)
          ? (lu as Record<string, Reglage>)
          : {}
    } catch {
      this.cache = {}
    }
    return this.cache
  }

  private async ecrire(reglages: Record<string, Reglage>): Promise<void> {
    this.cache = reglages
    await mkdir(dirname(this.fichier), { recursive: true })
    await writeFile(this.fichier, JSON.stringify(reglages, null, 2), 'utf8')
  }

  /**
   * L'état de chaque partenaire de la liste fermée.
   *
   * Un réglage dont l'adresse ne passe plus `lienAutorise` est IGNORÉ, pas
   * corrigé : le domaine d'un partenaire peut changer dans le code, et une
   * adresse devenue hors domaine ne doit pas continuer de s'afficher sous un
   * logo qui ne lui correspond plus.
   */
  async lister(): Promise<readonly EtatPartenaire[]> {
    const reglages = await this.charger()
    return PARTENAIRES_GERES.map((p) => {
      const reglage = reglages[p.nom]
      const valide = reglage !== undefined && lienAutorise(p, reglage.lien).ok
      return {
        nom: p.nom,
        lien: valide ? reglage.lien : p.lien,
        lienParDefaut: p.lien,
        personnalise: valide,
        modifieLe: valide ? reglage.modifieLe : null,
        domaine: p.domaine,
        remuneration: p.remuneration,
      }
    })
  }

  /** Les seules adresses qui diffèrent du dépôt. Ce que le site public lit. */
  async liens(): Promise<Record<string, string>> {
    const liens: Record<string, string> = {}
    for (const etat of await this.lister()) {
      if (etat.personnalise) liens[etat.nom] = etat.lien
    }
    return liens
  }

  /** Règle l'adresse d'un partenaire. Refuse plutôt que de normaliser. */
  async definir(nom: string, lien: string, maintenant = new Date()): Promise<EtatPartenaire> {
    const partenaire = partenaireGere(nom)
    if (partenaire === null) throw new PartenaireInconnu(nom)

    const verdict = lienAutorise(partenaire, lien)
    if (!verdict.ok) throw new LienRefuse(verdict.raison)

    const reglages = { ...(await this.charger()) }
    reglages[nom] = { lien: lien.trim(), modifieLe: maintenant.toISOString() }
    await this.ecrire(reglages)

    const etat = (await this.lister()).find((e) => e.nom === nom)
    if (etat === undefined) throw new PartenaireInconnu(nom)
    return etat
  }

  /** Rétablit l'adresse du dépôt. */
  async retablir(nom: string): Promise<EtatPartenaire> {
    if (partenaireGere(nom) === null) throw new PartenaireInconnu(nom)
    const reglages = { ...(await this.charger()) }
    delete reglages[nom]
    await this.ecrire(reglages)
    const etat = (await this.lister()).find((e) => e.nom === nom)
    if (etat === undefined) throw new PartenaireInconnu(nom)
    return etat
  }
}
