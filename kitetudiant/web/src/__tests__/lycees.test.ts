/**
 * Les résultats publiés d'un lycée.
 *
 * Le seul calcul de ce module est une soustraction — les admis sans mention,
 * que le ministère ne publie pas. Tout le reste est repris tel quel. Ces
 * tests tiennent donc surtout une chose : que ce calcul refuse de produire un
 * nombre quand un de ses termes manque.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  chercherLycees,
  depuisLigne,
  mentionsDuLycee,
  repartition,
} from '../lycees.ts'

/** Une ligne réelle du jeu, relevée le 20/09/2026. */
const LIGNE = {
  code_etablissement: '0010014K',
  etablissement: 'LYCEE EDGAR QUINET',
  commune: '01053',
  annee: '2023',
  presents_gnle: 232,
  taux_reu_brut_gnle: '95',
  nombre_de_mentions_tb_avec_felicitations_g: 3,
  nombre_de_mentions_tb_sans_felicitations_g: 19,
  nombre_de_mentions_b_g: 37,
  nombre_de_mentions_ab_g: 85,
}

function reponse(resultats: unknown[]): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ results: resultats }), { status: 200 }),
  ) as unknown as typeof fetch
}

describe('lecture d’une ligne publiée', () => {
  it('reprend les mentions telles quelles, sans rien recalculer', () => {
    const m = depuisLigne(LIGNE)
    expect(m.felicitations).toBe(3)
    expect(m.tresBien).toBe(19)
    expect(m.bien).toBe(37)
    expect(m.assezBien).toBe(85)
    expect(m.presents).toBe(232)
    expect(m.tauxReussite).toBe(95)
  })

  it('déduit les admis sans mention, seul chiffre calculé', () => {
    // 232 présents × 95 % = 220 admis ; 144 mentions ; reste 76.
    expect(depuisLigne(LIGNE).sansMention).toBe(76)
  })

  it('rend « null » plutôt qu’un nombre quand un terme manque', () => {
    // Une soustraction avec un trou donne un nombre, pas une information.
    expect(depuisLigne({ ...LIGNE, presents_gnle: undefined }).sansMention).toBeNull()
    expect(depuisLigne({ ...LIGNE, taux_reu_brut_gnle: undefined }).sansMention).toBeNull()
    expect(
      depuisLigne({
        ...LIGNE,
        nombre_de_mentions_tb_avec_felicitations_g: undefined,
        nombre_de_mentions_tb_sans_felicitations_g: undefined,
        nombre_de_mentions_b_g: undefined,
        nombre_de_mentions_ab_g: undefined,
      }).sansMention,
    ).toBeNull()
  })

  it('ne rend jamais un « sans mention » négatif', () => {
    // Plus de mentions que d'admis est impossible, mais un jeu de données
    // peut avoir un trou : mieux vaut zéro qu'un nombre négatif à l'écran.
    expect(depuisLigne({ ...LIGNE, nombre_de_mentions_ab_g: 900 }).sansMention).toBe(0)
  })

  it('porte toujours son millésime', () => {
    // Le dernier millésime publié n'est pas l'année en cours. Sans lui,
    // l'élève croit lire les résultats de l'an dernier (règle 6).
    expect(depuisLigne(LIGNE).annee).toBe('2023')
  })
})

describe('répartition', () => {
  it('rapporte les mentions aux ADMIS, pas aux présents', () => {
    // Rapporter aux présents ferait un total qui ne tombe pas à cent, et
    // personne ne saurait pourquoi.
    const parts = repartition(depuisLigne(LIGNE))
    const somme = parts.reduce((t, p) => t + p.pourcentage, 0)
    expect(somme).toBeGreaterThanOrEqual(99)
    expect(somme).toBeLessThanOrEqual(101)
  })

  it('nomme les cinq catégories, félicitations comprises', () => {
    expect(repartition(depuisLigne(LIGNE)).map((p) => p.libelle)).toEqual([
      'Félicitations',
      'Mention très bien',
      'Mention bien',
      'Mention assez bien',
      'Sans mention',
    ])
  })

  it('omet « sans mention » quand il n’a pas pu être déduit', () => {
    const parts = repartition(depuisLigne({ ...LIGNE, presents_gnle: undefined }))
    expect(parts.map((p) => p.libelle)).not.toContain('Sans mention')
  })

  it('ne rend rien plutôt que des zéros quand tout manque', () => {
    expect(repartition(depuisLigne({ code_etablissement: 'X' }))).toEqual([])
  })
})

describe('recherche', () => {
  it('ne cherche pas sur moins de trois caractères', async () => {
    const faux = reponse([])
    expect(await chercherLycees('ly', faux)).toEqual([])
    expect(faux).not.toHaveBeenCalled()
  })

  it('ne propose qu’une fois chaque établissement, au millésime le plus récent', async () => {
    // Un lycée figure une fois par année dans le jeu : sans dédoublonnage,
    // la liste proposerait six fois le même.
    const lycees = await chercherLycees(
      'Edgar Quinet',
      reponse([
        { ...LIGNE, annee: '2023' },
        { ...LIGNE, annee: '2022' },
        { ...LIGNE, annee: '2021' },
      ]),
    )
    expect(lycees).toHaveLength(1)
    expect(lycees[0]!.annee).toBe('2023')
    expect(lycees[0]!.uai).toBe('0010014K')
  })

  it('joint sur l’UAI et non sur le nom', async () => {
    // Deux lycées peuvent porter le même nom dans deux communes, et un nom
    // se réécrit d'une année sur l'autre. L'UAI est la clé pivot.
    const lycees = await chercherLycees(
      'Jean Moulin',
      reponse([
        { ...LIGNE, code_etablissement: '0010014K', etablissement: 'LYCEE JEAN MOULIN' },
        { ...LIGNE, code_etablissement: '0750001A', etablissement: 'LYCEE JEAN MOULIN' },
      ]),
    )
    expect(lycees).toHaveLength(2)
    expect(lycees.map((l) => l.uai)).toEqual(['0010014K', '0750001A'])
  })

  it('rend null quand l’établissement n’a aucune ligne', async () => {
    expect(await mentionsDuLycee('0000000X', reponse([]))).toBeNull()
  })
})
