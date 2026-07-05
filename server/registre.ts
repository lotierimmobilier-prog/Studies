import type { PrixFormation, RequetePrix } from './types'

/** Normalise un nom d'établissement pour la comparaison. */
export function clefEtab(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface EntreeCuratee {
  /** Fragments qui doivent apparaître dans le nom normalisé de l'établissement. */
  motifs: string[]
  prixAnnuel: number | null
  gratuitBoursier?: boolean
  url?: string
  note?: string
}

/**
 * Base curée de frais de scolarité (ordres de grandeur réels, à rafraîchir).
 * Sert de vérité prioritaire et de repli fiable quand le scraping échoue.
 * Les montants sont indicatifs : toujours vérifier sur le site de l'école.
 */
const REGISTRE: EntreeCuratee[] = [
  {
    motifs: ['epita'],
    prixAnnuel: 10600,
    url: 'https://www.epita.fr',
    note: "École d'ingénieurs privée",
  },
  {
    motifs: ['epitech'],
    prixAnnuel: 9080,
    url: 'https://www.epitech.eu',
    note: 'École privée informatique',
  },
  {
    motifs: ['hec'],
    prixAnnuel: 18500,
    url: 'https://www.hec.edu',
    note: 'Grande école de commerce',
  },
  {
    motifs: ['emlyon', 'em lyon'],
    prixAnnuel: 17500,
    url: 'https://em-lyon.com',
    note: 'École de commerce',
  },
  {
    motifs: ['essec'],
    prixAnnuel: 18000,
    url: 'https://www.essec.edu',
    note: 'École de commerce',
  },
  {
    motifs: ['insa'],
    prixAnnuel: 600,
    gratuitBoursier: true,
    note: "École d'ingénieurs publique",
  },
  {
    motifs: ['polytechnique'],
    prixAnnuel: 0,
    gratuitBoursier: true,
    note: 'Cycle ingénieur rémunéré',
  },
  {
    motifs: ['sciences po', 'iep'],
    prixAnnuel: 0,
    gratuitBoursier: true,
    note: 'Frais selon revenus (barème progressif)',
  },
]

/** Cherche une entrée curée correspondant à l'établissement. */
export function chercherCurated(etablissement: string): EntreeCuratee | null {
  const clef = clefEtab(etablissement)
  return (
    REGISTRE.find((e) => e.motifs.every((m) => clef.includes(clefEtab(m)))) ??
    REGISTRE.find((e) => e.motifs.some((m) => clef.includes(clefEtab(m)))) ??
    null
  )
}

/**
 * Estimation de repli par catégorie, à partir du statut et de la filière de
 * l'open data, quand ni la base curée ni le scraping ne donnent de prix.
 */
export function estimerParCategorie(req: RequetePrix): PrixFormation {
  const statut = (req.statut ?? '').toLowerCase()
  const fili = (req.fili ?? '').toLowerCase()
  const formation = (req.formation ?? '').toLowerCase()
  const base = {
    etablissement: req.etablissement,
    devise: 'EUR' as const,
    source: 'estimation' as const,
    dateMaj: '',
  }

  const estPublic = statut.includes('public')
  const estPrive = statut.includes('priv')

  if (estPublic) {
    // Droits nationaux ~175 €/an ; BTS/CPGE en lycée public gratuits.
    if (fili.includes('bts') || fili.includes('cpge'))
      return {
        ...base,
        prixAnnuel: 0,
        gratuitBoursier: true,
        note: 'Formation publique en lycée : gratuite (hors frais annexes)',
      }
    return {
      ...base,
      prixAnnuel: 175,
      gratuitBoursier: true,
      note: 'Droits d\'inscription nationaux (public), boursiers exonérés',
    }
  }

  if (estPrive) {
    // Fourchettes indicatives selon le type de formation.
    if (formation.includes('ingenieur') || formation.includes('ingénieur'))
      return { ...base, prixAnnuel: 9000, note: 'École d\'ingénieurs privée (fourchette ~7 000–12 000 €)' }
    if (formation.includes('commerce') || formation.includes('management'))
      return { ...base, prixAnnuel: 11000, note: 'École de commerce privée (fourchette ~8 000–18 000 €)' }
    return { ...base, prixAnnuel: 6000, note: 'Établissement privé (fourchette indicative)' }
  }

  return { ...base, prixAnnuel: null, note: 'Frais à vérifier sur le site de l\'établissement' }
}
