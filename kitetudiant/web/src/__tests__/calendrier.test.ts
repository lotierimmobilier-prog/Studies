import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AVERTISSEMENT,
  enCourt,
  enToutesLettres,
  fenetreProjetee,
  MILLESIME_CALENDRIER,
  PHASES,
  PUBLICATION_ATTENDUE,
  RELEVE_LE,
  SESSION_VISEE,
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

  it('vise la session suivant celle dont il tire ses dates', () => {
    expect(Number(SESSION_VISEE)).toBe(Number(MILLESIME_CALENDRIER) + 1)
  })

  it('dit que le calendrier de la session visée n’est pas encore publié', () => {
    // C'est l'avertissement le plus important du bloc : un élève qui prendrait
    // une fenêtre déduite pour une date officielle manquerait un vœu.
    expect(AVERTISSEMENT).toContain(SESSION_VISEE)
    expect(AVERTISSEMENT).toMatch(/n’est pas encore publié|n'est pas encore publié/i)
    expect(AVERTISSEMENT).toContain(PUBLICATION_ATTENDUE)
    expect(AVERTISSEMENT).toMatch(/déduits de la session/i)
    expect(AVERTISSEMENT).toMatch(/ne sont pas officiels/i)
    expect(AVERTISSEMENT).toMatch(/peuvent changer/i)
    expect(AVERTISSEMENT).toMatch(/l’État|l'État/)
    expect(AVERTISSEMENT).toMatch(/font foi/i)
  })

  it('enchaîne trois phases, dans l’ordre', () => {
    expect(PHASES.map((p) => p.numero)).toEqual([1, 2, 3])
  })

  it('range les étapes de chaque phase par date croissante', () => {
    for (const phase of PHASES) {
      const dates = phase.etapes.map((e) => e.reference)
      expect(dates, `phase ${phase.numero}`).toEqual([...dates].sort())
    }
  })

  it('n’emploie que des dates réelles, toutes du millésime de référence', () => {
    // Une date « 2027 » écrite ici serait inventée : le calendrier de la
    // session visée n'existe pas encore. Les fenêtres sont calculées, jamais
    // saisies.
    for (const phase of PHASES) {
      for (const e of phase.etapes) {
        expect(e.reference, e.titre).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(Number.isNaN(new Date(`${e.reference}T12:00:00Z`).getTime()), e.titre).toBe(false)
        const annee = Number(e.reference.slice(0, 4))
        // Une session court sur deux années civiles : la précédente à partir
        // d'octobre, puis celle du millésime.
        expect([Number(MILLESIME_CALENDRIER) - 1, Number(MILLESIME_CALENDRIER)], e.titre).toContain(
          annee,
        )
        expect(e.reference, e.titre).not.toContain(SESSION_VISEE)
      }
    }
  })

  it('n’annonce aucun jour précis pour la session visée', () => {
    // Le cœur de l'affaire : personne ne connaît ces jours-là. Les périodes de
    // phase se lisent au mois, jamais « le 13 mars 2027 ».
    for (const phase of PHASES) {
      expect(phase.periode, `phase ${phase.numero}`).not.toMatch(
        /\b\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/,
      )
    }
    for (const phase of PHASES) {
      for (const e of phase.etapes) {
        expect(fenetreProjetee(e.reference), e.titre).not.toMatch(/\d{1,2}\s+[a-zéû]+\s+\d{4}/)
      }
    }
  })

  it('retient les trois échéances qu’on oublie le plus', () => {
    const toutes = PHASES.flatMap((p) => p.etapes)
    const par = (iso: string) => toutes.find((e) => e.reference === iso)
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
    expect(fenetreProjetee('à préciser')).toBe('à préciser')
  })
})

describe('la fenêtre prévisionnelle', () => {
  it('décale d’une session et ne garde que le tiers de mois', () => {
    expect(fenetreProjetee('2026-03-12')).toBe('mi-mars 2027')
    expect(fenetreProjetee('2026-04-01')).toBe('début avril 2027')
    expect(fenetreProjetee('2026-07-11')).toBe('mi-juillet 2027')
    // Une étape de l'automne appartient à la session de l'année suivante :
    // elle se décale comme les autres, pas autrement.
    expect(fenetreProjetee('2025-12-17')).toBe('mi-décembre 2026')
  })

  it('coupe le mois en trois, aux mêmes bornes chaque fois', () => {
    expect(fenetreProjetee('2026-05-10')).toBe('début mai 2027')
    expect(fenetreProjetee('2026-05-11')).toBe('mi-mai 2027')
    expect(fenetreProjetee('2026-05-20')).toBe('mi-mai 2027')
    expect(fenetreProjetee('2026-05-21')).toBe('fin mai 2027')
    expect(fenetreProjetee('2026-05-31')).toBe('fin mai 2027')
  })

  it('se déduit de l’étape, jamais d’un texte écrit à côté', () => {
    // La garantie de fond : aucune fenêtre ne peut diverger de la date dont
    // elle est tirée, puisqu'aucune n'est saisie à la main.
    for (const phase of PHASES) {
      for (const e of phase.etapes) {
        const mois = new Date(`${e.reference}T12:00:00Z`).toLocaleDateString('fr-FR', {
          month: 'long',
          timeZone: 'UTC',
        })
        expect(fenetreProjetee(e.reference), e.titre).toContain(mois)
      }
    }
  })

  it('ne décale pas la date de référence, qui reste affichable telle quelle', () => {
    // Les deux lignes d'une étape disent deux choses différentes : ce qu'on
    // projette, et ce qui s'est réellement passé. La seconde ne bouge pas.
    expect(enToutesLettres('2026-03-12')).toContain('2026')
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
