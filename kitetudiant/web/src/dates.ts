/**
 * Écrire une date en toutes lettres, sans en changer le jour.
 *
 * ── Ce que faisaient les trois copies ────────────────────────────────────
 *
 * `accueil.tsx`, `blog.tsx` et `monCompte.tsx` portaient chacun leur
 * `dateLisible`, et deux des trois étaient fausses :
 *
 *     new Date('2025-09-01').toLocaleDateString('fr-FR', { … })
 *
 * `new Date` lit une date SEULE comme minuit UTC, puis `toLocaleDateString`
 * la rend dans le fuseau du lecteur. À l'ouest de Greenwich, minuit UTC
 * tombe la veille : un élève à Tahiti lisait « 31 août 2025 » là où le
 * fichier dit 2025-09-01. Vérifié, TZ=Pacific/Tahiti.
 *
 * Ce n'est pas un détail d'affichage ici : la règle 6 de CLAUDE.md impose
 * que toute donnée porte son millésime et sa date de collecte. Une date de
 * collecte décalée d'un jour selon l'endroit où on la lit n'est plus une
 * date de collecte.
 *
 * ── Deux cas, une seule fonction ─────────────────────────────────────────
 *
 * Une date seule (`2025-09-01`) ne désigne pas un instant : elle désigne un
 * jour, le même pour tout le monde. On l'ancre à midi UTC — assez loin des
 * deux bords pour qu'aucun fuseau ne la fasse basculer — et on la rend en
 * UTC.
 *
 * Un instant (`2025-09-01T23:40:00Z`, une date d'inscription) désigne au
 * contraire un point dans le temps, et le fuseau du lecteur est la bonne
 * façon de le lui montrer : c'est bien la veille au soir pour lui.
 *
 * ── Pourquoi ce module et pas `packages/articles` ────────────────────────
 *
 * Il sert aussi aux dates de compte, qui n'ont rien d'éditorial. Il n'a
 * aucune dépendance au navigateur, ce qui permet au script de pré-rendu de
 * l'importer comme il importe déjà les articles.
 */

/** `true` si la chaîne est une date seule, au format `AAAA-MM-JJ`. */
function dateSeule(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)
}

/**
 * « 1 septembre 2025 ». Rend la chaîne d'entrée telle quelle si elle n'est
 * pas une date lisible — une date illisible affichée en clair se corrige,
 * une date inventée ne se voit pas (« pas de valeur de repli silencieuse »).
 */
export function dateLisible(iso: string): string {
  const seule = dateSeule(iso)
  const d = new Date(seule ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(seule ? { timeZone: 'UTC' } : {}),
  })
}

/**
 * La valeur de l'attribut `datetime` d'une balise `<time>`.
 *
 * Un `<time>` se lit à deux niveaux : la machine lit `datetime`, la personne
 * lit le contenu. Les deux doivent dire le même jour, d'où cette fonction à
 * côté de la précédente plutôt qu'un `article.publieLe` recopié à la main.
 */
export function dateMachine(iso: string): string {
  if (dateSeule(iso)) return iso
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toISOString()
}
