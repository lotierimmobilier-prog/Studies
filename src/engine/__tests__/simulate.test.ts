import { describe, it, expect } from 'vitest'
import type { Formation, ProfilEtudiant } from '../../types'
import {
  scoreAcademique,
  scoreSpecialites,
  scorePassion,
  scoreGeographie,
  scoreMotivation,
  combinerProbabilite,
  ponderation,
  simulerFormation,
  simulerToutes,
} from '../simulate'

const formation: Formation = {
  id: 'test-info',
  nom: 'Licence Informatique',
  etablissement: 'Université Test',
  ville: 'Lyon',
  region: 'Auvergne-Rhône-Alpes',
  domaine: 'informatique',
  selectivite: 'non-selective',
  tauxAccesBase: 50,
  matieresCles: { mathematiques: 3, informatique: 3 },
  attendus: 'Test',
}

const profilBase: ProfilEtudiant = {
  classe: 'terminale',
  souhaits: '',
  specialites: [],
  notes: {},
  region: null,
  mobilite: false,
  passions: [],
  motivation: 5,
  coherenceProjet: 5,
}

describe('scoreAcademique', () => {
  it('renvoie 100 pour des notes parfaites dans les matières clés', () => {
    const profil = { ...profilBase, notes: { mathematiques: 20, informatique: 20 } }
    expect(scoreAcademique(formation, profil)).toBe(100)
  })

  it('pondère selon les matières clés', () => {
    const profil = { ...profilBase, notes: { mathematiques: 10, informatique: 10 } }
    expect(scoreAcademique(formation, profil)).toBe(50)
  })

  it('retombe sur un score neutre sans aucune note', () => {
    expect(scoreAcademique(formation, profilBase)).toBe(50)
  })

  it('utilise la moyenne générale si aucune matière clé n\'est renseignée', () => {
    const profil = { ...profilBase, notes: { francais: 16, philosophie: 12 } }
    expect(scoreAcademique(formation, profil)).toBe(70)
  })
})

describe('scoreSpecialites', () => {
  // formation.domaine = 'informatique' → attendues : nsi, maths, physique_chimie
  it('renvoie 50 (neutre) sans spécialité choisie', () => {
    expect(scoreSpecialites(formation, profilBase)).toBe(50)
  })

  it('récompense des spécialités alignées', () => {
    const profil = { ...profilBase, specialites: ['nsi' as const, 'maths' as const] }
    expect(scoreSpecialites(formation, profil)).toBeGreaterThanOrEqual(70)
  })

  it('donne 100 pour les trois spécialités attendues', () => {
    const profil = {
      ...profilBase,
      specialites: ['nsi' as const, 'maths' as const, 'physique_chimie' as const],
    }
    expect(scoreSpecialites(formation, profil)).toBe(100)
  })

  it('pénalise des spécialités hors sujet', () => {
    const profil = { ...profilBase, specialites: ['hlp' as const, 'arts' as const] }
    expect(scoreSpecialites(formation, profil)).toBe(25)
  })
})

describe('scorePassion', () => {
  it('donne 100 quand le domaine est une passion', () => {
    const profil = { ...profilBase, passions: ['informatique' as const] }
    expect(scorePassion(formation, profil)).toBe(100)
  })

  it('donne un bonus partiel pour un domaine proche', () => {
    const profil = { ...profilBase, passions: ['sciences' as const] }
    expect(scorePassion(formation, profil)).toBe(65)
  })

  it('pénalise un domaine sans lien', () => {
    const profil = { ...profilBase, passions: ['arts' as const] }
    expect(scorePassion(formation, profil)).toBe(25)
  })
})

describe('scoreGeographie', () => {
  it('récompense la même région', () => {
    const profil = { ...profilBase, region: 'Auvergne-Rhône-Alpes' as const }
    expect(scoreGeographie(formation, profil)).toBe(100)
  })

  it('pénalise fortement hors secteur sans mobilité pour une licence', () => {
    const profil = { ...profilBase, region: 'Bretagne' as const, mobilite: false }
    expect(scoreGeographie(formation, profil)).toBe(30)
  })

  it('atténue la pénalité avec la mobilité', () => {
    const profil = { ...profilBase, region: 'Bretagne' as const, mobilite: true }
    expect(scoreGeographie(formation, profil)).toBe(70)
  })
})

describe('scoreMotivation', () => {
  it('combine motivation et cohérence', () => {
    const profil = { ...profilBase, motivation: 10, coherenceProjet: 10 }
    expect(scoreMotivation(profil)).toBe(100)
  })
})

describe('combinerProbabilite', () => {
  it('renvoie environ le taux de base pour une adéquation moyenne', () => {
    expect(combinerProbabilite(50, 50)).toBe(50)
  })

  it('augmente la probabilité avec une forte adéquation', () => {
    expect(combinerProbabilite(50, 100)).toBeGreaterThan(50)
  })

  it('reste borné entre 1 et 99', () => {
    expect(combinerProbabilite(8, 0)).toBeGreaterThanOrEqual(1)
    expect(combinerProbabilite(90, 100)).toBeLessThanOrEqual(99)
  })
})

describe('ponderation', () => {
  const somme = (p: ReturnType<typeof ponderation>) =>
    p.academique + p.specialites + p.passion + p.motivation + p.geographie

  it('renvoie des poids qui somment à 1 (adéquation sur 0-100)', () => {
    for (const domaine of ['sciences', 'arts', 'commerce', 'droit'] as const) {
      expect(somme(ponderation({ ...formation, selectivite: 'selective', domaine }))).toBeCloseTo(1)
    }
    expect(somme(ponderation({ ...formation, selectivite: 'non-selective' }))).toBeCloseTo(1)
  })

  it('privilégie le secteur géographique pour les licences non sélectives', () => {
    const p = ponderation({ ...formation, selectivite: 'non-selective' })
    expect(p.geographie).toBeGreaterThan(p.passion)
    expect(p.geographie).toBeGreaterThanOrEqual(0.25)
  })

  it('met le poids sur les notes et spécialités pour une filière scientifique sélective', () => {
    const p = ponderation({ ...formation, selectivite: 'selective', domaine: 'sciences' })
    expect(p.academique).toBeGreaterThanOrEqual(0.45)
    expect(p.specialites).toBeGreaterThan(p.geographie)
  })

  it('renforce la passion pour une école d’art sélective', () => {
    const art = ponderation({ ...formation, selectivite: 'selective', domaine: 'arts' })
    const sci = ponderation({ ...formation, selectivite: 'selective', domaine: 'sciences' })
    expect(art.passion).toBeGreaterThan(sci.passion)
  })
})

describe('simulerFormation', () => {
  it('produit une probabilité et des sous-scores cohérents', () => {
    const profil: ProfilEtudiant = {
      classe: 'terminale',
      souhaits: '',
      specialites: [],
      notes: { mathematiques: 18, informatique: 17 },
      region: 'Auvergne-Rhône-Alpes',
      mobilite: false,
      passions: ['informatique'],
      motivation: 9,
      coherenceProjet: 8,
    }
    const res = simulerFormation(formation, profil)
    expect(res.probabilite).toBeGreaterThan(50)
    expect(res.details.academique).toBeGreaterThan(80)
    expect(res.explications.length).toBeGreaterThan(0)
  })
})

describe('simulerToutes', () => {
  it('trie les résultats par probabilité décroissante', () => {
    const res = simulerToutes([formation, { ...formation, id: 'b', tauxAccesBase: 5, selectivite: 'selective' }], profilBase)
    expect(res[0].probabilite).toBeGreaterThanOrEqual(res[1].probabilite)
  })
})
