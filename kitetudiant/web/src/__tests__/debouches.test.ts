import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { specialitesDesLibelles, libelleDuTheme, THEMES } from '../themes.ts'
import { lienOffresFranceTravail } from '../../../packages/metiers/src/index.ts'

/**
 * Les débouchés d'un établissement.
 *
 * Une école n'a pas de débouchés publiés : personne ne suit le devenir des
 * sortants formation par formation. Ce que la page montre, c'est le nombre
 * d'annonces ouvertes dans les secteurs vers lesquels ses spécialités mènent
 * — et tout l'enjeu est que la nuance tienne, parce qu'un chiffre à côté d'un
 * nom d'école se lit comme une promesse.
 */

const ECRAN = readFileSync(
  resolve(import.meta.dirname, '..', 'pageEtablissement.tsx'),
  'utf8',
)
const SERVEUR = readFileSync(
  resolve(import.meta.dirname, '..', '..', '..', '..', 'server', 'index.ts'),
  'utf8',
)

describe('le classement des spécialités', () => {
  it('range par nombre de formations, pas par ordre d’arrivée', () => {
    // Une école qui propose une licence de sport puis huit de droit est une
    // école de droit, quel que soit l'ordre de publication du ministère.
    const libelles = [
      'Licence - STAPS',
      ...Array.from({ length: 8 }, () => 'Licence - Droit'),
    ]
    expect(specialitesDesLibelles(libelles)[0]).toBe('droit')
  })

  it('compte une formation dans CHACUN de ses thèmes', () => {
    // « Droit et économie » relève des deux ; n'en compter qu'un
    // appauvrirait le classement sans raison.
    const cles = specialitesDesLibelles(['Licence - Droit et économie'])
    expect(cles).toContain('droit')
    expect(cles).toContain('economie')
  })

  it('rend une liste vide quand aucun intitulé ne parle', () => {
    // Le composant se tait alors, plutôt que de proposer des secteurs au
    // hasard : une école sans spécialité reconnue n'affiche pas la section.
    expect(specialitesDesLibelles(['Parcours ZZZ'])).toEqual([])
    expect(specialitesDesLibelles([])).toEqual([])
  })

  it('départage les égalités de façon stable', () => {
    /* Deux spécialités à poids égal doivent sortir dans le même ordre à
       chaque appel. Sinon la même école montrerait deux classements
       différents d'un chargement à l'autre — et, le serveur n'en comptant
       que cinq, deux jeux de chiffres différents. */
    const libelles = ['Licence - Droit', 'Licence - Informatique']
    const premier = specialitesDesLibelles(libelles)
    for (let i = 0; i < 20; i += 1) {
      expect(specialitesDesLibelles(libelles)).toEqual(premier)
    }
  })
})

describe('les libellés affichés', () => {
  it('ne montrent jamais la clé technique', () => {
    // « sante » à l'écran donnerait à l'élève le sentiment de lire un
    // journal de débogage plutôt que sa propre fiche.
    for (const theme of THEMES) {
      expect(libelleDuTheme(theme.cle)).not.toBe(theme.cle)
      expect(libelleDuTheme(theme.cle)).toBe(theme.libelle)
    }
  })

  it('retombent sur la clé plutôt que sur du vide', () => {
    // Un thème inconnu ne doit pas produire un lien au nom vide.
    expect(libelleDuTheme('inexistant')).toBe('inexistant')
  })
})

describe('le lien vers France Travail', () => {
  it('n’est défini qu’à un seul endroit', () => {
    /* Le serveur s'en sert pour les métiers d'une formation, le navigateur
       pour les spécialités d'une école. Deux constructions de la même URL
       divergeraient au premier changement de leur site, et personne ne s'en
       apercevrait avant qu'un lien ne mène nulle part. */
    const emploi = readFileSync(
      resolve(import.meta.dirname, '..', '..', '..', '..', 'server', 'emploi.ts'),
      'utf8',
    )
    expect(emploi).toContain('return lienOffresFranceTravail(libelle, region)')
    expect(emploi).not.toContain('candidat.francetravail.fr/offres/recherche?')
  })

  it('porte la région quand on la connaît, et rien quand on ne la connaît pas', () => {
    expect(lienOffresFranceTravail('Santé et soin', '75')).toContain('region=75')
    expect(lienOffresFranceTravail('Santé et soin', null)).not.toContain('region=')
  })

  it('encode les accents et les espaces', () => {
    // « Santé et soin » collé tel quel dans une URL casse le lien.
    const lien = lienOffresFranceTravail('Santé et soin', null)
    expect(lien).toContain('Sant%C3%A9')
    expect(lien).not.toContain(' ')
  })
})

describe('ce que l’écran doit dire, et ne jamais taire', () => {
  it('refuse d’appeler ces chiffres les débouchés des diplômés', () => {
    /* La règle qui compte : personne ne publie le devenir des sortants
       formation par formation, et nous ne l'inventons pas. */
    expect(ECRAN).toContain('Ce ne sont pas les débouchés des diplômés de cette école')
  })

  it('explique l’ordre des spécialités', () => {
    /* « Sciences » en tête avec 1 342 offres devant « Santé » à 49 632 se
       lirait comme un classement des débouchés — soit l'inverse du vrai.
       Mesuré sur l'Université de Limoges. */
    expect(ECRAN).toContain('nombre de formations')
    expect(ECRAN).toContain('un classement des')
  })

  it('dit ce qu’il ne compte pas', () => {
    // Une liste tronquée en silence laisse croire que l'école ne fait que ça.
    expect(ECRAN).toContain('tues > 0')
    expect(ECRAN).toContain('les plus enseignées sont comptées ici')
  })

  it('pose la mise en garde AVANT les chiffres', () => {
    // Un lecteur qui fait défiler jusqu'en bas les a déjà lus comme un verdict.
    const garde = ECRAN.indexOf('Beaucoup de recrutements ne passent jamais')
    const liste = ECRAN.indexOf('<ul className="specialites">')
    expect(garde).toBeGreaterThan(-1)
    expect(garde).toBeLessThan(liste)
  })

  it('distingue « non compté » de zéro', () => {
    /* Un échec de comptage affiché comme « 0 offre » découragerait sur la
       foi d'une panne réseau. `null` n'est jamais rendu en chiffre. */
    expect(ECRAN).toContain("sp.enFrance === null ? 'non compté'")
    expect(ECRAN).toContain("sp.enRegion === null ? 'non compté'")
  })

  it('porte la date du relevé', () => {
    // Règle 6 de CLAUDE.md : toute donnée affichée porte sa date de collecte.
    expect(ECRAN).toContain('dateLisible(releveLe)')
  })
})

describe('le coût du comptage est borné côté serveur', () => {
  it('plafonne le nombre de spécialités comptées', () => {
    /* Chaque domaine ROME coûte un appel par échelle, le quota est de dix
       par seconde, et les seize thèmes couvrent quarante-sept domaines.
       Mesuré : cinq spécialités neuves prennent cinq secondes ; les seize
       en prendraient près de dix. */
    expect(SERVEUR).toMatch(/const THEMES_MAX = \d+/)
    expect(SERVEUR).toContain('connus.slice(0, THEMES_MAX)')
  })

  it('renvoie combien avaient été demandées', () => {
    // Sans ce nombre, l'écran ne pourrait pas dire ce qu'il tait.
    expect(SERVEUR).toContain('demandees: connus.length')
  })

  it('dédoublonne et ignore les thèmes inconnus', () => {
    // Les clés arrivent du navigateur : deux fois « sante » ne doit pas
    // coûter deux fois, et une clé inventée ne doit rien coûter du tout.
    expect(SERVEUR).toContain('[...new Set(demandes)]')
    expect(SERVEUR).toContain('.filter((t) => t.domaines.length > 0)')
  })

  it('ne compte jamais un total partiel', () => {
    /* `somme` rend null dès qu'un domaine manque : additionner ce qu'on a en
       faisant comme si le reste valait zéro donnerait un total faux, plus
       petit que la réalité, et rien ne le signalerait. */
    expect(SERVEUR).toContain('somme(totaux.map((t) => t.enFrance))')
    expect(SERVEUR).toContain("region === null ? null : somme(totaux.map((t) => t.enRegion))")
  })
})
