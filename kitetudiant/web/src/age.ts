/**
 * L'âge de l'élève, et ce qu'on lui montre en conséquence.
 *
 * ── Ce que le site sait, et ce qu'il n'a pas voulu savoir ────────────────
 *
 * Il ne demande que l'ANNÉE de naissance. La date complète ne sert à rien —
 * ni au calcul de l'APL, ni à ce module — et la règle 3 de CLAUDE.md demande
 * de minimiser ce qu'on collecte sur des mineurs. Conséquence : entre deux
 * personnes nées la même année, l'une a eu son anniversaire et l'autre non,
 * et leur âge réel diffère d'un an. On ne peut pas trancher.
 *
 * On retient donc toujours le PLUS PETIT des deux. Quelqu'un né en 2008, en
 * 2026, est compté pour dix-sept ans et non dix-huit, parce qu'il PEUT avoir
 * dix-sept ans. C'est le bon sens de l'erreur : dans l'autre, on montrerait
 * un contrat commercial à un mineur en croyant parler à un majeur.
 *
 * ── Ce que cette porte vaut, et ce qu'elle ne vaut pas ───────────────────
 *
 * L'année est DÉCLARATIVE. Personne ne la vérifie, et un élève de seize ans
 * qui veut passer tape 2004. C'est une barrière de bonne foi, pas un
 * contrôle d'identité — et c'est pour ça que ce qui se trouve derrière doit
 * rester acceptable même quand quelqu'un force le passage. Aucun écran ne
 * doit dépendre de cette porte pour être honnête.
 */

/** L'âge de la majorité en France. */
export const MAJORITE = 18

/**
 * L'âge, calculé au plus BAS de ce que l'année permet.
 *
 * Vivait dans `consentementBulletin.ts`, qui l'utilisait pour l'article 45 de
 * la loi Informatique et Libertés. Deux endroits ont maintenant besoin de la
 * même règle : la copier serait s'exposer à ce qu'elles divergent.
 */
export function ageMinimal(anneeNaissance: number, maintenant = new Date()): number {
  return maintenant.getFullYear() - anneeNaissance - 1
}

/**
 * `true` seulement si l'élève est majeur À COUP SÛR.
 *
 * L'année de ses dix-huit ans ne suffit pas : né en 2008, il peut n'avoir
 * dix-huit ans qu'en décembre 2026. Il faut attendre 2027 pour en être
 * certain. Un an de retard assumé, contre le risque de se tromper de sens.
 */
export function majeurCertain(anneeNaissance: number, maintenant = new Date()): boolean {
  return ageMinimal(anneeNaissance, maintenant) >= MAJORITE
}

/**
 * Ce qu'on sait de l'élève, du point de vue du contenu à lui montrer.
 *
 * `inconnu` est un état à part entière, et non un synonyme de `mineur` : il
 * dit qu'on n'a pas posé la question, ce qui appelle un autre écran — on
 * propose de la poser, au lieu de décider à sa place.
 */
export type Public = 'mineur' | 'majeur' | 'inconnu'

export function publicDe(anneeNaissance: number | null, maintenant = new Date()): Public {
  if (anneeNaissance === null || !Number.isFinite(anneeNaissance)) return 'inconnu'
  return majeurCertain(anneeNaissance, maintenant) ? 'majeur' : 'mineur'
}

/* -------------------------------------------------------- la mémoire */

/* L'année reste dans le NAVIGATEUR, jamais sur le compte.
 *
 * Elle ne sert qu'à choisir ce qu'on affiche — une décision qui se prend ici,
 * dans la page. La poser aussi sur le serveur ajouterait la date de naissance
 * d'un mineur à une base de données, pour un service que le navigateur rend
 * déjà. Le compte ne porte que l'adresse e-mail, et c'est écrit dans
 * `ProfilCompte` : cette exception-là n'a pas de raison d'être.
 *
 * Contrepartie assumée, à dire plutôt qu'à cacher : sur un deuxième appareil,
 * l'élève reverra la question. */
const CLE = 'kitetudiant.annee-naissance'

/** Bornes de plausibilité. En dehors, la saisie n'est pas une année. */
const PLUS_ANCIENNE = 1930

export function anneePlausible(annee: number, maintenant = new Date()): boolean {
  return Number.isInteger(annee) && annee >= PLUS_ANCIENNE && annee <= maintenant.getFullYear()
}

export function lireAnneeNaissance(
  lire: () => string | null = () => {
    try {
      return window.localStorage.getItem(CLE)
    } catch {
      return null
    }
  },
  maintenant = new Date(),
): number | null {
  const brut = lire()
  if (brut === null) return null
  const annee = Number.parseInt(brut, 10)
  // Une valeur abîmée s'efface comme une absence : on redemandera. La garder
  // ferait afficher un contenu choisi sur un nombre qui ne veut rien dire.
  return anneePlausible(annee, maintenant) ? annee : null
}

export function ecrireAnneeNaissance(
  annee: number,
  ecrire: (v: string) => void = (v) => {
    try {
      window.localStorage.setItem(CLE, v)
    } catch {
      // Stockage refusé : la question se reposera au prochain chargement.
    }
  },
  maintenant = new Date(),
): void {
  if (!anneePlausible(annee, maintenant)) return
  ecrire(String(annee))
}
