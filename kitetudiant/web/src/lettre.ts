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
export function assembler(reponses: Reponses, questions: readonly Question[] = QUESTIONS): string {
  const parties: string[] = []
  for (const partie of ['introduction', 'developpement', 'conclusion'] as const) {
    const bloc = questions
      .filter((q) => q.partie === partie)
      .map((q) => (reponses[q.cle] ?? '').trim())
      .filter((t) => t !== '')
      .join(' ')
    if (bloc !== '') parties.push(bloc)
  }
  return parties.join('\n\n')
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
        `Ton texte fait ${l.caracteres} caractères, soit ${l.caracteres - l.limite} de trop. ` +
        `Parcoursup en accepte ${l.limite}.`,
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
