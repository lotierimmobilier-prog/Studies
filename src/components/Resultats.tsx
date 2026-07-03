import type { ProfilEtudiant, ResultatSimulation } from '../types'
import { LABELS_DOMAINE } from '../data/labels'
import { construireStrategie } from '../engine/strategie'
import { coutDeLaVie } from '../data/coutVie'

function couleurProba(p: number): string {
  if (p >= 60) return 'var(--green)'
  if (p >= 30) return 'var(--amber)'
  return 'var(--red)'
}

function libelleChance(p: number): string {
  if (p >= 70) return 'Très favorable'
  if (p >= 50) return 'Favorable'
  if (p >= 30) return 'Incertain'
  return 'Difficile'
}

/** Carte détaillée d'une formation simulée. */
function ResultItem({ r }: { r: ResultatSimulation }) {
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
            {r.formation.prixIndicatif && (
              <span>💶 {r.formation.prixIndicatif}</span>
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

interface ResultatsProps {
  resultats: ResultatSimulation[]
  profil?: ProfilEtudiant
  sourceReelle?: boolean
  onRecommencer: () => void
}

/** Résultats groupés en une liste de vœux équilibrée (plusieurs choix). */
export default function Resultats({
  resultats,
  sourceReelle = true,
  onRecommencer,
}: ResultatsProps) {
  const groupes = construireStrategie(resultats)

  return (
    <div className="card">
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
            <ResultItem key={r.formation.id} r={r} />
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
