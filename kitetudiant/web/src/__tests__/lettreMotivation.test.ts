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
  assembler,
  chargerBrouillons,
  compterCaracteres,
  enregistrerBrouillons,
  identiteCitee,
  longueur,
  poser,
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
    expect(longue?.texte).toContain('1600')
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
    const reponses = Object.fromEntries(QUESTIONS.map((q) => [q.cle, 'Une phrase à moi.']))
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
