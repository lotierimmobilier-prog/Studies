/**
 * Démonstration : le reste-à-vivre d'un même profil sur trois villes, calculé
 * sur les données réelles téléchargées à l'étape 1.
 *
 *   npx tsx kitetudiant/scripts/demo/rav.ts
 *
 * Les loyers viennent de data/brut/loyers_communes.csv, les aides des barèmes
 * versionnés. Tout ce que l'élève déclare est affiché comme déclaratif.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { calculerFourchetteRAV, calculerRAV } from '../../packages/budget-engine/src/rav.ts'
import type {
  LigneBudget,
  LoyerCommune,
  MontantSource,
  ProfilEleve,
  VoeuBudget,
} from '../../packages/budget-engine/src/types.ts'

const RACINE = resolve(import.meta.dirname, '../..')
const LOYERS = resolve(RACINE, 'data/brut/loyers_communes.csv')
const AU = '2026-09-19'
const TYPOLOGIE = 'appartement 1 ou 2 pièces'

function chargerLoyers(codes: readonly string[]): Map<string, LoyerCommune & { nom: string }> {
  let brut: string
  try {
    brut = readFileSync(LOYERS, 'utf8')
  } catch {
    throw new Error(
      `${LOYERS} est absent. Lancer d'abord : python3 kitetudiant/scripts/exploration/telecharger.py`,
    )
  }
  const lignes = brut.split('\n')
  const entetes = (lignes[0] ?? '').split(';')
  const col = (nom: string): number => entetes.indexOf(nom)
  const iInsee = col('insee_c')
  const iType = col('type_logement')
  const trouves = new Map<string, LoyerCommune & { nom: string }>()
  const voulus = new Set(codes)
  for (const ligne of lignes.slice(1)) {
    if (ligne.length === 0) continue
    const champs = ligne.split(';')
    if (!voulus.has(champs[iInsee] ?? '') || champs[iType] !== TYPOLOGIE) continue
    const maille = champs[col('typpred')] as LoyerCommune['qualite']
    trouves.set(champs[iInsee] as string, {
      nom: champs[col('libgeo')] as string,
      euroParM2: {
        bas: Number(champs[col('lwr_ipm2')]),
        central: Number(champs[col('loypredm2')]),
        haut: Number(champs[col('upr_ipm2')]),
      },
      millesime: champs[col('year')] as string,
      source: `Indicateur des loyers par commune, millésime ${champs[col('year')]} (ANIL / CEREMA)`,
      qualite: maille,
    })
  }
  return trouves
}

function euros(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function declare(montant: number, quoi: string): MontantSource {
  return { montant, source: 'Saisie déclarative de l’élève', millesime: 'déclaratif', hypothese: quoi }
}

const PROFIL: ProfilEleve = {
  echelonBourse: '5',
  exonereCvec: false,
  eligibleAideMerite: true,
  eligibleAideMobiliteParcoursup: true,
  contributionFamilialeMensuelle: 150,
  jobEtudiantMensuel: { bas: 200, haut: 300 },
  aidesRegionalesAnnuelles: null,
  repasCrousParMois: 15,
  coursesMensuelles: 120,
  fraisDiversMensuels: 80,
}

/** APL déclarée, faute de service OpenFisca branché : c'est dit en clair. */
const APL_DECLAREE = 180

function voeu(codeInsee: string, loyer: LoyerCommune, avecApl: boolean): VoeuBudget {
  return {
    codeInsee,
    loyer,
    surfaceHypotheseM2: 25,
    aplMensuelle: avecApl
      ? declare(APL_DECLAREE, 'APL déclarée par l’élève, en attendant la simulation OpenFisca')
      : null,
    transportMensuel: declare(30, 'abonnement urbain étudiant déclaré'),
    fraisScolariteAnnuels: declare(0, 'droits d’inscription, boursier exonéré'),
    fraisInstallation: declare(800, 'dépôt de garantie et premier équipement déclarés'),
    assujettiCvec: true,
  }
}

function afficherLignes(lignes: readonly LigneBudget[]): void {
  for (const sens of ['depense', 'ressource'] as const) {
    console.log(`\n  ${sens === 'depense' ? 'DÉPENSES' : 'RESSOURCES'}`)
    for (const l of lignes.filter((x) => x.sens === sens)) {
      if (l.statut === 'calcule') {
        console.log(`    ${l.poste.padEnd(26)} ${euros(l.mensualise).padStart(12)}   ${l.valeur.millesime}`)
        console.log(`      ${l.valeur.hypothese}`)
        console.log(`      source : ${l.valeur.source}`)
      } else {
        const etiquette = l.statut === 'manquant' ? 'DONNÉE MANQUANTE' : 'sans objet'
        console.log(`    ${l.poste.padEnd(26)} ${etiquette.padStart(12)}`)
        console.log(`      ${l.raison}`)
      }
    }
  }
}

const VILLES = [
  ['87085', 'Limoges'],
  ['31555', 'Toulouse'],
  ['75113', 'Paris 13e'],
] as const

const loyers = chargerLoyers(VILLES.map(([code]) => code))

console.log('KITETUDIANT — reste-à-vivre, calculé au ' + AU)
console.log('Profil : boursier échelon 5, 25 m², 150 €/mois de la famille, job 200 à 300 €.\n')
console.log('Ville           loyer/m²    optimiste      central      prudent   verdict (central)')
console.log('─'.repeat(88))

for (const [code, nom] of VILLES) {
  const loyer = loyers.get(code)
  if (!loyer) {
    console.log(`${nom.padEnd(14)} aucun indicateur de loyer pour ${code} — RAV non calculé`)
    continue
  }
  const f = calculerFourchetteRAV(PROFIL, voeu(code, loyer, true), AU)
  const c = (v: number | null): string => (v === null ? 'indéterminé' : euros(v))
  console.log(
    `${nom.padEnd(14)} ${loyer.euroParM2.central.toFixed(2).padStart(7)}  ` +
      `${c(f.optimiste.ravMensuel).padStart(12)} ${c(f.central.ravMensuel).padStart(12)} ` +
      `${c(f.prudent.ravMensuel).padStart(12)}   ${f.central.soutenabilite}`,
  )
  for (const a of f.central.avertissements) console.log(`               ⚠ ${a}`)
}

const limoges = loyers.get('87085')
if (limoges) {
  console.log('\n' + '═'.repeat(88))
  console.log('Détail du budget à Limoges, scénario central')
  console.log('═'.repeat(88))
  const r = calculerRAV(PROFIL, voeu('87085', limoges, true), 'central', AU)
  afficherLignes(r.lignes)
  console.log(`\n  RESTE-À-VIVRE : ${euros(r.ravMensuel ?? 0)} par mois — ${r.soutenabilite}`)

  console.log('\n' + '═'.repeat(88))
  console.log('Le même vœu sans simulation d’APL : ce que le moteur refuse de faire')
  console.log('═'.repeat(88))
  const sansApl = calculerRAV(PROFIL, voeu('87085', limoges, false), 'central', AU)
  console.log(`  RESTE-À-VIVRE : ${sansApl.ravMensuel === null ? 'non calculé' : euros(sansApl.ravMensuel)}`)
  console.log(`  verdict       : ${sansApl.soutenabilite}`)
  console.log(`  postes manquants : ${sansApl.postesManquants.join(', ')}`)
  const manquant = sansApl.lignes.find((l) => l.poste === 'loyer_net')
  if (manquant && manquant.statut === 'manquant') console.log(`  raison        : ${manquant.raison}`)
}
