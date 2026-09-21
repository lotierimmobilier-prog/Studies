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
