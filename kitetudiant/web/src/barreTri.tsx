/**
 * La barre de classement et de filtres, au-dessus de la liste.
 *
 * ── Ce qu'elle doit rendre impossible ────────────────────────────────────
 *
 * Qu'une formation disparaisse sans que l'élève sache qu'elle a disparu.
 * C'est la règle 4 de CLAUDE.md, et c'est la seule raison pour laquelle
 * cette barre affiche en permanence le compte des formations écartées, avec
 * le bouton qui les ramène. Un filtre qui se contenterait de raccourcir la
 * liste serait indiscernable d'un algorithme qui cache.
 *
 * ── Des boutons, pas des menus déroulants ────────────────────────────────
 *
 * Pour trois ou quatre choix, un `select` demande deux gestes et masque les
 * options ; des boutons montrent tout de suite ce qui est possible et ce qui
 * est actif. La ville fait exception : elles se comptent par dizaines, et là
 * un `select` est le bon outil.
 *
 * ── L'état actif ─────────────────────────────────────────────────────────
 *
 * `aria-pressed` et non une classe seule : un lecteur d'écran annonce alors
 * « Ville, bouton bascule, activé ». La couleur ne dit rien à qui ne la voit
 * pas.
 */

import {
  CLASSEMENTS,
  comptesParSecteur,
  villesDe,
  type Classement,
  type Filtres,
  type Secteur,
} from './tri.ts'
import { nombre } from './nombres.ts'
import type { ResultatFormation } from './calcul.ts'

const SECTEURS: readonly { readonly cle: Secteur; readonly libelle: string }[] = [
  { cle: 'public', libelle: 'Public' },
  { cle: 'prive', libelle: 'Privé' },
]

export function BarreTri({
  resultats,
  classement,
  filtres,
  ecartes,
  onClassement,
  onFiltres,
}: {
  /** TOUS les résultats, avant filtre : c'est eux qui donnent les choix. */
  readonly resultats: readonly ResultatFormation[]
  readonly classement: Classement
  readonly filtres: Filtres
  /** Combien de formations le filtre écarte en ce moment. */
  readonly ecartes: number
  readonly onClassement: (c: Classement) => void
  readonly onFiltres: (f: Filtres) => void
}) {
  const villes = villesDe(resultats)
  const comptes = comptesParSecteur(resultats)

  return (
    <section className="barre-tri" aria-label="Classer et filtrer">
      <div className="barre-tri-groupe">
        <span className="barre-tri-titre" id="tri-classer">
          Classer par
        </span>
        <div className="barre-tri-boutons" role="group" aria-labelledby="tri-classer">
          {CLASSEMENTS.map((c) => (
            <button
              key={c.cle}
              type="button"
              className="barre-tri-choix"
              aria-pressed={classement === c.cle}
              onClick={() => onClassement(c.cle)}
            >
              {c.libelle}
            </button>
          ))}
        </div>
      </div>

      <div className="barre-tri-groupe">
        <span className="barre-tri-titre" id="tri-secteur">
          Établissement
        </span>
        <div className="barre-tri-boutons" role="group" aria-labelledby="tri-secteur">
          <button
            type="button"
            className="barre-tri-choix"
            aria-pressed={filtres.secteur === null}
            onClick={() => onFiltres({ ...filtres, secteur: null })}
          >
            Tous
          </button>
          {SECTEURS.map((s) => (
            <button
              key={s.cle}
              type="button"
              className="barre-tri-choix"
              aria-pressed={filtres.secteur === s.cle}
              onClick={() =>
                onFiltres({ ...filtres, secteur: filtres.secteur === s.cle ? null : s.cle })
              }
            >
              {s.libelle}
              <span className="barre-tri-compte"> {nombre(comptes[s.cle])}</span>
            </button>
          ))}
        </div>
      </div>

      {villes.length > 1 ? (
        <div className="barre-tri-groupe">
          <label className="barre-tri-titre" htmlFor="tri-ville">
            Ville
          </label>
          <select
            id="tri-ville"
            className="barre-tri-select"
            value={filtres.ville ?? ''}
            onChange={(ev) =>
              onFiltres({ ...filtres, ville: ev.target.value === '' ? null : ev.target.value })
            }
          >
            <option value="">Toutes les villes ({nombre(villes.length)})</option>
            {villes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Le compte des écartés n'est pas une politesse : sans lui, un filtre
          est indiscernable d'une formation retirée de la vue. */}
      {ecartes > 0 ? (
        <p className="barre-tri-ecartes">
          <span>
            {nombre(ecartes)} formation{ecartes > 1 ? 's' : ''} masquée
            {ecartes > 1 ? 's' : ''} par ton filtre — rien n’est supprimé.
          </span>
          <button
            type="button"
            className="barre-tri-tout"
            onClick={() => onFiltres({ secteur: null, ville: null })}
          >
            Tout afficher
          </button>
        </p>
      ) : null}

      {comptes.inconnu > 0 && filtres.secteur !== null ? (
        <p className="note barre-tri-note">
          {nombre(comptes.inconnu)} formation{comptes.inconnu > 1 ? 's' : ''} dont le
          statut n’est pas publié rest{comptes.inconnu > 1 ? 'ent' : 'e'} affichée
          {comptes.inconnu > 1 ? 's' : ''} : une donnée manquante n’est pas une réponse
          négative.
        </p>
      ) : null}
    </section>
  )
}
