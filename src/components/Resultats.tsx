import type { ResultatSimulation } from '../types'
import { LABELS_DOMAINE } from '../data/labels'
import { construireStrategie } from '../engine/strategie'
import { recommander } from '../engine/recommandation'
import { coutDeLaVie } from '../data/coutVie'
import { formaterPrix, type PrixFormation } from '../data/prix'
import { formaterAvis, type AvisEcole } from '../data/avis'
import type { Conseil } from '../data/conseil'

/** Puce « note Google ⭐ », rendue seulement si un avis est disponible. */
function NoteGoogle({ avis }: { avis?: AvisEcole }) {
  if (!avis) return null
  const libelle = formaterAvis(avis)
  if (!libelle) return null
  const contenu = (
    <>
      ⭐ {libelle} <span className="avis-src">· Google</span>
    </>
  )
  return avis.urlMaps ? (
    <a href={avis.urlMaps} target="_blank" rel="noreferrer" title="Voir sur Google Maps">
      {contenu}
    </a>
  ) : (
    <span title="Avis Google">{contenu}</span>
  )
}

/**
 * Probabilité déclinée dans la couleur unique (bleu, teinte 214) :
 * un bleu plus profond signale de meilleures chances.
 */
function couleurProba(p: number): string {
  const l = 66 - (p / 100) * 36 // 66% (faible) → 30% (élevé)
  return `hsl(214 82% ${l}%)`
}

function libelleChance(p: number): string {
  if (p >= 70) return 'Très favorable'
  if (p >= 50) return 'Favorable'
  if (p >= 30) return 'Incertain'
  return 'Difficile'
}

/** Carte détaillée d'une formation simulée. */
function ResultItem({
  r,
  prix,
  avis,
}: {
  r: ResultatSimulation
  prix?: PrixFormation
  avis?: AvisEcole
}) {
  return (
    <div className="result-item">
      <div className="result-head">
        <div>
          <div className="result-title">{r.formation.nom}</div>
          <div className="result-meta">
            {r.formation.etablissement} · {r.formation.ville}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="tag">{LABELS_DOMAINE[r.formation.domaine]}</span>
            <span className="tag">
              {r.formation.selectivite === 'selective'
                ? 'Sélective'
                : 'Non sélective'}
            </span>
            <span className="tag">
              Taux d'accès ~{r.formation.tauxAccesBase}%
            </span>
          </div>
        </div>
        <div className="proba">
          <div
            className="proba-value"
            style={{ color: couleurProba(r.probabilite) }}
          >
            {r.probabilite}%
          </div>
          <div className="proba-label">{libelleChance(r.probabilite)}</div>
        </div>
      </div>

      <div className="bar">
        <span
          style={{
            width: `${r.probabilite}%`,
            background: couleurProba(r.probabilite),
          }}
        />
      </div>

      <div className="subscores">
        <span>
          Académique <b>{r.details.academique}</b>
        </span>
        <span>
          Spécialités <b>{r.details.specialites}</b>
        </span>
        <span>
          Passion <b>{r.details.passion}</b>
        </span>
        <span>
          Motivation <b>{r.details.motivation}</b>
        </span>
        <span>
          Géo <b>{r.details.geographie}</b>
        </span>
      </div>

      {(() => {
        const cout = coutDeLaVie(r.formation.ville, r.formation.region)
        return (
          <div className="infos-reelles">
            {r.formation.statut && <span>🏛️ {r.formation.statut}</span>}
            <NoteGoogle avis={avis} />
            {prix ? (
              <span
                title={
                  prix.source === 'scrape'
                    ? "Prix récupéré sur le site de l'école"
                    : prix.source === 'curated'
                      ? 'Prix de référence'
                      : 'Estimation par catégorie'
                }
              >
                💶 {formaterPrix(prix)}
                {prix.source === 'scrape' && ' ✓'}
              </span>
            ) : (
              r.formation.prixIndicatif && (
                <span>💶 {r.formation.prixIndicatif}</span>
              )
            )}
            {r.formation.capacite !== undefined && (
              <span>🎓 {r.formation.capacite} places</span>
            )}
            {r.formation.ville && (
              <span title="Loyer moyen studio/T1, charges comprises (indicatif)">
                🏠 Loyer ~{cout.loyerStudio} €/mois à {r.formation.ville}
              </span>
            )}
            {r.formation.lienParcoursup && (
              <a
                href={r.formation.lienParcoursup}
                target="_blank"
                rel="noreferrer"
              >
                Fiche Parcoursup ↗
              </a>
            )}
          </div>
        )
      })()}

      {r.explications.length > 0 && (
        <ul className="explications">
          {r.explications.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Bandeau « écoles adaptées » : met en avant les formations qui collent le
 * mieux au profil (notes + spécialités + passions + région) tout en restant
 * accessibles, avec les raisons de la mise en avant.
 */
function Recommandations({
  resultats,
  prix,
  avis,
}: {
  resultats: ResultatSimulation[]
  prix?: Map<string, PrixFormation>
  avis?: Map<string, AvisEcole>
}) {
  const reco = recommander(resultats, 3)
  if (reco.length === 0) return null

  return (
    <section className="reco">
      <div className="reco-head">
        <span className="reco-tag">✨ Écoles adaptées à ton profil</span>
        <p className="subtitle" style={{ margin: '0.35rem 0 0' }}>
          Sélectionnées d'après tes notes, tes spécialités, tes passions et ta
          région — en gardant des chances réalistes. Le meilleur point de départ
          pour ta liste.
        </p>
      </div>
      <div className="reco-grid">
        {reco.map(({ resultat: r, raisons }, i) => {
          const cout = coutDeLaVie(r.formation.ville, r.formation.region)
          const p = prix?.get(r.formation.id)
          return (
            <article className="reco-card" key={r.formation.id}>
              <div className="reco-rank">#{i + 1}</div>
              <div className="reco-title">{r.formation.nom}</div>
              <div className="reco-meta">
                {r.formation.etablissement} · {r.formation.ville}
              </div>
              <div className="reco-scores">
                <span
                  className="reco-proba"
                  style={{ color: couleurProba(r.probabilite) }}
                >
                  {r.probabilite}% <small>de chances</small>
                </span>
                <span className="reco-adeq" title="Correspondance avec ton profil">
                  {r.adequation}/100 d'adéquation
                </span>
              </div>
              {raisons.length > 0 && (
                <ul className="reco-raisons">
                  {raisons.map((raison, j) => (
                    <li key={j}>{raison}</li>
                  ))}
                </ul>
              )}
              <div className="reco-facts">
                {p ? (
                  <span>💶 {formaterPrix(p)}</span>
                ) : (
                  r.formation.prixIndicatif && (
                    <span>💶 {r.formation.prixIndicatif}</span>
                  )
                )}
                <NoteGoogle avis={avis?.get(r.formation.id)} />
                <span>🏠 ~{cout.loyerStudio} €/mois</span>
                {r.formation.lienParcoursup && (
                  <a
                    href={r.formation.lienParcoursup}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Parcoursup ↗
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

interface ResultatsProps {
  resultats: ResultatSimulation[]
  prix?: Map<string, PrixFormation>
  avis?: Map<string, AvisEcole>
  conseil?: Conseil | null
  sourceReelle?: boolean
  onRecommencer: () => void
}

/** Résultats groupés en une liste de vœux équilibrée (plusieurs choix). */
export default function Resultats({
  resultats,
  prix,
  avis,
  conseil,
  sourceReelle = true,
  onRecommencer,
}: ResultatsProps) {
  const groupes = construireStrategie(resultats)

  return (
    <div className="card">
      {conseil && conseil.conseils.length > 0 && (
        <div className="advice">
          <div className="advice-tag">
            {conseil.source === 'ia' ? '✦ Conseil personnalisé (IA)' : '✦ Conseil personnalisé'}
          </div>
          {conseil.conseils.map((c, i) => (
            <p key={i}>{c}</p>
          ))}
        </div>
      )}

      <Recommandations resultats={resultats} prix={prix} avis={avis} />

      <h2>Votre liste de vœux conseillée</h2>
      <p className="subtitle">
        Pour maximiser vos chances, Parcoursup recommande une liste{' '}
        <strong>équilibrée</strong> : quelques vœux ambitieux, un socle de vœux
        réalistes, et des valeurs sûres. Voici plusieurs choix par catégorie.
        {sourceReelle && (
          <>
            {' '}
            Données issues de l'<strong>open data officiel Parcoursup</strong>.
          </>
        )}
      </p>

      {groupes.map((g) => (
        <section key={g.categorie} style={{ marginBottom: '1.75rem' }}>
          <h3 style={{ margin: '0 0 0.15rem' }}>
            {g.emoji} {g.titre}
          </h3>
          <p className="subtitle" style={{ margin: '0 0 0.9rem' }}>
            {g.description}
          </p>
          {g.resultats.map((r) => (
            <ResultItem
              key={r.formation.id}
              r={r}
              prix={prix?.get(r.formation.id)}
              avis={avis?.get(r.formation.id)}
            />
          ))}
        </section>
      ))}

      <div className="actions">
        <button className="btn btn-ghost" onClick={onRecommencer}>
          ← Modifier mon profil
        </button>
      </div>

      <p className="disclaimer">
        ⚠️ Ce simulateur est un outil pédagogique. Les probabilités sont des
        estimations calculées à partir d'un modèle simplifié et de données
        d'exemple. Elles ne préjugent pas des décisions réelles des formations
        Parcoursup.
      </p>
    </div>
  )
}
