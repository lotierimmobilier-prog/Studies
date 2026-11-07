/**
 * La recherche dans les articles.
 *
 * ── Pourquoi elle tourne dans le navigateur ──────────────────────────────
 *
 * Onze articles font quelques dizaines de milliers de caractères : ils sont
 * déjà chargés quand la liste s'affiche. Une recherche côté serveur
 * demanderait un aller-retour par frappe, ferait connaître au serveur ce que
 * chaque visiteur cherche, et n'irait pas plus vite. Le site promet « aucun
 * traceur » à des mineurs : ne pas envoyer leurs requêtes est la façon la
 * plus sûre de ne pas les conserver.
 *
 * ── Ce qu'elle fait, et ce qu'elle ne prétend pas faire ──────────────────
 *
 * Elle cherche des MOTS, tous les mots saisis, n'importe où dans l'article.
 * Elle ne devine pas les synonymes, ne corrige pas les fautes, et n'affiche
 * aucun score de pertinence en pourcentage — un chiffre de ce genre aurait
 * l'air d'une mesure alors qu'il ne serait qu'un réglage interne.
 *
 * Le classement, lui, est explicable en une phrase : un mot trouvé dans le
 * titre compte plus qu'un mot trouvé dans le chapeau, qui compte plus qu'un
 * mot trouvé dans le corps.
 *
 * ── Les accents ──────────────────────────────────────────────────────────
 *
 * « vœux » doit se trouver en tapant « voeux », et « académie » en tapant
 * « academie ». Sur un site français consulté au téléphone, exiger les
 * accents reviendrait à n'avoir pas de recherche du tout.
 */

import { type Article } from './index.ts'

/**
 * Réduit un texte à sa forme comparable : minuscules, sans accent, sans
 * ligature. `NFD` sépare la lettre de son accent, et la plage U+0300-U+036F
 * retire les accents ainsi détachés.
 */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .toLowerCase()
}

/** Les mots d'une requête, vidés de leur ponctuation. */
export function motsDe(requete: string): string[] {
  return normaliser(requete)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 0)
}

/** Le poids de chaque endroit où un mot peut se trouver. */
const POIDS = { titre: 8, chapeau: 4, motCle: 3, corps: 1 } as const

export interface Trouvaille {
  readonly article: Article
  /**
   * Un score interne, qui sert UNIQUEMENT à ordonner. Il n'est pas affiché :
   * un nombre montré à l'écran passerait pour une mesure de pertinence,
   * alors que c'est un réglage.
   */
  readonly score: number
  /** Le passage du corps où un mot a été trouvé, ou `null`. */
  readonly extrait: string | null
}

function textesDuCorps(article: Article): string[] {
  return article.corps.flatMap((b) => (b.type === 'liste' ? [...b.points] : [b.texte]))
}

/**
 * Un extrait centré sur le premier mot trouvé, coupé aux espaces.
 *
 * Couper au caractère près donnerait « …ndre Parcoursup en di… » ; on recule
 * donc jusqu'à l'espace le plus proche. Les bornes sont marquées par une
 * ellipse seulement quand on a réellement coupé.
 */
function extraireAutour(texte: string, mot: string, largeur = 150): string | null {
  const ou = normaliser(texte).indexOf(mot)
  if (ou < 0) return null
  const debutBrut = Math.max(0, ou - Math.floor(largeur / 3))
  const finBrut = Math.min(texte.length, debutBrut + largeur)
  const debut = debutBrut === 0 ? 0 : texte.indexOf(' ', debutBrut) + 1
  const fin = finBrut === texte.length ? texte.length : texte.lastIndexOf(' ', finBrut)
  const coupe = texte.slice(debut, fin).trim()
  return `${debut > 0 ? '…' : ''}${coupe}${fin < texte.length ? '…' : ''}`
}

/**
 * Les articles qui contiennent TOUS les mots de la requête.
 *
 * Tous, et non au moins un : chercher « logement bourse » doit rendre les
 * articles qui parlent des deux, pas la moitié du blog. Un « ou » implicite
 * donne des listes longues où le bon résultat se noie.
 *
 * Une requête vide rend la liste entière, dans son ordre d'origine — c'est
 * le cas normal au chargement de la page, pas une absence de résultat.
 */
export function chercherArticles(
  articles: readonly Article[],
  requete: string,
): Trouvaille[] {
  const mots = motsDe(requete)
  if (mots.length === 0) {
    return articles.map((article) => ({ article, score: 0, extrait: null }))
  }

  const trouvailles: Trouvaille[] = []
  for (const article of articles) {
    const titre = normaliser(article.titre)
    const chapeau = normaliser(article.chapeau)
    const motsCles = normaliser(article.motsCles.join(' '))
    const corps = textesDuCorps(article)
    const corpsNormalise = normaliser(corps.join(' '))

    let score = 0
    let extrait: string | null = null
    let tousTrouves = true

    for (const mot of mots) {
      let ici = 0
      if (titre.includes(mot)) ici += POIDS.titre
      if (chapeau.includes(mot)) ici += POIDS.chapeau
      if (motsCles.includes(mot)) ici += POIDS.motCle
      if (corpsNormalise.includes(mot)) {
        ici += POIDS.corps
        if (extrait === null) {
          for (const texte of corps) {
            extrait = extraireAutour(texte, mot)
            if (extrait !== null) break
          }
        }
      }
      if (ici === 0) {
        tousTrouves = false
        break
      }
      score += ici
    }

    if (tousTrouves) trouvailles.push({ article, score, extrait })
  }

  // À score égal, l'ordre d'origine est conservé : `sort` est stable en
  // JavaScript depuis ES2019, donc deux articles aussi pertinents restent
  // dans l'ordre choisi par la rédaction plutôt que dans un ordre arbitraire.
  return trouvailles.sort((a, b) => b.score - a.score)
}
