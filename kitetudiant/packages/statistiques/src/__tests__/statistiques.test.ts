/**
 * Les relevés anonymes.
 *
 * Le test central de ce fichier est « aucun identifiant ne passe ». Tout le
 * reste en découle : si un identifiant pouvait passer, la promesse de la page
 * d'accueil — « tes notes, tes bulletins et tes vœux restent dans ton
 * navigateur » — deviendrait fausse sans que rien ne le signale.
 */
import { describe, expect, it } from 'vitest'

import {
  CLES_RELEVE,
  ReleveInvalide,
  agregerReleves,
  normaliserReleve,
  relevesEnCsv,
  trancheMoyenne,
  trancheReste,
  type Releve,
} from '../index.ts'

const LE_JOUR = '2026-09-20'

function releve(surcharges: Partial<Releve> = {}): Releve {
  return normaliserReleve(
    {
      typeBac: 'general',
      academie: 'Toulouse',
      trancheMoyenne: '12 à 14',
      boursier: true,
      mobilite: 'france',
      filiere: 'Licence',
      communes: ['31555'],
      trancheReste: '200 à 400',
      bulletins: 2,
      formations: 40,
      ...surcharges,
    },
    LE_JOUR,
  )
}

describe('aucun identifiant ne franchit la normalisation', () => {
  it('jette tout champ qui n’est pas au catalogue', () => {
    // La barrière. Un identifiant ajouté côté navigateur — ou posté
    // directement sur l'adresse — ne peut pas voyager jusqu'au disque.
    const sale = normaliserReleve(
      {
        typeBac: 'general',
        mobilite: 'france',
        // Tout ce qui suit doit disparaître.
        email: 'eleve@exemple.fr',
        jeton: 'session-abcdef',
        ip: '203.0.113.7',
        identifiant: 'u-1234',
        nom: 'Dupont',
        notes: { mathematiques: 15.5 },
        voeux: ['12345'],
      },
      LE_JOUR,
    )
    expect(Object.keys(sale).sort()).toEqual([...CLES_RELEVE].sort())
    const texte = JSON.stringify(sale)
    for (const fuite of ['exemple.fr', 'session-abcdef', '203.0.113', 'u-1234', 'Dupont', '15.5', '12345']) {
      expect(texte, `« ${fuite} » a survécu à la normalisation`).not.toContain(fuite)
    }
  })

  it('impose la date du serveur et n’y met jamais d’heure', () => {
    // Une date venue du navigateur serait falsifiable ; avec une heure, elle
    // redeviendrait un quasi-identifiant croisée avec une commune rare.
    const r = normaliserReleve({ le: '1999-01-01T03:04:05.678Z', typeBac: 'general' }, LE_JOUR)
    expect(r.le).toBe(LE_JOUR)
    expect(r.le).not.toMatch(/[T:]/)
  })

  it('refuse ce qui n’est pas un objet', () => {
    for (const mauvais of [null, 'texte', 42, undefined]) {
      expect(() => normaliserReleve(mauvais, LE_JOUR)).toThrow(ReleveInvalide)
    }
  })
})

describe('les valeurs sont reconstruites, jamais reprises', () => {
  it('retombe sur une valeur permise quand la valeur reçue est inconnue', () => {
    const r = normaliserReleve({ typeBac: 'doctorat', mobilite: 'lune' }, LE_JOUR)
    expect(r.typeBac).toBe('autre')
    expect(r.mobilite).toBe('france')
  })

  it('ne garde que des codes INSEE plausibles, dédoublonnés et bornés', () => {
    const r = normaliserReleve(
      {
        communes: ['31555', '31555', '2A004', 'pas-un-code', '', 75056, ...Array.from({ length: 30 }, (_, i) => `990${String(i).padStart(2, '0')}`)],
      },
      LE_JOUR,
    )
    expect(r.communes).toContain('31555')
    expect(r.communes).toContain('2A004')
    expect(r.communes).not.toContain('pas-un-code')
    expect(new Set(r.communes).size).toBe(r.communes.length)
    // Au-delà de vingt, ce n'est plus une simulation, c'est un balayage.
    expect(r.communes.length).toBeLessThanOrEqual(20)
  })

  it('borne les compteurs plutôt que de propager une valeur absurde', () => {
    const r = normaliserReleve({ bulletins: 9999, formations: -3 }, LE_JOUR)
    expect(r.bulletins).toBe(20)
    expect(r.formations).toBe(0)
  })

  it('borne les textes libres', () => {
    const r = normaliserReleve({ academie: 'x'.repeat(500), filiere: '   ' }, LE_JOUR)
    expect(r.academie!.length).toBe(60)
    expect(r.filiere).toBeNull()
  })
})

describe('les tranches, jamais les valeurs exactes', () => {
  it('range une moyenne dans sa tranche', () => {
    expect(trancheMoyenne(9.9)).toBe('moins de 10')
    expect(trancheMoyenne(10)).toBe('10 à 12')
    expect(trancheMoyenne(14.3)).toBe('14 à 16')
    expect(trancheMoyenne(20)).toBe('16 et plus')
  })

  it('dit « inconnue » plutôt que d’inventer un zéro', () => {
    expect(trancheMoyenne(null)).toBe('inconnue')
    expect(trancheMoyenne(Number.NaN)).toBe('inconnue')
  })

  it('donne au reste-à-vivre négatif sa tranche propre', () => {
    // C'est le cas qui compte le plus — l'année n'est pas finançable — et le
    // noyer dans « moins de 200 » le rendrait invisible.
    expect(trancheReste(-236)).toBe('négatif')
    expect(trancheReste(0)).toBe('0 à 200')
    expect(trancheReste(null)).toBe('non calculé')
  })
})

describe('agrégats', () => {
  const LISTE = [
    releve(),
    releve({ typeBac: 'technologique', academie: 'Nancy-Metz', communes: ['54395'] }),
    releve({ boursier: false, communes: ['31555', '54395'] }),
    releve({ boursier: null }),
  ]

  it('compte le total et les bornes de la période', () => {
    const a = agregerReleves(LISTE)
    expect(a.total).toBe(4)
    expect(a.duPremier).toBe(LE_JOUR)
    expect(a.auDernier).toBe(LE_JOUR)
  })

  it('rend la série par jour en ordre chronologique, pas en palmarès', () => {
    const a = agregerReleves([...LISTE, { ...releve(), le: '2026-09-18' }])
    expect(a.parJour.map((c) => c.valeur)).toEqual(['2026-09-18', '2026-09-20'])
  })

  it('compte les communes sur toutes les simulations', () => {
    const a = agregerReleves(LISTE)
    expect(a.communes.find((c) => c.valeur === '31555')?.nombre).toBe(3)
    expect(a.communes.find((c) => c.valeur === '54395')?.nombre).toBe(2)
  })

  it('compte les boursiers sans écraser l’inconnu', () => {
    // Trois états, trois compteurs. Ranger l'inconnu avec les non-boursiers
    // donnerait un taux faux, et personne ne le verrait.
    expect(agregerReleves(LISTE).boursiers).toEqual({ oui: 2, non: 1, inconnu: 1 })
  })

  it('ne renvoie aucun agrégat quand il n’y a rien', () => {
    const a = agregerReleves([])
    expect(a.total).toBe(0)
    expect(a.duPremier).toBeNull()
    expect(a.parJour).toEqual([])
  })
})

describe('export CSV', () => {
  it('porte exactement les colonnes du relevé', () => {
    const csv = relevesEnCsv([releve()])
    expect(csv.split('\n')[0]).toBe(CLES_RELEVE.join(';'))
  })

  it('sépare par point-virgule, comme l’attend un tableur français', () => {
    // La virgule est le séparateur DÉCIMAL en français : l'employer comme
    // séparateur de colonnes casse l'ouverture du fichier.
    expect(relevesEnCsv([releve()]).split('\n')[1]).toContain(';')
  })

  it('échappe ce qui contient le séparateur ou un guillemet', () => {
    const csv = relevesEnCsv([releve({ filiere: 'Licence ; "spéciale"' })])
    expect(csv).toContain('"Licence ; ""spéciale"""')
  })

  it('n’a rien à caviarder', () => {
    // C'est la preuve que la conception tient : si l'export demandait de
    // masquer une colonne, c'est que le relevé n'aurait pas dû la porter.
    const csv = relevesEnCsv(LISTE_POUR_FUITE)
    for (const interdit of ['@', 'jeton', 'session']) {
      expect(csv.toLowerCase()).not.toContain(interdit)
    }
  })
})

const LISTE_POUR_FUITE = [releve(), releve({ academie: 'Nancy-Metz' })]
