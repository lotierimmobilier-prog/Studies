/**
 * Collection de cartes.
 *
 * Une carte se gagne en SE SERVANT de l'outil — comparer des villes, déposer un
 * bulletin, ouvrir le détail d'un budget —, jamais en recrutant quelqu'un. Ce
 * choix n'est pas cosmétique : un mécanisme de parrainage adressé à des mineurs
 * obligerait à savoir qui a invité qui, donc à bâtir un graphe social d'élèves,
 * ce que la règle 3 de CLAUDE.md interdit. On garde la viralité — une carte se
 * partage en image — et on ne collecte rien.
 *
 * Trois autres règles du projet pèsent sur ce fichier :
 *
 *   - règle 1 : aucun montant ne vient d'un LLM. Les loyers des cartes sortent
 *     du jeu de communes versionné, comme partout ailleurs ;
 *   - règle 6 : chaque carte qui porte un euro porte sa source et son millésime.
 *     Une carte sans chiffre n'a pas de provenance, et c'est écrit `null`, pas
 *     une chaîne vide ;
 *   - rien n'est inventé, pas même la couleur d'une carte. Elle vient du
 *     décile du loyer de la commune parmi les 1 246 couvertes, et ce décile
 *     est aussi écrit en toutes lettres au-dessus du titre.
 *
 * Rien ne part au serveur. La collection vit dans le navigateur, comme les
 * notes et les vœux, et la promesse « aucune note enregistrée » reste vraie.
 */

import {
  loyerDe,
  loyersCentrauxTries,
  MILLESIME_LOYERS,
  nomCommune,
  SOURCE_LOYERS,
  SURFACE_TYPE,
} from './donnees.ts'
import { euros } from './nombres.ts'

/* ------------------------------------------------------------------ rareté */

export type Rarete = 'courante' | 'peu-frequente' | 'rare'

/**
 * Ce qui est écrit au-dessus du titre d'une carte de ville.
 *
 * « rare », « peu fréquente » : ce vocabulaire de collection disait au fond
 * quelque chose de vérifiable — la place du loyer parmi les communes
 * couvertes. Autant l'écrire. On y gagne une information utile et on y perd
 * un ton de jeu qui n'allait pas à un outil d'orientation.
 *
 * La rareté reste, mais seulement comme accent de couleur.
 */
export function situationDuLoyer(decile: number): string {
  if (decile <= 1) return 'parmi les 10 % de communes les moins chères'
  if (decile <= 3) return 'moins chère que sept communes sur dix'
  if (decile >= 10) return 'parmi les 10 % de communes les plus chères'
  if (decile >= 8) return 'plus chère que sept communes sur dix'
  return 'loyer proche de la médiane des communes couvertes'
}

/**
 * Décile du loyer d'une commune parmi toutes celles que l'indicateur couvre.
 * 1 = les 10 % les moins chères, 10 = les 10 % les plus chères.
 */
export function decileDuLoyer(euroParM2: number): number {
  const tries = loyersCentrauxTries()
  if (tries.length === 0) return 5
  let rang = 0
  while (rang < tries.length && tries[rang]! < euroParM2) rang += 1
  return Math.min(10, Math.floor((rang / tries.length) * 10) + 1)
}

/**
 * Les extrêmes sont rares parce qu'ils le sont : peu de communes ont un loyer
 * aussi bas ou aussi haut. Chercher une carte rare revient donc à regarder une
 * ville qu'on n'aurait pas regardée — exactement ce que le site cherche.
 */
export function rareteDuDecile(decile: number): Rarete {
  if (decile <= 1 || decile >= 10) return 'rare'
  if (decile <= 3 || decile >= 8) return 'peu-frequente'
  return 'courante'
}

/* ------------------------------------------------------------------ cartes */

export type Famille = 'ville' | 'etape' | 'ecart'

export interface Carte {
  readonly id: string
  readonly famille: Famille
  /** La ligne au-dessus du titre. `null` quand il n'y a rien de factuel à dire. */
  readonly mention: string | null
  readonly titre: string
  /** Le chiffre que porte la carte, déjà mis en forme. `null` s'il n'y en a pas. */
  readonly valeur: string | null
  readonly detail: string
  /** Source et millésime du chiffre. `null` quand la carte n'en porte aucun. */
  readonly provenance: string | null
  readonly rarete: Rarete
}

/** Identifiants des cartes d'étape, fixés ici une fois pour toutes. */
export type IdEtape =
  | 'premier-budget'
  | 'trois-villes'
  | 'dix-villes'
  | 'bulletin'
  | 'trois-bulletins'
  | 'detail'
  | 'hors-academie'
  | 'vingt-villes'

interface DefinitionEtape {
  readonly titre: string
  readonly detail: string
  readonly rarete: Rarete
}

export const ETAPES_CARTES: Readonly<Record<IdEtape, DefinitionEtape>> = {
  'premier-budget': {
    titre: 'Premier budget',
    detail: 'Tu as calculé ce qu’il te resterait pour vivre, une fois sur place.',
    rarete: 'courante',
  },
  'trois-villes': {
    titre: 'Trois villes',
    detail: 'Trois communes comparées : le coût de la vie n’est plus une abstraction.',
    rarete: 'courante',
  },
  'dix-villes': {
    titre: 'Dix villes',
    detail: 'Dix communes regardées. Peu de gens élargissent autant leurs vœux.',
    rarete: 'rare',
  },
  bulletin: {
    titre: 'Bulletin lu',
    detail: 'Tes signaux sont extraits. Le texte des appréciations, lui, n’est pas conservé.',
    rarete: 'peu-frequente',
  },
  'trois-bulletins': {
    titre: 'Trois bulletins',
    detail:
      'Trois trimestres déposés : ta progression se voit, et c’est elle que lisent les ' +
      'commissions.',
    rarete: 'rare',
  },
  detail: {
    titre: 'Ligne par ligne',
    detail: 'Tu as ouvert un budget en entier : chaque euro, sa source, son millésime.',
    rarete: 'peu-frequente',
  },
  'hors-academie': {
    titre: 'Hors de ton académie',
    detail: 'Un vœu ailleurs. C’est souvent là que se trouve la formation qui te va.',
    rarete: 'peu-frequente',
  },
  'vingt-villes': {
    titre: 'Vingt villes',
    detail:
      'Vingt communes chiffrées. À ce stade, tu connais mieux la carte que la plupart ' +
      'des candidats.',
    rarete: 'rare',
  },
}

/** Identifiant stable d'une carte de ville. */
export function idVille(codeInsee: string): string {
  return `ville:${codeInsee}`
}

/** Identifiant stable d'une carte d'étape. */
export function idEtape(etape: IdEtape): string {
  return `etape:${etape}`
}

/**
 * La carte d'une commune, ou `null` si son loyer est inconnu.
 *
 * Pas de repli silencieux : une commune sans loyer ne donne pas de carte, elle
 * n'en donne pas une vide.
 */
export function carteVille(codeInsee: string): Carte | null {
  const loyer = loyerDe(codeInsee)
  const nom = nomCommune(codeInsee)
  if (loyer === null || nom === null) return null
  const decile = decileDuLoyer(loyer.euroParM2.central)
  return {
    id: idVille(codeInsee),
    famille: 'ville',
    mention: situationDuLoyer(decile),
    titre: nom.replace(/\s+Arrondissement$/i, ''),
    valeur: `${euros(loyer.euroParM2.central * SURFACE_TYPE)} / mois`,
    detail: `Studio de ${SURFACE_TYPE} m², loyer d’annonce charges comprises.`,
    provenance: `${SOURCE_LOYERS}, millésime ${MILLESIME_LOYERS}`,
    rarete: rareteDuDecile(decile),
  }
}

/** La carte d'une étape franchie. */
export function carteEtape(etape: IdEtape): Carte {
  const def = ETAPES_CARTES[etape]
  return {
    id: idEtape(etape),
    famille: 'etape',
    // Une étape franchie n'a pas de chiffre : rien à mentionner au-dessus.
    mention: null,
    titre: def.titre,
    valeur: null,
    detail: def.detail,
    provenance: null,
    rarete: def.rarete,
  }
}

/**
 * La carte « écart » : la différence de loyer entre la ville la moins chère et
 * la plus chère de la collection.
 *
 * Elle n'est pas stockée, elle se recalcule à chaque affichage — sa valeur
 * change à mesure que la collection grandit, et une valeur figée mentirait.
 * `null` tant qu'il n'y a pas deux villes à comparer.
 */
export function carteEcart(codesInsee: readonly string[]): Carte | null {
  const loyers: { readonly nom: string; readonly m2: number }[] = []
  for (const code of codesInsee) {
    const loyer = loyerDe(code)
    const nom = nomCommune(code)
    if (loyer !== null && nom !== null) loyers.push({ nom, m2: loyer.euroParM2.central })
  }
  if (loyers.length < 2) return null
  const tries = [...loyers].sort((a, b) => a.m2 - b.m2)
  const bas = tries[0]!
  const haut = tries[tries.length - 1]!
  if (haut.m2 === bas.m2) return null
  const ecart = (haut.m2 - bas.m2) * SURFACE_TYPE
  const lisible = (n: string): string => n.replace(/\s+Arrondissement$/i, '')
  return {
    id: 'ecart',
    famille: 'ecart',
    mention: 'entre les deux villes que tu as comparées',
    titre: 'L’écart',
    valeur: `${euros(ecart)} / mois`,
    detail: `Ce qui sépare ${lisible(bas.nom)} de ${lisible(haut.nom)}, à logement identique.`,
    provenance: `${SOURCE_LOYERS}, millésime ${MILLESIME_LOYERS}`,
    rarete: 'rare',
  }
}

/* ----------------------------------------------------------- la collection */

export interface Obtention {
  readonly id: string
  /** Date ISO du jour où la carte a été gagnée. */
  readonly le: string
}

const CLE = 'kitetudiant.collection'

/**
 * localStorage peut lever (navigation privée, stockage bloqué) et peut rendre
 * n'importe quoi si quelqu'un l'a modifié à la main. Tout est donc enveloppé,
 * et une valeur illisible vaut « collection vide » plutôt qu'une page blanche.
 */
export function chargerCollection(): Obtention[] {
  try {
    const brut = window.localStorage.getItem(CLE)
    if (brut === null) return []
    const lu: unknown = JSON.parse(brut)
    if (!Array.isArray(lu)) return []
    return lu.filter(
      (o): o is Obtention =>
        typeof o === 'object' &&
        o !== null &&
        typeof (o as Obtention).id === 'string' &&
        typeof (o as Obtention).le === 'string',
    )
  } catch {
    return []
  }
}

export function enregistrerCollection(collection: readonly Obtention[]): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(collection))
  } catch {
    // Stockage refusé : la collection de cette session reste en mémoire, et
    // rien d'autre ne casse. Mieux vaut une collection oubliée qu'une erreur.
  }
}

/**
 * Ajoute des cartes sans jamais dupliquer ni réécrire une date déjà acquise.
 * Renvoie une nouvelle liste ; l'ancienne n'est pas touchée.
 */
export function ajouter(
  collection: readonly Obtention[],
  ids: readonly string[],
  leJour: string,
): Obtention[] {
  const connus = new Set(collection.map((o) => o.id))
  const ajoutees = ids.filter((id) => !connus.has(id)).map((id) => ({ id, le: leJour }))
  return ajoutees.length === 0 ? [...collection] : [...collection, ...ajoutees]
}

/** Les codes INSEE des villes présentes dans une collection. */
export function villesDe(collection: readonly Obtention[]): string[] {
  return collection
    .filter((o) => o.id.startsWith('ville:'))
    .map((o) => o.id.slice('ville:'.length))
}

/**
 * Les cartes à afficher, dans un ordre stable : l'écart d'abord quand il
 * existe, puis les étapes dans l'ordre du catalogue, puis les villes de la plus
 * chère à la moins chère.
 *
 * Une obtention dont la carte n'existe plus (commune retirée d'un millésime)
 * est ignorée plutôt qu'affichée à moitié.
 */
export function cartesDe(collection: readonly Obtention[]): Carte[] {
  const ids = new Set(collection.map((o) => o.id))
  const cartes: Carte[] = []

  const villes = villesDe(collection)
  const ecart = carteEcart(villes)
  if (ecart !== null) cartes.push(ecart)

  for (const etape of Object.keys(ETAPES_CARTES) as IdEtape[]) {
    if (ids.has(idEtape(etape))) cartes.push(carteEtape(etape))
  }

  const cartesVilles: Carte[] = []
  for (const code of villes) {
    const carte = carteVille(code)
    if (carte !== null) cartesVilles.push(carte)
  }
  cartesVilles.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  cartes.push(...cartesVilles)

  return cartes
}

/** Nombre total de cartes qu'il est possible d'obtenir aujourd'hui. */
export function cartesPossibles(nombreCommunes: number): number {
  return Object.keys(ETAPES_CARTES).length + nombreCommunes + 1 // + la carte « écart »
}

/** Combien de récompenses existent en tout. Six, et elles ne bougent pas. */
export function recompensesPossibles(): number {
  return Object.keys(ETAPES_CARTES).length
}

/**
 * Sépare les deux natures de cartes.
 *
 * Elles étaient mélangées dans une grille unique, et le compteur annonçait
 * « 8 cartes sur 1 253 » : un dénominateur écrasé par les villes, qui faisait
 * passer six récompenses réellement méritées pour un score dérisoire. Ce
 * n'était pas qu'un défaut d'affichage — cela rendait le mécanisme
 * incompréhensible.
 *
 * Une RÉCOMPENSE marque ce que l'élève a fait : un premier budget calculé,
 * trois villes comparées, un bulletin lu. Elles sont six, on peut les avoir
 * toutes, et c'est cela qui se progresse.
 *
 * Une carte de VILLE est une pièce d'album : elle retient une commune
 * regardée, avec son loyer et sa place parmi les autres. Il y en a autant que
 * de communes couvertes, et personne ne les aura jamais toutes.
 */
export function separerCartes(cartes: readonly Carte[]): {
  readonly recompenses: Carte[]
  readonly villes: Carte[]
} {
  return {
    recompenses: cartes.filter((c) => c.famille === 'etape'),
    // La carte « écart » compare deux villes : sa place est dans l'album,
    // pas parmi les récompenses, parce qu'elle décrit une donnée et non un
    // geste accompli.
    villes: cartes.filter((c) => c.famille !== 'etape'),
  }
}

/* ------------------------------------------------- ce qu'une visite débloque */

/**
 * Ce qu'une session de résultats fait gagner.
 *
 * Fonction pure : elle reçoit ce que l'élève vient de faire et renvoie les
 * identifiants gagnés. Aucun accès au stockage, aucun effet de bord — c'est ce
 * qui la rend testable, et ce qui évite qu'une carte apparaisse par accident.
 */
export interface Activite {
  /** Communes pour lesquelles un reste-à-vivre a bel et bien été calculé. */
  readonly communesChiffrees: readonly string[]
  /** L'élève a ouvert le détail d'un budget, ligne par ligne. */
  readonly detailOuvert: boolean
  /**
   * Nombre de bulletins analysés — un booléen ne disait que « au moins un »,
   * et ne pouvait donc récompenser que le premier. Les paliers se comptent.
   */
  readonly bulletinsLus: number
  /** Académie de l'élève, et celles des formations regardées. */
  readonly academieEleve: string | null
  readonly academiesRegardees: readonly string[]
}

export function cartesGagnees(activite: Activite): string[] {
  const gagnees: string[] = []

  const villes = [...new Set(activite.communesChiffrees)].filter((c) => loyerDe(c) !== null)
  for (const code of villes) gagnees.push(idVille(code))

  if (villes.length >= 1) gagnees.push(idEtape('premier-budget'))
  if (villes.length >= 3) gagnees.push(idEtape('trois-villes'))
  if (villes.length >= 10) gagnees.push(idEtape('dix-villes'))
  if (villes.length >= 20) gagnees.push(idEtape('vingt-villes'))
  if (activite.detailOuvert) gagnees.push(idEtape('detail'))
  if (activite.bulletinsLus >= 1) gagnees.push(idEtape('bulletin'))
  if (activite.bulletinsLus >= 3) gagnees.push(idEtape('trois-bulletins'))

  // « Hors de ton académie » n'a de sens que si l'on connaît la sienne : sans
  // elle, on ne décerne rien plutôt que de supposer.
  if (activite.academieEleve !== null && activite.academieEleve !== '') {
    const ailleurs = activite.academiesRegardees.some(
      (a) => a !== '' && a !== activite.academieEleve,
    )
    if (ailleurs) gagnees.push(idEtape('hors-academie'))
  }

  return gagnees
}

/* ----------------------------------------------------- export et import */

/**
 * La collection au format texte, pour la reprendre sur un autre appareil.
 * Rien n'est chiffré : il n'y a rien de personnel dedans, seulement des noms
 * de villes déjà publics et des dates.
 */
export function exporter(collection: readonly Obtention[]): string {
  return JSON.stringify({ version: 1, cartes: collection }, null, 2)
}

export function importer(texte: string): Obtention[] | null {
  try {
    const lu: unknown = JSON.parse(texte)
    if (typeof lu !== 'object' || lu === null) return null
    const cartes = (lu as { cartes?: unknown }).cartes
    if (!Array.isArray(cartes)) return null
    return cartes.filter(
      (o): o is Obtention =>
        typeof o === 'object' &&
        o !== null &&
        typeof (o as Obtention).id === 'string' &&
        typeof (o as Obtention).le === 'string',
    )
  } catch {
    return null
  }
}
