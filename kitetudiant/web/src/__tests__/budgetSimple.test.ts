import { describe, it, expect } from 'vitest'

import {
  AIDES_FAMILLE,
  JOBS_ETUDIANTS,
  TRAINS_DE_VIE,
  aideFamilleCourante,
  depensesDeclarees,
  jobCourant,
  trainDeVieCourant,
  valeursDe,
} from '../budgetSimple.ts'
import { REPONSES_PAR_DEFAUT } from '../parcours.tsx'

describe('les choix affichent ce qu’ils appliquent', () => {
  it('chaque train de vie fixe les quatre postes, sans en oublier', () => {
    for (const t of TRAINS_DE_VIE) {
      const v = valeursDe(t)
      expect(Object.keys(v).sort()).toEqual([
        'coursesMensuelles',
        'fraisDiversMensuels',
        'repasCrousParMois',
        'transportMensuel',
      ])
      for (const montant of Object.values(v)) {
        expect(typeof montant).toBe('number')
        expect(montant).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('les trains de vie vont du moins cher au plus cher', () => {
    // L'ordre affiché doit suivre le coût, sinon le choix du milieu ne veut
    // plus rien dire.
    const couts = TRAINS_DE_VIE.map(
      (t) => t.coursesMensuelles + t.fraisDiversMensuels + t.transportMensuel,
    )
    expect(couts).toEqual([...couts].sort((a, b) => a - b))
  })

  it('les fourchettes de job sont cohérentes et croissantes', () => {
    for (const j of JOBS_ETUDIANTS) expect(j.bas).toBeLessThanOrEqual(j.haut)
    const hauts = JOBS_ETUDIANTS.map((j) => j.haut)
    expect(hauts).toEqual([...hauts].sort((a, b) => a - b))
  })

  it('les aides familiales sont croissantes et commencent à zéro', () => {
    const montants = AIDES_FAMILLE.map((a) => a.montant)
    expect(montants[0]).toBe(0)
    expect(montants).toEqual([...montants].sort((a, b) => a - b))
  })
})

describe('reconnaissance du choix courant', () => {
  it('retrouve le train de vie appliqué', () => {
    const t = TRAINS_DE_VIE[1]!
    expect(trainDeVieCourant(valeursDe(t))?.cle).toBe(t.cle)
  })

  it('ne prétend à aucun choix quand un montant a été ajusté', () => {
    // C'est ce qui garantit que la mise en évidence à l'écran dit la vérité :
    // un montant modifié dans le détail ne doit plus afficher de choix actif.
    const ajuste = { ...valeursDe(TRAINS_DE_VIE[1]!), coursesMensuelles: 137 }
    expect(trainDeVieCourant(ajuste)).toBeNull()
  })

  it('retrouve l’aide familiale et le job', () => {
    expect(aideFamilleCourante(250)?.cle).toBe('moyenne')
    expect(aideFamilleCourante(137)).toBeNull()
    expect(jobCourant(150, 350)?.cle).toBe('regulier')
    expect(jobCourant(42, 43)).toBeNull()
  })
})

describe('les valeurs de départ du parcours', () => {
  it('correspondent toutes les trois à un choix affiché', () => {
    // Sans cela, le parcours s'ouvrirait sur « montants ajustés à la main »
    // alors que l'élève n'a rien touché — et aucune réponse ne serait mise en
    // évidence.
    expect(trainDeVieCourant(REPONSES_PAR_DEFAUT)).not.toBeNull()
    expect(aideFamilleCourante(REPONSES_PAR_DEFAUT.contributionFamiliale)).not.toBeNull()
    expect(jobCourant(REPONSES_PAR_DEFAUT.jobBas, REPONSES_PAR_DEFAUT.jobHaut)).not.toBeNull()
  })
})

describe('depensesDeclarees', () => {
  it('additionne les trois postes en euros, et eux seuls', () => {
    const t = TRAINS_DE_VIE[0]!
    expect(depensesDeclarees(t)).toBe(
      t.coursesMensuelles + t.fraisDiversMensuels + t.transportMensuel,
    )
  })

  it('n’ajoute pas le nombre de repas au total en euros', () => {
    // repasCrousParMois est un NOMBRE DE REPAS, pas un montant : l'additionner
    // donnerait un total faux de quelques dizaines d'euros. Deux trains de vie
    // dont les trois postes en euros sont identiques doivent donner le même
    // total, quel que soit leur nombre de repas.
    const base = TRAINS_DE_VIE[0]!
    const memeEuros = { ...base, repasCrousParMois: base.repasCrousParMois + 30 }
    expect(depensesDeclarees(memeEuros)).toBe(depensesDeclarees(base))
  })
})
