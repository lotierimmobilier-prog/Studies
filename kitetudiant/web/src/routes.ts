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
  // Connexion et inscription ont leur propre adresse plutôt qu'un simple état
  // en mémoire : on veut pouvoir envoyer « le lien d'inscription » à
  // quelqu'un, revenir en arrière après avoir ouvert le formulaire, et
  // retomber sur la bonne page après un aller-retour vers un fournisseur
  // d'identité externe.
  | { readonly vue: 'connexion' }
  | { readonly vue: 'inscription' }
  // L'espace personnel a son adresse, comme le reste. Elle n'est pas plus
  // secrète pour autant : c'est la session qui protège son contenu, pas
  // l'ignorance du chemin. Un chemin « secret » se retrouve dans l'historique
  // du navigateur, dans les journaux d'un serveur mandataire, dans un
  // message copié-collé — il ne protège rien.
  | { readonly vue: 'compte' }
  // La recherche directe d'écoles a son adresse : « qu'y a-t-il à Limoges ? »
  // est une question qu'on envoie à quelqu'un, et un lien qu'on met en favori.
  | { readonly vue: 'recherche' }
  // Une formation sans adresse n'existe que comme une carte dans une liste :
  // on ne peut ni la partager, ni la mettre en favori, ni y revenir, ni
  // l'indexer. C'était le manque le plus structurant du site.
  //
  // La clé dans l'adresse est `cod_aff_form`, la clé pivot des formations
  // (DECISIONS.md, D7) — jamais un intitulé transformé en slug : un intitulé
  // se réécrit d'une session à l'autre, et l'adresse partagée l'an dernier
  // tomberait alors dans le vide.
  | { readonly vue: 'formation'; readonly code: string }
  // L'établissement, lui, est identifié par son UAI. Deux lycées peuvent
  // porter le même nom ; aucun ne partage son UAI.
  | { readonly vue: 'etablissement'; readonly uai: string }
  // La collection n'était qu'un état en mémoire : on ne pouvait ni la
  // partager, ni la mettre en favori, ni y revenir avec le bouton
  // « précédent ». Exactement le défaut que les fiches de formation
  // viennent de perdre.
  | { readonly vue: 'collection' }
  // La liste de vœux. Elle a une adresse comme le reste : c'est la page
  // qu'un élève rouvre le plus souvent, et celle qu'il montre à ses parents.
  | { readonly vue: 'voeux' }

/** Le chemin d'une route, préfixé par la base de déploiement. */
export function cheminDe(route: Route): string {
  switch (route.vue) {
    case 'accueil':
      return BASE
    case 'blog':
      return `${BASE}blog`
    case 'article':
      return `${BASE}blog/${route.slug}`
    case 'connexion':
      return `${BASE}connexion`
    case 'inscription':
      return `${BASE}inscription`
    case 'compte':
      return `${BASE}mon-compte`
    case 'recherche':
      return `${BASE}chercher-une-ecole`
    case 'formation':
      return `${BASE}formation/${route.code}`
    case 'etablissement':
      return `${BASE}etablissement/${route.uai}`
    case 'collection':
      return `${BASE}mes-cartes`
    case 'voeux':
      return `${BASE}mes-voeux`
  }
}

/**
 * Les formes acceptées dans une adresse.
 *
 * Elles sont volontairement étroites. Un motif large laisserait passer
 * n'importe quel chemin et transformerait une faute de frappe en requête
 * envoyée à l'open data — puis en page vide sans explication. Ici, ce qui
 * n'a pas la forme d'une clé n'est tout simplement pas une route.
 */
const CODE_FORMATION = /^[A-Za-z0-9_-]{1,32}$/
/** Sept chiffres et une lettre : c'est la forme d'un code UAI. */
const CODE_UAI = /^[0-9]{7}[A-Za-z]$/

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
  if (reste === 'connexion') return { vue: 'connexion' }
  if (reste === 'inscription') return { vue: 'inscription' }
  if (reste === 'mon-compte') return { vue: 'compte' }
  if (reste === 'chercher-une-ecole') return { vue: 'recherche' }
  if (reste === 'mes-cartes') return { vue: 'collection' }
  if (reste === 'mes-voeux') return { vue: 'voeux' }
  const article = /^blog\/([a-z0-9-]+)$/.exec(reste)
  if (article !== null) return { vue: 'article', slug: article[1]! }
  const formation = /^formation\/(.+)$/.exec(reste)
  if (formation !== null && CODE_FORMATION.test(formation[1]!)) {
    return { vue: 'formation', code: formation[1]! }
  }
  const etablissement = /^etablissement\/(.+)$/.exec(reste)
  if (etablissement !== null && CODE_UAI.test(etablissement[1]!)) {
    // L'UAI est normalisé en majuscules : « 0121471j » et « 0121471J »
    // désignent le même établissement, et deux adresses pour une même page
    // dispersent son référencement.
    return { vue: 'etablissement', uai: etablissement[1]!.toUpperCase() }
  }
  return null
}

/** L'adresse absolue d'une route, pour les liens canoniques et le plan du site. */
export function adresseComplete(route: Route, origine = 'https://kitetudiant.fr'): string {
  return `${origine.replace(/\/$/, '')}${cheminDe(route)}`
}
