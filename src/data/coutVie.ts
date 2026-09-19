import type { Region } from '../types'

/**
 * Coût de la vie étudiant par ville / agglomération.
 *
 * Loyer moyen indicatif d'un studio / T1 (charges comprises), ordres de grandeur
 * observés sur le marché locatif étudiant (sources : observatoires des loyers,
 * enquêtes logement étudiant). Ces valeurs sont **indicatives** et à rafraîchir
 * périodiquement ; elles servent à comparer les villes entre elles.
 */

export interface CoutVille {
  /** Loyer mensuel moyen indicatif d'un studio / T1, charges comprises (€). */
  loyerStudio: number
  /** Budget de vie mensuel indicatif hors loyer (courses, transport, loisirs) (€). */
  budgetMensuelHorsLoyer: number
}

/** Normalise un nom de ville pour la recherche (minuscules, sans accents/tirets). */
function clef(ville: string): string {
  return ville
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-\s']/g, ' ')
    .trim()
}

/** Loyers moyens studio/T1 par ville (données indicatives). */
const VILLES: Record<string, CoutVille> = {
  paris: { loyerStudio: 900, budgetMensuelHorsLoyer: 550 },
  'boulogne billancourt': { loyerStudio: 850, budgetMensuelHorsLoyer: 520 },
  lyon: { loyerStudio: 620, budgetMensuelHorsLoyer: 480 },
  villeurbanne: { loyerStudio: 580, budgetMensuelHorsLoyer: 470 },
  marseille: { loyerStudio: 560, budgetMensuelHorsLoyer: 460 },
  'aix en provence': { loyerStudio: 620, budgetMensuelHorsLoyer: 470 },
  bordeaux: { loyerStudio: 590, budgetMensuelHorsLoyer: 470 },
  toulouse: { loyerStudio: 540, budgetMensuelHorsLoyer: 450 },
  lille: { loyerStudio: 560, budgetMensuelHorsLoyer: 450 },
  nantes: { loyerStudio: 560, budgetMensuelHorsLoyer: 450 },
  rennes: { loyerStudio: 540, budgetMensuelHorsLoyer: 440 },
  strasbourg: { loyerStudio: 520, budgetMensuelHorsLoyer: 440 },
  montpellier: { loyerStudio: 540, budgetMensuelHorsLoyer: 440 },
  nice: { loyerStudio: 650, budgetMensuelHorsLoyer: 470 },
  grenoble: { loyerStudio: 520, budgetMensuelHorsLoyer: 440 },
  dijon: { loyerStudio: 470, budgetMensuelHorsLoyer: 420 },
  caen: { loyerStudio: 470, budgetMensuelHorsLoyer: 410 },
  'clermont ferrand': { loyerStudio: 460, budgetMensuelHorsLoyer: 410 },
  'illkirch graffenstaden': { loyerStudio: 500, budgetMensuelHorsLoyer: 430 },
}

/** Loyer moyen de repli par région (quand la ville précise est inconnue). */
const REGIONS_DEFAUT: Partial<Record<Region, CoutVille>> = {
  'Île-de-France': { loyerStudio: 820, budgetMensuelHorsLoyer: 530 },
  'Auvergne-Rhône-Alpes': { loyerStudio: 540, budgetMensuelHorsLoyer: 450 },
  "Provence-Alpes-Côte d'Azur": { loyerStudio: 590, budgetMensuelHorsLoyer: 460 },
  'Nouvelle-Aquitaine': { loyerStudio: 520, budgetMensuelHorsLoyer: 440 },
  Occitanie: { loyerStudio: 510, budgetMensuelHorsLoyer: 440 },
  'Hauts-de-France': { loyerStudio: 500, budgetMensuelHorsLoyer: 430 },
  'Pays de la Loire': { loyerStudio: 520, budgetMensuelHorsLoyer: 440 },
  Bretagne: { loyerStudio: 510, budgetMensuelHorsLoyer: 430 },
  'Grand Est': { loyerStudio: 490, budgetMensuelHorsLoyer: 430 },
  Normandie: { loyerStudio: 470, budgetMensuelHorsLoyer: 420 },
  'Bourgogne-Franche-Comté': { loyerStudio: 460, budgetMensuelHorsLoyer: 410 },
  'Centre-Val de Loire': { loyerStudio: 470, budgetMensuelHorsLoyer: 420 },
  Corse: { loyerStudio: 550, budgetMensuelHorsLoyer: 450 },
}

/** Repli national si ni la ville ni la région ne sont connues. */
const DEFAUT_NATIONAL: CoutVille = { loyerStudio: 520, budgetMensuelHorsLoyer: 440 }

/**
 * Renvoie le coût de la vie estimé pour une ville, avec repli régional puis
 * national. Le loyer prime dans la comparaison entre villes.
 */
export function coutDeLaVie(ville: string, region: Region | null): CoutVille {
  const v = VILLES[clef(ville)]
  if (v) return v
  if (region && REGIONS_DEFAUT[region]) return REGIONS_DEFAUT[region]!
  return DEFAUT_NATIONAL
}

/** Budget mensuel total estimé (loyer + vie courante). */
export function budgetMensuel(ville: string, region: Region | null): number {
  const c = coutDeLaVie(ville, region)
  return c.loyerStudio + c.budgetMensuelHorsLoyer
}
