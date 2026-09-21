import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Ce que le site PROMET doit rester vrai quand le code change.
 *
 * ── Ce qui s'est passé ───────────────────────────────────────────────────
 *
 * D1 a fait monter la liste de vœux au serveur — c'est ce qui permet de la
 * retrouver d'un appareil à l'autre. `accueil.tsx` a été réécrit en
 * conséquence. Deux autres textes ne l'ont pas été, et ont continué pendant
 * des jours à promettre l'inverse :
 *
 *   - « tes vœux […] restent dans ce navigateur et ne sont jamais envoyés »
 *     sur les écrans de connexion et d'inscription ;
 *   - « aucun vœu n'est enregistré » juste sous le bouton qui crée le compte.
 *
 * Une promesse de confidentialité fausse, faite à des mineurs, au moment
 * exact du consentement. Rien ne l'a signalée : aucun test ne lit les textes.
 *
 * ── Pourquoi le test porte sur les TEXTES et pas sur le code ─────────────
 *
 * Le code était juste : c'est le texte qui mentait. Un test qui vérifie que
 * `panier_voeu` existe n'aurait rien vu. Celui-ci lit ce que l'élève lit.
 */

const ICI = import.meta.dirname
function lire(fichier: string): string {
  return readFileSync(resolve(ICI, '..', fichier), 'utf8')
}

const COMPTE = lire('compte.tsx')
const APP = lire('App.tsx')
const VOEUX = lire('mesVoeux.tsx')
const ACCUEIL = lire('accueil.tsx')

/** Le texte visible, sans les commentaires de code qui parlent de la faute. */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

describe('aucun écran ne promet que les vœux restent dans le navigateur', () => {
  const ECRANS: readonly (readonly [string, string])[] = [
    ['compte.tsx', COMPTE],
    ['App.tsx', APP],
    ['mesVoeux.tsx', VOEUX],
    ['accueil.tsx', ACCUEIL],
  ]

  it('ne dit nulle part qu’aucun vœu n’est enregistré', () => {
    /* Les formulations exactes qui étaient affichées. Elles reviendraient
       telles quelles si quelqu'un « rétablissait » un texte depuis un
       ancien commit. */
    const menteuses = [
      /aucun vœu[^.]{0,40}n’est enregistré/i,
      /aucun vœu[^.]{0,40}n'est enregistré/i,
      /tes vœux[^.]{0,80}jamais envoyés/i,
    ]
    for (const [nom, source] of ECRANS) {
      const texte = sansCommentaires(source)
      for (const motif of menteuses) {
        expect(texte, `${nom} promet quelque chose de faux : ${motif}`).not.toMatch(motif)
      }
    }
  })

  it('les écrans de compte disent que la liste de vœux est gardée', () => {
    // Le pendant positif : retirer la phrase fausse sans la remplacer
    // laisserait un silence, qui se lit comme l'ancienne promesse.
    expect(COMPTE).toMatch(/liste de vœux/i)
    expect(APP).toMatch(/liste de vœux/i)
  })
})

describe('« Mes vœux » ne se fait pas passer pour Parcoursup', () => {
  it('dit que la liste ne part pas sur Parcoursup', () => {
    /* La page s'appelle « Mes vœux », plafonne à dix comme Parcoursup, et
       propose de « retirer » un vœu. Sans cette phrase, un élève de dix-sept
       ans peut croire ses vœux déposés — et s'en apercevoir après la date
       limite de confirmation. */
    const texte = sansCommentaires(VOEUX)
    expect(texte).toMatch(/ne part pas sur\s*\n?\s*Parcoursup/i)
    expect(texte).toMatch(/parcoursup\.gouv\.fr/)
  })

  it('le redit sur le bouton d’ajout, où l’on passe sans lire la page', () => {
    // On ajoute un vœu depuis une fiche de formation, pas depuis la liste :
    // la mise en garde doit être là aussi.
    expect(sansCommentaires(VOEUX)).toMatch(/pas un dépôt de vœux/i)
  })
})
