import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AGE_MINIMUM,
  TEXTE_CONSENTEMENT,
  VERSION_CONSENTEMENT,
  ageMinimal,
  assezAge,
  consentementDonne,
} from '../consentementBulletin.ts'

/**
 * Le consentement au dépôt d'un bulletin.
 *
 * ── Ce qui était en jeu ──────────────────────────────────────────────────
 *
 * Déposer un bulletin l'envoie à notre serveur puis à l'API Claude. Rien
 * n'est conservé, mais le fichier PART — et trois écrans ont longtemps
 * promis le contraire. Le texte est corrigé ; il fallait encore que
 * l'élève puisse DÉCIDER, et qu'il ait l'âge de décider.
 */

const SRC = resolve(import.meta.dirname, '..')
const PARCOURS = readFileSync(resolve(SRC, 'parcours.tsx'), 'utf8')

describe('l’âge se compte au plus bas', () => {
  /* Le site ne demande que l'ANNÉE de naissance — c'est voulu (règle 3,
     minimisation). Entre deux personnes nées la même année, l'une a eu son
     anniversaire et l'autre non : un an d'écart réel. On retient le plus
     petit des deux, parce que se tromper dans l'autre sens enverrait le
     bulletin d'un enfant de quatorze ans chez un sous-traitant. */
  const EN_2026 = new Date('2026-06-15T12:00:00Z')

  it('compte 14 ans pour quelqu’un né en 2011, et non 15', () => {
    expect(ageMinimal(2011, EN_2026)).toBe(14)
  })

  it('refuse donc le dépôt à la limite basse', () => {
    expect(assezAge(2011, EN_2026)).toBe(false)
    expect(assezAge(2010, EN_2026)).toBe(true)
  })

  it('laisse passer un lycéen de terminale, qui est le cas courant', () => {
    // 17-18 ans : personne n'est bloqué par erreur dans le public visé.
    expect(assezAge(2008, EN_2026)).toBe(true)
    expect(assezAge(2009, EN_2026)).toBe(true)
  })

  it('l’année par défaut du parcours n’enferme personne', () => {
    /* `REPONSES_PAR_DEFAUT` pose `année courante − 18`. Si ce défaut
       tombait sous la limite, tout le monde serait bloqué avant d'avoir
       rien saisi. */
    const defaut = EN_2026.getFullYear() - 18
    expect(assezAge(defaut, EN_2026)).toBe(true)
  })
})

describe('le texte lu avant d’accepter', () => {
  const entier = [TEXTE_CONSENTEMENT.titre, ...TEXTE_CONSENTEMENT.points].join(' ')

  it('nomme le destinataire', () => {
    // « Un prestataire » ne permet à personne de se faire un avis.
    expect(entier).toMatch(/Anthropic/)
  })

  it('dit ce qui part, ce qui revient, et ce qui n’est pas gardé', () => {
    expect(entier).toMatch(/envoyé/i)
    expect(entier).toMatch(/moyennes/i)
    expect(entier).toMatch(/n’est enregistré nulle part|pas gardé|n’est pas conservé/i)
  })

  it('dit qu’on peut s’en passer', () => {
    /* Un consentement n'en est un que si le refus reste praticable. La
       saisie à la main donne le même résultat sans rien envoyer. */
    expect(entier).toMatch(/à la main/i)
  })

  it('la case n’est pas une formule creuse', () => {
    expect(TEXTE_CONSENTEMENT.case).toMatch(/j’ai lu/i)
    expect(TEXTE_CONSENTEMENT.case).toMatch(/accepte/i)
  })
})

describe('un accord porte sa version', () => {
  it('un accord d’une version antérieure ne vaut plus', () => {
    /* Un consentement vaut pour ce qui a été dit au moment où il est
       donné. Le jour où le texte change — un destinataire de plus, une
       durée qui bouge — l'accord d'hier ne couvre plus rien. */
    const vieux = JSON.stringify({ le: '2026-01-01T00:00:00.000Z', version: VERSION_CONSENTEMENT - 1 })
    expect(consentementDonne(() => vieux)).toBeNull()
  })

  it('un accord de la version courante vaut', () => {
    const bon = JSON.stringify({ le: '2026-01-01T00:00:00.000Z', version: VERSION_CONSENTEMENT })
    expect(consentementDonne(() => bon)?.version).toBe(VERSION_CONSENTEMENT)
  })

  it('une valeur illisible est traitée comme une absence d’accord', () => {
    // Redemander est le comportement sûr. Présumer l'accord ne l'est pas.
    expect(consentementDonne(() => 'pas du json')).toBeNull()
    expect(consentementDonne(() => '{"version":1}')).toBeNull()
    expect(consentementDonne(() => null)).toBeNull()
  })
})

describe('l’écran ne dépose rien sans les deux conditions', () => {
  it('le champ de fichier n’existe que derrière l’accord', () => {
    /* Désactiver le champ ne suffirait pas : un champ grisé se contourne.
       Il n'est pas rendu du tout tant que l'accord n'est pas donné. */
    const depot = PARCOURS.indexOf('type="file"')
    const garde = PARCOURS.indexOf('!accord ?')
    expect(depot).toBeGreaterThan(-1)
    expect(garde).toBeGreaterThan(-1)
    expect(garde, 'le champ de fichier précède la garde de consentement').toBeLessThan(depot)
  })

  it('l’âge est vérifié avant tout, y compris avant l’accord', () => {
    // Quelqu'un de trop jeune ne doit même pas se voir proposer d'accepter.
    const age = PARCOURS.indexOf('!assezAge(')
    const garde = PARCOURS.indexOf('!accord ?')
    expect(age).toBeGreaterThan(-1)
    expect(age).toBeLessThan(garde)
  })

  it('l’écran affiche l’âge depuis la constante, pas un 15 écrit à la main', () => {
    /* Écrit en dur, il resterait à 15 le jour où la loi ou notre lecture
       de la loi change — et le texte contredirait le code. */
    const bloc = PARCOURS.slice(PARCOURS.indexOf('consentement-refus'))
    expect(bloc.slice(0, 900)).toContain('{AGE_MINIMUM}')
    expect(AGE_MINIMUM).toBe(15)
  })

  it('le refus propose la saisie à la main plutôt que de laisser sans issue', () => {
    const bloc = PARCOURS.slice(PARCOURS.indexOf('consentement-refus'))
    expect(bloc.slice(0, 900)).toMatch(/Saisis tes moyennes/i)
  })

  it('ne promet plus que les appréciations « ne sont jamais conservées » à côté du champ', () => {
    /* Cette phrase vivait sous le champ de fichier, où elle tenait lieu
       d'information — sans jamais dire que le fichier partait. Elle est
       remplacée par le vrai texte de consentement, en amont. */
    const apres = PARCOURS.slice(PARCOURS.indexOf('type="file"'))
    expect(apres.slice(0, 1400)).not.toMatch(/n’est jamais\s+conservé/)
  })
})
