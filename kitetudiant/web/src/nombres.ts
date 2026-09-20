/**
 * Mise en forme des nombres, en français.
 *
 * `toLocaleString('fr-FR')` sépare les milliers par une ESPACE FINE
 * INSÉCABLE (U+202F). C'est la règle typographique française, et c'est très
 * bien tant que la police sait la rendre.
 *
 * Poppins, la police des chiffres du site, la rend deux fois plus étroite que
 * la police du système : mesuré au navigateur le 20/09/2026, 3,4 px contre
 * 6,4 px à 32 px de corps. Résultat, « 1 246 » se lisait « 1246 » — sur un
 * site dont tout l'objet est d'afficher des montants, c'est une faute.
 *
 * On remplace donc U+202F par l'espace insécable ordinaire U+00A0 : un peu
 * plus large que la convention, mais visible, et toujours insécable — un
 * montant ne doit jamais se couper en fin de ligne.
 *
 * Toutes les mises en forme de nombres du site passent par ici. Un
 * `toLocaleString` appelé directement ailleurs réintroduirait le défaut sans
 * que rien ne le signale ; nombres.test.ts l'interdit.
 */

/** L'espace fine insécable produite par la locale française. */
export const FINE_INSECABLE = ' '
/** L'espace insécable ordinaire, plus large, que toute police sait rendre. */
export const INSECABLE = ' '

/** Remplace les espaces fines par des insécables ordinaires. */
export function lisible(texte: string): string {
  return texte.replaceAll(FINE_INSECABLE, INSECABLE)
}

/** Un nombre entier, séparateurs de milliers compris. */
export function nombre(v: number): string {
  return lisible(v.toLocaleString('fr-FR'))
}

/** Un montant arrondi à l'euro. Le signe moins est le vrai, pas un trait d'union. */
export function euros(v: number): string {
  const arrondi = Math.round(v)
  const absolu = lisible(Math.abs(arrondi).toLocaleString('fr-FR'))
  return `${arrondi < 0 ? '−' : ''}${absolu}${INSECABLE}€`
}

/** Un montant au centime près. */
export function eurosPrecis(v: number): string {
  const texte = lisible(
    v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )
  return `${texte}${INSECABLE}€`
}
