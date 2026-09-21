/**
 * Les textes de la page d'accueil, définis une seule fois.
 *
 * ── Pourquoi ils vivent ici ──────────────────────────────────────────────
 *
 * Deux endroits les écrivent : `web/src/accueil.tsx`, que voient les gens, et
 * `scripts/prerendre.ts`, que lisent les robots — le second pose le `<title>`
 * réel et le corps de la page livrée avant que React ne monte.
 *
 * Écrits deux fois, ils divergeraient, et la divergence a un nom : du contenu
 * masqué. Un moteur qui reçoit un titre et en voit un autre à l'exécution le
 * sanctionne, et il a raison — c'est la forme la plus courante de tromperie
 * sur un site.
 *
 * Ce paquet n'a aucune dépendance au navigateur, ce qui permet au script de
 * pré-rendu de l'importer comme il importe déjà les articles.
 *
 * ── Ce que la règle 5 impose au titre ────────────────────────────────────
 *
 * « Les trois scores restent séparés. Jamais de note globale unique. » Le
 * titre ne peut donc promettre ni « la meilleure école », ni un classement.
 * Il nomme deux des trois angles — les chances et le reste-à-vivre — et le
 * sous-titre les énonce tous les trois. Nommer n'est pas fondre.
 *
 * Il porte en revanche les mots qu'un lycéen tape : « vœux », « Parcoursup ».
 * Le titre précédent — « Trouve la meilleure solution pour l'année
 * prochaine » — n'en contenait aucun, et les rejetait dans un sur-titre en
 * petits caractères, hors du `h1`.
 */

/** Le `h1` de l'accueil, et la première ligne de la page livrée aux robots. */
export const ACCUEIL_TITRE_PAGE =
  'Tes vœux Parcoursup : tes chances, et ce qu’il te restera pour vivre.'

/** Le `<title>` de l'onglet et du résultat de recherche. */
export const ACCUEIL_TITRE_ONGLET =
  'KitEtudiant.fr — choisir ses vœux Parcoursup : taux d’accès, coût de la vie, reste-à-vivre'

/** La `<meta name="description">`, et le chapeau de la page livrée. */
export const ACCUEIL_DESCRIPTION =
  'Pour chaque formation Parcoursup : le taux d’accès publié, ce qu’elle vaut pour ton ' +
  'profil, et ce qu’il te restera chaque mois une fois le loyer payé. Chiffres datés, ' +
  'source affichée, aucun classement d’écoles.'

/**
 * Les questions que pose un lycéen avant de se servir du site.
 *
 * ── Pourquoi elles existent ──────────────────────────────────────────────
 *
 * Un moteur génératif ne reprend pas un paragraphe au milieu d'un fil : il
 * reprend l'unité la plus petite qui tienne debout toute seule, et une
 * question suivie de sa réponse en est une. Les articles en portent déjà
 * (`Article.questions`, déclarées en `FAQPage`) ; l'accueil, qui est la
 * page la plus citée d'un site, n'en portait aucune.
 *
 * Elles ne sont pas là pour remplir la page. Les cinq premières répondent
 * aux questions dont la réponse EST le site — ce qu'est le reste-à-vivre,
 * d'où viennent les chiffres — et les deux dernières à celles dont une
 * mauvaise réponse ferait du tort : non, ce n'est pas le site officiel ;
 * non, rien n'est transmis à Parcoursup.
 *
 * ── Ce qu'elles ne font pas ──────────────────────────────────────────────
 *
 * Aucune ne cite de montant. Un barème change, et un texte figé ne porte ni
 * source ni millésime (règles 1 et 6). Aucune ne promet non plus un
 * résultat — « tu seras pris », « la meilleure école » — ni ne dramatise :
 * « Ne pas écrire de texte d'interface anxiogène » est une règle, pas un
 * conseil.
 *
 * Chaque réponse est vérifiable dans le code, et `accueil.test.ts` le
 * vérifie pour celles qui portent sur un comportement.
 */
export interface QuestionAccueil {
  readonly question: string
  readonly reponse: string
}

export const ACCUEIL_QUESTIONS: readonly QuestionAccueil[] = [
  {
    question: 'C’est quoi le reste-à-vivre ?',
    reponse:
      'C’est ce qu’il te reste chaque mois une fois payés le loyer, les charges, ' +
      'les frais de scolarité et tes dépenses courantes — et une fois comptées les ' +
      'aides auxquelles tu as droit. C’est le chiffre qui dit si une formation est ' +
      'tenable là où elle se trouve, et deux formations identiques peuvent donner ' +
      'deux reste-à-vivre très différents selon la ville.',
  },
  {
    question: 'D’où viennent les chiffres ?',
    reponse:
      'Des données publiées : les statistiques d’admission de Parcoursup pour la ' +
      'session précédente, l’indicateur des loyers par commune de l’ANIL, et les ' +
      'barèmes officiels des bourses, de l’aide au logement et de la CVEC. Chaque ' +
      'montant affiché porte sa source et son année. Quand une donnée manque, elle ' +
      's’affiche comme manquante : rien n’est remplacé par une estimation.',
  },
  {
    question: 'Est-ce que le site classe les écoles ?',
    reponse:
      'Non, et c’est délibéré. Tu vois trois indications tenues séparées — tes ' +
      'chances d’admission, l’adéquation à ton profil, et le reste-à-vivre sur ' +
      'place — jamais fondues en une note unique. Un classement supposerait que la ' +
      'même école convienne à tout le monde, ce qui n’est pas le cas.',
  },
  {
    question: 'Est-ce que c’est le site officiel de Parcoursup ?',
    reponse:
      'Non. KitEtudiant.fr est un service indépendant, sans lien avec Parcoursup, ' +
      'le ministère de l’Enseignement supérieur ou les CROUS. Il lit les données ' +
      'que ces organismes publient, rien de plus. Pour la procédure elle-même et ' +
      'pour les dates, parcoursup.gouv.fr fait foi.',
  },
  {
    question: 'Est-ce que mes vœux sont envoyés à Parcoursup ?',
    reponse:
      'Non, jamais. La liste que tu prépares ici sert à comparer et à t’organiser ; ' +
      'elle ne part nulle part. Tes vœux réels se formulent et se confirment sur ' +
      'parcoursup.gouv.fr, et c’est la confirmation là-bas qui compte.',
  },
  {
    question: 'Faut-il créer un compte ?',
    reponse:
      'Pas pour calculer : le questionnaire, les résultats et le reste-à-vivre de ' +
      'chaque formation s’obtiennent sans compte. Il en faut un pour deux choses — ' +
      'voir le détail poste par poste d’un budget, et retrouver ta liste de vœux ' +
      'd’un appareil à l’autre. Il ne demande qu’une adresse e-mail et un mot de ' +
      'passe ; tes notes et tes réponses au questionnaire, elles, restent dans ton ' +
      'navigateur.',
  },
  {
    question: 'Est-ce que le site peut me dire si je serai pris ?',
    reponse:
      'Personne ne le peut, et méfie-toi de qui l’affirme : les commissions ' +
      'd’examen des vœux décident chaque année sur les dossiers qu’elles reçoivent. ' +
      'Ce que le site montre, c’est ce qui s’est passé l’an dernier — combien de ' +
      'candidats, combien d’admis, et où se situait leur dossier. C’est une ' +
      'indication utile pour équilibrer une liste, pas une prédiction.',
  },
]
