/**
 * Les thèmes de formation.
 *
 * ══ Ce qu'ils sont, et ce qu'ils ne sont pas ═════════════════════════════
 *
 * Le ministère publie une filière « très agrégée » — BTS, Licence, CPGE,
 * BUT… — qui dit le TYPE de formation, pas sa discipline. Un BTS peut être en
 * comptabilité comme en horticulture. Il n'existe donc, dans ce jeu de
 * données, aucun champ « droit », « sport » ou « langues ».
 *
 * Ces thèmes sont NOTRE regroupement. Chacun n'est rien d'autre qu'une liste
 * de mots cherchés dans l'intitulé publié des formations. Ce n'est pas une
 * nomenclature officielle, et l'écran le dit : présenter une classification
 * maison comme une taxonomie du ministère serait exactement le genre de petit
 * mensonge que ce site refuse.
 *
 * ══ Les conséquences, assumées ═══════════════════════════════════════════
 *
 * Une formation dont l'intitulé ne contient aucun des mots d'un thème n'y
 * apparaît pas, même si elle en relève. C'est pourquoi le champ de mots-clés
 * libres reste à côté : le thème est un raccourci, jamais un filtre qui
 * ferme.
 *
 * Les mots sont volontairement des RACINES — « juridi » plutôt que
 * « juridique » — pour attraper les déclinaisons sans avoir à les énumérer.
 * L'API du ministère cherche sur des mots entiers ; on écrit donc les formes
 * réellement employées dans les intitulés, vérifiées contre le jeu de
 * données le 20/09/2026.
 */

export interface Theme {
  readonly cle: string
  readonly libelle: string
  /** Mots cherchés dans l'intitulé de la formation, combinés en OU. */
  readonly mots: readonly string[]
}

export const THEMES: readonly Theme[] = [
  {
    cle: 'droit',
    libelle: 'Droit et justice',
    mots: ['droit', 'juridiques', 'notariat'],
  },
  {
    cle: 'sante',
    libelle: 'Santé et soin',
    mots: ['santé', 'infirmier', 'PASS', 'soins', 'médicale', 'pharmacie', 'kinésithérapie'],
  },
  {
    cle: 'sciences',
    libelle: 'Sciences',
    mots: ['mathématiques', 'physique', 'chimie', 'biologie', 'sciences'],
  },
  {
    cle: 'informatique',
    libelle: 'Informatique et numérique',
    mots: ['informatique', 'numérique', 'réseaux', 'données'],
  },
  {
    cle: 'ingenierie',
    libelle: 'Ingénierie et industrie',
    mots: ['ingénieur', 'mécanique', 'électrique', 'génie', 'industriels', 'maintenance'],
  },
  {
    cle: 'economie',
    libelle: 'Économie, gestion, commerce',
    mots: ['économie', 'gestion', 'commerce', 'management', 'comptabilité', 'marketing'],
  },
  {
    cle: 'langues',
    libelle: 'Langues et lettres',
    mots: ['langues', 'lettres', 'anglais', 'littérature', 'LEA'],
  },
  {
    cle: 'humanites',
    libelle: 'Histoire, géographie, sciences sociales',
    mots: ['histoire', 'géographie', 'sociologie', 'philosophie', 'politiques'],
  },
  {
    cle: 'arts',
    libelle: 'Arts, design, spectacle',
    mots: ['art', 'arts', 'design', 'audiovisuel', 'spectacle', 'musique', 'mode'],
  },
  {
    cle: 'sport',
    libelle: 'Sport',
    mots: ['STAPS', 'sport', 'sportives', 'sportif'],
  },
  {
    cle: 'social',
    libelle: 'Social et éducation',
    mots: ['social', 'éducateur', 'animation', 'enfance', 'éducation'],
  },
  {
    cle: 'nature',
    libelle: 'Agriculture et environnement',
    mots: ['agricole', 'agronomie', 'environnement', 'nature', 'paysage', 'forêt'],
  },
  {
    cle: 'tourisme',
    libelle: 'Tourisme, hôtellerie, restauration',
    mots: ['tourisme', 'hôtellerie', 'restauration', 'culinaires'],
  },
  {
    cle: 'batiment',
    libelle: 'Bâtiment et travaux publics',
    mots: ['bâtiment', 'travaux', 'construction', 'architecture'],
  },
  {
    cle: 'transport',
    libelle: 'Transport et logistique',
    mots: ['transport', 'logistique'],
  },
  {
    cle: 'communication',
    libelle: 'Communication et information',
    mots: ['communication', 'journalisme', 'documentation'],
  },
]

/** Les mots d'un thème, ou une liste vide si la clé n'en désigne aucun. */
export function motsDuTheme(cle: string): readonly string[] {
  return THEMES.find((t) => t.cle === cle)?.mots ?? []
}

/**
 * Les thèmes qu'évoque l'intitulé d'une formation.
 *
 * C'est l'inverse de la recherche : au lieu de chercher les formations d'un
 * thème, on demande de quels thèmes relève une formation donnée. Sert à
 * proposer des métiers sur sa fiche.
 *
 * ── En mots ENTIERS, et c'est tout le sujet ─────────────────────────────
 *
 * Une comparaison par sous-chaîne rangerait « transport » dans le thème
 * « sport », et « informatique » dans « mathématiques » dès qu'un mot en
 * contiendrait un autre. Constaté en construisant la table des métiers, sur
 * ce mot-là exactement.
 *
 * Les accents et la casse sont neutralisés d'abord : les intitulés du
 * ministère mêlent « Génie Électrique » et « genie electrique ».
 *
 * Rend une liste, jamais un seul thème : « Licence - Droit et économie »
 * relève des deux, et n'en garder qu'un appauvrirait la fiche sans raison.
 */
export function themesDuLibelle(libelle: string): string[] {
  const texte = ` ${normaliserMots(libelle)} `
  return THEMES.filter((t) =>
    t.mots.some((mot) => texte.includes(` ${normaliserMots(mot)} `)),
  ).map((t) => t.cle)
}

/** Minuscules, sans accent, ponctuation réduite à des espaces. */
function normaliserMots(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
