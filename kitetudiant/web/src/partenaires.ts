/**
 * Les partenariats rémunérés, déclarés en un seul endroit.
 *
 * ── Pourquoi un module, pour un seul lien ────────────────────────────────
 *
 * Parce qu'un lien d'affiliation n'est pas un lien. C'est un lien PLUS une
 * obligation de le dire, et les deux doivent voyager ensemble. Recopié à la
 * main dans un écran, il finirait tôt ou tard posé sans sa mention — et
 * c'est précisément le cas que la loi et l'honnêteté interdisent.
 *
 * `partenaires.test.ts` vérifie que tout écran qui pose le lien affiche
 * aussi la phrase de rémunération.
 *
 * ── Ce que ce partenariat oblige à corriger ailleurs ─────────────────────
 *
 * `compte.tsx` promettait « aucune revente, aucune publicité, aucun
 * traceur ». La première et la troisième restent vraies ; la deuxième ne
 * l'est plus du jour où le site place un lien qui le rémunère. Elle a donc
 * été précisée en même temps que ce module est né, et non après coup.
 *
 * C'est la troisième fois que ce site doit réparer une promesse devenue
 * fausse (D1 pour les vœux, puis les écrans de compte). La règle qui s'en
 * dégage : une promesse ne se contourne pas, elle se réécrit AVANT de faire
 * ce qu'elle interdisait.
 *
 * ── Ce que le lien ne fait pas ───────────────────────────────────────────
 *
 * Aucun script de Papernest n'est chargé. C'est une balise `a`, comme le
 * bouton Google : le partenaire n'apprend l'existence d'un visiteur qu'au
 * moment où celui-ci clique. Sur un site qui s'adresse à des mineurs, la
 * différence n'est pas cosmétique.
 *
 * `rel="sponsored"` est la valeur prévue pour un lien rémunéré. Sans elle,
 * un moteur le traite comme une recommandation éditoriale — ce qu'il n'est
 * pas — et peut sanctionner le site pour lien payant non déclaré.
 */

export interface Partenaire {
  readonly nom: string
  readonly lien: string
  /**
   * La mention de rémunération, affichée partout où le lien apparaît —
   * ou `null` quand le lien ne nous rapporte RIEN.
   *
   * La distinction n'est pas cosmétique. Deux logos côte à côte se lisent
   * comme deux partenariats de même nature ; si un seul est rémunéré, il
   * faut le dire, sans quoi on laisse croire que l'autre l'est aussi — ou
   * pire, que ni l'un ni l'autre ne l'est.
   */
  readonly remuneration: string | null
  /** Ce que le partenaire fait réellement, sans promesse chiffrée. */
  readonly quoi: string
}

/**
 * Les attributs d'un lien, selon qu'il rapporte ou non.
 *
 * `sponsored` déclare un lien payant. Le poser sur un lien qui ne l'est pas
 * serait faux dans l'autre sens : on annoncerait à un moteur un contrat
 * commercial qui n'existe pas, et on s'interdirait de le citer un jour comme
 * une vraie recommandation.
 */
export function relDe(p: Partenaire): string {
  return p.remuneration === null ? 'noopener noreferrer' : REL_PARTENAIRE
}

/**
 * Papernest — énergie, assurance habitation, mobile et internet.
 *
 * Aucun montant n'est annoncé, ici ni à l'écran. La règle 1 de CLAUDE.md
 * veut que tout euro affiché remonte à une ligne de calcul avec sa source
 * et son millésime ; une économie promise par un partenaire n'en a pas. On
 * dit ce que le service FAIT, jamais ce qu'il ferait gagner.
 */
export const PAPERNEST: Partenaire = {
  nom: 'papernest',
  lien:
    'https://app.papernest.com/onboarding?anonymous' +
    '&x=a45d02d5-18bf-4b8b-a028-baf31f1cb7b7' +
    '&y=1bd41d4a-598b-4237-a49f-03d0eaaaaaaa' +
    '&destination=intro-call-or-app__generic&user.campaign=app_link',
  remuneration:
    'papernest est un partenaire : le service est gratuit pour toi, et c’est lui qui ' +
    'nous rémunère si tu souscris. Ça ne change rien à ce que tu paies, et nous ne ' +
    'touchons rien si tu compares sans rien signer.',
  quoi:
    'Il compare les offres d’électricité, de gaz, d’assurance habitation, de mobile et ' +
    'd’internet, puis s’occupe des démarches et de la résiliation de l’ancien contrat.',
}

/**
 * leboncoin — les annonces de logement.
 *
 * ── Pourquoi il est ici, et pourquoi il n'est PAS un partenaire ──────────
 *
 * C'est là qu'une grande partie des locations étudiantes sont publiées, et
 * la recherche de logement est le premier obstacle concret d'une rentrée —
 * avant même les contrats. Le citer rend le bloc utile plutôt que
 * simplement commercial.
 *
 * Mais aucun accord ne nous lie à leboncoin et ce lien ne nous rapporte
 * rien : `remuneration` vaut donc `null`, il ne porte pas `sponsored`, et
 * l'écran dit lequel des deux liens est payé.
 *
 * Le jour où un accord existerait, il suffira de renseigner
 * `remuneration` : le `rel` suit, et `partenaires.test.ts` exigera la
 * mention à l'écran.
 */
export const LEBONCOIN: Partenaire = {
  nom: 'leboncoin',
  lien: 'https://www.leboncoin.fr/recherche?category=10',
  remuneration: null,
  quoi:
    'Une grande partie des locations étudiantes y sont publiées, souvent par des ' +
    'particuliers et sans frais d’agence.',
}

/**
 * Les attributs d'un lien rémunéré.
 *
 * `sponsored` le déclare payant, `noopener` empêche la page ouverte
 * d'accéder à la nôtre, `noreferrer` ne lui transmet pas la page de départ.
 */
export const REL_PARTENAIRE = 'sponsored noopener noreferrer'
