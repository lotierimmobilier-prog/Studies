/**
 * Mise en forme des nombres, en français.
 *
 * Ce module vit dans le MOTEUR et non dans l'interface, parce que le moteur
 * écrit lui aussi du texte destiné à l'élève : le champ `hypothese` de chaque
 * ligne de budget est lu tel quel à l'écran. Tant qu'il n'existait qu'une
 * version côté web, le moteur interpolait ses nombres bruts et l'on affichait
 * « 16.326 €/m² » et « 199.88 € d'APL » — point décimal anglais et précision
 * de laboratoire. Constaté à l'écran le 20/09/2026.
 *
 * L'interface le réexporte : une seule implémentation, et le moteur reste
 * sans dépendance vers le web (c'est le web qui importe le moteur, jamais
 * l'inverse).
 *
 * ── L'espace des milliers ────────────────────────────────────────────────
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

/** Un montant au centime près, deux décimales toujours affichées. */
export function eurosPrecis(v: number): string {
  const texte = lisible(
    v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )
  return `${texte}${INSECABLE}€`
}

/**
 * Un montant arrondi au centime, SANS décimales inutiles.
 *
 * C'est la forme qui convient au texte courant d'une hypothèse, où le montant
 * est cité au fil de la phrase : « 16,33 €/m² × 25 m², moins 199,88 € d'APL »
 * se lit, « 16.326 €/m² ... moins 199.88 € » non. Un montant rond n'y traîne
 * pas un « ,00 » qui n'apprend rien.
 *
 * L'arrondi ne porte QUE sur l'affichage. Le calcul, lui, garde la valeur
 * pleine : arrondir avant d'additionner déplacerait le total de quelques
 * centimes sans que rien ne le dise.
 */
export function eurosAuCentime(v: number): string {
  const arrondi = Math.round(v * 100) / 100
  // Deux décimales ou aucune, jamais une seule : « 120,4 € » n'est pas un
  // montant, c'est un nombre auquel il manque un chiffre. Un montant rond,
  // lui, n'a pas besoin d'un « ,00 » qui n'apprend rien.
  const decimales = Number.isInteger(arrondi) ? 0 : 2
  const texte = lisible(
    Math.abs(arrondi).toLocaleString('fr-FR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }),
  )
  return `${arrondi < 0 ? '−' : ''}${texte}${INSECABLE}€`
}
