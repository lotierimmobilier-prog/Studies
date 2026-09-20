import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  ajouter,
  carteEcart,
  carteEtape,
  carteVille,
  cartesDe,
  cartesGagnees,
  chargerCollection,
  decileDuLoyer,
  enregistrerCollection,
  idEtape,
  idVille,
  importer,
  exporter,
  rareteDuDecile,
  villesDe,
  type Activite,
  type Obtention,
} from '../collection.ts'
import { loyerDe, MILLESIME_LOYERS, SURFACE_TYPE } from '../donnees.ts'

/** Communes réellement présentes dans le jeu versionné (cf. accueil.tsx). */
const LIMOGES = '87085'
const TOULOUSE = '31555'
const PARIS13 = '75113'
const INCONNUE = '00000'

describe('carte de ville', () => {
  it('porte sa source et son millésime, comme tout chiffre du site', () => {
    // Règle 6 de CLAUDE.md : toute donnée affichée porte son millésime.
    const carte = carteVille(LIMOGES)
    expect(carte).not.toBeNull()
    expect(carte!.provenance).toContain(MILLESIME_LOYERS)
    expect(carte!.valeur).toMatch(/€/)
  })

  it('affiche le même loyer que le reste du site', () => {
    const loyer = loyerDe(LIMOGES)
    expect(loyer).not.toBeNull()
    const attendu = Math.round(loyer!.euroParM2.central * SURFACE_TYPE)
    // Le montant de la carte doit être celui du studio type, pas un autre.
    expect(carteVille(LIMOGES)!.valeur).toContain(attendu.toLocaleString('fr-FR'))
  })

  it('n’existe pas pour une commune sans loyer connu', () => {
    // Pas de valeur de repli silencieuse : une donnée absente est absente.
    expect(carteVille(INCONNUE)).toBeNull()
  })

  it('abrège « Paris 13e Arrondissement » sans changer la clé', () => {
    const carte = carteVille(PARIS13)
    expect(carte!.titre).not.toMatch(/Arrondissement/)
    expect(carte!.id).toBe(idVille(PARIS13))
  })
})

describe('carte d’étape', () => {
  it('ne porte aucun chiffre, donc aucune provenance', () => {
    // Règle 6 lue à l'envers : une carte sans euro ne doit pas afficher une
    // source vide, qui donnerait l'illusion d'une donnée sourcée.
    const carte = carteEtape('detail')
    expect(carte.valeur).toBeNull()
    expect(carte.provenance).toBeNull()
    expect(carte.id).toBe(idEtape('detail'))
  })

  it('ne promet jamais rien sur le fait d’inviter quelqu’un', () => {
    for (const id of ['premier-budget', 'trois-villes', 'dix-villes', 'bulletin', 'detail', 'hors-academie'] as const) {
      expect(carteEtape(id).detail).not.toMatch(/invit|partag|ami|parrain/i)
    }
  })
})

describe('rareté', () => {
  it('se déduit du décile réel du loyer, jamais d’un tirage', () => {
    for (const code of [LIMOGES, TOULOUSE, PARIS13]) {
      const d = decileDuLoyer(loyerDe(code)!.euroParM2.central)
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(10)
    }
    // Paris 13e est nettement plus cher que Limoges : son décile est plus haut.
    expect(decileDuLoyer(loyerDe(PARIS13)!.euroParM2.central)).toBeGreaterThan(
      decileDuLoyer(loyerDe(LIMOGES)!.euroParM2.central),
    )
  })

  it('range les extrêmes en « rare » et le centre en « courante »', () => {
    expect(rareteDuDecile(1)).toBe('rare')
    expect(rareteDuDecile(10)).toBe('rare')
    expect(rareteDuDecile(2)).toBe('peu-frequente')
    expect(rareteDuDecile(9)).toBe('peu-frequente')
    expect(rareteDuDecile(5)).toBe('courante')
  })
})

describe('carte « écart »', () => {
  it('n’existe pas tant qu’il n’y a pas deux villes à comparer', () => {
    expect(carteEcart([])).toBeNull()
    expect(carteEcart([LIMOGES])).toBeNull()
  })

  it('chiffre la vraie différence entre la moins chère et la plus chère', () => {
    const bas = loyerDe(LIMOGES)!.euroParM2.central
    const haut = loyerDe(PARIS13)!.euroParM2.central
    const attendu = Math.round((haut - bas) * SURFACE_TYPE)
    const carte = carteEcart([PARIS13, TOULOUSE, LIMOGES])
    expect(carte!.valeur).toContain(attendu.toLocaleString('fr-FR'))
    expect(carte!.detail).toContain('Limoges')
    expect(carte!.provenance).toContain(MILLESIME_LOYERS)
  })

  it('ignore une commune sans loyer plutôt que de la compter pour zéro', () => {
    expect(carteEcart([LIMOGES, INCONNUE])).toBeNull()
  })
})

describe('la collection', () => {
  it('n’ajoute jamais deux fois la même carte ni ne réécrit sa date', () => {
    const debut: Obtention[] = [{ id: idVille(LIMOGES), le: '2026-01-01' }]
    const apres = ajouter(debut, [idVille(LIMOGES), idVille(TOULOUSE)], '2026-09-20')
    expect(apres).toHaveLength(2)
    expect(apres.find((o) => o.id === idVille(LIMOGES))!.le).toBe('2026-01-01')
    expect(apres.find((o) => o.id === idVille(TOULOUSE))!.le).toBe('2026-09-20')
    // L'ancienne liste n'est pas modifiée.
    expect(debut).toHaveLength(1)
  })

  it('retrouve les villes qu’elle contient', () => {
    const c: Obtention[] = [
      { id: idVille(LIMOGES), le: '2026-09-20' },
      { id: idEtape('detail'), le: '2026-09-20' },
    ]
    expect(villesDe(c)).toEqual([LIMOGES])
  })

  it('affiche l’écart d’abord, puis les étapes, puis les villes triées', () => {
    const c: Obtention[] = [
      { id: idVille(PARIS13), le: '2026-09-20' },
      { id: idEtape('detail'), le: '2026-09-20' },
      { id: idVille(LIMOGES), le: '2026-09-20' },
    ]
    const cartes = cartesDe(c)
    expect(cartes[0]!.famille).toBe('ecart')
    expect(cartes[1]!.id).toBe(idEtape('detail'))
    expect(cartes.slice(2).map((x) => x.titre)).toEqual(['Limoges', 'Paris 13e'])
  })

  it('ignore une obtention dont la carte n’existe plus', () => {
    // Une commune retirée d'un millésime ne doit pas afficher une carte vide.
    const cartes = cartesDe([{ id: idVille(INCONNUE), le: '2026-09-20' }])
    expect(cartes).toEqual([])
  })
})

describe('ce qu’une visite débloque', () => {
  const vide: Activite = {
    communesChiffrees: [],
    detailOuvert: false,
    bulletinLu: false,
    academieEleve: null,
    academiesRegardees: [],
  }

  it('ne donne rien quand aucun reste-à-vivre n’a été calculé', () => {
    // Sans compte, l'aperçu ne chiffre rien : il ne doit rien débloquer.
    expect(cartesGagnees(vide)).toEqual([])
  })

  it('donne la ville et le premier budget dès un calcul', () => {
    const g = cartesGagnees({ ...vide, communesChiffrees: [LIMOGES] })
    expect(g).toContain(idVille(LIMOGES))
    expect(g).toContain(idEtape('premier-budget'))
    expect(g).not.toContain(idEtape('trois-villes'))
  })

  it('compte les villes distinctes, pas les formations', () => {
    // Trois formations dans la même ville, ce n'est pas trois villes.
    const g = cartesGagnees({ ...vide, communesChiffrees: [LIMOGES, LIMOGES, LIMOGES] })
    expect(g).not.toContain(idEtape('trois-villes'))
    const h = cartesGagnees({ ...vide, communesChiffrees: [LIMOGES, TOULOUSE, PARIS13] })
    expect(h).toContain(idEtape('trois-villes'))
  })

  it('écarte une commune sans loyer connu', () => {
    expect(cartesGagnees({ ...vide, communesChiffrees: [INCONNUE] })).toEqual([])
  })

  it('ne décerne « hors de ton académie » que si l’on connaît la sienne', () => {
    const sansAcademie = cartesGagnees({
      ...vide,
      communesChiffrees: [LIMOGES],
      academiesRegardees: ['Toulouse'],
    })
    expect(sansAcademie).not.toContain(idEtape('hors-academie'))

    const avec = cartesGagnees({
      ...vide,
      communesChiffrees: [LIMOGES],
      academieEleve: 'Limoges',
      academiesRegardees: ['Limoges', 'Toulouse'],
    })
    expect(avec).toContain(idEtape('hors-academie'))

    const memeAcademie = cartesGagnees({
      ...vide,
      communesChiffrees: [LIMOGES],
      academieEleve: 'Limoges',
      academiesRegardees: ['Limoges', ''],
    })
    expect(memeAcademie).not.toContain(idEtape('hors-academie'))
  })
})

describe('stockage', () => {
  const original = Reflect.get(globalThis, 'window') as unknown

  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'window')
    else Reflect.set(globalThis, 'window', original)
  })

  function fausseFenetre(valeur: string | null, leve = false): void {
    Reflect.set(globalThis, 'window', {
      localStorage: {
        getItem: () => {
          if (leve) throw new Error('stockage bloqué')
          return valeur
        },
        setItem: () => {
          if (leve) throw new Error('stockage bloqué')
        },
      },
    })
  }

  it('rend une collection vide quand le stockage est refusé', () => {
    // Navigation privée, stockage bloqué : la page doit s'afficher quand même.
    fausseFenetre(null, true)
    expect(chargerCollection()).toEqual([])
    expect(() => enregistrerCollection([{ id: 'x', le: '2026-09-20' }])).not.toThrow()
  })

  it('rend une collection vide quand le contenu est illisible', () => {
    fausseFenetre('ceci n’est pas du JSON')
    expect(chargerCollection()).toEqual([])
    fausseFenetre('{"pas":"un tableau"}')
    expect(chargerCollection()).toEqual([])
  })

  it('écarte les entrées mal formées sans jeter les bonnes', () => {
    fausseFenetre(
      JSON.stringify([{ id: idVille(LIMOGES), le: '2026-09-20' }, { id: 42 }, null, 'x']),
    )
    expect(chargerCollection()).toEqual([{ id: idVille(LIMOGES), le: '2026-09-20' }])
  })
})

describe('export et import', () => {
  it('font l’aller-retour sans perte', () => {
    const c: Obtention[] = [
      { id: idVille(LIMOGES), le: '2026-09-20' },
      { id: idEtape('bulletin'), le: '2026-09-21' },
    ]
    expect(importer(exporter(c))).toEqual(c)
  })

  it('refusent un fichier qui n’en est pas un', () => {
    expect(importer('n’importe quoi')).toBeNull()
    expect(importer('{"version":1}')).toBeNull()
    expect(importer('null')).toBeNull()
  })
})

describe('les cartes ne se gagnent jamais par parrainage', () => {
  // Ce n'est pas une préférence de style : récompenser un mineur pour en
  // recruter d'autres obligerait à savoir qui a invité qui, donc à construire
  // un graphe social d'élèves — ce que la règle 3 de CLAUDE.md interdit. Le
  // choix est structurel, ce test le rend permanent.
  const SRC = resolve(import.meta.dirname, '..')

  function sources(dossier: string): string[] {
    const trouves: string[] = []
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree)
      if (statSync(chemin).isDirectory()) {
        if (entree === '__tests__' || entree === 'images') continue
        trouves.push(...sources(chemin))
      } else if (/\.tsx?$/.test(entree)) {
        trouves.push(chemin)
      }
    }
    return trouves
  }

  it('aucun code de parrainage, de filleul ni de lien de suivi dans le front', () => {
    const fautifs: string[] = []
    for (const fichier of sources(SRC)) {
      const texte = readFileSync(fichier, 'utf8')
      // On cherche les identifiants du mécanisme, pas les commentaires qui
      // expliquent pourquoi il n'existe pas : d'où le « // » exclu en amont.
      for (const ligne of texte.split('\n')) {
        const code = ligne.replace(/^\s*(\/\/|\*|\/\*).*$/, '')
        if (/\b(parrain\w*|filleul\w*|referral|refCode|utm_)\b/i.test(code)) {
          fautifs.push(`${fichier.replace(`${SRC}/`, '')} → ${ligne.trim()}`)
        }
      }
    }
    expect(
      fautifs,
      'Une carte doit se gagner en se servant du site, jamais en invitant ' +
        'quelqu’un : un parrainage supposerait de relier des élèves entre eux.',
    ).toEqual([])
  })
})
