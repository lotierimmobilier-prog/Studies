/**
 * L'atelier de lettre de motivation.
 *
 * ── L'invariant que tout le reste sert ────────────────────────────────────
 *
 * Le site n'écrit AUCUNE phrase de la lettre. La fiche du ministère, que cet
 * écran cite en tête, dit « évitez absolument le recours à des logiciels de
 * type ChatGPT ou équivalent : les enseignants le voient et ce qui est
 * demandé, c'est une production personnelle ».
 *
 * `assembler` est donc tenu par un test de sortie : tout mot qui sort doit
 * être entré. Une transition ajoutée, une formule de politesse glissée en
 * fin de texte, un appel à un modèle — chacun fait virer ce fichier au rouge.
 */

import { readFileSync } from 'node:fs'
import { nombre } from '../nombres.ts'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AVERTISSEMENT_IA,
  LONGUEUR,
  QUESTIONS,
  RELECTURE,
  SOURCE_LETTRE,
} from '../../../packages/articles/src/lettreMotivation.ts'
import {
  amorceFormation,
  assembler,
  avancement,
  avecAmorce,
  chargerBrouillons,
  compterCaracteres,
  enregistrerBrouillons,
  identiteCitee,
  longueur,
  messageDeChargement,
  poser,
  QUESTION_PREREMPLIE,
  relire,
  ressemblance,
  SEUIL_RESSEMBLANCE,
  type Brouillon,
} from '../lettre.ts'

const SRC = resolve(__dirname, '..')

function brouillon(modif: Partial<Brouillon> = {}): Brouillon {
  return {
    codeFormation: '12',
    reponses: {},
    texte: '',
    modifieLe: '2026-09-21T00:00:00.000Z',
    ...modif,
  }
}

/**
 * Le code d'un fichier, ses commentaires retirés.
 *
 * Les deux fichiers de l'atelier EXPLIQUENT, en commentaire, pourquoi ils
 * n'appellent pas de modèle et ne jugent pas le fond — donc ils contiennent
 * les mots « ChatGPT » et « peu convaincante ». Chercher ces mots dans le
 * fichier entier ferait échouer les tests sur la prose qui les interdit,
 * et pousserait à effacer l'explication pour faire passer le test.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Les mots d'un texte, comparables : sans accents, sans casse, sans ponctuation. */
function motsDe(texte: string): string[] {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m !== '')
}

describe('le site n’écrit aucune phrase de la lettre', () => {
  const REPONSES = {
    demande: 'Je demande la licence de droit à Bordeaux.',
    motivation: 'Le droit constitutionnel m’intéresse depuis le cours de spécialité.',
    connaissance: 'Je suis allé à la journée portes ouvertes en février.',
    scolaire: 'La spécialité HGGSP m’a appris à construire un raisonnement.',
    experiences: 'J’ai été bénévole deux étés au festival de ma commune.',
    projet: 'Je voudrais travailler dans le droit public, sans être encore sûr.',
  }

  it('ne fait sortir que des mots entrés', () => {
    /* Le test qui tient tout le fichier. Chaque mot du brouillon doit venir
       d'une réponse de l'élève. Une seule transition ajoutée le fait échouer. */
    const sortie = motsDe(assembler(REPONSES))
    const entree = new Set(Object.values(REPONSES).flatMap(motsDe))
    const inventes = sortie.filter((m) => !entree.has(m))
    expect(inventes, `mots ajoutés par le site : ${inventes.join(', ')}`).toEqual([])
  })

  it('n’ajoute ni politesse ni formule finale', () => {
    const texte = assembler(REPONSES).toLowerCase()
    for (const formule of [
      'je vous remercie',
      'dans l’attente',
      'veuillez agréer',
      'cordialement',
      'madame',
      'monsieur',
    ]) {
      expect(texte, `« ${formule} » a été ajouté`).not.toContain(formule)
    }
  })

  it('ne rend rien quand rien n’a été écrit', () => {
    expect(assembler({})).toBe('')
    expect(assembler({ motivation: '   ' })).toBe('')
  })

  it('suit le plan de la fiche : introduction, développement, conclusion', () => {
    const texte = assembler(REPONSES)
    const parties = texte.split('\n\n')
    expect(parties).toHaveLength(3)
    expect(parties[0]).toContain('licence de droit')
    expect(parties[2]).toContain('droit public')
  })

  it('n’appelle aucun modèle de langage', () => {
    /* La garantie ne vaut que si personne ne rebranche une génération plus
       tard. Les deux fichiers de l'atelier sont relus pour cela. */
    for (const fichier of ['lettre.ts', 'lettre.tsx']) {
      const source = sansCommentaires(readFileSync(resolve(SRC, fichier), 'utf8'))
      expect(source, `${fichier} appelle un modèle`).not.toMatch(
        /anthropic|openai|\bclaude\b|gpt|completion|generer(Texte|Lettre)|redigerLettre/i,
      )
      expect(source, `${fichier} envoie le brouillon quelque part`).not.toMatch(
        /fetch\([^)]*lettre|POST[^\n]*lettre/i,
      )
    }
  })
})

describe('le dépouilleur de commentaires', () => {
  /* Sans ce test, un dépouilleur trop gourmand rendrait décoratifs les deux
     tests qui s'en servent : ils passeraient sur un fichier vide. */
  it('retire les commentaires et garde le code', () => {
    const source = '/* ChatGPT */\nconst a = 1 // note: rien\nconst b = 2'
    const net = sansCommentaires(source)
    expect(net).not.toContain('ChatGPT')
    expect(net).not.toContain('rien')
    expect(net).toContain('const a = 1')
    expect(net).toContain('const b = 2')
  })

  it('ne mange pas les deux barres d’une adresse', () => {
    expect(sansCommentaires("const u = 'https://exemple.fr/x'")).toContain('exemple.fr/x')
  })

  it('laisse intact le vrai code des deux fichiers', () => {
    for (const fichier of ['lettre.ts', 'lettre.tsx']) {
      const net = sansCommentaires(readFileSync(resolve(SRC, fichier), 'utf8'))
      expect(net, `${fichier} a été vidé par le dépouilleur`).toContain('export')
      expect(net.length).toBeGreaterThan(500)
    }
  })
})

describe('le compteur de caractères', () => {
  it('compte en points de code, comme n’importe quel compteur', () => {
    // « .length » en compterait deux pour l'emoji, et l'élève verrait un
    // nombre différent de celui de Parcoursup.
    expect(compterCaracteres('abc')).toBe(3)
    expect(compterCaracteres('œuf')).toBe(3)
    expect(compterCaracteres('🎓')).toBe(1)
  })

  it('prend la limite du ministère, et celle des IFSI', () => {
    expect(longueur('a'.repeat(1400)).depasse).toBe(false)
    expect(longueur('a'.repeat(1600)).depasse).toBe(true)
    expect(longueur('a'.repeat(1600), true).depasse).toBe(false)
    expect(longueur('', true).limite).toBe(LONGUEUR.ifsi)
    expect(longueur('').limite).toBe(LONGUEUR.standard)
  })

  it('dit combien il en reste', () => {
    expect(longueur('a'.repeat(500)).restants).toBe(1000)
  })
})

describe('le prénom interdit par la fiche', () => {
  it('le trouve malgré la casse et les accents', () => {
    expect(identiteCitee('Je suis Chloé Dupont, en terminale.', ['Chloé', 'Dupont'])).toEqual([
      'Chloé',
      'Dupont',
    ])
    expect(identiteCitee('je m’appelle chloe', ['Chloé'])).toEqual(['Chloé'])
  })

  it('ne se déclenche pas sur un mot qui contient le prénom', () => {
    // « Marc » dans « marché » n'est pas une identité citée.
    expect(identiteCitee('Le marché du droit recrute.', ['Marc'])).toEqual([])
    expect(identiteCitee('Ce parcours est long.', ['Cours'])).toEqual([])
  })

  it('ne dit rien quand aucune identité n’est connue', () => {
    expect(identiteCitee('Chloé Dupont', [])).toEqual([])
  })

  it('remonte jusqu’à la relecture, et bloque', () => {
    /* `identiteCitee` peut très bien marcher pendant que `relire` cesse de
       l'appeler : c'est la relecture que l'élève voit, donc c'est elle qu'on
       tient ici. */
    const r = relire(brouillon({ texte: 'Je suis Chloé et je veux faire du droit.' }), {
      identite: ['Chloé', 'Dupont'],
    })
    const dite = r.find((x) => x.cle === 'identite')
    expect(dite, 'la relecture ne cherche plus le prénom').toBeDefined()
    expect(dite?.gravite).toBe('bloquant')
    expect(dite?.texte).toContain('Chloé')
    expect(dite?.texte).toMatch(/nom ni son prénom/)
  })
})

describe('le copier-coller entre deux vœux', () => {
  const texte = 'Le droit constitutionnel m’intéresse depuis la spécialité de première.'

  it('repère deux textes quasi identiques', () => {
    expect(ressemblance(texte, texte)).toBe(1)
    expect(ressemblance(texte, `${texte} À Bordeaux.`)).toBeGreaterThanOrEqual(
      SEUIL_RESSEMBLANCE,
    )
  })

  it('laisse passer deux textes réellement différents', () => {
    const autre = 'Je veux devenir infirmier après un stage en Ehpad l’été dernier.'
    expect(ressemblance(texte, autre)).toBeLessThan(SEUIL_RESSEMBLANCE)
  })

  it('ne compare pas un brouillon à lui-même', () => {
    const b = brouillon({ texte })
    expect(relire(b, { autres: [b] }).some((r) => r.cle.startsWith('copie:'))).toBe(false)
  })

  it('signale la copie entre deux formations', () => {
    const b = brouillon({ codeFormation: '12', texte })
    const jumeau = brouillon({ codeFormation: '34', texte })
    const remarques = relire(b, { autres: [jumeau] })
    const copie = remarques.find((r) => r.cle.startsWith('copie:'))
    expect(copie?.gravite).toBe('bloquant')
    expect(copie?.texte).toContain('copier/coller')
  })
})

describe('la relecture de Jean-Paul', () => {
  it('ne porte aucun jugement sur le fond', () => {
    /* Règle 5 : pas de note. Et un jugement de machine sur ce qu'un mineur
       écrit de son avenir n'a pas sa place, note ou pas. */
    const source = sansCommentaires(readFileSync(resolve(SRC, 'lettre.ts'), 'utf8'))
    expect(source).not.toMatch(
      /peu convaincant|insuffisant|médiocre|faible|mauvais|score|note\s*[:=]/i,
    )
  })

  it('signale un dépassement en donnant le chiffre exact', () => {
    const r = relire(brouillon({ texte: 'a'.repeat(1600) }))
    const longue = r.find((x) => x.cle === 'longueur')
    expect(longue?.gravite).toBe('bloquant')
    /* Mis en forme comme partout ailleurs : « 1 600 », pas « 1600 ». Le
       compteur, juste à côté, le fait déjà — deux écritures d'un même nombre
       à deux lignes d'écart se lisent comme deux nombres. */
    expect(longue?.texte).toContain(nombre(1600))
    expect(longue?.texte).toContain('100')
  })

  it('signale une entête de courrier, que la fiche exclut', () => {
    const r = relire(brouillon({ texte: 'Madame, Monsieur, je vous écris pour…' }))
    expect(r.find((x) => x.cle === 'entete')?.gravite).toBe('conseil')
  })

  it('compte les questions restées vides', () => {
    const r = relire(brouillon({ reponses: { demande: 'Licence de droit' } }))
    const manquantes = r.find((x) => x.cle === 'manquantes')
    expect(manquantes?.texte).toContain(`${QUESTIONS.length - 1} questions`)
  })

  it('ne dit rien d’un brouillon complet et conforme', () => {
    /* Des réponses d'une LONGUEUR de lettre, et non de six mots.
       « Une phrase à moi. » six fois donnait 109 caractères : un brouillon
       que ce test appelait « conforme » alors qu'il faisait sept pour cent de
       la longueur attendue. La remarque « ce sont encore des notes », ajoutée
       depuis, l'a mis au jour — et elle avait raison. */
    const phrase =
      'Une phrase à moi, assez longue pour ressembler à ce qu’on écrit vraiment dans ' +
      'une lettre de motivation, avec un exemple précis et une raison. '
    /* Une fois par question : six fois cette phrase font environ 900
       caractères — au-dessus du seuil des notes, sous la limite des 1 500. */
    const reponses = Object.fromEntries(QUESTIONS.map((q) => [q.cle, phrase]))
    const r = relire(brouillon({ reponses, texte: assembler(reponses) }), {
      identite: ['Chloé'],
    })
    expect(r).toEqual([])
  })
})

describe('les brouillons restent dans le navigateur', () => {
  it('ne se perdent pas d’un chargement à l’autre', () => {
    let coffre = ''
    const b = brouillon({ texte: 'Mon texte.' })
    enregistrerBrouillons([b], (v) => {
      coffre = v
    })
    expect(chargerBrouillons(() => coffre)).toEqual([b])
  })

  it('survivent à un stockage vide ou abîmé', () => {
    expect(chargerBrouillons(() => null)).toEqual([])
    expect(chargerBrouillons(() => 'pas du json')).toEqual([])
    expect(chargerBrouillons(() => '{"pas": "un tableau"}')).toEqual([])
    expect(chargerBrouillons(() => '[{"codeFormation": 12}]')).toEqual([])
  })

  it('remplacent le brouillon d’une formation sans toucher aux autres', () => {
    const a = brouillon({ codeFormation: '12', texte: 'A' })
    const b = brouillon({ codeFormation: '34', texte: 'B' })
    const suivant = poser([a, b], { ...a, texte: 'A corrigé' })
    expect(suivant).toHaveLength(2)
    expect(suivant.find((x) => x.codeFormation === '12')?.texte).toBe('A corrigé')
    expect(suivant.find((x) => x.codeFormation === '34')?.texte).toBe('B')
  })
})

describe('le contenu vient de la fiche du ministère', () => {
  const ecran = readFileSync(resolve(SRC, 'lettre.tsx'), 'utf8')

  it('cite l’avertissement sur les IA, sans le retoucher', () => {
    expect(AVERTISSEMENT_IA).toContain('ChatGPT')
    expect(AVERTISSEMENT_IA).toContain('production personnelle')
    /* Il ne suffit pas que la constante soit importée : le fichier la
       mentionnerait encore si l'on remplaçait le paragraphe par une phrase
       maison. C'est le RENDU qu'on tient, dans le bloc de citation. */
    const citation = /<blockquote className="lettre-avertissement">[\s\S]*?<\/blockquote>/.exec(
      ecran,
    )
    expect(citation, 'le bloc de citation a disparu de l’écran').not.toBeNull()
    expect(citation![0], 'l’avertissement du ministère n’est plus affiché').toContain(
      '{AVERTISSEMENT_IA}',
    )
    expect(citation![0], 'la citation a perdu sa source').toContain('{SOURCE_LETTRE}')
  })

  it('affiche la source et le millésime — règle 6', () => {
    expect(ecran).toContain('SOURCE_LETTRE')
    expect(ecran).toContain('MILLESIME_LETTRE')
    expect(SOURCE_LETTRE).toMatch(/ministère de l’Éducation nationale/)
  })

  it('reprend la consigne sur l’identité', () => {
    expect(RELECTURE.join(' ')).toMatch(/nom ni prénom/i)
    expect(RELECTURE.join(' ')).toMatch(/copier\/coller/i)
  })

  it('couvre les trois parties du plan recommandé', () => {
    const parties = new Set(QUESTIONS.map((q) => q.partie))
    expect([...parties].sort()).toEqual(['conclusion', 'developpement', 'introduction'])
  })
})

describe('le pré-remplissage', () => {
  /* Le site pose UNE réponse, et c'est une donnée : l'intitulé exact du vœu,
     tel que Parcoursup le publie. La fiche le réclame nommément — « le bon
     intitulé de la formation » — et c'est là que les candidats se trompent,
     en recopiant un nom approximatif lu sur le site d'une école.
     Les cinq autres questions portent sur ce qui les intéresse et sur ce
     qu'ils ont fait : aucune donnée n'y répond, et une phrase proposée serait
     une phrase écrite à leur place. */

  it('ne remplit QUE la question de l’intitulé', () => {
    const rempli = avecAmorce({}, 'Licence de droit, à l’université de Bordeaux')
    expect(Object.keys(rempli)).toEqual([QUESTION_PREREMPLIE])
    expect(QUESTION_PREREMPLIE).toBe('demande')
  })

  it('ne laisse aucune autre question se pré-remplir', () => {
    /* Le test qui tient la règle : si un jour quelqu'un ajoute une amorce à
       « qu'est-ce qui t'intéresse », ce sont nos mots qui partiront sur
       Parcoursup. Les cinq autres doivent rester vides. */
    const rempli = avecAmorce({}, 'Licence de droit')
    for (const q of QUESTIONS) {
      if (q.cle === QUESTION_PREREMPLIE) continue
      expect(rempli[q.cle], `« ${q.question} » a été pré-remplie`).toBeUndefined()
    }
  })

  it('n’écrit jamais par-dessus une réponse existante', () => {
    const ecrite = { demande: 'Ma propre formulation.' }
    expect(avecAmorce(ecrite, 'Licence de droit')).toEqual(ecrite)
    // Même une réponse réduite à des espaces compte comme vide.
    expect(avecAmorce({ demande: '   ' }, 'Licence de droit').demande).toBe('Licence de droit')
  })

  it('ne pose rien quand le vœu n’a pas d’intitulé', () => {
    expect(avecAmorce({}, '')).toEqual({})
    expect(amorceFormation('', 'Université de Bordeaux')).toBe('')
  })

  it('assemble l’intitulé et l’établissement, sans phrase autour', () => {
    expect(amorceFormation('Licence de droit', 'Université de Bordeaux')).toBe(
      'Licence de droit, Université de Bordeaux',
    )
    // Sans établissement connu, l'intitulé seul, sans virgule orpheline.
    expect(amorceFormation('Licence de droit', '')).toBe('Licence de droit')
    expect(amorceFormation('Licence de droit', '   ')).toBe('Licence de droit')
  })

  it('n’ajoute pas de préposition devant l’établissement', () => {
    /* L'open data publie « Université de Bordeaux », « IUT de Bordeaux »,
       « INSA Toulouse » : aucun article ne va devant tous. Une apposition se
       lit dans tous les cas ; « à Université de Bordeaux » ne se lit dans
       aucun. */
    for (const ou of ['Université de Bordeaux', 'IUT de Bordeaux', 'INSA Toulouse']) {
      const a = amorceFormation('Licence de droit', ou)
      expect(a).toBe(`Licence de droit, ${ou}`)
      expect(a).not.toMatch(/\bà [A-Z]/)
    }
  })

  it('ne fabrique aucune motivation', () => {
    /* Une amorce qui contiendrait « je suis intéressé par » serait une phrase
       écrite à la place de l'élève, quel que soit le nom qu'on lui donne. */
    const a = amorceFormation('Licence de droit', 'Université de Bordeaux').toLowerCase()
    for (const mot of ['je ', 'motiv', 'intéress', 'passionn', 'souhaite', 'candidat']) {
      expect(a, `l’amorce contient « ${mot} »`).not.toContain(mot)
    }
  })
})

describe('l’avancement', () => {
  it('compte les questions réellement remplies', () => {
    expect(avancement({})).toEqual({ remplies: 0, total: QUESTIONS.length })
    expect(avancement({ demande: 'Licence de droit', motivation: '  ' })).toEqual({
      remplies: 1,
      total: QUESTIONS.length,
    })
  })

  it('atteint le total quand tout est rempli', () => {
    const toutes = Object.fromEntries(QUESTIONS.map((q) => [q.cle, 'Une phrase.']))
    expect(avancement(toutes).remplies).toBe(QUESTIONS.length)
  })
})

describe('la présentation de l’atelier', () => {
  const ecran = readFileSync(resolve(SRC, 'lettre.tsx'), 'utf8')

  it('ouvre sur le premier vœu, pas sur le brouillon libre', () => {
    expect(ecran).toMatch(/setCourant\(voeux\[0\]!\.code\)/)
    // Et ne bouscule pas un choix déjà fait par l'élève.
    expect(ecran).toMatch(/if \(voeuChoisi \|\| voeux\.length === 0\) return/)
  })

  it('descend le prénom près de la relecture qui s’en sert', () => {
    const relecture = ecran.indexOf('Ce que Jean-Paul a vérifié')
    const nom = ecran.indexOf('lettre-identite')
    const questions = ecran.indexOf('Les questions de la fiche')
    expect(nom).toBeGreaterThan(questions)
    expect(nom).toBeGreaterThan(relecture)
  })

  it('replie le réglage IFSI au lieu de couper la page', () => {
    expect(ecran).toContain('<details className="lettre-reglages">')
  })

  it('dit où on en est dans les six questions', () => {
    expect(ecran).toContain('lettre-avancement')
    expect(ecran).toMatch(/\{avance\.remplies\} question/)
    // « 0 sur 6 question remplie » ne se dit pas : le cas zéro a sa phrase.
    expect(ecran).toMatch(/avance\.remplies === 0 \? \(/)
  })

  it('signale le champ pré-rempli au lieu de le faire passer pour une réponse', () => {
    /* Un champ déjà plein sans rien dire, c'est une question que l'élève croit
       avoir traitée — et l'intitulé seul ne fait pas une introduction. */
    expect(ecran).toContain('lettre-prerempli')
    expect(ecran).toContain('pas une phrase')
  })

  it('garde l’ordre du parcours dans le code, quelle que soit la colonne', () => {
    /* Les deux colonnes sont une affaire de GRILLE, pas de balisage. Déplacer
       le brouillon avant les questions dans le code le placerait au même
       endroit à l'écran large — et le ferait passer AVANT les questions sur
       un téléphone et dans un lecteur d'écran, c'est-à-dire demanderait de
       relire un texte qu'on n'a pas encore écrit. */
    const questions = ecran.indexOf('lettre-questions')
    const brouillon = ecran.indexOf('lettre-texte')
    const relecture = ecran.indexOf('Ce que Jean-Paul a vérifié')
    expect(questions).toBeGreaterThan(-1)
    expect(brouillon).toBeGreaterThan(questions)
    expect(relecture).toBeGreaterThan(brouillon)
  })

  it('affiche UNE question à la fois', () => {
    /* Six champs vides empilés, c'est un mur : l'élève voit la quantité avant
       la première question, et la quantité est ce qui fait refermer un
       formulaire. */
    expect(ecran).toMatch(/QUESTIONS\.filter\(\(_, i\) => i === etape\)/)
  })

  it('laisse toujours aller à n’importe quelle question', () => {
    /* L'ordre était libre — « commence par la question que tu veux » — et il
       doit le rester : un parcours imposé est plus simple à écrire et plus dur
       à remplir. Les crans sont donc de vrais boutons. */
    const pas = /<nav className="lettre-etapes"[\s\S]*?<\/nav>/.exec(ecran)
    expect(pas, 'le pas-à-pas a disparu de l’écran').not.toBeNull()
    expect(pas![0], 'les crans ne mènent plus nulle part').toContain('onClick={() => setEtape(i)}')
    expect(pas![0], 'un cran n’est pas un bouton').toContain('type="button"')
  })

  it('donne à chaque cran un nom qui dit sa question et son état', () => {
    /* Six boutons « 1 » à « 6 » ne se distinguent pas à l'oreille, et la
       couleur seule ne dit pas ce qui est fait. Le nom porte les trois. */
    const pas = /<nav className="lettre-etapes"[\s\S]*?<\/nav>/.exec(ecran)!
    expect(pas[0]).toContain('aria-label={`Question ${i + 1}')
    expect(pas[0]).toMatch(/remplie' : 'vide'/)
    expect(pas[0]).toContain('${q.question}')
    // Et la question courante ne se repère pas qu'à la couleur.
    expect(pas[0]).toContain("aria-current={i === etape ? 'step' : undefined}")
  })

  it('ne fait pas d’une question passée un aveu', () => {
    /* « Suivante » sur un champ vide se lit comme un abandon. Le bouton dit ce
       que l'élève fait — il passe, et il pourra revenir. */
    expect(ecran).toContain('Passer pour l’instant')
  })

  it('montre les pistes tant que le champ est vide', () => {
    /* Elles étaient derrière un clic, au moment précis où l'on sèche —
       c'est-à-dire au moment où l'on n'a pas envie de chercher l'aide. */
    expect(ecran).toMatch(
      /<details className="lettre-pistes" open=\{\(brouillon\.reponses\[q\.cle\] \?\? ''\)\.trim\(\) === ''\}>/,
    )
  })

  it('un brouillon jamais retouché suit ses réponses', () => {
    /* Sans cette règle, le pré-remplissage annonçait « tu as retouché le texte
       à la main » dès l'ouverture, et le brouillon ne se remplissait plus. */
    expect(ecran).toMatch(/const suitLesReponses = brouillon\.texte === '' \|\| brouillon\.texte === assemble/)
    expect(ecran).toMatch(/const l = longueur\(texteCourant, ifsi\)/)
  })
})

describe('quand les vœux ne se chargent pas', () => {
  /* Une donnée manquante s'affiche comme manquante (CLAUDE.md). Le premier
     jet avalait toutes les erreurs : une panne de l'API se présentait alors
     exactement comme « tu n'as aucun vœu », et l'élève allait chercher ses
     vœux ailleurs pendant que le serveur était à terre. */

  function inscriptionRequise(): Error {
    const e = new Error('Connecte-toi pour retrouver tes vœux.')
    e.name = 'InscriptionRequise'
    return e
  }

  it('se tait quand l’élève n’a simplement pas de compte', () => {
    // Sans compte, la liste vide EST la réponse : annoncer une panne serait
    // signaler un problème qui n'existe pas.
    expect(messageDeChargement(inscriptionRequise())).toBeNull()
  })

  it('dit tout le reste', () => {
    for (const panne of [
      new Error('Failed to fetch'),
      new Error('Le service ne répond pas'),
      { message: 'objet quelconque' },
      undefined,
      null,
    ]) {
      const m = messageDeChargement(panne)
      expect(m, `« ${String(panne)} » a été avalé en silence`).not.toBeNull()
      expect(m).toContain('n’ont pas pu être chargés')
    }
  })

  it('ne bloque pas l’élève pour autant', () => {
    /* Une panne de nos vœux n'empêche pas d'écrire : le brouillon est gardé
       dans le navigateur, et se rattachera à un vœu plus tard. */
    const m = messageDeChargement(new Error('500'))
    expect(m).toContain('quand même')
    expect(m).toContain('gardé')
  })

  it('est affiché par l’écran, pas seulement calculé', () => {
    const ecran = readFileSync(resolve(SRC, 'lettre.tsx'), 'utf8')
    expect(ecran).toContain('setPanne(messageDeChargement(e))')
    expect(ecran).toMatch(/\{panne === null \? null : <p className="erreur">\{panne\}<\/p>\}/)
  })
})

/**
 * La mise en page de l'atelier.
 *
 * Deux règles de CSS, et chacune a été apprise au navigateur.
 */
describe('les deux colonnes de l’atelier', () => {
  /* Commentaires retirés : la règle porte précisément le mot `align-items:
     start` pour dire de ne pas l'écrire, et un test qui s'attrape lui-même sur
     sa propre explication ne prouve rien. */
  const CSS = readFileSync(resolve(SRC, 'styles.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ' ',
  )
  const grille = /\.lettre-atelier \{[^}]*\}/g

  it('ne ramène pas la colonne du brouillon à la hauteur de son contenu', () => {
    /* `align-items: start` paraît juste — la colonne de droite est la plus
       courte — et il annule exactement ce pour quoi elle existe : une case de
       grille réduite à son contenu n'offre aucune course au `position: sticky`
       qu'elle contient. Constaté au navigateur : le compteur repartait hors de
       l'écran au premier défilement, comme avant le changement. */
    for (const regle of CSS.match(grille) ?? []) {
      expect(regle, 'le brouillon ne suivra plus le défilement').not.toMatch(
        /align-items:\s*(start|flex-start)/,
      )
    }
  })

  it('pose le brouillon SOUS la barre du haut, pas derrière', () => {
    /* La barre du haut est elle-même collée, et haute de 63 px. Un `top: 0`
       glisserait le champ derrière elle : on écrirait dans une zone dont le
       premier tiers est masqué. */
    const collee = /\.lettre-sortie-collee \{[\s\S]*?\}/.exec(CSS)
    expect(collee, 'la colonne collée a disparu de la feuille').not.toBeNull()
    expect(collee![0]).toContain('position: sticky')
    const top = /top:\s*([\d.]+)rem/.exec(collee![0])
    expect(top, 'le décalage sous la barre du haut n’est plus exprimé en rem').not.toBeNull()
    expect(Number(top![1]), 'top trop petit : le champ passera sous la barre').toBeGreaterThan(
      3.9,
    )
  })
})
