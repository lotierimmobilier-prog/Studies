/**
 * Les trois encadrés de tête : géographique, stratégique, économique.
 *
 * Ils mettent en avant, ils ne filtrent pas — la liste complète reste en
 * dessous, et aucun vœu n'en est retiré (règle 4 de CLAUDE.md). Les trois
 * restent côte à côte, sans note globale qui les fondrait (règle 5).
 *
 * Chaque encadré porte son chiffre ET ce sur quoi il repose. Quand un choix
 * n'est pas possible, il le dit et propose l'action qui le débloquerait, au
 * lieu de disparaître.
 */

import { estUnChoix, type Critere, type Proposition } from './recommandations.ts'

const ENTETES: Record<Critere, { readonly titre: string; readonly sous: string }> = {
  geographique: {
    titre: 'Choix géographique',
    sous: 'La plus proche de chez toi',
  },
  strategique: {
    titre: 'Choix stratégique',
    sous: 'Pour tes études et la suite',
  },
  economique: {
    titre: 'Choix économique',
    sous: 'Là où ton budget tient',
  },
}

export function TroisChoix({
  propositions,
  localisationEnCours,
  onLocaliser,
  onInscrire,
}: {
  readonly propositions: readonly Proposition[]
  readonly localisationEnCours: boolean
  readonly onLocaliser: () => void
  readonly onInscrire: () => void
}) {
  return (
    <section className="choix-tete" aria-label="Trois façons de choisir">
      <h2 className="choix-tete-titre">Trois façons de choisir</h2>
      <p className="choix-tete-intro">
        Trois critères, jamais mélangés en une note unique. La liste complète reste
        en dessous : rien n’en est retiré.
      </p>

      <div className="choix-grille">
        {propositions.map((p, i) => {
          const entete = ENTETES[p.critere]
          return (
            <article className={`choix-carte choix-${p.critere}`} key={p.critere}>
              <span className="choix-rang">{i + 1}</span>
              <h3 className="choix-titre">{entete.titre}</h3>
              <p className="choix-sous">{entete.sous}</p>

              {estUnChoix(p) ? (
                <>
                  <p className="choix-valeur">{p.valeur}</p>
                  <p className="choix-formation">{p.resultat.formation.libelle}</p>
                  <p className="choix-etab">
                    {p.resultat.formation.etablissement} — {p.resultat.formation.ville}
                  </p>
                  <p className="choix-pourquoi">{p.pourquoi}</p>
                </>
              ) : (
                <>
                  <p className="choix-absent">{p.raison}</p>
                  {p.critere === 'geographique' ? (
                    <button
                      type="button"
                      className="secondaire choix-action"
                      onClick={onLocaliser}
                      disabled={localisationEnCours}
                    >
                      {localisationEnCours ? 'Localisation…' : 'Utiliser ma position'}
                    </button>
                  ) : null}
                  {p.critere === 'economique' ? (
                    <button type="button" className="secondaire choix-action" onClick={onInscrire}>
                      Créer mon compte
                    </button>
                  ) : null}
                </>
              )}
            </article>
          )
        })}
      </div>

      <p className="choix-confidentialite">
        Ta position sert uniquement à trier cette liste. Elle est comparée aux communes
        <strong> sur ton appareil</strong> et n’est envoyée à personne — ni à nous, ni à
        un service tiers.
      </p>
    </section>
  )
}
