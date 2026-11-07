/**
 * Des thèmes de formation vers les métiers, et de là vers les offres d'emploi.
 *
 * ── Pourquoi cette table existe ──────────────────────────────────────────
 *
 * Parcoursup ne publie AUCUN lien entre une formation et un métier. L'Onisep
 * le publie, mais sous licence ODbL, dont le partage à l'identique
 * engagerait tout ce qu'on en dérive — décision D13 : on lie vers eux, on
 * n'intègre pas leur jeu.
 *
 * Cette table est donc **notre choix éditorial**, comme les seize thèmes
 * eux-mêmes. Elle relie chacun d'eux à des « domaines professionnels » du
 * ROME, le référentiel de France Travail : un code de trois caractères, par
 * exemple `M18` pour les systèmes d'information.
 *
 * L'écran doit le dire. Ce n'est pas une donnée publiée, c'est un
 * rapprochement que nous assumons, et il est approximatif à la maille du
 * domaine.
 *
 * ── Comment elle a été construite ────────────────────────────────────────
 *
 * Pas de mémoire, pas d'à-peu-près. Les mots-clés déjà vérifiés de chaque
 * thème ont été cherchés — en MOTS ENTIERS — dans les 1 911 libellés de
 * métiers du référentiel, et les domaines qui ressortaient ont été relus un
 * par un avant d'entrer ici.
 *
 * La recherche par sous-chaîne, essayée d'abord, rangeait le thème « sport »
 * dans les métiers du **trans**port. Les mots-clés avaient été écrits pour
 * l'opérateur de recherche du ministère, qui travaille par mots ; les
 * réemployer tels quels ailleurs ne va pas de soi.
 *
 * ── Ce que la table ne prétend pas ───────────────────────────────────────
 *
 * Qu'une formation mène à ces métiers-là et pas à d'autres. Un domaine
 * professionnel rassemble des dizaines de métiers, et un diplômé en exerce
 * souvent un qui n'y figure pas. C'est une piste, pas un destin.
 */

export interface Theme {
  /** Clé du thème, identique à celle de web/src/themes.ts. */
  readonly cle: string
  /**
   * Domaines professionnels du ROME, en trois caractères.
   * Vide quand aucun rapprochement honnête n'existe.
   */
  readonly domaines: readonly string[]
  /** Ce que la page dit du rapprochement. Jamais laissé implicite. */
  readonly note: string
}

/**
 * La correspondance, thème par thème.
 *
 * Chaque domaine cité ici a été relu dans le référentiel avant d'y entrer :
 * `metiers.test.ts` vérifie qu'ils existent tous, et qu'aucun n'a été
 * inventé.
 */
export const THEMES_METIERS: readonly Theme[] = [
  {
    cle: 'droit',
    domaines: ['K19'],
    note: 'Métiers du droit et de la justice : avocat, fiscaliste, mandataire de justice.',
  },
  {
    cle: 'sante',
    // Tout le domaine J : praticiens, biologie, soins, rééducation, infirmiers.
    domaines: ['J11', 'J12', 'J13', 'J14', 'J15'],
    note: 'Professions médicales, paramédicales et de rééducation.',
  },
  {
    cle: 'sciences',
    domaines: ['K24', 'H13'],
    note: 'Recherche et études — et les métiers de l’environnement industriel.',
  },
  {
    cle: 'informatique',
    domaines: ['M18', 'I14'],
    note: 'Systèmes d’information et télécommunications.',
  },
  {
    cle: 'ingenierie',
    domaines: ['H11', 'H12', 'H14', 'I13'],
    note: 'Conception, méthodes et maintenance industrielles.',
  },
  {
    cle: 'economie',
    domaines: ['C11', 'C12', 'M12', 'M13', 'M17'],
    note: 'Banque, assurance, gestion financière et direction commerciale.',
  },
  {
    cle: 'langues',
    // Aucun métier ne s'appelle « angliciste ». Un diplômé en langues
    // enseigne, traduit ou travaille dans la recherche : c'est la réponse
    // honnête, pas un trou dans la table.
    domaines: ['K21', 'K24'],
    note: 'Surtout l’enseignement et la recherche : aucun métier du référentiel ne porte le nom d’une langue.',
  },
  {
    cle: 'humanites',
    domaines: ['K21', 'K24', 'K16'],
    note: 'Enseignement, recherche, patrimoine et documentation.',
  },
  {
    cle: 'arts',
    domaines: ['B11', 'L12', 'L13', 'L15', 'E11'],
    note: 'Artisanat d’art, spectacle vivant, audiovisuel et communication.',
  },
  {
    cle: 'sport',
    domaines: ['G12', 'L14'],
    note: 'Animation sportive et sport professionnel — trois métiers seulement pour le second.',
  },
  {
    cle: 'social',
    domaines: ['K12', 'K13', 'K14', 'K21'],
    note: 'Action sociale, aide à la personne et enseignement.',
  },
  {
    cle: 'nature',
    domaines: ['A12', 'A13', 'A14', 'H13'],
    note: 'Agriculture, espaces verts, forêt et environnement.',
  },
  {
    cle: 'tourisme',
    domaines: ['G11', 'G13', 'G14', 'G15', 'G16', 'G18'],
    note: 'Hôtellerie, restauration, voyages et accueil.',
  },
  {
    cle: 'batiment',
    domaines: ['F11', 'F12', 'F16', 'F17'],
    note: 'Conception, conduite de travaux et second œuvre.',
  },
  {
    cle: 'transport',
    domaines: ['N11', 'N12', 'N13', 'N41', 'N42'],
    note: 'Logistique, conduite et exploitation des transports.',
  },
  {
    cle: 'communication',
    domaines: ['E11', 'E12', 'E14'],
    note: 'Communication, édition, production audiovisuelle.',
  },
]

const PAR_CLE = new Map(THEMES_METIERS.map((t) => [t.cle, t]))

export function themeMetiers(cle: string): Theme | null {
  return PAR_CLE.get(cle) ?? null
}

/** Un code ROME appartient-il à ce domaine professionnel ? */
export function dansLeDomaine(codeRome: string, domaine: string): boolean {
  return codeRome.slice(0, 3) === domaine
}

export interface Metier {
  readonly code: string
  readonly libelle: string
}

/**
 * Un échantillon des métiers d'un thème, réparti sur toute la liste.
 *
 * ── Pourquoi un échantillon ─────────────────────────────────────────────
 *
 * Une page qui affiche quatre-vingt-seize métiers ne se lit pas, et chacun
 * coûte un appel à l'API pour son compteur — dont la limite est de dix par
 * seconde.
 *
 * ── Pourquoi RÉPARTI et non les huit premiers ───────────────────────────
 *
 * Les huit premiers par ordre alphabétique, essayés d'abord, donnaient pour
 * la santé : agent de service hospitalier, agent de stérilisation,
 * aide-soignant, allergologue, ambulancier, angiologue, assistant dentaire,
 * assistant médico-technique. Huit métiers en « A », et pas un médecin — sur
 * la fiche d'une licence de médecine. Vu à l'écran.
 *
 * On prend donc des positions régulièrement espacées dans la liste triée. Ce
 * n'est toujours PAS un classement, et l'écran le dit ; mais l'échantillon
 * traverse le domaine au lieu d'en montrer la première lettre.
 *
 * Le classement par nombre d'offres serait mieux. Il suppose de compter les
 * quatre-vingt-seize métiers, donc un relevé quotidien en tâche de fond :
 * c'est la suite, pas ce lot.
 */
export function metiersDuTheme(
  cle: string,
  referentiel: readonly Metier[],
  combien = 8,
): Metier[] {
  const theme = PAR_CLE.get(cle)
  if (theme === undefined || theme.domaines.length === 0) return []
  const retenus = referentiel.filter((m) =>
    theme.domaines.some((d) => dansLeDomaine(m.code, d)),
  )
  // Tri par libellé : l'ordre du référentiel n'a aucun sens pour un lecteur,
  // et un ordre stable évite qu'une même page change d'un rechargement à
  // l'autre.
  retenus.sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
  if (retenus.length <= combien) return retenus

  const pas = retenus.length / combien
  return Array.from({ length: combien }, (_, i) => retenus[Math.floor(i * pas)]!)
}

/**
 * Un lien vers les offres de France Travail, côté candidat.
 *
 * Défini ICI, et pas des deux côtés : le serveur s'en sert pour les métiers
 * d'une fiche de formation, le navigateur pour les spécialités d'une école.
 * Deux constructions de la même URL divergeraient au premier changement de
 * leur site — et personne ne s'en apercevrait avant qu'un lien ne mène nulle
 * part.
 *
 * `motsCles` et non un code ROME : la recherche publique de France Travail
 * n'accepte pas les codes dans cette URL. C'est donc une recherche par mots,
 * moins précise que le comptage affiché à côté — qui, lui, passe par l'API et
 * filtre sur le code exact.
 */
export function lienOffresFranceTravail(motsCles: string, region: string | null): string {
  const p = new URLSearchParams({ motsCles })
  if (region !== null) p.set('region', region)
  return `https://candidat.francetravail.fr/offres/recherche?${p.toString()}`
}
