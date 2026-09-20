import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AVERTISSEMENT,
  enCourt,
  enToutesLettres,
  MILLESIME_CALENDRIER,
  PHASES,
  RELEVE_LE,
  SOURCE_CALENDRIER,
} from '../calendrier.ts'

const SRC = resolve(import.meta.dirname, '..')

describe('le calendrier', () => {
  it('porte sa source, son millésime et sa date de relevé', () => {
    // Règle 6 de CLAUDE.md.
    expect(SOURCE_CALENDRIER).toContain('parcoursup.gouv.fr')
    expect(MILLESIME_CALENDRIER).toBe('2026')
    expect(RELEVE_LE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('dit que ces dates ne sont pas officielles pour la session à venir', () => {
    // C'est l'avertissement demandé, et le plus important du bloc : un élève
    // qui se fierait à une date périmée manquerait un vœu.
    expect(AVERTISSEMENT).toMatch(/ne sont pas officielles/i)
    expect(AVERTISSEMENT).toMatch(/peuvent changer/i)
    expect(AVERTISSEMENT).toMatch(/l’État|l'État/)
    expect(AVERTISSEMENT).toMatch(/font foi/i)
  })

  it('enchaîne trois phases, dans l’ordre', () => {
    expect(PHASES.map((p) => p.numero)).toEqual([1, 2, 3])
  })

  it('range les étapes de chaque phase par date croissante', () => {
    for (const phase of PHASES) {
      const dates = phase.etapes.map((e) => e.le)
      expect(dates, `phase ${phase.numero}`).toEqual([...dates].sort())
    }
  })

  it('n’emploie que des dates réelles', () => {
    for (const phase of PHASES) {
      for (const e of phase.etapes) {
        expect(e.le, e.titre).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(Number.isNaN(new Date(`${e.le}T12:00:00Z`).getTime()), e.titre).toBe(false)
      }
    }
  })

  it('retient les trois échéances qu’on oublie le plus', () => {
    const toutes = PHASES.flatMap((p) => p.etapes)
    const par = (iso: string) => toutes.find((e) => e.le === iso)
    // Dernier jour pour formuler, dernier jour pour confirmer, et la fin de la
    // phase complémentaire — celles dont l'oubli coûte une année.
    expect(par('2026-03-12')?.titre).toMatch(/formuler/i)
    expect(par('2026-04-01')?.titre).toMatch(/confirmer/i)
    expect(par('2026-09-10')?.titre).toMatch(/complémentaire/i)
  })

  it('écrit les dates en toutes lettres, sans décalage de fuseau', () => {
    // Une date construite sans heure serait interprétée en UTC puis affichée
    // en local : le 1ᵉʳ avril deviendrait le 31 mars à l'ouest de Greenwich.
    expect(enToutesLettres('2026-04-01')).toBe('mercredi 1ᵉʳ avril 2026')
    expect(enToutesLettres('2026-03-12')).toBe('jeudi 12 mars 2026')
    expect(enCourt('2026-06-02')).toBe('2 juin')
  })

  it('écrit « 1ᵉʳ » pour le premier du mois, et seulement pour lui', () => {
    // La locale française rend « 1 avril » ; l'usage écrit « 1ᵉʳ avril ».
    expect(enCourt('2026-04-01')).toBe('1ᵉʳ avril')
    expect(enCourt('2026-04-11')).toBe('11 avril')
    expect(enCourt('2026-04-21')).toBe('21 avril')
  })

  it('rend une date illisible telle quelle, plutôt qu’un « Invalid Date »', () => {
    expect(enToutesLettres('à préciser')).toBe('à préciser')
  })
})

describe('la page d’accueil ne montre jamais les dates sans l’avertissement', () => {
  const accueil = readFileSync(resolve(SRC, 'accueil.tsx'), 'utf8')

  it('affiche l’avertissement dans le même bloc que la chronologie', () => {
    const debut = accueil.indexOf('id="calendrier"')
    const fin = accueil.indexOf('</section>', debut)
    expect(debut).toBeGreaterThan(-1)
    const bloc = accueil.slice(debut, fin)
    expect(bloc).toContain('{AVERTISSEMENT}')
    // L'avertissement doit précéder les dates, pas les suivre.
    expect(bloc.indexOf('{AVERTISSEMENT}')).toBeLessThan(bloc.indexOf('PHASES.map'))
  })

  it('n’écrit aucune date en dur dans la page', () => {
    // Une date recopiée dans le JSX échapperait au millésime et à
    // l'avertissement, et resterait là après la mise à jour du calendrier.
    expect(accueil).not.toMatch(/\b\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) 20\d\d\b/)
  })
})
