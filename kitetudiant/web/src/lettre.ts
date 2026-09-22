/**
 * Le brouillon de lettre de motivation : tout ce qui se calcule.
 *
 * ── La règle qui tient tout le fichier ─────────────────────────────────────
 *
 * AUCUNE PHRASE DE LA LETTRE N'EST ÉCRITE PAR LE SITE. `assembler` concatène
 * les réponses de l'élève, dans l'ordre du plan, et n'ajoute rien — pas une
 * formule de liaison, pas une transition, pas une politesse. Le seul texte
 * qui sort est celui qui est entré.
 *
 * C'est la consigne du ministère, citée dans `lettreMotivation.ts` : « ce qui
 * est demandé, c'est une production personnelle ». Un site qui affiche cette
 * phrase et compose la lettre à côté se contredit.
 *
 * Jean-Paul, lui, RELIT. Il compte les caractères, cherche le prénom que la
 * fiche interdit, repère les réponses vides et les deux brouillons identiques.
 * Ce sont des vérifications, pas de la rédaction : elles ne produisent aucun
 * mot qui finira dans la lettre.
 */

import { LONGUEUR, QUESTIONS, type Question } from '../../packages/articles/src/lettreMotivation.ts'
/* Tout nombre affiché passe par là : « 1 500 » et non « 1500 ». Les deux
   remarques ci-dessous s'affichent à côté du compteur, qui le fait déjà —
   deux mises en forme pour un même nombre, à deux lignes d'écart, se lisent
   comme deux nombres différents. */
import { nombre } from './nombres.ts'

/** Les réponses, une par question. Une clé absente vaut « pas encore répondu ». */
export type Reponses = Readonly<Record<string, string>>

/** Un brouillon rattaché à une formation. Jamais partagé entre deux vœux. */
export interface Brouillon {
  /** `cod_aff_form`, la clé pivot. Un brouillon par formation demandée. */
  readonly codeFormation: string
  readonly reponses: Reponses
  /** Le texte final, que l'élève a pu retoucher à la main après l'assemblage. */
  readonly texte: string
  readonly modifieLe: string
}

/* ------------------------------------------------------------ assemblage */

/**
 * Le brouillon, fait des seules réponses de l'élève.
 *
 * Les parties sont séparées par une ligne vide : l'introduction, le
 * développement, la conclusion, comme le demande la fiche. Rien d'autre n'est
 * ajouté entre elles.
 */
/**
 * La typographie d'une lettre, appliquée aux phrases de l'élève.
 *
 * ── Pourquoi ce n'est pas rédiger à sa place ─────────────────────────────
 *
 * Aucun mot n'est ajouté, retiré ni remplacé. Une majuscule en début de
 * phrase et un point à la fin, c'est la mise en forme d'un texte, pas sa
 * composition — au même titre que les espaces entre les paragraphes, que
 * `assembler` pose déjà.
 *
 * La différence avec ce que la fiche interdit tient en une phrase : ici, si
 * l'on retire la mise en forme, il reste exactement ce que l'élève a écrit.
 *
 * ── Ce qui n'est volontairement PAS fait ────────────────────────────────
 *
 * Les espaces fines insécables avant « ; : ? ! », que la typographie
 * française demande. Ce texte finit collé dans un champ de Parcoursup, dont
 * on ne maîtrise ni la police ni l'encodage : une U+202F qui s'y afficherait
 * en carré vide abîmerait la lettre au lieu de la soigner.
 */
export function typographier(texte: string): string {
  return texte
    .split('\n')
    .map((ligne) => {
      const l = ligne.trim()
      if (l === '') return ''
      /* Majuscule au début, et après chaque fin de phrase. Le motif exige
         l'espace qui suit : « M. Dupont » ou « 3.5 » ne sont pas des fins de
         phrase, et une règle sans cette espace les couperait en deux. */
      const majuscules = l.replace(
        /(^|[.!?]\s+)([a-zà-öø-ÿ])/g,
        (_, avant: string, lettre: string) => avant + lettre.toUpperCase(),
      )
      // Un point final, sauf si la phrase se termine déjà par une ponctuation.
      return /[.!?…»)]$/.test(majuscules) ? majuscules : `${majuscules}.`
    })
    .join('\n')
}

export function assembler(reponses: Reponses, questions: readonly Question[] = QUESTIONS): string {
  const parties: string[] = []
  for (const partie of ['introduction', 'developpement', 'conclusion'] as const) {
    const bloc = questions
      .filter((q) => q.partie === partie)
      .map((q) => (reponses[q.cle] ?? '').trim())
      .filter((t) => t !== '')
      .join(' ')
    if (bloc !== '') parties.push(typographier(bloc))
  }
  return parties.join('\n\n')
}

/* ------------------------------------------------------- pré-remplissage */

/**
 * La seule réponse que le site peut pré-remplir : l'intitulé du vœu.
 *
 * ── Pourquoi celle-là, et aucune autre ──────────────────────────────────
 *
 * Ce n'est pas de la rédaction, c'est une DONNÉE. L'intitulé exact de la
 * formation et le nom de l'établissement viennent de l'open data Parcoursup,
 * et la fiche du ministère les réclame nommément : « le bon intitulé de la
 * formation », « BUT si vous parlez du diplôme et non pas IUT ». C'est
 * justement là que les candidats se trompent, en recopiant un nom approximatif
 * lu sur un site d'école.
 *
 * Les cinq autres questions portent sur ce qui l'intéresse, ce qu'il a fait,
 * ce qu'il projette. Aucune donnée ne répond à ça, et une phrase proposée
 * serait une phrase écrite à sa place — ce que la fiche interdit et ce que
 * tout ce module refuse.
 *
 * Le texte rendu est une amorce factuelle, pas une phrase finie : l'élève la
 * complète et la réécrit. Elle n'est posée que sur un champ VIDE, jamais
 * par-dessus ce qu'il a tapé.
 */
export function amorceFormation(libelle: string, etablissement: string): string {
  const nom = libelle.trim()
  if (nom === '') return ''
  const ou = etablissement.trim()
  /* Une virgule, pas une préposition.
     « à ${ou} » donnait « à Université de Bordeaux » : l'open data publie les
     noms sans article, et deviner lequel va devant chacun — l'IUT, la faculté,
     les INSA — se trompe une fois sur trois. Une apposition se lit dans tous
     les cas, et l'élève en fera sa phrase : c'est une amorce, pas un texte. */
  return ou === '' ? nom : `${nom}, ${ou}`
}

/** La clé de la seule question pré-remplissable. Nommée, pour être testée. */
export const QUESTION_PREREMPLIE = 'demande'

/**
 * Les réponses, l'amorce posée si et seulement si la question est vide.
 *
 * Ne touche jamais à une réponse existante : quelqu'un qui revient sur son
 * brouillon retrouve ses mots, pas les nôtres.
 */
export function avecAmorce(reponses: Reponses, amorce: string): Reponses {
  if (amorce === '' || (reponses[QUESTION_PREREMPLIE] ?? '').trim() !== '') return reponses
  return { ...reponses, [QUESTION_PREREMPLIE]: amorce }
}

/** Combien de questions ont reçu une réponse. Pour dire où on en est. */
export function avancement(
  reponses: Reponses,
  questions: readonly Question[] = QUESTIONS,
): { readonly remplies: number; readonly total: number } {
  return {
    remplies: questions.filter((q) => (reponses[q.cle] ?? '').trim() !== '').length,
    total: questions.length,
  }
}

/* ------------------------------------------------------------- longueur */

/**
 * Le nombre de caractères au sens de Parcoursup.
 *
 * Compté en points de code et non en unités UTF-16 : « œ » et un emoji valent
 * un caractère chacun, comme dans n'importe quel compteur qu'un élève verra
 * ailleurs. `"".length` en compterait deux pour l'emoji.
 */
export function compterCaracteres(texte: string): number {
  return [...texte].length
}

export interface EtatLongueur {
  readonly caracteres: number
  readonly limite: number
  readonly restants: number
  readonly depasse: boolean
}

export function longueur(texte: string, ifsi = false): EtatLongueur {
  const limite = ifsi ? LONGUEUR.ifsi : LONGUEUR.standard
  const caracteres = compterCaracteres(texte)
  return { caracteres, limite, restants: limite - caracteres, depasse: caracteres > limite }
}

/* -------------------------------------------------- la relecture de Jean-Paul */

export type Gravite = 'bloquant' | 'conseil'

export interface Remarque {
  readonly cle: string
  readonly gravite: Gravite
  readonly texte: string
}

/** Découpe un texte en mots comparables : sans accents, sans casse. */
function mots(texte: string): string[] {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 1)
}

/**
 * Le prénom ou le nom apparaît-il dans le texte ?
 *
 * La fiche est catégorique : « Il faut absolument éviter de mentionner votre
 * identité (nom, prénom...) dans votre lettre de motivation. » La comparaison
 * ignore les accents et la casse, et ne retient que les mots entiers — sinon
 * un prénom comme « Marc » signalerait « marché ».
 */
export function identiteCitee(texte: string, identite: readonly string[]): string[] {
  const presents = new Set(mots(texte))
  const trouves: string[] = []
  for (const brut of identite) {
    for (const m of mots(brut)) {
      if (presents.has(m) && !trouves.includes(brut)) trouves.push(brut)
    }
  }
  return trouves
}

/**
 * Deux brouillons sont-ils la même lettre ?
 *
 * « Pas de copier/coller ! » dit la fiche, et c'est ce qui se repère le plus
 * vite à la lecture de deux dossiers. On compare la part de mots communs
 * plutôt que le texte exact : changer le nom de l'école ne fait pas deux
 * lettres différentes.
 */
export function ressemblance(a: string, b: string): number {
  const ma = new Set(mots(a))
  const mb = new Set(mots(b))
  if (ma.size === 0 || mb.size === 0) return 0
  let communs = 0
  for (const m of ma) if (mb.has(m)) communs += 1
  return communs / Math.min(ma.size, mb.size)
}

/** Au-delà, deux brouillons sont signalés comme le même texte. */
export const SEUIL_RESSEMBLANCE = 0.8

/**
 * En dessous de cette part de la limite, le texte est encore des notes.
 *
 * 40 % de 1 500, c'est six cents caractères — deux petits paragraphes. En
 * dessous, il ne s'agit plus d'étoffer mais de reprendre, et le dire tôt vaut
 * mieux que le découvrir à la relecture.
 */
export const SEUIL_NOTES = 0.4

/**
 * Ce que Jean-Paul a à dire sur un brouillon.
 *
 * Que des constats vérifiables : un compte, une présence, une comparaison.
 * Aucune appréciation sur le fond — « ta motivation est peu convaincante »
 * serait un jugement de machine sur un mineur, et la règle 5 interdit déjà
 * d'en faire une note.
 */
export function relire(
  brouillon: Brouillon,
  options: {
    readonly identite?: readonly string[]
    readonly ifsi?: boolean
    /** Les autres brouillons de l'élève, pour détecter le copier-coller. */
    readonly autres?: readonly Brouillon[]
    readonly questions?: readonly Question[]
  } = {},
): Remarque[] {
  const questions = options.questions ?? QUESTIONS
  const remarques: Remarque[] = []
  const texte = brouillon.texte

  const l = longueur(texte, options.ifsi ?? false)
  if (l.depasse) {
    remarques.push({
      cle: 'longueur',
      gravite: 'bloquant',
      texte:
        `Ton texte fait ${nombre(l.caracteres)} caractères, soit ` +
        `${nombre(l.caracteres - l.limite)} de trop. Parcoursup en accepte ` +
        `${nombre(l.limite)}.`,
    })
  }

  const citees = identiteCitee(texte, options.identite ?? [])
  if (citees.length > 0) {
    remarques.push({
      cle: 'identite',
      gravite: 'bloquant',
      texte:
        `${citees.join(' et ')} apparaît dans ton texte. La fiche du ministère demande ` +
        'de ne jamais mentionner son nom ni son prénom dans la lettre.',
    })
  }

  if (/^\s*(madame|monsieur|cher|chère)\b/i.test(texte) || /\ble \d{1,2}\/\d{1,2}\//.test(texte)) {
    remarques.push({
      cle: 'entete',
      gravite: 'conseil',
      texte:
        'On dirait un début de courrier. La fiche précise que c’est « un texte, sans date ' +
        'et sans en-tête ».',
    })
  }

  /* « C'est encore des notes, pas une lettre. »
   *
   * Le cas le plus fréquent, et celui que rien ne disait : six réponses de
   * trois mots font un texte de quatre-vingt-dix caractères là où la fiche en
   * attend mille cinq cents. Le compteur l'affichait — « 90 sur 1 500 » — mais
   * un compteur ne dit pas que c'est un problème, il dit un nombre.
   *
   * Le seuil est à 40 % : en dessous, il ne s'agit plus d'étoffer mais de
   * reprendre, et le dire tôt vaut mieux que le découvrir à la relecture.
   *
   * La remarque NOMME la réponse la plus courte, parce que « développe » sans
   * dire où est un conseil qu'on ne peut pas suivre. Elle ne juge pas ce qui
   * est écrit : elle compte des caractères, comme le reste de cette relecture.
   */
  const ecrites = questions
    .map((q) => ({ q, texte: (brouillon.reponses[q.cle] ?? '').trim() }))
    .filter((r) => r.texte !== '')
  if (texte.trim() !== '' && l.caracteres < Math.round(l.limite * SEUIL_NOTES) && ecrites.length > 0) {
    const plusCourte = ecrites.reduce((a, b) => (a.texte.length <= b.texte.length ? a : b))
    remarques.push({
      cle: 'notes',
      gravite: 'conseil',
      texte:
        `Ton texte fait ${nombre(l.caracteres)} caractères, là où une lettre en fait environ ` +
        `${nombre(l.limite)} : il en manque ${nombre(l.restants)}. Ce sont encore des notes. Reprends tes ` +
        `réponses une par une et écris-les en phrases — la plus courte pour l’instant est ` +
        `« ${plusCourte.q.question} ».`,
    })
  }

  const sansReponse = questions.filter((q) => (brouillon.reponses[q.cle] ?? '').trim() === '')
  if (sansReponse.length > 0) {
    remarques.push({
      cle: 'manquantes',
      gravite: 'conseil',
      texte:
        sansReponse.length === 1
          ? `Une question est restée vide : « ${sansReponse[0]?.question} »`
          : `${sansReponse.length} questions sont restées vides, dont « ${sansReponse[0]?.question} »`,
    })
  }

  for (const autre of options.autres ?? []) {
    if (autre.codeFormation === brouillon.codeFormation) continue
    if (ressemblance(texte, autre.texte) >= SEUIL_RESSEMBLANCE) {
      remarques.push({
        cle: `copie:${autre.codeFormation}`,
        gravite: 'bloquant',
        texte:
          'Ce texte est presque le même que celui d’un autre de tes vœux. La fiche est ' +
          'nette là-dessus : « Pas de copier/coller ! » — c’est ce qui se voit le plus vite.',
      })
      break
    }
  }

  return remarques
}

/* ------------------------------------------------- l'échec de chargement */

/**
 * Ce qu'on dit à l'élève quand ses vœux n'arrivent pas.
 *
 * `null` veut dire « rien à dire » : sans compte, la liste vide EST la
 * réponse, et afficher une panne à un visiteur serait lui annoncer un problème
 * qui n'existe pas.
 *
 * Tout le reste se dit. Le premier jet avalait toutes les erreurs — la panne
 * de l'API se présentait alors exactement comme « tu n'as aucun vœu », et
 * l'élève cherchait ses vœux ailleurs pendant que le serveur était à terre.
 * Une donnée manquante s'affiche comme manquante (CLAUDE.md).
 *
 * Cette fonction existe à part du composant pour être tenue par un test :
 * un `catch` qui redeviendrait muet ne se verrait pas autrement.
 */
export function messageDeChargement(erreur: unknown): string | null {
  if (erreur instanceof Error && erreur.name === 'InscriptionRequise') return null
  return (
    'Tes vœux n’ont pas pu être chargés. Tu peux écrire ton brouillon quand même : ' +
    'il sera gardé, et tu pourras le rattacher à un vœu plus tard.'
  )
}

/* ----------------------------------------------------------- persistance */

/* Les brouillons ne quittent pas le navigateur.
 *
 * Ce sont les mots d'un mineur sur ce qu'il espère faire de sa vie, écrits
 * avant relecture. Règle 3 de CLAUDE.md : minimisation. Rien de tout cela
 * n'a de raison d'être envoyé, donc rien ne l'est. */
const CLE = 'kitetudiant.lettres'

export function chargerBrouillons(
  lire: () => string | null = () => {
    try {
      return window.localStorage.getItem(CLE)
    } catch {
      return null
    }
  },
): Brouillon[] {
  const brut = lire()
  if (brut === null) return []
  try {
    const lu: unknown = JSON.parse(brut)
    if (!Array.isArray(lu)) return []
    return lu.filter(
      (b): b is Brouillon =>
        typeof b === 'object' &&
        b !== null &&
        typeof (b as Brouillon).codeFormation === 'string' &&
        typeof (b as Brouillon).texte === 'string',
    )
  } catch {
    return []
  }
}

export function enregistrerBrouillons(
  brouillons: readonly Brouillon[],
  ecrire: (v: string) => void = (v) => {
    try {
      window.localStorage.setItem(CLE, v)
    } catch {
      // Stockage refusé : le brouillon ne survivra pas au rechargement.
    }
  },
): void {
  ecrire(JSON.stringify(brouillons))
}

/** Remplace le brouillon d'une formation, ou l'ajoute. */
export function poser(
  brouillons: readonly Brouillon[],
  brouillon: Brouillon,
): Brouillon[] {
  const sansLui = brouillons.filter((b) => b.codeFormation !== brouillon.codeFormation)
  return [...sansLui, brouillon]
}
