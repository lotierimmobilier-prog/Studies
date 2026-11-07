/**
 * Les liens « chercher un logement », par ville.
 *
 * ── Pourquoi le CROUS d'abord ────────────────────────────────────────────
 *
 * Parce que c'est ce que les articles du site conseillent, et qu'un produit
 * qui conseille une chose puis met en avant son contraire ne mérite pas
 * qu'on le croie. La résidence universitaire est la solution la moins chère,
 * elle s'attribue au printemps, et l'article « Bourse et logement » dit
 * explicitement que ne pas postuler « parce qu'on n'est pas encore sûr »
 * revient à s'en priver.
 *
 * Le privé vient donc en second, pas en premier.
 *
 * ── Sur les paramètres de leboncoin ──────────────────────────────────────
 *
 * Ce sont ceux de son moteur de recherche public. Ils n'ont PAS pu être
 * vérifiés depuis l'environnement de développement : le site répond 403 à
 * toute adresse qui n'est pas un navigateur d'usager, y compris à un
 * navigateur sans interface. L'URL est donc construite de façon que la
 * VILLE porte tout le lien — si un nom de filtre venait à changer, le lien
 * ouvrirait toujours les locations de la bonne commune, simplement sans le
 * tri par surface. C'est la dégradation acceptable ; un lien mort ne
 * l'aurait pas été.
 *
 * ── Ce que ces liens ne sont pas ─────────────────────────────────────────
 *
 * Une recommandation. Le site n'a aucun lien avec ces services, n'en tire
 * rien, et ne peut pas vérifier ce qu'on y trouve. Les libellés disent
 * « chercher », jamais « trouver », et rien n'est chargé depuis ces domaines
 * tant qu'on n'a pas cliqué.
 */

export interface LienLogement {
  readonly cle: 'crous' | 'prive'
  readonly libelle: string
  readonly note: string
  readonly url: string
}

/**
 * La recherche de logement en résidence universitaire, sur le portail
 * national du CROUS. Il ne prend pas la ville en paramètre d'URL : on ouvre
 * donc la recherche, et le libellé dit ce qu'il faudra saisir.
 */
function crous(): LienLogement {
  return {
    cle: 'crous',
    libelle: 'Résidence universitaire',
    note: 'La solution la moins chère. Les demandes se font au printemps, avant les réponses.',
    url: 'https://trouverunlogement.lescrous.fr/',
  }
}

/**
 * Les locations d'appartements d'une à deux pièces dans la commune —
 * autrement dit un studio ou un T2, ce que cherche un étudiant seul.
 *
 * `category=10` est la rubrique « Locations ». `real_estate_type=2` vise les
 * appartements, `rooms=1,2` les une et deux pièces. Ces deux derniers sont
 * du confort : voir l'avertissement en tête de fichier.
 */
function prive(ville: string): LienLogement {
  const params = new URLSearchParams({
    category: '10',
    locations: ville,
    real_estate_type: '2',
    rooms: '1,2',
  })
  return {
    cle: 'prive',
    libelle: `Studios et T2 à ${ville}`,
    note: 'Dans le parc privé. Les meilleures offres partent tôt dans les villes tendues.',
    url: `https://www.leboncoin.fr/recherche?${params.toString()}`,
  }
}

/**
 * Les deux pistes, dans l'ordre où il faut les essayer. Une ville vide ne
 * rend que le CROUS : fabriquer une recherche sur une commune inconnue
 * ouvrirait une page vide, ce qui est pire que pas de lien.
 */
export function liensLogement(ville: string): LienLogement[] {
  const nette = ville.trim()
  return nette === '' ? [crous()] : [crous(), prive(nette)]
}
