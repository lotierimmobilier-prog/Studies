/**
 * Le calendrier Parcoursup.
 *
 * ── Ce que ce fichier contient, et ce qu'il ne contient pas ──────────────
 *
 * Il contient UNE donnée réelle : les dates de la session 2026, telles que le
 * ministère les a publiées. Elles sont sourcées, millésimées, datées de leur
 * relevé.
 *
 * Il ne contient AUCUNE date de la session 2027, parce qu'il n'en existe
 * aucune : à ce jour, le calendrier de la session 2027 n'est pas publié. Le
 * ministère le publie en général en novembre ou décembre. Écrire ici un
 * « 15 janvier 2027 » relevé sur un site tiers reviendrait à inventer une
 * valeur de repli et à la présenter comme un fait — ce que CLAUDE.md interdit.
 *
 * Ce que le site affiche pour 2027 est donc une FENÊTRE, déduite de la date
 * 2026 correspondante : « mi-janvier 2027 », pas « 15 janvier 2027 ». Elle est
 * calculée par `fenetreProjetee`, jamais saisie à la main, pour qu'elle ne
 * puisse pas diverger de la date dont elle est tirée. Un élève qui lit
 * « mi-mars » sait qu'il doit revenir chercher le jour exact ; un élève qui
 * lit « 13 mars » le note dans son agenda et ne revient jamais.
 *
 * ── Pourquoi l'avertissement est exporté ─────────────────────────────────
 *
 * Afficher des dates sans dire d'où elles viennent ferait manquer un vœu à un
 * élève qui s'y serait fié. `AVERTISSEMENT` est donc exporté et un test
 * vérifie qu'il précède les dates sur la page d'accueil, plutôt que d'être
 * relégué en pied de page.
 *
 * Règle 6 de CLAUDE.md : la source et le millésime accompagnent la donnée.
 */

/** La session que prépare l'élève aujourd'hui. */
export const SESSION_VISEE = '2027'

/** Le millésime de la seule donnée réelle d'ici : la dernière session connue. */
export const MILLESIME_CALENDRIER = '2026'

export const SOURCE_CALENDRIER =
  'Calendrier de la session 2026, publié par le ministère de l’Enseignement supérieur ' +
  'et de la Recherche sur parcoursup.gouv.fr'

/** Date à laquelle ce calendrier a été relevé, au format ISO. */
export const RELEVE_LE = '2026-09-20'

/** Quand le calendrier officiel de la session visée est attendu. */
export const PUBLICATION_ATTENDUE = 'en général en novembre ou décembre'

export const AVERTISSEMENT =
  'Le calendrier officiel de la session ' +
  SESSION_VISEE +
  ' n’est pas encore publié : le ministère le publie ' +
  PUBLICATION_ATTENDUE +
  '. Les repères ci-dessous sont déduits de la session ' +
  MILLESIME_CALENDRIER +
  ' — ils ne sont pas officiels et peuvent changer, puisque le calendrier est fixé ' +
  'chaque année par l’État. Notez les périodes, pas des jours précis : seules les ' +
  'dates publiées sur parcoursup.gouv.fr font foi.'

export interface Etape {
  /**
   * Date réelle de la session de référence, au format ISO.
   * C'est la seule date factuelle de cette structure ; la fenêtre affichée
   * pour la session visée en est déduite.
   */
  readonly reference: string
  readonly titre: string
  readonly detail: string | null
}

export interface Phase {
  readonly numero: number
  /** La période de la session visée, au mois près. Jamais un jour. */
  readonly periode: string
  readonly titre: string
  readonly resume: string
  readonly etapes: readonly Etape[]
  /** Un conseil ou un rappel figurant sur le calendrier officiel. */
  readonly note: string | null
}

export const PHASES: readonly Phase[] = [
  {
    numero: 1,
    periode: 'automne 2026 → janvier 2027',
    titre: 'Je m’informe et je découvre les formations',
    resume:
      'La période où l’on regarde sans s’engager. Au lycée, le professeur principal et ' +
      'les personnels d’orientation sont là pour ça. Un étudiant déjà inscrit ailleurs et ' +
      'qui veut se réorienter passe, lui, par le service orientation de son établissement.',
    etapes: [
      {
        reference: '2025-12-17',
        titre: 'Ouverture de la carte des formations',
        detail:
          'Les formations de la session s’affichent sur parcoursup.gouv.fr, avec leurs ' +
          'attendus, leurs taux d’accès et leurs statistiques de l’année précédente.',
      },
    ],
    note:
      'C’est aussi le moment où le calendrier officiel de la session paraît. Revenez ' +
      'le chercher à ce moment-là : c’est lui qui fixera les jours exacts.',
  },
  {
    numero: 2,
    periode: 'janvier → mars → avril 2027',
    titre: 'Je m’inscris, je formule mes vœux, je finalise mon dossier',
    resume:
      'Jusqu’à 10 vœux, sans avoir à les classer par ordre de préférence. Certaines ' +
      'formations acceptent en plus des sous-vœux. L’apprentissage ouvre droit à 10 vœux ' +
      'supplémentaires, comptés à part.',
    etapes: [
      {
        reference: '2026-01-19',
        titre: 'Ouverture des inscriptions',
        detail: 'Création du dossier candidat, puis formulation des vœux.',
      },
      {
        reference: '2026-03-12',
        titre: 'Dernier jour pour formuler ses vœux',
        detail: 'Passé cette date, aucun vœu ne peut plus être ajouté en phase principale.',
      },
      {
        reference: '2026-04-01',
        titre: 'Dernier jour pour compléter son dossier et confirmer ses vœux',
        detail:
          'Sans confirmation, un vœu formulé n’est transmis à aucune formation. C’est la ' +
          'date que l’on oublie le plus souvent.',
      },
    ],
    note:
      'Les vœux en apprentissage échappent à cette échéance : on peut continuer à en ' +
      'formuler après la date de confirmation.',
  },
  {
    numero: 3,
    periode: 'juin → septembre 2027',
    titre: 'Je reçois les réponses et je décide',
    resume:
      'Les propositions arrivent au fil de l’eau, pas toutes le même jour. À chaque ' +
      'proposition reçue correspond un délai de réponse : le silence vaut refus.',
    etapes: [
      {
        reference: '2026-06-02',
        titre: 'Début de la phase d’admission principale',
        detail: 'Les premières réponses — « oui » ou « oui si » — apparaissent au dossier.',
      },
      {
        reference: '2026-06-05',
        titre: 'Ouverture du classement des vœux en attente',
        detail: 'À faire dans les jours qui suivent : la période de classement est courte.',
      },
      {
        reference: '2026-06-11',
        titre: 'Début de la phase complémentaire',
        detail:
          'Jusqu’à 10 nouveaux vœux, sur les formations qui ont encore des places à ' +
          'proposer.',
      },
      {
        reference: '2026-07-11',
        titre: 'Fin de la phase principale',
        detail: null,
      },
      {
        reference: '2026-09-10',
        titre: 'Fin de la phase complémentaire',
        detail: 'Dernier jour de la session.',
      },
    ],
    note: null,
  },
]

/**
 * Met en forme une date ISO.
 *
 * Trois précautions :
 *   - l'heure est forcée à midi UTC et le fuseau à UTC. Une date nue serait
 *     lue en UTC puis rendue en heure locale : le 1ᵉʳ avril deviendrait le
 *     31 mars à l'ouest de Greenwich ;
 *   - une date illisible est rendue telle quelle, jamais « Invalid Date » ;
 *   - le premier du mois s'écrit « 1ᵉʳ », que la locale ne produit pas.
 */
function mettreEnForme(iso: string, options: Intl.DateTimeFormatOptions): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  const texte = d.toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' })
  return d.getUTCDate() === 1 ? texte.replace(/\b1\b/, '1ᵉʳ') : texte
}

/** « jeudi 12 mars 2026 ». Une seule source : la date ISO ci-dessus. */
export function enToutesLettres(iso: string): string {
  return mettreEnForme(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** « 12 mars », pour les repères compacts. */
export function enCourt(iso: string): string {
  return mettreEnForme(iso, { day: 'numeric', month: 'long' })
}

/** Nombre d'années entre la session de référence et celle que l'on vise. */
const DECALAGE = Number(SESSION_VISEE) - Number(MILLESIME_CALENDRIER)

/**
 * La fenêtre prévisionnelle correspondant à une date de référence.
 *
 * « 2026-03-12 » donne « mi-mars 2027 ». Le jour disparaît volontairement :
 * il n'est pas connu, et l'afficher au jour près le ferait passer pour tel.
 * Le calcul est déterministe et tiré de la date elle-même, pour qu'aucune
 * fenêtre ne puisse dériver de l'étape qu'elle décrit.
 */
export function fenetreProjetee(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  const mois = d.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
  const annee = d.getUTCFullYear() + DECALAGE
  const jour = d.getUTCDate()
  // « mi- » se soude au mois ; « début » et « fin » restent détachés.
  if (jour <= 10) return `début ${mois} ${annee}`
  if (jour <= 20) return `mi-${mois} ${annee}`
  return `fin ${mois} ${annee}`
}
