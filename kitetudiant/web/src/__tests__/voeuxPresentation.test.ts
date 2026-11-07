import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * La page des vœux reprend la présentation de l'atelier de lettre.
 *
 * ── Pourquoi les deux écrans se ressemblent ──────────────────────────────
 *
 * Parce qu'ils posent le même problème : une colonne de travail longue, et un
 * récapitulatif — combien il en reste, ce qui n'est pas enregistré — qu'on ne
 * voyait qu'en arrivant tout en bas.
 *
 * Ce fichier tient ce qui, dans cette ressemblance, n'est pas décoratif : une
 * phrase encadrée veut dire la même chose sur les deux écrans, l'ordre du code
 * reste celui du parcours, et la grille ne reprend pas le piège appris sur
 * l'atelier.
 */

const SRC = resolve(import.meta.dirname, '..')
const ECRAN = readFileSync(resolve(SRC, 'mesVoeux.tsx'), 'utf8')
/* Commentaires retirés : les règles ci-dessous nomment précisément ce qu'il
   ne faut pas écrire, et un test qui s'attrape sur sa propre explication ne
   prouve rien. */
const CSS = readFileSync(resolve(SRC, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')

describe('la phrase qui évite le malentendu est encadrée', () => {
  it('« elle ne part pas sur Parcoursup » n’est plus dans le chapô', () => {
    /* Elle y était, en gras au milieu d'un paragraphe gris — c'est-à-dire à
       l'endroit exact qu'on saute. Encadrée, elle a le poids de ce qu'elle
       évite : un élève de dix-sept ans qui croit ses vœux déposés, et s'en
       aperçoit après la date limite de confirmation. */
    const encadre = /<p className="voeux-avertissement">[\s\S]*?<\/p>/.exec(ECRAN)
    expect(encadre, 'l’encadré a disparu de l’écran').not.toBeNull()
    expect(encadre![0]).toMatch(/ne part pas sur\s*\n?\s*Parcoursup/i)
    expect(encadre![0]).toMatch(/parcoursup\.gouv\.fr/)
  })

  it('partage sa mise en forme avec l’avertissement du ministère', () => {
    /* Deux écrans, un seul traitement : une phrase encadrée doit vouloir dire
       la même chose partout, sinon elle ne veut plus rien dire nulle part.
       Une règle séparée finirait par dériver de l'autre. */
    /* Le test vise la RÈGLE partagée, pas l'ordre des sélecteurs : la page des
       cartes est venue s'y ajouter, et un motif qui exigeait « .voeux-
       avertissement juste avant l'accolade » l'a fait virer au rouge pour un
       élargissement qui allait dans le bon sens. */
    const partagee = [...CSS.matchAll(/([^@{};]+)\{/g)]
      .map((m) => m[1]!.split(',').map((x) => x.trim().split('\n').pop()!.trim()))
      .find((sels) => sels.includes('.lettre-avertissement'))
    expect(partagee, 'la règle de l’encadré a disparu').not.toBeUndefined()
    expect(
      partagee,
      'la page des vœux ne partage plus la règle : les deux encadrés vont dériver',
    ).toContain('.voeux-avertissement')
  })
})

describe('les deux colonnes', () => {
  it('gardent l’ordre du parcours dans le code', () => {
    /* La grille déplace la colonne, pas le balisage. Remonter le
       récapitulatif avant la liste le placerait au même endroit sur un grand
       écran — et AVANT la liste sur un téléphone et dans un lecteur d'écran,
       c'est-à-dire ferait lire le décompte avant ce qu'il compte. */
    const liste = ECRAN.indexOf('<ol className="voeux">')
    const recap = ECRAN.indexOf('voeux-cote')
    expect(liste).toBeGreaterThan(-1)
    expect(recap).toBeGreaterThan(liste)
  })

  it('ne ramènent pas la colonne du récapitulatif à la hauteur de son contenu', () => {
    /* `align-items: start` paraît juste — la colonne de droite est la plus
       courte — et annule ce pour quoi elle existe : une case de grille réduite
       à son contenu n'offre aucune course au `position: sticky` qu'elle
       contient. Appris au navigateur sur l'atelier de lettre, où le compteur
       repartait hors de l'écran au premier défilement. */
    for (const regle of CSS.match(/\.voeux-atelier \{[^}]*\}/g) ?? []) {
      expect(regle, 'le récapitulatif ne suivra plus le défilement').not.toMatch(
        /align-items:\s*(start|flex-start)/,
      )
    }
  })

  it('posent le récapitulatif SOUS la barre du haut, pas derrière', () => {
    const collee = /\.voeux-cote-collee \{[\s\S]*?\}/.exec(CSS)
    expect(collee, 'la colonne collée a disparu de la feuille').not.toBeNull()
    expect(collee![0]).toContain('position: sticky')
    const top = /top:\s*([\d.]+)rem/.exec(collee![0])
    expect(top, 'le décalage sous la barre du haut n’est plus exprimé en rem').not.toBeNull()
    expect(Number(top![1]), 'top trop petit : le récapitulatif passera sous la barre')
      .toBeGreaterThan(3.9)
  })
})

describe('la jauge des dix vœux', () => {
  it('compte jusqu’au plafond, pas jusqu’au nombre de vœux', () => {
    /* Une jauge longue de trois crans quand on a trois vœux ne dit rien : ce
       qu'on veut voir, c'est la place qu'il reste. */
    expect(ECRAN).toMatch(/Array\.from\(\{ length: VOEUX_MAX \}/)
  })

  it('n’est pas relue à qui écoute la page', () => {
    // La phrase « 3 vœux sur 10 — il t'en reste 7 à poser » la dit déjà.
    const jauge = /<ol className="voeux-jauge"[^>]*>/.exec(ECRAN)
    expect(jauge, 'la jauge a disparu de l’écran').not.toBeNull()
    expect(jauge![0]).toContain('aria-hidden="true"')
  })

  it('dit ce qu’il reste, et ce que « plein » veut dire', () => {
    /* « 10 sur 10 » tout seul se lit comme une erreur. Dire que la liste est
       pleine COMME SUR PARCOURSUP explique le plafond au lieu de le subir. */
    expect(ECRAN).toMatch(/il t’en reste \$\{VOEUX_MAX - voeux\.length\}/)
    expect(ECRAN).toMatch(/la liste est pleine, comme sur Parcoursup/)
  })
})
