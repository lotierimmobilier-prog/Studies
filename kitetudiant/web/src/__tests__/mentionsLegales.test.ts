import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  IDENTITE,
  LIENS_REMUNERES,
  SECTIONS,
} from '../../../packages/articles/src/mentionsLegales.ts'
import { cheminDe, routeDuChemin } from '../routes.ts'

/**
 * La page légale, et ce qu'elle promet.
 *
 * ── Pourquoi elle existe ─────────────────────────────────────────────────
 *
 * Il n'y avait AUCUNE page légale sur ce site : ni mentions légales, ni
 * politique de données. Pour un site français qui crée des comptes et
 * reçoit des bulletins scolaires de mineurs, ce n'est pas un oubli de
 * forme. Elle est née de la déclaration du lien rémunéré, qui devait bien
 * être écrite quelque part qui fasse foi.
 *
 * ── Ce que les tests protègent ───────────────────────────────────────────
 *
 * Deux choses, et elles tirent dans des sens opposés :
 *
 *   1. que la page reste TROUVABLE — une page légale qu'aucun lien ne mène
 *      et qu'aucun plan ne liste ne remplit pas son office ;
 *   2. que ses trous restent VISIBLES — une page qui a l'air complète parce
 *      qu'on a masqué ce qui manque ne sera jamais complétée.
 */

const SRC = resolve(import.meta.dirname, '..')
const PAGE = readFileSync(resolve(SRC, 'mentionsLegales.tsx'), 'utf8')
const PRERENDU = readFileSync(
  resolve(SRC, '..', '..', 'scripts', 'prerendre.ts'),
  'utf8',
)

describe('la page est atteignable', () => {
  it('a une adresse, qui se relit dans les deux sens', () => {
    expect(cheminDe({ vue: 'mentions' })).toMatch(/mentions-legales$/)
    expect(routeDuChemin(cheminDe({ vue: 'mentions' }))?.vue).toBe('mentions')
  })

  it('le pied de page y mène, sur l’accueil comme dans l’application', () => {
    /* C'est là qu'on va chercher des mentions légales, et le seul endroit
       où leur absence se remarque. */
    for (const nom of ['App.tsx', 'accueil.tsx']) {
      const source = readFileSync(resolve(SRC, nom), 'utf8')
      expect(source, `${nom} n’a pas de lien vers les mentions légales`).toMatch(
        /vue: 'mentions'/,
      )
    }
  })

  it('elle est au plan du site et dans llms.txt', () => {
    expect(PRERENDU).toContain('mentions-legales')
    const bloc = PRERENDU.slice(PRERENDU.indexOf("join(SORTIE, 'llms.txt')"))
    expect(bloc).toContain('mentions-legales')
  })

  it('elle n’est pas écartée des index', () => {
    // Elle est publique : la ranger parmi les chemins privés la rendrait
    // introuvable, ce qui est exactement le défaut qu'elle corrige.
    const prives = PRERENDU.slice(PRERENDU.indexOf('CHEMINS_PRIVES'))
    expect(prives.slice(0, prives.indexOf(']'))).not.toContain('mentions-legales')
  })
})

describe('ce qui manque se voit', () => {
  it('les faits d’identité inconnus valent null, et ne sont pas inventés', () => {
    /* « Ne pas inventer de valeurs de repli silencieuses » (CLAUDE.md). Une
       raison sociale plausible mais fausse dans des mentions légales est
       pire qu'une mention absente : l'absence se voit, l'invention non. */
    for (const [cle, valeur] of Object.entries(IDENTITE)) {
      expect(
        valeur === null || (typeof valeur === 'string' && valeur.trim().length > 0),
        `IDENTITE.${cle} vaut une chaîne vide : ni renseigné, ni déclaré manquant`,
      ).toBe(true)
    }
  })

  it('la page écrit « à compléter » à la place d’un null', () => {
    expect(PAGE).toMatch(/À compléter avant la mise en ligne/)
    expect(PAGE).toMatch(/valeur === null/)
  })

  it('elle avertit en haut tant qu’il reste des trous', () => {
    // Et l'avertissement disparaît tout seul une fois IDENTITE remplie :
    // rien à penser à retirer, donc rien à oublier de retirer.
    expect(PAGE).toMatch(/manquants > 0/)
    expect(PAGE).toMatch(/legal-avertissement/)
  })
})

describe('la déclaration du lien rémunéré', () => {
  const texte = LIENS_REMUNERES.corps.flat().join(' ')

  it('nomme le partenaire et dit qu’il verse une commission', () => {
    expect(texte).toMatch(/papernest/i)
    expect(texte).toMatch(/commission/i)
  })

  it('dit que le prix est le même et que comparer ne coûte rien', () => {
    expect(texte).toMatch(/gratuit/i)
    expect(texte).toMatch(/même prix|le même que|aucune commission/i)
  })

  it('ne chiffre aucune économie', () => {
    // Règle 1 : un euro affiché remonte à une ligne de calcul datée, et une
    // économie annoncée par un partenaire n'en a aucune.
    expect(texte).not.toMatch(/\d[\d  ]*(€|euros?\b)/i)
    expect(texte).not.toMatch(/\d+\s*%/)
  })

  it('dit que rien n’est réordonné pour des raisons commerciales', () => {
    /* C'est la question qu'un lecteur se pose vraiment en découvrant qu'un
       site d'orientation est rémunéré : est-ce que ça change ce qu'on me
       montre ? La réponse doit être écrite, pas déduite. */
    expect(texte).toMatch(/réordonné|mis en avant|raisons commerciales/i)
  })

  it('rappelle la majorité', () => {
    expect(texte).toMatch(/majorité|représentant légal|annulable/i)
  })

  it('distingue le lien payé de celui qui ne l’est pas', () => {
    /* La page porte deux logos. Déclarer « un seul lien commercial » sans
       dire lequel des deux l'est laisserait le lecteur deviner — et deviner
       de travers dans un sens comme dans l'autre. */
    expect(texte).toMatch(/leboncoin/i)
    expect(texte).toMatch(/n’est PAS rémunéré|pas rémunéré/i)
  })
})

describe('la section données décrit le code, pas les intentions', () => {
  const donnees = SECTIONS.find((s) => s.titre === 'Données personnelles')
  const texte = (donnees?.corps ?? []).flat().join(' ')

  it('nomme les sous-traitants, dont celui qui lit les bulletins', () => {
    /* Un bulletin part au serveur puis à l'API Claude
       (server/bulletinScolaire.ts). Le taire dans une politique de données
       serait exactement la faute que cette page répare ailleurs. */
    expect(texte).toMatch(/Anthropic/)
    expect(texte).toMatch(/France Travail/)
    expect(texte).toMatch(/IGN|geopf/)
  })

  it('distingue « non conservé » de « jamais envoyé »', () => {
    expect(texte).toMatch(/envoyé mais non conservé|n’est écrit sur aucun disque/i)
  })

  it('dit la durée de conservation et la voie de recours', () => {
    expect(texte).toMatch(/trois ans/)
    expect(texte).toMatch(/CNIL/)
  })
})
