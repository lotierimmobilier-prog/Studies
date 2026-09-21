/**
 * Le budget s'adresse à un lycéen de terminale.
 *
 * Les libellés venaient du nom technique du poste : « Loyer Net », « Frais
 * Scolarite », « Aide Mobilite Parcoursup ». Et « loyer net » nommait un
 * montant que personne ne paie — le loyer moins l'APL, fondus en une ligne.
 *
 * Ces tests tiennent les deux bouts : des mots qu'on comprend, et la règle 6
 * intacte — chaque montant garde sa source et son millésime.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { POSTES_DEPENSE, POSTES_RESSOURCE } from '../../../packages/budget-engine/src/types.ts'
import { LIBELLES_POSTE } from '../libelles.ts'

const SRC = resolve(__dirname, '..')
const APP = readFileSync(resolve(SRC, 'App.tsx'), 'utf8')

const TOUS = [...POSTES_DEPENSE, ...POSTES_RESSOURCE]

describe('les libellés du budget', () => {
  it('couvrent tous les postes du moteur', () => {
    // Un poste ajouté au moteur sans libellé planterait à l'affichage.
    for (const poste of TOUS) {
      expect(LIBELLES_POSTE[poste], `le poste « ${poste} » n'a pas de libellé`).toBeDefined()
    }
    expect(Object.keys(LIBELLES_POSTE).sort()).toEqual([...TOUS].sort())
  })

  it('n’exposent jamais le nom technique du poste', () => {
    for (const poste of TOUS) {
      const { nom, quoi } = LIBELLES_POSTE[poste]
      expect(nom, `« ${nom} » contient un souligné : c'est le nom interne`).not.toMatch(/_/)
      // « Aide Mobilite Parcoursup », c'est le poste avec des espaces.
      expect(nom.toLowerCase()).not.toBe(poste.replace(/_/g, ' '))
      expect(nom.trim().length).toBeGreaterThan(2)
      expect(quoi.trim().length).toBeGreaterThan(2)
    }
  })

  it('ne parlent plus de « loyer net »', () => {
    /* Le montant affiché sous ce nom — 128 € pour un studio à 311 € — n'était
       le loyer de personne. Le loyer et l'aide sont deux lignes. */
    const textes = Object.values(LIBELLES_POSTE)
      .map((l) => `${l.nom} ${l.quoi}`)
      .join(' ')
      .toLowerCase()
    expect(textes).not.toContain('loyer net')
    expect(LIBELLES_POSTE.loyer.quoi).toContain('charges comprises')
    expect(LIBELLES_POSTE.aide_logement.nom.toLowerCase()).toContain('logement')
  })
})

describe('l’affichage d’une ligne', () => {
  const ligne = /function Ligne\(\{ ligne \}[\s\S]*?\n\}/.exec(APP)

  it('tire son intitulé des libellés, jamais du nom du poste', () => {
    expect(ligne).not.toBeNull()
    expect(ligne![0]).toContain('LIBELLES_POSTE[ligne.poste]')
    expect(
      ligne![0],
      'le nom du poste est réaffiché tel quel, souligné remplacé par une espace',
    ).not.toMatch(/poste\.replace\(/)
  })

  it('garde la source et le millésime attachés au montant — règle 6', () => {
    /* Repliés, pas supprimés : ils sont dans le même <li> que le chiffre,
       à un clic, et non quatre lignes grises au-dessus de lui. */
    expect(ligne![0]).toContain('ligne.valeur.source')
    expect(ligne![0]).toContain('ligne.valeur.millesime')
    expect(ligne![0]).toContain('ligne.valeur.hypothese')
    const provenance = /<details className="ligne-provenance">[\s\S]*?<\/details>/.exec(ligne![0])
    expect(provenance, 'la provenance n’est plus dans un volet').not.toBeNull()
    for (const champ of ['hypothese', 'source', 'millesime']) {
      expect(
        provenance![0],
        `« ${champ} » est sorti du volet : il redéplie la ligne de quatre lignes grises`,
      ).toContain(champ)
    }
  })
})

describe('le panneau du budget', () => {
  const budget = /function Budget\(\{ lignes, rav \}[\s\S]*?\n\}\n/.exec(APP)

  it('replie les aides sans objet sans les retirer', () => {
    expect(budget).not.toBeNull()
    expect(budget![0]).toContain("l.statut === 'sans_objet'")
    expect(budget![0], 'les lignes sans objet ne sont plus rendues du tout').toMatch(
      /ecartees\.map\(/,
    )
    expect(budget![0], 'le nombre d’aides écartées n’est pas annoncé').toMatch(/ecartees\.length/)
  })

  it('n’écrit pas de texte anxiogène sur un budget négatif', () => {
    // CLAUDE.md : jamais « aucune chance », jamais un refus.
    expect(budget![0]).toMatch(/Il te manque/)
    expect(budget![0]).toContain('Ce n’est pas un refus')
    expect(budget![0].toLowerCase()).not.toMatch(/impossible|infinançable|renonce|abandonne/)
  })
})
