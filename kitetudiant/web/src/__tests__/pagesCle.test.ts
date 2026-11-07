/**
 * Les deux pages à clé pivot : une formation, un établissement.
 *
 * Ce qui est vérifié ici n'est pas décoratif. Une adresse qui ouvre la
 * mauvaise école est pire qu'une adresse qui ne s'ouvre pas, parce que
 * personne ne s'en aperçoit ; et des coordonnées interverties restent
 * parfaitement valides tout en plaçant l'école à l'autre bout du monde.
 */

import { describe, expect, it } from 'vitest'

import { adresseComplete, cheminDe, routeDuChemin, type Route } from '../routes.ts'
import { formationParCode, formationsDeLEtablissement } from '../donnees.ts'

/**
 * Une adresse de requête relue en clair.
 *
 * `decodeURIComponent` ne suffit pas : `URLSearchParams` encode l'espace en
 * `+`, qui n'est PAS un caractère à pourcent. Sans cette substitution, le
 * test comparait « cod_uai+= » à « cod_uai = » et échouait sur une requête
 * pourtant juste.
 */
function enClair(url: string): string {
  return decodeURIComponent(url.replace(/\+/g, ' '))
}

/** Un `fetch` qui rend ce qu'on lui donne, et retient l'adresse appelée. */
function faussetch(resultats: unknown[]): { recuperer: typeof fetch; adresses: string[] } {
  const adresses: string[] = []
  const recuperer = ((url: string) => {
    adresses.push(url)
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: resultats }),
    } as Response)
  }) as unknown as typeof fetch
  return { recuperer, adresses }
}

describe('les adresses des pages à clé pivot', () => {
  it('une formation et un établissement ont chacun leur chemin', () => {
    expect(cheminDe({ vue: 'formation', code: '2519' })).toBe('/formation/2519')
    expect(cheminDe({ vue: 'etablissement', uai: '0121471J' })).toBe(
      '/etablissement/0121471J',
    )
  })

  it('le chemin se relit en la route dont il vient', () => {
    const routes: Route[] = [
      { vue: 'formation', code: '2519' },
      { vue: 'formation', code: 'A-1_b' },
      { vue: 'etablissement', uai: '0121471J' },
    ]
    for (const route of routes) {
      expect(routeDuChemin(cheminDe(route))).toEqual(route)
    }
  })

  it('un UAI en minuscules désigne le même établissement', () => {
    // Deux adresses pour une même page dispersent son référencement, et
    // donnent deux fois le même contenu à indexer.
    expect(routeDuChemin('/etablissement/0121471j')).toEqual({
      vue: 'etablissement',
      uai: '0121471J',
    })
  })

  it('ce qui n’a pas la forme d’une clé n’est pas une route', () => {
    // Un motif large transformerait une faute de frappe en requête envoyée à
    // l'open data, puis en page vide sans explication.
    expect(routeDuChemin('/etablissement/pas-un-uai')).toBeNull()
    expect(routeDuChemin('/etablissement/012147JJ')).toBeNull()
    expect(routeDuChemin('/formation/')).toBeNull()
    expect(routeDuChemin('/formation/avec/slash')).toBeNull()
    expect(routeDuChemin('/formation/' + 'x'.repeat(33))).toBeNull()
  })

  it('l’adresse canonique est absolue', () => {
    expect(adresseComplete({ vue: 'formation', code: '2519' })).toBe(
      'https://kitetudiant.fr/formation/2519',
    )
  })
})

describe('chercher une formation par sa clé pivot', () => {
  it('interroge cod_aff_form, et rien d’autre', async () => {
    const { recuperer, adresses } = faussetch([])
    await formationParCode('2519', recuperer)
    expect(enClair(adresses[0]!)).toContain('where=cod_aff_form = "2519"')
  })

  it('rend null quand le code n’existe pas', async () => {
    const { recuperer } = faussetch([])
    // Surtout pas une formation approchante : elle passerait inaperçue.
    expect(await formationParCode('inexistant', recuperer)).toBeNull()
  })

  it('lit la position dans le bon ordre, objet comme chaîne', async () => {
    // Rodez : 44,35 de latitude, 2,56 de longitude. Les intervertir donnerait
    // un point au large de la Somalie — et resterait valide.
    const commun = {
      cod_aff_form: '1',
      lib_for_voe_ins: 'Licence',
      ville_etab: 'Rodez',
      dep: '12',
    }
    const objet = faussetch([
      { ...commun, g_olocalisation_des_formations: { lat: 44.35624, lon: 2.56417 } },
    ])
    expect((await formationParCode('1', objet.recuperer))?.coordonnees).toEqual({
      lat: 44.35624,
      lon: 2.56417,
    })

    const chaine = faussetch([
      { ...commun, g_olocalisation_des_formations: '44.35624, 2.56417' },
    ])
    expect((await formationParCode('1', chaine.recuperer))?.coordonnees).toEqual({
      lat: 44.35624,
      lon: 2.56417,
    })
  })

  it('refuse une position hors des bornes plutôt que de la garder', async () => {
    const { recuperer } = faussetch([
      {
        cod_aff_form: '1',
        lib_for_voe_ins: 'Licence',
        ville_etab: 'Rodez',
        dep: '12',
        g_olocalisation_des_formations: '999, 999',
      },
    ])
    expect((await formationParCode('1', recuperer))?.coordonnees).toBeNull()
  })

  it('laisse la position à null quand elle n’est pas publiée', async () => {
    // 0,27 % du jeu réel. La fiche doit dire que la position n'est pas
    // publiée, pas montrer le centre de la commune comme si c'était l'école.
    const { recuperer } = faussetch([
      { cod_aff_form: '1', lib_for_voe_ins: 'Licence', ville_etab: 'Rodez', dep: '12' },
    ])
    expect((await formationParCode('1', recuperer))?.coordonnees).toBeNull()
  })

  it('retient le code UAI de l’établissement', async () => {
    const { recuperer } = faussetch([
      {
        cod_aff_form: '1',
        lib_for_voe_ins: 'Licence',
        ville_etab: 'Rodez',
        dep: '12',
        cod_uai: '0121471J',
      },
    ])
    expect((await formationParCode('1', recuperer))?.uai).toBe('0121471J')
  })
})

describe('les formations d’un établissement', () => {
  it('interroge le code UAI, jamais le nom', async () => {
    // Deux établissements peuvent porter le même nom ; aucun ne partage son
    // UAI.
    const { recuperer, adresses } = faussetch([])
    await formationsDeLEtablissement('0121471J', recuperer)
    const appel = enClair(adresses[0]!)
    expect(appel).toContain('where=cod_uai = "0121471J"')
    expect(appel).not.toContain('g_ea_lib_vx')
  })

  it('écarte les enregistrements inexploitables sans faire échouer le reste', async () => {
    const { recuperer } = faussetch([
      { cod_aff_form: '1', lib_for_voe_ins: 'Licence', ville_etab: 'Rodez', dep: '12' },
      { cod_aff_form: '2' },
    ])
    const liste = await formationsDeLEtablissement('0121471J', recuperer)
    expect(liste.map((f) => f.id)).toEqual(['1'])
  })
})
