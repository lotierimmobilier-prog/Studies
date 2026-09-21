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

/**
 * Les bulletins PARTENT. Trois écrans juraient le contraire.
 *
 * ── Ce qui s'est passé ───────────────────────────────────────────────────
 *
 * Déposer un bulletin l'envoie à notre serveur, qui le transmet à l'API
 * Claude pour en lire les moyennes et les appréciations
 * (`web/src/donnees.ts` → `POST /api/bulletin-scolaire` →
 * `server/bulletinScolaire.ts`). Rien n'est écrit sur disque, et le texte
 * brut des appréciations n'est pas gardé — mais « non conservé » et
 * « jamais envoyé » ne sont pas la même phrase.
 *
 * C'est la seconde qui était écrite, à trois endroits :
 *
 *   - « tes notes, tes bulletins […] ne sont jamais envoyés » (compte.tsx,
 *     sous le bouton qui crée le compte) ;
 *   - « tes moyennes, tes bulletins et ton budget restent dans ton
 *     navigateur […] ils ne sont jamais envoyés » (accueil.tsx) ;
 *   - « ni tes notes, ni tes bulletins » sous le titre « Ce que nous ne
 *     savons pas de toi » (monCompte.tsx).
 *
 * Le bulletin d'un lycéen contient ses notes et les appréciations écrites
 * de ses professeurs. Promettre qu'il ne quitte pas l'appareil, à un
 * mineur, alors qu'il part chez un sous-traitant, est la promesse la plus
 * lourde que ce site ait faussement tenue — la quatrième trouvée ici.
 *
 * ── Ce que le test exige ─────────────────────────────────────────────────
 *
 * Que le mot « bulletin » n'apparaisse jamais dans une phrase qui promet
 * que quelque chose ne part pas, et que l'écran qui les mentionne dise ce
 * qui leur arrive.
 */
describe('aucun écran ne promet qu’un bulletin ne quitte pas l’appareil', () => {
  const ECRANS: readonly (readonly [string, string])[] = [
    ['compte.tsx', COMPTE],
    ['App.tsx', APP],
    ['accueil.tsx', ACCUEIL],
    ['monCompte.tsx', lire('monCompte.tsx')],
  ]

  /* Le JSX coupe une phrase là où la ligne se termine, pas où la phrase le
     veut : « il part\n            se faire lire ». Toute lecture de prose
     dans un .tsx doit donc replier les blancs avant de chercher quoi que ce
     soit, sinon le test échoue sur la mise en forme et pas sur le texte. */
  const prose = (source: string): string =>
    sansCommentaires(source).replace(/\s+/g, ' ')

  /** Ce qui promet qu'une chose ne part pas. */
  const NE_PART_PAS = /(jamais envoyés?|ne sont pas envoyés?|ne quitte(nt)? (pas|jamais))/i
  /** Ce qui, à côté, dit la vérité sur le sort d'un bulletin. */
  const CORRIGE = /(lu puis oublié|pas conservé|jamais enregistré|n’est enregistré nulle part|fait exception|part se faire lire)/i

  it('ne range jamais « bulletins » dans ce qui n’est jamais envoyé', () => {
    /* Un premier jet découpait par phrase et ne voyait rien : la promesse
       fautive s'étalait sur DEUX phrases — « Pas gardé : tes notes, tes
       bulletins, tes réponses au questionnaire. » puis « Ils restent dans ce
       navigateur et ne sont jamais envoyés. » Vérifié : le test passait au
       vert sur le texte exact qu'il devait refuser.
       
       On regarde donc une fenêtre autour du mot, pas une phrase, et on
       accepte la cohabitation uniquement si la correction est dans la même
       fenêtre. */
    const FENETRE = 260
    for (const [nom, source] of ECRANS) {
      const texte = prose(source)
      for (const m of texte.matchAll(/bulletins?/gi)) {
        const i = m.index ?? 0
        const autour = texte.slice(Math.max(0, i - FENETRE), i + FENETRE)
        if (!NE_PART_PAS.test(autour)) continue
        expect(
          CORRIGE.test(autour),
          `${nom} promet qu’un bulletin ne part pas, sans dire ce qui lui arrive :\n` +
            `« ${autour.trim()} »`,
        ).toBe(true)
      }
    }
  })

  it('les écrans qui parlent des bulletins disent ce qui leur arrive', () => {
    // Retirer la fausse promesse sans la remplacer laisserait un silence,
    // qui se lit comme l'ancienne promesse.
    for (const nom of ['compte.tsx', 'accueil.tsx', 'monCompte.tsx']) {
      const texte = prose(lire(nom))
      if (!/bulletin/i.test(texte)) continue
      expect(
        texte,
        `${nom} mentionne les bulletins sans dire qu’ils sont lus puis oubliés`,
      ).toMatch(/lu puis oublié|pas conservé|n’est enregistré nulle part|jamais enregistré|part se faire lire/i)
    }
  })

  it('les mentions légales, elles, l’expliquent en entier', () => {
    const legales = lire('../../packages/articles/src/mentionsLegales.ts')
    expect(legales).toMatch(/Anthropic/)
    expect(legales).toMatch(/bulletin/i)
  })
})
