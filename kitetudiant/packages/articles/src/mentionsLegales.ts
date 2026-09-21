/**
 * Les mentions légales, la politique de données, et la déclaration des
 * liens rémunérés.
 *
 * ── Pourquoi ce fichier est né ───────────────────────────────────────────
 *
 * L'accueil a gagné un lien partenaire rémunéré, et il a fallu le déclarer
 * quelque part qui fasse foi. Il s'est avéré qu'il n'y avait AUCUNE page
 * légale sur ce site : ni mentions légales, ni politique de données. Pour
 * un site français qui crée des comptes et reçoit des bulletins scolaires
 * de mineurs, ce n'est pas un oubli de forme.
 *
 * ── Ce que ce fichier ne fait pas ────────────────────────────────────────
 *
 * Il n'invente aucune identité. Raison sociale, adresse, SIREN, directeur
 * de la publication, adresse de contact : ce sont des faits que le code ne
 * connaît pas. Ils valent `null` tant qu'ils n'ont pas été fournis, la page
 * dit alors en clair qu'ils manquent, et `mentionsLegales.test.ts` refuse
 * qu'un `null` disparaisse en silence.
 *
 * C'est la même règle que partout ailleurs ici : « ne pas inventer de
 * valeurs de repli silencieuses ». Une mention légale inventée est pire
 * qu'une mention légale absente — l'absence se voit, l'invention non.
 *
 * ── Le texte décrit ce que le code FAIT ──────────────────────────────────
 *
 * Chaque affirmation de la section « données » a été vérifiée dans le code
 * avant d'être écrite, pas déduite de ce que le site promettait. C'est
 * comme ça qu'on a découvert que deux écrans juraient que les bulletins
 * « ne sont jamais envoyés » alors qu'ils partent au serveur puis à l'API
 * Claude. Les deux écrans ont été corrigés dans le même commit que cette
 * page : une page légale qui contredit l'application ne protège personne.
 */

/** Un fait d'identité que seul l'éditeur connaît. `null` = à fournir. */
export type AFournir = string | null

export interface IdentiteEditeur {
  /** Raison sociale, ou nom et prénom si le site est édité par une personne. */
  readonly editeur: AFournir
  /** « SAS », « auto-entrepreneur », « association loi 1901 »… */
  readonly formeJuridique: AFournir
  /** Adresse du siège ou du domicile déclaré. */
  readonly adresse: AFournir
  /** SIREN ou SIRET. `null` si le site n'est pas édité par une entreprise. */
  readonly siren: AFournir
  /** Personne responsable du contenu publié. */
  readonly directeurPublication: AFournir
  /** Adresse à laquelle on peut écrire, y compris pour exercer ses droits. */
  readonly contact: AFournir
  /** Nom de l'hébergeur, et son adresse complète — la loi exige les deux. */
  readonly hebergeur: AFournir
  readonly adresseHebergeur: AFournir
}

/**
 * Ce qui est connu aujourd'hui, et ce qui ne l'est pas.
 *
 * `hebergeur` est renseigné parce que le script de déploiement vise un VPS
 * Hostinger et que c'est un fait du dépôt. Son adresse légale complète, en
 * revanche, doit être recopiée depuis le contrat — pas devinée.
 */
export const IDENTITE: IdentiteEditeur = {
  editeur: null,
  formeJuridique: null,
  adresse: null,
  siren: null,
  directeurPublication: null,
  contact: null,
  hebergeur: 'Hostinger',
  adresseHebergeur: null,
}

export interface SectionLegale {
  readonly titre: string
  /** Les paragraphes, dans l'ordre. Une liste de points vaut un paragraphe. */
  readonly corps: readonly (string | readonly string[])[]
}

/**
 * La section demandée : les liens rémunérés.
 *
 * Elle est la première des sections rédigées parce que c'est celle qui a
 * motivé la page, et parce qu'elle est celle qu'on ira chercher.
 *
 * Elle dit trois choses, et pas une de plus : qu'il existe un lien
 * rémunéré, lequel, et ce que ça change (rien, pour le lecteur). Aucun
 * montant, aucune promesse d'économie — règle 1 de CLAUDE.md : un euro
 * affiché remonte à une ligne de calcul datée, et une économie annoncée par
 * un partenaire n'en a aucune.
 */
export const LIENS_REMUNERES: SectionLegale = {
  titre: 'Liens commerciaux et rémunération du site',
  corps: [
    'KitEtudiant.fr publie un lien commercial, et un seul. Il figure sur la page ' +
      'd’accueil, dans la section « Faire baisser tes factures », et renvoie vers ' +
      'papernest, un service de comparaison et de souscription de contrats ' +
      'd’électricité, de gaz, d’assurance habitation, de téléphonie mobile et ' +
      'd’accès à internet.',
    'Ce lien est rémunéré. Si vous souscrivez un contrat après l’avoir suivi, ' +
      'papernest verse une commission à l’éditeur du site. Le service reste gratuit ' +
      'pour vous, le prix des contrats est le même que si vous étiez passé ' +
      'directement par papernest, et aucune commission n’est due si vous comparez ' +
      'sans souscrire.',
    'Ce lien porte l’attribut HTML « rel="sponsored" », qui le déclare comme ' +
      'rémunéré aux moteurs de recherche, et la mention de rémunération est affichée ' +
      'à l’écran au-dessus du bouton, avant tout clic.',
    'Ce que ce partenariat ne change pas :',
    [
      'Aucun calcul du site n’en dépend. Le reste-à-vivre, les statistiques ' +
        'd’admission et les articles sont identiques que vous cliquiez ou non.',
      'Aucun montant d’économie n’est annoncé, ni sur le site ni ici. Le site ' +
        'n’affiche que des montants issus de barèmes publiés, avec leur source et ' +
        'leur millésime.',
      'Aucun script de papernest n’est chargé sur le site. Le partenaire n’apprend ' +
        'l’existence d’un visiteur qu’au moment où celui-ci clique sur le lien, et ' +
        'rien de ce que vous faites sur KitEtudiant.fr ne lui est transmis.',
      'Aucune formation, aucune école, aucun résultat n’est mis en avant, retiré ou ' +
        'réordonné pour des raisons commerciales.',
    ],
    'Les contrats proposés par papernest se signent à la majorité, ou par un ' +
      'représentant légal. KitEtudiant.fr s’adresse en grande partie à des lycéens ' +
      'mineurs : un contrat signé par un mineur non émancipé est annulable, et le ' +
      'site le rappelle à l’endroit où le lien apparaît.',
    'Si d’autres liens rémunérés venaient à être publiés, ils seraient ajoutés ici ' +
      'et signalés de la même manière à l’endroit où ils apparaissent.',
  ],
}

/**
 * Ce que le site reçoit, garde, et transmet.
 *
 * Écrit d'après le code, pas d'après ce que le site promettait. Les
 * références entre parenthèses sont là pour qu'on puisse vérifier, et pour
 * qu'une prochaine modification du code rende la contradiction visible.
 */
export const DONNEES: SectionLegale = {
  titre: 'Données personnelles',
  corps: [
    'Le site fonctionne sans compte. Un compte ne sert qu’à retrouver une liste de ' +
      'vœux d’un appareil à l’autre, et à accéder au détail poste par poste d’un ' +
      'budget.',
    'Ce qui est enregistré sur le serveur, pour un compte :',
    [
      'Votre adresse e-mail, chiffrée. Une empreinte cryptographique en est dérivée ' +
        'pour retrouver le compte sans déchiffrer la table.',
      'Votre mot de passe sous forme d’empreinte salée — jamais en clair. Les comptes ' +
        'ouverts avec Google n’en ont pas.',
      'Les dates de création, de dernière visite, et la date de suppression prévue.',
      'Votre liste de vœux : un code de formation et un rang, rien d’autre. Ni note, ' +
        'ni montant, ni commentaire.',
      'Une empreinte du jeton de session. Le jeton lui-même ne quitte pas votre ' +
        'navigateur.',
    ],
    'Ce qui n’est jamais enregistré : vos notes, vos réponses au questionnaire, votre ' +
      'budget, vos cartes de villes. Ces éléments restent dans votre navigateur.',
    'Ce qui est envoyé mais non conservé : si vous déposez un bulletin scolaire, le ' +
      'fichier est transmis à notre serveur, puis à l’API Claude d’Anthropic, qui en ' +
      'extrait des moyennes par matière et une lecture rédigée des appréciations. Le ' +
      'fichier n’est écrit sur aucun disque chez nous et le texte brut des ' +
      'appréciations n’est pas conservé : seuls les nombres et la synthèse reviennent ' +
      'dans votre navigateur. Déposer un bulletin est facultatif — les moyennes ' +
      'peuvent être saisies à la main, et rien n’est alors transmis à personne.',
    'Sous-traitants : Anthropic (lecture des bulletins et assistance rédactionnelle), ' +
      'France Travail (comptage et affichage d’offres d’emploi, sans aucune donnée ' +
      'vous concernant), l’IGN via data.geopf.fr (fonds de carte), et Google si vous ' +
      'choisissez de vous connecter avec un compte Google, qui nous transmet alors ' +
      'votre adresse e-mail et rien d’autre.',
    'Durée de conservation : un compte inutilisé pendant trois ans est supprimé ' +
      'automatiquement, avec sa liste de vœux.',
    'Traceurs : aucun. Le site ne pose pas de cookie publicitaire, ne mesure pas ' +
      'l’audience par un service tiers, et ne charge aucun script extérieur. Le seul ' +
      'stockage effectué dans votre navigateur sert à retenir vos réponses et vos ' +
      'cartes, et ne sort jamais de votre appareil.',
    'Vos droits : vous pouvez demander l’accès, la rectification, l’effacement ou la ' +
      'portabilité de vos données, à l’adresse de contact indiquée plus haut. Si la ' +
      'réponse ne vous convient pas, vous pouvez saisir la CNIL (cnil.fr).',
  ],
}

/** Les mineurs, puisque c'est la majeure partie du public. */
export const MINEURS: SectionLegale = {
  titre: 'Mineurs',
  corps: [
    'Ce site s’adresse en grande partie à des lycéens, souvent mineurs. Il est conçu ' +
      'pour en tenir compte : il ne demande ni nom, ni prénom, ni adresse postale, ni ' +
      'téléphone, ni date de naissance complète. Une adresse e-mail et un mot de passe ' +
      'suffisent à ouvrir un compte.',
    'Un bulletin scolaire déposé concerne un mineur dans la plupart des cas. C’est ' +
      'pourquoi il n’est conservé nulle part, et pourquoi le texte des appréciations ' +
      'des professeurs n’est pas gardé après lecture.',
    'Un représentant légal peut demander à tout moment la suppression du compte de son ' +
      'enfant, à l’adresse de contact indiquée plus haut.',
  ],
}

/** Ce que le site n'est pas — repris de ce qui est déjà dit partout. */
export const INDEPENDANCE: SectionLegale = {
  titre: 'Indépendance',
  corps: [
    'KitEtudiant.fr est un service indépendant. Il n’est affilié ni à Parcoursup, ni ' +
      'au ministère de l’Enseignement supérieur, ni aux CROUS, ni à aucun ' +
      'établissement d’enseignement.',
    'Il n’accède à aucun dossier Parcoursup et ne transmet rien à la plateforme. La ' +
      'liste de vœux que vous préparez ici ne vaut pas dépôt : seuls les vœux ' +
      'formulés et confirmés sur parcoursup.gouv.fr comptent.',
    'En cas de divergence entre ce site et une source officielle, la source ' +
      'officielle fait foi.',
  ],
}

/** Les données publiques réutilisées, et à quel titre. */
export const SOURCES: SectionLegale = {
  titre: 'Données publiques réutilisées',
  corps: [
    'Le site réutilise des jeux de données ouverts, chacun affiché avec sa source et ' +
      'son millésime à l’endroit où il apparaît :',
    [
      'Statistiques d’admission de Parcoursup, publiées par le ministère de ' +
        'l’Enseignement supérieur.',
      'Indicateur des loyers par commune, publié par la DGALN et l’ANIL.',
      'Fiches de formation de l’Onisep, sous licence ODbL.',
      'Offres d’emploi et référentiel des métiers, API de France Travail.',
      'Fonds de carte de l’IGN, via data.geopf.fr.',
    ],
    'Ces réutilisations n’impliquent aucune approbation des organismes concernés.',
  ],
}

/** L'ordre d'affichage. L'identité d'abord, comme l'exige la loi. */
export const SECTIONS: readonly SectionLegale[] = [
  INDEPENDANCE,
  LIENS_REMUNERES,
  DONNEES,
  MINEURS,
  SOURCES,
]

export const MENTIONS_TITRE = 'Mentions légales'
export const MENTIONS_TITRE_ONGLET = 'Mentions légales — KitEtudiant.fr'
export const MENTIONS_DESCRIPTION =
  'Éditeur, hébergeur, données personnelles, liens rémunérés et sources de données ' +
  'de KitEtudiant.fr.'
