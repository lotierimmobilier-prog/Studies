import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Les grandes illustrations sont des fichiers embarqués dans le dépôt. Trois
 * choses peuvent mal tourner sans que rien ne le signale, et ce sont les trois
 * que ce fichier surveille.
 *
 *   1. Un chemin écrit en dur (« /images/campus.webp ») vise la racine du
 *      serveur. Le site est servi sous « /kitetudiant/ » : l'image revient en
 *      404, la page s'affiche avec un cadre vide, et rien n'échoue au build.
 *      C'est exactement le défaut qui avait cassé tous les appels à l'API le
 *      19/09/2026 (cf. baseApi.test.ts). L'import ES, lui, passe par Vite, qui
 *      préfixe l'URL avec la base de déploiement.
 *   2. Un fichier qui n'est plus référencé reste dans le dépôt et continue de
 *      peser — plusieurs centaines de kilo-octets chacun ici.
 *   3. Une balise `img` sans `width`/`height` laisse le texte sauter quand
 *      l'image arrive, et sans `alt` elle est annoncée par un lecteur d'écran
 *      comme un élément inconnu au milieu d'une phrase.
 */

const SRC = resolve(import.meta.dirname, '..')
const IMAGES = resolve(SRC, 'images')

function fichiersSources(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) {
      if (entree === '__tests__' || entree === 'images') continue
      trouves.push(...fichiersSources(chemin))
    } else if (/\.tsx?$/.test(entree)) {
      trouves.push(chemin)
    }
  }
  return trouves
}

const SOURCES = fichiersSources(SRC)
const CONTENUS = new Map(SOURCES.map((f) => [f, readFileSync(f, 'utf8')]))
const FICHIERS_IMAGE = readdirSync(IMAGES).filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f))

describe('les illustrations embarquées', () => {
  it('existent bel et bien, sinon ces tests ne protègent rien', () => {
    expect(FICHIERS_IMAGE.length).toBeGreaterThan(0)
  })

  it.each(FICHIERS_IMAGE)('%s est importée par au moins un fichier', (fichier) => {
    const importee = [...CONTENUS.values()].some((source) =>
      source.includes(`./images/${fichier}`),
    )
    expect(
      importee,
      `kitetudiant/web/src/images/${fichier} n'est importée nulle part : elle ` +
        `alourdit le dépôt sans jamais s'afficher. Supprime-la, ou sers-t'en.`,
    ).toBe(true)
  })

  it('reconnaît un chemin fautif quand il y en a un', () => {
    // Garde-fou : sans lui, un resserrement de l'expression régulière pourrait
    // vider le test ci-dessous sans que rien ne le signale.
    const fautif = (source: string): string[] =>
      [...source.matchAll(/['"`]([^'"`\n]*\.(?:webp|png|jpe?g|avif|svg))['"`]/gi)]
        .map((m) => m[1]!)
        .filter((c) => !c.startsWith('./') && c.includes('/'))
    expect(fautif(`const a = "/images/campus.webp"`)).toEqual(['/images/campus.webp'])
    expect(fautif(`const b = "https://cdn.exemple.fr/x.png"`)).toEqual([
      'https://cdn.exemple.fr/x.png',
    ])
    expect(fautif(`import c from './images/campus.webp'`)).toEqual([])
    expect(fautif('const d = `kitetudiant-limoges.png`')).toEqual([])
  })

  it('ne sont jamais désignées par un chemin écrit en dur', () => {
    const fautifs: string[] = []
    for (const [fichier, source] of CONTENUS) {
      // Une chaîne littérale qui ressemble à un CHEMIN d'image — elle contient
      // une barre oblique — et qui ne commence pas par « ./ » : soit une URL
      // absolue du site (cassée sous un sous-chemin), soit une adresse chez un
      // tiers (interdite, elle communiquerait l'adresse IP de l'élève).
      //
      // La barre oblique est ce qui distingue un chemin d'un simple nom de
      // fichier. Sans elle, ce test signalait le nom proposé au téléchargement
      // d'une carte partagée (« kitetudiant-limoges.png ») : ce n'est pas une
      // ressource à charger, rien ne part le chercher.
      for (const m of source.matchAll(/['"`]([^'"`\n]*\.(?:webp|png|jpe?g|avif|svg))['"`]/gi)) {
        const chemin = m[1]!
        if (chemin.startsWith('./')) continue
        if (!chemin.includes('/')) continue
        const ligne = source.slice(0, m.index).split('\n').length
        fautifs.push(`${fichier.replace(`${SRC}/`, '')}:${ligne} → ${chemin}`)
      }
    }
    expect(
      fautifs,
      'Une image doit être importée (« import x from \'./images/… \' ») pour que ' +
        'Vite lui applique la base de déploiement et l’embarque dans le paquet. ' +
        'Un chemin absolu revient en 404 sous « /kitetudiant/ » ; une URL ' +
        'externe enverrait l’adresse IP de chaque élève à un service tiers.',
    ).toEqual([])
  })
})

describe('chaque balise image', () => {
  const BALISES: { readonly fichier: string; readonly ligne: number; readonly texte: string }[] = []
  for (const [fichier, source] of CONTENUS) {
    for (const m of source.matchAll(/<img\b[\s\S]*?\/>/g)) {
      BALISES.push({
        fichier: fichier.replace(`${SRC}/`, ''),
        ligne: source.slice(0, m.index).split('\n').length,
        texte: m[0],
      })
    }
  }

  it('il y en a au moins une à vérifier', () => {
    expect(BALISES.length).toBeGreaterThan(0)
  })

  it.each(BALISES.map((b) => [`${b.fichier}:${b.ligne}`, b.texte] as const))(
    '%s réserve sa place',
    (_ou, texte) => {
      // width et height : la place est réservée avant le chargement, le texte
      // ne saute pas au moment où l'image arrive.
      expect(texte).toMatch(/\bwidth=/)
      expect(texte).toMatch(/\bheight=/)
    },
  )

  it.each(BALISES.map((b) => [`${b.fichier}:${b.ligne}`, b.texte] as const))(
    '%s dit clairement si elle porte du sens',
    (_ou, texte) => {
      // Toute image a un `alt`. Deux cas, et pas de troisième :
      //
      //   - décorative : alt vide ET aria-hidden, pour qu'un lecteur d'écran
      //     la saute au lieu de l'annoncer comme un élément inconnu ;
      //   - porteuse de sens : un alt non vide, et surtout PAS aria-hidden,
      //     qui la masquerait justement à qui en a besoin.
      //
      // Ce test exigeait `alt=""` partout jusqu'au 20/09/2026 — vrai tant que
      // les seules images étaient des illustrations, faux dès l'arrivée du
      // logo, dont le nom du site doit être lu.
      expect(texte).toMatch(/\balt=/)
      const decorative = /\balt=""/.test(texte)
      const masquee = /\baria-hidden="true"/.test(texte)
      expect(
        decorative === masquee,
        decorative
          ? 'alt vide sans aria-hidden : elle sera annoncée comme une image sans nom.'
          : 'alt non vide avec aria-hidden : son texte ne sera jamais lu.',
      ).toBe(true)
    },
  )

  it('toute image lourde attend d’être vue', () => {
    // Au-delà de 100 Ko, une image ne doit pas partir avant qu'on la regarde.
    // En dessous, `loading` n'a pas de sens : le logo est dans l'en-tête et
    // doit arriver tout de suite.
    for (const b of BALISES) {
      const m = /src=\{(\w+)\}/.exec(b.texte)
      if (m === null) continue
      const source = CONTENUS.get(resolve(SRC, b.fichier)) ?? ''
      const imp = new RegExp(`import ${m[1]} from '\\./images/([^']+)'`).exec(source)
      if (imp === null) continue
      const poids = statSync(join(IMAGES, imp[1]!)).size
      if (poids > 100 * 1024) {
        expect(b.texte, `${b.fichier}:${b.ligne} pèse ${Math.round(poids / 1024)} Ko`).toMatch(
          /\bloading=/,
        )
      }
    }
  })

  it('le dossier d’images reste léger', () => {
    // Garde-fou de poids. Quatre illustrations dessinées y ont pesé 886 Ko
    // jusqu'au 20/09/2026 — pour des images que la page finissait par ne plus
    // afficher, et que Vite embarquait quand même. Une limite chiffrée rend
    // la prochaine dérive visible tout de suite.
    const total = FICHIERS_IMAGE.reduce((n, f) => n + statSync(join(IMAGES, f)).size, 0)
    expect(
      Math.round(total / 1024),
      `${FICHIERS_IMAGE.join(', ')} — au-delà de 300 Ko, il faut une bonne raison.`,
    ).toBeLessThan(300)
  })
})
