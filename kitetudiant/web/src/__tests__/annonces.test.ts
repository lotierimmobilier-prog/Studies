import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { communeDuNom } from '../donnees.ts'

/**
 * Les annonces d'emploi affichées sur une fiche de formation.
 *
 * D15 avait tranché l'inverse — « le compteur, pas les annonces » — parce
 * qu'une offre est pourvue en quelques jours. Le motif reste vrai, et c'est
 * lui qui dicte tout ce qui est vérifié ici : l'âge visible, le lien vers
 * l'annonce d'origine, la mise en garde avant les cartes.
 *
 * Le second enjeu est la règle 1 de CLAUDE.md : un salaire affiché doit
 * remonter à sa source. Le parseur est éprouvé côté serveur, contre les
 * libellés réels ; ici on vérifie que l'écran n'invente rien quand il
 * n'y en a pas.
 */

const ECRAN = readFileSync(
  resolve(import.meta.dirname, '..', 'pageFormation.tsx'),
  'utf8',
)
const CSS = readFileSync(resolve(import.meta.dirname, '..', 'styles.css'), 'utf8')
const SERVEUR = readFileSync(
  resolve(import.meta.dirname, '..', '..', '..', '..', 'server', 'index.ts'),
  'utf8',
)

describe('la commune de l’élève', () => {
  it('se résout quand le nom est sans ambiguïté', () => {
    expect(communeDuNom('Limoges')).toBe('87085')
    expect(communeDuNom('limoges')).toBe('87085')
    expect(communeDuNom('  LIMOGES  ')).toBe('87085')
  })

  it('tolère accents et traits d’union', () => {
    // Les élèves tapent « saint etienne du rouvray » aussi bien que la
    // forme officielle.
    expect(communeDuNom('Saint-Étienne-du-Rouvray')).toBe(
      communeDuNom('saint etienne du rouvray'),
    )
    expect(communeDuNom('Saint-Étienne-du-Rouvray')).not.toBeNull()
  })

  it('REFUSE un nom porté par deux communes', () => {
    /* Sept noms sont ambigus dans la table : Valence, Saint-Denis,
       Sainte-Marie… Choisir entre Valence dans la Drôme et Valence en
       Tarn-et-Garonne placerait l'élève à six cents kilomètres de chez lui,
       et rien à l'écran ne le signalerait. */
    for (const nom of ['Valence', 'Saint-Denis', 'Sainte-Marie', 'Saint-Pierre']) {
      expect(communeDuNom(nom), `${nom} est ambigu`).toBeNull()
    }
  })

  it('refuse ce qu’elle ne connaît pas, plutôt que d’approcher', () => {
    // La table ne porte que les communes dont le loyer est publié. Un
    // village n'y est pas, et « le plus proche » serait un mensonge.
    expect(communeDuNom('Trifouillis-les-Oies')).toBeNull()
    expect(communeDuNom('')).toBeNull()
    expect(communeDuNom('   ')).toBeNull()
  })
})

describe('le choix du lieu', () => {
  it('ne s’affiche que s’il change quelque chose', () => {
    // Proposer « près de chez moi » à quelqu'un qui habite la ville de
    // l'école, c'est proposer deux fois la même liste.
    expect(ECRAN).toContain('communeEleve !== null && communeEleve !== formation.codeInsee')
  })

  it('porte son état autrement que par la couleur', () => {
    // `aria-pressed` le dit à qui ne voit pas la couleur du bouton actif.
    expect(ECRAN).toContain("aria-pressed={ou === 'ecole'}")
    expect(ECRAN).toContain("aria-pressed={ou === 'moi'}")
  })

  it('part de l’école, pas de chez l’élève', () => {
    // La fiche parle d'une formation : le lieu par défaut est le sien.
    expect(ECRAN).toContain("useState<'ecole' | 'moi'>('ecole')")
  })
})

describe('ce que la carte dit, et ne prétend pas', () => {
  it('ne montre un salaire que s’il est publié', () => {
    /* Règle 1 : aucun montant sans source. Un libellé non reconnu donne
       `null`, et la carte l'écrit — elle n'approche rien. */
    expect(ECRAN).toContain('Salaire non publié')
    expect(ECRAN).toContain('o.salaireMin === null')
  })

  it('distingue le plancher d’un salaire tout court', () => {
    // « 24 000 € » se lirait comme le salaire ; « à partir de » dit que
    // c'est le bas d'une fourchette.
    expect(ECRAN).toContain('À partir de')
  })

  it('porte l’âge de l’annonce et un lien vers l’original', () => {
    /* C'est la réponse à D15 : une offre se pourvoit vite, donc on montre
       son âge, et le lien mène là où l'on verra qu'elle est prise. */
    expect(ECRAN).toContain('ageLisible(o.actualiseeLe)')
    expect(ECRAN).toContain('href={o.url}')
    expect(ECRAN).toContain('rel="noopener noreferrer"')
  })

  it('avertit AVANT les cartes, pas après', () => {
    // Une annonce qu'on lit avant d'avoir su qu'elle peut être pourvue a
    // déjà fait son effet.
    const garde = ECRAN.indexOf('Une offre se')
    const liste = ECRAN.indexOf('<ul className="annonces">')
    expect(garde).toBeGreaterThan(-1)
    expect(garde).toBeLessThan(liste)
  })

  it('ne lit pas zéro annonce comme un verdict', () => {
    /* Zéro à trente kilomètres est la photo d'un rayon étroit, pas un
       jugement sur le métier. `CLAUDE.md` interdit le texte anxiogène. */
    expect(ECRAN).toContain('Le rayon est étroit')
  })
})

describe('la grille', () => {
  it('passe de une à deux puis trois colonnes', () => {
    expect(CSS).toContain('.annonces {')
    expect(CSS).toMatch(/@media \(min-width: 34rem\) \{\s*\.annonces \{\s*grid-template-columns: repeat\(2/)
    expect(CSS).toMatch(/@media \(min-width: 62rem\) \{\s*\.annonces \{\s*grid-template-columns: repeat\(3/)
  })

  it('n’étire pas une carte seule sur toute la largeur', () => {
    // `auto-fit` le ferait, et une carte pleine largeur ne se lit plus
    // comme un élément d'une liste.
    const bloc = /\.annonces \{([^}]*)\}/.exec(CSS)?.[1] ?? ''
    expect(bloc).not.toContain('auto-fit')
    expect(bloc).toContain('grid-template-columns: 1fr')
  })
})

describe('le serveur ne fait pas confiance au navigateur', () => {
  it('valide le code INSEE avant de le transmettre', () => {
    // La commune vient du navigateur : tout ce qui n'est pas un code INSEE
    // est écarté plutôt que relayé tel quel à France Travail.
    expect(SERVEUR).toContain('/^[0-9]{2}[0-9AB][0-9]{2}$/i.test(brute)')
  })

  it('rend le lieu VRAIMENT interrogé', () => {
    // L'écran doit pouvoir écrire « autour de l'école » sans le déduire de
    // ce qu'il avait demandé : une commune refusée donnerait un texte faux.
    expect(SERVEUR).toContain('autour: commune')
  })

  it('fixe le rayon côté serveur', () => {
    // Chaque valeur distincte est une entrée de cache de plus.
    expect(SERVEUR).toContain('const DISTANCE_OFFRES_KM = 30')
  })
})
