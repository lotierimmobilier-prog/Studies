/**
 * Le calendrier Parcoursup, tel qu'il s'est déroulé pour la session 2026.
 *
 * ATTENTION — ces dates NE SONT PAS le calendrier officiel de la prochaine
 * session. Ce sont celles de la dernière session connue, reprises du
 * calendrier publié par le ministère. Elles servent de repère — les phases se
 * suivent dans le même ordre d'une année sur l'autre, aux mêmes moments à
 * quelques jours près — et rien de plus. Seul le calendrier publié sur
 * parcoursup.gouv.fr fait foi, et l'État peut le déplacer.
 *
 * Cet avertissement n'est pas une précaution de style : afficher des dates
 * sans dire d'où elles viennent ferait manquer un vœu à un élève qui s'y
 * serait fié. Il est donc affiché avec la chronologie, pas relégué en bas de
 * page, et `AVERTISSEMENT` est exporté pour qu'aucune vue ne puisse montrer
 * les dates sans lui.
 *
 * Règle 6 de CLAUDE.md : la source et le millésime accompagnent la donnée.
 */

export const MILLESIME_CALENDRIER = '2026'

export const SOURCE_CALENDRIER =
  'Calendrier de la session 2026, publié par le ministère de l’Enseignement supérieur ' +
  'et de la Recherche sur parcoursup.gouv.fr'

/** Date à laquelle ce calendrier a été relevé, au format ISO. */
export const RELEVE_LE = '2026-09-20'

export const AVERTISSEMENT =
  'Ces dates sont celles de la session ' +
  MILLESIME_CALENDRIER +
  '. Elles ne sont pas officielles pour la session à venir et peuvent changer : ' +
  'le calendrier est fixé chaque année par l’État. Seules les dates publiées sur ' +
  'parcoursup.gouv.fr font foi.'

export interface Etape {
  /** Date ISO du jour. L'affichage en toutes lettres en découle. */
  readonly le: string
  readonly titre: string
  readonly detail: string | null
}

export interface Phase {
  readonly numero: number
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
    periode: 'octobre 2025 → janvier 2026',
    titre: 'Je m’informe et je découvre les formations',
    resume:
      'La période où l’on regarde sans s’engager. Au lycée, le professeur principal et ' +
      'les personnels d’orientation sont là pour ça. Un étudiant déjà inscrit ailleurs et ' +
      'qui veut se réorienter passe, lui, par le service orientation de son établissement.',
    etapes: [
      {
        le: '2025-12-17',
        titre: 'Ouverture de la carte des formations',
        detail:
          'Les formations de la session s’affichent sur parcoursup.gouv.fr, avec leurs ' +
          'attendus, leurs taux d’accès et leurs statistiques de l’année précédente.',
      },
    ],
    note: null,
  },
  {
    numero: 2,
    periode: '19 janvier → 12 mars → 1ᵉʳ avril 2026',
    titre: 'Je m’inscris, je formule mes vœux, je finalise mon dossier',
    resume:
      'Jusqu’à 10 vœux, sans avoir à les classer par ordre de préférence. Certaines ' +
      'formations acceptent en plus des sous-vœux. L’apprentissage ouvre droit à 10 vœux ' +
      'supplémentaires, comptés à part.',
    etapes: [
      {
        le: '2026-01-19',
        titre: 'Ouverture des inscriptions',
        detail: 'Création du dossier candidat, puis formulation des vœux.',
      },
      {
        le: '2026-03-12',
        titre: 'Dernier jour pour formuler ses vœux',
        detail: 'Passé cette date, aucun vœu ne peut plus être ajouté en phase principale.',
      },
      {
        le: '2026-04-01',
        titre: 'Dernier jour pour compléter son dossier et confirmer ses vœux',
        detail:
          'Un vœu non confirmé est perdu, même s’il a été formulé à temps. C’est la ' +
          'date que l’on oublie le plus souvent.',
      },
    ],
    note:
      'Les vœux en apprentissage échappent à cette échéance : on peut continuer à en ' +
      'formuler après le 1ᵉʳ avril.',
  },
  {
    numero: 3,
    periode: '2 juin → 11 juillet 2026',
    titre: 'Je reçois les réponses et je décide',
    resume:
      'Les propositions arrivent au fil de l’eau, pas toutes le même jour. À chaque ' +
      'proposition reçue correspond un délai de réponse : le silence vaut refus.',
    etapes: [
      {
        le: '2026-06-02',
        titre: 'Début de la phase d’admission principale',
        detail: 'Les premières réponses — « oui » ou « oui si » — apparaissent au dossier.',
      },
      {
        le: '2026-06-05',
        titre: 'Ouverture du classement des vœux en attente',
        detail: 'À faire avant le lundi 8 juin inclus.',
      },
      {
        le: '2026-06-11',
        titre: 'Début de la phase complémentaire',
        detail:
          'Jusqu’à 10 nouveaux vœux, sur les formations qui ont encore des places à ' +
          'proposer.',
      },
      {
        le: '2026-07-11',
        titre: 'Fin de la phase principale',
        detail: null,
      },
      {
        le: '2026-09-10',
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
