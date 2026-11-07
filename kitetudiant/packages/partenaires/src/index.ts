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
   * Le domaine auquel `lien` doit appartenir, quoi qu'il arrive.
   *
   * Le lien d'affiliation se règle depuis la console (`server/partenaires.ts`) :
   * une campagne change, un compte change, et personne ne veut redéployer pour
   * ça. Mais le NOM, le LOGO et la mention de rémunération, eux, restent dans
   * le dépôt — donc un lien reréglé sur un autre domaine afficherait le logo
   * de papernest au-dessus d'un bouton qui mène ailleurs.
   *
   * Ce champ ferme cette porte : `lienAutorise` refuse tout ce qui ne
   * redescend pas de ce domaine. La console peut changer la campagne, jamais
   * le destinataire.
   */
  readonly domaine: string
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
  domaine: 'papernest.com',
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
  domaine: 'leboncoin.fr',
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


/* ═══════════════════════════════════════════════════════════════════════
   Le lien d'affiliation, réglable depuis la console
   ═══════════════════════════════════════════════════════════════════════

   ── Ce qui se règle, et ce qui ne se règle pas ──────────────────────────

   SEULE l'adresse se règle. Le nom, le logo, la description et la mention de
   rémunération restent dans ce fichier, versionnés et relus.

   Ce partage n'est pas un compromis, c'est le point. Une adresse
   d'affiliation change souvent — une campagne, un compte, un identifiant de
   suivi — et redéployer le site pour ça finit par vouloir dire ne pas le
   faire. La mention de rémunération, elle, ne doit JAMAIS pouvoir être
   modifiée à côté du lien qu'elle accompagne : rendre les deux réglables,
   c'est rendre possible un lien payé dont la phrase a été effacée, depuis un
   écran d'administration, sans relecture et sans trace dans le dépôt.

   Le lien voyage donc avec une mention qu'on ne peut pas lui retirer.

   ── Pourquoi le domaine est verrouillé ──────────────────────────────────

   Le logo reste celui du dépôt. Un lien reréglé vers un autre domaine
   afficherait donc le logo de papernest au-dessus d'un bouton menant
   ailleurs — exactement ce qu'on fait quand on veut tromper quelqu'un. Peu
   importe que ce soit une faute de frappe ou une console compromise : le
   résultat à l'écran est le même, et c'est lui qui compte.

   `lienAutorise` refuse donc tout ce qui ne redescend pas de `domaine`, et
   le navigateur le revérifie en recevant la réponse du serveur. Changer de
   partenaire est un changement de code, avec son logo et sa mention. */

/** Les partenaires que la console a le droit de régler. Liste fermée. */
export const PARTENAIRES_GERES: readonly Partenaire[] = [PAPERNEST, LEBONCOIN]

/** Le partenaire de ce nom, ou `null`. Aucun nom inventé n'est accepté. */
export function partenaireGere(nom: string): Partenaire | null {
  return PARTENAIRES_GERES.find((p) => p.nom === nom) ?? null
}

export type Verdict = { readonly ok: true } | { readonly ok: false; readonly raison: string }

/**
 * Cette adresse peut-elle remplacer celle d'un partenaire ?
 *
 * Quatre refus, et chacun dit lequel : une adresse rejetée sans raison se
 * retape à l'identique.
 */
export function lienAutorise(p: Partenaire, lien: string): Verdict {
  const brut = lien.trim()
  if (brut === '') return { ok: false, raison: 'L’adresse est vide.' }

  let url: URL
  try {
    url = new URL(brut)
  } catch {
    return {
      ok: false,
      raison: 'Ce n’est pas une adresse complète : elle doit commencer par https://.',
    }
  }

  if (url.protocol !== 'https:') {
    return {
      ok: false,
      raison: `L’adresse doit être en https, pas en ${url.protocol.replace(':', '')}.`,
    }
  }

  /* `https://papernest.com@ailleurs.fr/` a pour hôte ailleurs.fr : le test de
     domaine ci-dessous l'attrape déjà. On refuse quand même les identifiants
     dans l'adresse, parce qu'une adresse qui en porte n'a aucune raison
     d'exister ici et que la lire demande de savoir ce piège. */
  if (url.username !== '' || url.password !== '') {
    return { ok: false, raison: 'L’adresse ne doit pas contenir d’identifiant.' }
  }

  const hote = url.hostname.toLowerCase()
  if (hote !== p.domaine && !hote.endsWith(`.${p.domaine}`)) {
    return {
      ok: false,
      raison:
        `Cette adresse mène à ${hote}, pas à ${p.domaine}. Le logo et la mention ` +
        `affichés à côté sont ceux de ${p.nom} : changer de destinataire demande ` +
        'de changer aussi le logo, donc de passer par le code.',
    }
  }

  return { ok: true }
}

/**
 * Le même partenaire, avec l'adresse réglée en console.
 *
 * Revalide avant de remplacer. Le serveur valide déjà — mais c'est le
 * navigateur qui affiche le logo, et il n'a aucune raison de faire confiance
 * à une réponse sur ce point précis. Une adresse refusée laisse celle du
 * dépôt : c'est une valeur déclarée ici, lisible, pas un repli inventé.
 */
export function avecLien(p: Partenaire, lien: string | undefined): Partenaire {
  if (lien === undefined) return p
  return lienAutorise(p, lien).ok ? { ...p, lien: lien.trim() } : p
}
