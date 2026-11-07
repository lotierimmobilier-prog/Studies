import { describe, expect, it } from 'vitest'

import { affiniteAvec, domainesDe } from '../affinite.ts'
import type { ProfilScolaire } from '../types.ts'

const PROFIL: ProfilScolaire = {
  notes: { mathematiques: 16, physique_chimie: 15, informatique: 17, francais: 11 },
  matierePreferee: 'informatique',
  passions: ['informatique', 'ingenieur'],
  motivation: 8,
  signaux: null,
}

describe('rattachement d’une formation à des domaines', () => {
  it('reconnaît le domaine dans le libellé publié par Parcoursup', () => {
    expect(domainesDe('BUT Informatique', 'BUT')).toContain('informatique')
    expect(domainesDe('Licence - Droit', 'Licence')).toContain('droit')
    expect(domainesDe('Formation des infirmiers', 'IFSI')).toContain('sante')
  })

  it('ignore les accents et la casse', () => {
    expect(domainesDe('Licence — Économie et Gestion', 'Licence')).toContain('economie')
  })

  it('ne devine rien quand aucun mot-clé ne correspond', () => {
    expect(domainesDe('Parcours spécifique XYZ', 'Autre formation')).toEqual([])
  })
})

describe('affinité', () => {
  it('monte quand la formation touche une passion et les bonnes matières', () => {
    const a = affiniteAvec(PROFIL, { libelle: 'BUT Informatique', filiere: 'BUT' })
    expect(a.domaineInconnu).toBe(false)
    expect(a.score).toBeGreaterThan(80)
    expect(a.raisons.join(' ')).toContain('intéressent')
    expect(a.raisons.join(' ')).toContain('matière préférée')
  })

  it('reste basse sur un domaine hors des passions et des points forts', () => {
    const a = affiniteAvec(PROFIL, { libelle: 'Licence - Lettres modernes', filiere: 'Licence' })
    expect(a.score).toBeLessThan(40)
  })

  it('dit quand la formation n’est rattachée à aucun domaine, au lieu de mettre zéro en silence', () => {
    const a = affiniteAvec(PROFIL, { libelle: 'Parcours XYZ', filiere: 'Autre formation' })
    expect(a.domaineInconnu).toBe(true)
    expect(a.score).toBe(0)
    expect(a.raisons[0]).toContain('Aucun domaine reconnu')
  })

  it('ne compte pas les notes absentes des matières clés, et le signale', () => {
    const sansNotes: ProfilScolaire = { ...PROFIL, notes: {}, matierePreferee: null }
    const a = affiniteAvec(sansNotes, { libelle: 'BUT Informatique', filiere: 'BUT' })
    expect(a.score).toBe(40) // la passion seule
  })

  it('ne dépasse jamais 100', () => {
    const excellent: ProfilScolaire = {
      ...PROFIL,
      notes: { mathematiques: 20, informatique: 20 },
    }
    expect(affiniteAvec(excellent, { libelle: 'BUT Informatique', filiere: 'BUT' }).score)
      .toBeLessThanOrEqual(100)
  })

  it('n’utilise ni la motivation ni les signaux du bulletin', () => {
    const motive: ProfilScolaire = {
      ...PROFIL,
      motivation: 10,
      signaux: { serieux: 10, participation: 10, progression: 10 },
    }
    const demotive: ProfilScolaire = { ...PROFIL, motivation: 0, signaux: null }
    const cible = { libelle: 'BUT Informatique', filiere: 'BUT' }
    expect(affiniteAvec(motive, cible).score).toBe(affiniteAvec(demotive, cible).score)
  })
})

describe('faux amis du rattachement par mots-clés', () => {
  it('ne range pas Sciences Po dans les sciences', () => {
    const domaines = domainesDe(
      "Sciences Po / Instituts d'études politiques - Sciences Humaines et Sociales",
      'Autre formation',
    )
    expect(domaines).not.toContain('sciences')
  })

  it('reconnaît toujours les vraies licences scientifiques', () => {
    expect(domainesDe('Licence - Sciences de la vie', 'Licence')).toContain('sciences')
    expect(domainesDe('Licence - Mathématiques', 'Licence')).toContain('sciences')
    expect(domainesDe('Licence - Physique, chimie', 'Licence')).toContain('sciences')
  })
})
