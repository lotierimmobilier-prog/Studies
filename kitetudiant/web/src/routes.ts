/**
 * Les adresses du site.
 *
 * Jusqu'ici l'application n'avait qu'une adresse et changeait de vue en
 * mémoire. Le blog change la donne : un article sans URL propre ne se partage
 * pas, ne se met pas en favori, et n'est indexé par personne. Il lui faut donc
 * un chemin réel.
 *
 * Tous les chemins se déduisent de `import.meta.env.BASE_URL`. Le site est
 * servi sous « /kitetudiant/ » : un « /blog » écrit en dur viserait la racine
 * du serveur, où il n'y a rien — exactement le défaut qui avait cassé tous les
 * appels à l'API. routes.test.ts l'interdit.
 *
 * Côté serveur, nginx renvoie déjà l'index pour tout chemin inconnu sous le
 * préfixe (« try_files … /<slug>/index.html »), donc une adresse profonde
 * ouverte directement fonctionne.
 */

/** La base de déploiement, toujours terminée par une barre oblique. */
const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export type Route =
  | { readonly vue: 'accueil' }
  | { readonly vue: 'blog' }
  | { readonly vue: 'article'; readonly slug: string }

/** Le chemin d'une route, préfixé par la base de déploiement. */
export function cheminDe(route: Route): string {
  switch (route.vue) {
    case 'accueil':
      return BASE
    case 'blog':
      return `${BASE}blog`
    case 'article':
      return `${BASE}blog/${route.slug}`
  }
}

/**
 * La route que désigne un chemin, ou `null` si ce n'en est pas une.
 *
 * `null` veut dire « ce chemin ne concerne pas le routeur » : l'application
 * garde alors la vue qu'elle avait, plutôt que de retomber sur l'accueil.
 */
export function routeDuChemin(chemin: string): Route | null {
  if (!chemin.startsWith(BASE)) return null
  const reste = chemin.slice(BASE.length).replace(/\/+$/, '')
  if (reste === '') return { vue: 'accueil' }
  if (reste === 'blog') return { vue: 'blog' }
  const article = /^blog\/([a-z0-9-]+)$/.exec(reste)
  if (article !== null) return { vue: 'article', slug: article[1]! }
  return null
}

/** L'adresse absolue d'une route, pour les liens canoniques et le plan du site. */
export function adresseComplete(route: Route, origine = 'https://kitetudiant.fr'): string {
  return `${origine.replace(/\/$/, '')}${cheminDe(route)}`
}
