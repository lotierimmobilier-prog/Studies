/**
 * Le moteur écrit du texte que l'élève LIT.
 *
 * Le champ `hypothese` de chaque ligne de budget s'affiche tel quel sous le
 * montant : « 16,33 €/m² × 25 m², moins 199,88 € d'APL ». Tant que ces
 * nombres étaient interpolés bruts, la page affichait « 16.326 €/m² » et
 * « 199.88 € » — point décimal anglais, et trois décimales sur un loyer.
 * Constaté à l'écran le 20/09/2026.
 *
 * Deux garde-fous ici : la mise en forme elle-même, et le contrôle qu'AUCUNE
 * ligne produite par le moteur ne laisse passer un nombre à l'anglaise. Le
 * second est le seul qui attrape un nouveau poste écrit sans y penser.
 */
import { describe, expect, it } from 'vitest'

import { calculerRAV } from '../rav.ts'
import { INSECABLE, euros, eurosAuCentime, eurosPrecis, nombre } from '../nombres.ts'
import type { MontantSource, ProfilEleve, VoeuBudget } from '../types.ts'

describe('mise en forme des montants du moteur', () => {
  it('arrondit au centime et écrit la décimale à la française', () => {
    expect(eurosAuCentime(16.326)).toBe(`16,33${INSECABLE}€`)
    expect(eurosAuCentime(199.88)).toBe(`199,88${INSECABLE}€`)
  })

  it('ne traîne pas de décimales inutiles sur un montant rond', () => {
    // « 120,00 € de courses » n'apprend rien de plus que « 120 € ».
    expect(eurosAuCentime(120)).toBe(`120${INSECABLE}€`)
    expect(eurosAuCentime(0)).toBe(`0${INSECABLE}€`)
  })

  it('donne deux décimales ou aucune, jamais une seule', () => {
    // « 120,4 € » n'est pas un montant : c'est un nombre auquel il manque un
    // chiffre. Le défaut se voyait sur les courses déclarées.
    expect(eurosAuCentime(120.4)).toBe(`120,40${INSECABLE}€`)
    expect(eurosAuCentime(9.5)).toBe(`9,50${INSECABLE}€`)
  })

  it('emploie le vrai signe moins et l’espace insécable', () => {
    expect(eurosAuCentime(-12.5)).toBe(`−12,50${INSECABLE}€`)
    expect(eurosAuCentime(-12.5)).not.toContain('-')
    expect(nombre(1246)).toBe(`1${INSECABLE}246`)
  })

  it('n’arrondit que l’affichage, jamais le calcul', () => {
    // Le garde-fou de la règle 1 : la chaîne de calcul garde la valeur
    // pleine. Arrondir avant d'additionner déplacerait un total de quelques
    // centimes sans que rien ne le signale.
    expect(euros(334.6)).toBe(`335${INSECABLE}€`)
    expect(eurosPrecis(13.39)).toBe(`13,39${INSECABLE}€`)
    expect(334.6 + 0.4).toBe(335)
  })
})

/* ------------------------------------------------------------------------ */

function montant(valeur: number, quoi: string): MontantSource {
  return { montant: valeur, source: `Source de test — ${quoi}`, millesime: '2026', hypothese: quoi }
}

/** Un profil et un vœu dont TOUS les montants tombent sur des décimales. */
const PROFIL: ProfilEleve = {
  echelonBourse: null,
  exonereCvec: false,
  eligibleAideMerite: false,
  eligibleAideMobiliteParcoursup: false,
  contributionFamilialeMensuelle: 150.55,
  jobEtudiantMensuel: { bas: 120.35, haut: 300.75 },
  aidesRegionalesAnnuelles: null,
  repasCrousParMois: 20,
  coursesMensuelles: 120.4,
  fraisDiversMensuels: 80.25,
}

const VOEU: VoeuBudget = {
  codeInsee: '87085',
  loyer: {
    euroParM2: { bas: 14.117, central: 16.326, haut: 18.409 },
    millesime: '2025',
    source: 'Indicateur des loyers par commune, millésime 2025',
    qualite: 'commune',
  },
  surfaceHypotheseM2: 25,
  aplMensuelle: montant(199.88, 'APL simulée'),
  transportMensuel: montant(30.4, 'abonnement urbain étudiant'),
  fraisScolariteAnnuels: montant(170.6, 'droits d’inscription'),
  fraisInstallation: montant(800.25, 'dépôt de garantie'),
  assujettiCvec: true,
}

describe('aucune ligne ne laisse passer un nombre à l’anglaise', () => {
  it('ni dans l’hypothèse, ni dans la source', () => {
    const resultat = calculerRAV(PROFIL, VOEU, 'central', '2026-09-19')
    const fautifs: string[] = []
    for (const ligne of resultat.lignes) {
      if (ligne.statut !== 'calcule') continue
      for (const [champ, texte] of [
        ['hypothese', ligne.valeur.hypothese],
        ['source', ligne.valeur.source],
      ] as const) {
        // Un chiffre, un POINT, un chiffre : « 16.326 », « 199.88 ». Les
        // millésimes (« 2025 ») et les URL n'en contiennent pas.
        for (const m of texte.matchAll(/\d+\.\d+/g)) {
          // Une adresse web a le droit d'en contenir : « api.fr », « v1.2 ».
          const debut = Math.max(0, m.index - 40)
          if (/https?:\/\/\S*$/.test(texte.slice(debut, m.index))) continue
          fautifs.push(`${ligne.poste} · ${champ} → « ${m[0]} » dans « ${texte.slice(0, 90)}… »`)
        }
      }
    }
    expect(
      fautifs,
      'Passe par eurosAuCentime() de nombres.ts : un montant interpolé brut ' +
        's’affiche « 16.326 € » à un lycéen français.',
    ).toEqual([])
  })

  it('reconnaîtrait bien la faute si elle revenait', () => {
    // Garde-fou du garde-fou : sans lui, une expression régulière cassée
    // ferait passer le test ci-dessus pour de bonnes raisons apparentes.
    expect('16.326 €/m²'.match(/\d+\.\d+/g)).toEqual(['16.326'])
    expect('16,33 €/m²'.match(/\d+\.\d+/g)).toBeNull()
  })
})
