/**
 * L'âge de l'élève, et le contenu qui en dépend.
 *
 * Le site ne connaît que l'ANNÉE de naissance (règle 3 : minimisation). Il ne
 * peut donc jamais dire l'âge exact de quelqu'un — seulement une borne. Tout
 * ce fichier tient à ce que cette borne soit prise du BON CÔTÉ : au plus bas,
 * pour qu'une erreur fasse voir à un majeur le contenu d'un mineur, et jamais
 * l'inverse.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ageMinimal,
  anneePlausible,
  ecrireAnneeNaissance,
  lireAnneeNaissance,
  MAJORITE,
  majeurCertain,
  publicDe,
} from '../age.ts'
import { AGE_MINIMUM, assezAge } from '../consentementBulletin.ts'

const SRC = resolve(__dirname, '..')
const LE_1ER_JUILLET_2026 = new Date('2026-07-01T12:00:00Z')

describe('l’âge se compte au plus bas', () => {
  it('retire une année, parce que l’anniversaire n’a peut-être pas eu lieu', () => {
    // Né en 2008 : en 2026, il a 17 ou 18 ans. On retient 17.
    expect(ageMinimal(2008, LE_1ER_JUILLET_2026)).toBe(17)
    expect(ageMinimal(2007, LE_1ER_JUILLET_2026)).toBe(18)
  })

  it('ne déclare majeur qu’à partir de l’année où c’est certain', () => {
    /* Le cas qui décide de tout : quelqu'un né en 2008 PEUT n'avoir dix-huit
       ans qu'en décembre 2026. On ne le dit majeur qu'en 2027. Un an de
       retard assumé, contre le risque de se tromper de sens. */
    expect(majeurCertain(2008, LE_1ER_JUILLET_2026)).toBe(false)
    expect(majeurCertain(2008, new Date('2027-01-02T12:00:00Z'))).toBe(true)
    expect(majeurCertain(2007, LE_1ER_JUILLET_2026)).toBe(true)
  })

  it('se trompe toujours dans le même sens', () => {
    /* Pour toute année, la borne retenue est inférieure ou égale à l'âge
       réel. C'est la propriété qui garantit qu'on ne prendra jamais un
       mineur pour un majeur. */
    for (let annee = 1990; annee <= 2026; annee += 1) {
      const reelMax = 2026 - annee // si l'anniversaire est déjà passé
      const reelMin = reelMax - 1 // sinon
      const retenu = ageMinimal(annee, LE_1ER_JUILLET_2026)
      expect(retenu).toBe(reelMin)
      expect(retenu).toBeLessThanOrEqual(reelMax)
    }
  })

  it('emploie la même règle que le dépôt de bulletin', () => {
    /* `consentementBulletin` réexporte `ageMinimal` au lieu d'en garder une
       copie. Deux règles du plus bas qui divergeraient, c'est un écran qui
       accepte ce que l'autre refuse. */
    expect(assezAge(2026 - AGE_MINIMUM, LE_1ER_JUILLET_2026)).toBe(false)
    expect(assezAge(2026 - AGE_MINIMUM - 1, LE_1ER_JUILLET_2026)).toBe(true)
    const source = readFileSync(resolve(SRC, 'consentementBulletin.ts'), 'utf8')
    expect(source, 'la règle a été recopiée au lieu d’être importée').not.toMatch(
      /getFullYear\(\)\s*-\s*anneeNaissance/,
    )
  })

  it('fixe la majorité à dix-huit ans', () => {
    expect(MAJORITE).toBe(18)
  })
})

describe('le public d’un écran', () => {
  it('distingue « mineur », « majeur » et « inconnu »', () => {
    expect(publicDe(2008, LE_1ER_JUILLET_2026)).toBe('mineur')
    expect(publicDe(2000, LE_1ER_JUILLET_2026)).toBe('majeur')
    expect(publicDe(null, LE_1ER_JUILLET_2026)).toBe('inconnu')
  })

  it('ne confond pas « inconnu » avec « mineur »', () => {
    /* Deux états différents : l'un dit qu'on n'a pas posé la question,
       l'autre qu'on connaît la réponse. Les fondre ferait disparaître un
       contenu pour tous les visiteurs qui n'ont jamais répondu. */
    expect(publicDe(null)).not.toBe('mineur')
    expect(publicDe(Number.NaN)).toBe('inconnu')
  })
})

describe('la mémoire de l’année', () => {
  it('se relit telle qu’elle a été écrite', () => {
    let coffre = ''
    ecrireAnneeNaissance(2008, (v) => {
      coffre = v
    })
    expect(lireAnneeNaissance(() => coffre, LE_1ER_JUILLET_2026)).toBe(2008)
  })

  it('traite une valeur abîmée comme une absence', () => {
    /* Une valeur illisible ne doit pas produire un âge : elle ferait choisir
       un contenu sur un nombre qui ne veut rien dire. On redemandera. */
    for (const abime of ['', 'bientôt', '0', '-42', '20 08', '3000']) {
      expect(lireAnneeNaissance(() => abime, LE_1ER_JUILLET_2026)).toBeNull()
    }
    expect(lireAnneeNaissance(() => null)).toBeNull()
  })

  it('refuse d’écrire une année invraisemblable', () => {
    let coffre: string | null = null
    for (const mauvaise of [0, -1, 3000, 2027, 1800, 1.5]) {
      ecrireAnneeNaissance(mauvaise, (v) => {
        coffre = v
      }, LE_1ER_JUILLET_2026)
    }
    expect(coffre).toBeNull()
  })

  it('accepte l’année en cours, et pas la suivante', () => {
    expect(anneePlausible(2026, LE_1ER_JUILLET_2026)).toBe(true)
    expect(anneePlausible(2027, LE_1ER_JUILLET_2026)).toBe(false)
  })

  it('ne part jamais sur un serveur', () => {
    /* Le compte ne porte que l'adresse e-mail (`ProfilCompte`). Ajouter
       l'année de naissance d'un mineur à une base de données pour un choix
       d'affichage que le navigateur fait déjà serait un recul sur la
       règle 3 de CLAUDE.md. */
    const source = readFileSync(resolve(SRC, 'age.ts'), 'utf8')
    expect(source).not.toMatch(/fetch\(|BASE_API|axios|XMLHttpRequest/)
    const donnees = readFileSync(resolve(SRC, 'donnees.ts'), 'utf8')
    const profil = /export interface ProfilCompte \{[\s\S]*?\n\}/.exec(donnees)
    expect(profil).not.toBeNull()
    expect(
      profil![0],
      'l’année de naissance a été ajoutée au profil envoyé par le serveur',
    ).not.toMatch(/annee|naissance|age/i)
  })
})

describe('ce que voit un mineur sur l’accueil', () => {
  const accueil = readFileSync(resolve(SRC, 'accueil.tsx'), 'utf8')

  it('lit le public une fois, au premier rendu', () => {
    // Une lecture différée ferait clignoter le contenu des majeurs devant un
    // mineur, le temps d'un effet.
    expect(accueil).toMatch(/useState<Public>\(\(\) => publicDe\(lireAnneeNaissance\(\)\)\)/)
  })

  it('ne lui montre pas le lien rémunéré', () => {
    /* Un contrat d'énergie signé par un mineur est annulable : le lui
       proposer, c'est lui proposer une démarche qui ne tiendra pas — et se
       faire payer pour ça. */
    const bloc = /\{lecteur === 'mineur' \? \([\s\S]*?\) : \([\s\S]*?\)\}/.exec(accueil)
    expect(bloc, 'la carte des contrats n’est plus conditionnelle').not.toBeNull()
    const [pourMineur, pourMajeur] = bloc![0].split(') : (')
    /* Sans la casse : le lien se pose sur la constante du dépôt
       (`PAPERNEST.lien`) ou sur le partenaire résolu par la console
       (`partenaires.papernest.lien`), et la règle vaut pour les deux. */
    expect(pourMineur).not.toMatch(/papernest\.lien/i)
    expect(pourMajeur).toMatch(/papernest\.lien/i)
  })

  it('lui garde l’information, et lui dit avec qui faire la démarche', () => {
    expect(accueil).toMatch(/Tu n’as pas encore dix-huit ans/)
    expect(accueil).toMatch(/avec un parent/)
  })

  it('ne lui affiche pas une mention de rémunération sans lien rémunéré', () => {
    expect(accueil).toMatch(/lecteur === 'mineur' \? null : \(\s*<p className="note partenaire-mention">/)
  })

  it('laisse la page inchangée quand l’année n’est pas connue', () => {
    /* La plupart des visiteurs n'ont jamais répondu. Leur retirer un contenu
       au nom d'un doute ferait disparaître la section pour presque tout le
       monde ; la porte ne se ferme que sur une réponse. */
    expect(accueil).not.toMatch(/lecteur !== 'majeur'/)
    expect(accueil).not.toMatch(/lecteur === 'inconnu'/)
  })
})

describe('où l’année est demandée', () => {
  it('en première question du parcours', () => {
    const parcours = readFileSync(resolve(SRC, 'parcours.tsx'), 'utf8')
    const etape0 = parcours.slice(parcours.indexOf('if (etape === 0)'))
    const annee = etape0.indexOf('Ton année de naissance')
    const bac = etape0.indexOf('reponses.typeBac === b.cle')
    expect(annee).toBeGreaterThan(-1)
    expect(annee, 'le bac est redemandé avant l’année').toBeLessThan(bac)
    expect(etape0).toContain('ecrireAnneeNaissance(anneeNaissance)')
  })

  it('et à l’inscription, pas à la connexion', () => {
    const compte = readFileSync(resolve(SRC, 'compte.tsx'), 'utf8')
    expect(compte).toMatch(/mode === 'inscription' \? \(\s*<div className="champ">/)
    expect(compte).toContain('compte-annee')
    // Gardée seulement après une inscription réussie.
    expect(compte).toMatch(/if \(mode === 'inscription' && annee !== ''\)/)
  })
})
