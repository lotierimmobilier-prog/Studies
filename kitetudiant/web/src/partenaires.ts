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
  /** La mention de rémunération, affichée partout où le lien apparaît. */
  readonly remuneration: string
  /** Ce que le partenaire fait réellement, sans promesse chiffrée. */
  readonly quoi: string
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
 * Les attributs d'un lien rémunéré.
 *
 * `sponsored` le déclare payant, `noopener` empêche la page ouverte
 * d'accéder à la nôtre, `noreferrer` ne lui transmet pas la page de départ.
 */
export const REL_PARTENAIRE = 'sponsored noopener noreferrer'
