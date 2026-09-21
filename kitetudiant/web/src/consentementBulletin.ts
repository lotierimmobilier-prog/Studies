/**
 * Le consentement au dépôt d'un bulletin.
 *
 * ── Ce que le dépôt fait réellement ──────────────────────────────────────
 *
 * Le fichier part sur notre serveur, puis à l'API Claude d'Anthropic, qui
 * en lit les moyennes et les appréciations (`server/bulletinScolaire.ts`).
 * Rien n'est écrit sur disque et le texte brut des appréciations n'est pas
 * gardé — mais « non conservé » et « jamais envoyé » ne sont pas la même
 * chose, et c'est la seconde que trois écrans ont longtemps promise.
 *
 * Un traitement pareil ne se fait pas en silence. Ce module porte les deux
 * conditions qui l'autorisent : que l'élève ait lu ce qui se passe et
 * l'accepte, et qu'il ait l'âge de le décider.
 *
 * ── Pourquoi une VERSION du texte ────────────────────────────────────────
 *
 * Un consentement vaut pour ce qui a été dit au moment où il est donné.
 * Le jour où le texte change — un sous-traitant de plus, une durée qui
 * bouge — l'accord d'hier ne couvre plus rien. Sans version enregistrée,
 * personne ne peut le savoir, et on continuerait de s'appuyer sur un
 * consentement périmé.
 *
 * Incrémenter `VERSION_CONSENTEMENT` invalide donc tous les accords
 * précédents : on redemande. C'est le comportement voulu, pas un effet de
 * bord.
 */

import { ageMinimal } from './age.ts'

/**
 * À changer dès que `TEXTE_CONSENTEMENT` change de SENS.
 *
 * Une virgule déplacée ne compte pas ; un destinataire de plus, si.
 */
export const VERSION_CONSENTEMENT = 1

/**
 * L'âge en dessous duquel le dépôt est refusé.
 *
 * L'article 45 de la loi Informatique et Libertés fixe à 15 ans l'âge où
 * un mineur peut consentir seul au traitement de ses données. En dessous,
 * il faut le consentement conjoint d'un titulaire de l'autorité parentale
 * — un circuit vérifiable qui n'existe pas ici.
 *
 * Plutôt que de faire semblant de le recueillir, on refuse le dépôt et on
 * propose la saisie à la main, qui n'envoie rien à personne.
 */
export const AGE_MINIMUM = 15

/**
 * Le texte que l'élève lit avant d'accepter.
 *
 * Il dit QUOI part, À QUI, POURQUOI, ce qui REVIENT, ce qui n'est PAS
 * gardé, et qu'on peut s'en passer. Nommer Anthropic n'est pas un détail :
 * « un prestataire » ne permet à personne de se faire un avis.
 */
export const TEXTE_CONSENTEMENT = {
  titre: 'Avant de déposer un bulletin',
  points: [
    'Le fichier est envoyé à notre serveur, puis à l’API Claude d’Anthropic, qui le lit.',
    'Ce qui en revient : tes moyennes par matière, trois indicateurs chiffrés, et un ' +
      'résumé écrit des appréciations.',
    'Ce qui n’est pas gardé : le fichier lui-même, qui n’est enregistré nulle part, et ' +
      'le texte des appréciations de tes professeurs.',
    'Tu peux t’en passer : saisir tes moyennes à la main donne le même résultat, et ' +
      'rien ne quitte alors ton appareil.',
  ],
  case: 'J’ai lu ce qui précède et j’accepte que mon bulletin soit lu de cette façon.',
} as const

/** Ce qu'on retient d'un accord donné. */
export interface Consentement {
  /** Horodatage ISO. Un accord sans date ne se vérifie pas. */
  readonly le: string
  /** La version du texte accepté. Voir `VERSION_CONSENTEMENT`. */
  readonly version: number
}

const CLE = 'kitetudiant.consentement.bulletin'

/* L'âge se calcule dans `age.ts`, plus ici.
 *
 * Deux écrans ont désormais besoin de la même règle du plus bas : le dépôt de
 * bulletin, pour les quinze ans de l'article 45, et le choix du contenu, pour
 * la majorité. La copier serait s'exposer à ce que les deux divergent — et
 * c'est précisément la règle qu'on ne veut jamais voir diverger.
 *
 * Réexportée ici : les appelants du consentement n'ont pas à savoir où elle
 * vit, et rien de ce qui importait `ageMinimal` depuis ce module ne casse.
 */
export { ageMinimal } from './age.ts'

/** `true` si l'élève a l'âge de décider seul du dépôt de son bulletin. */
export function assezAge(anneeNaissance: number, maintenant = new Date()): boolean {
  return ageMinimal(anneeNaissance, maintenant) >= AGE_MINIMUM
}

/**
 * L'accord enregistré, s'il couvre la version actuelle du texte.
 *
 * Un accord d'une version antérieure est traité comme absent : il portait
 * sur autre chose.
 */
export function consentementDonne(
  lire: () => string | null = () => {
    try {
      return window.localStorage.getItem(CLE)
    } catch {
      /* Navigation privée, stockage bloqué : on redemandera, ce qui est le
         comportement sûr. Mieux vaut redemander que présumer un accord. */
      return null
    }
  },
): Consentement | null {
  const brut = lire()
  if (brut === null) return null
  try {
    const c = JSON.parse(brut) as Partial<Consentement>
    if (typeof c.le !== 'string' || c.version !== VERSION_CONSENTEMENT) return null
    return { le: c.le, version: c.version }
  } catch {
    return null
  }
}

/** Enregistre l'accord, daté et versionné. */
export function poserConsentement(maintenant = new Date()): Consentement {
  const c: Consentement = { le: maintenant.toISOString(), version: VERSION_CONSENTEMENT }
  try {
    window.localStorage.setItem(CLE, JSON.stringify(c))
  } catch {
    /* On garde l'accord pour cette session malgré tout : refuser le dépôt
       parce que le navigateur bloque le stockage punirait l'élève pour un
       réglage qui n'a rien à voir. */
  }
  return c
}

/** Retire l'accord. Utilisé par les tests, et par un éventuel « revenir ». */
export function retirerConsentement(): void {
  try {
    window.localStorage.removeItem(CLE)
  } catch {
    /* Rien à faire : sans stockage, il n'y avait rien à retirer. */
  }
}
