import { useState } from 'react'
import type { Domaine, Matiere, ProfilEtudiant, Region } from './types'
import { FORMATIONS } from './data/formations'
import {
  DOMAINES,
  LABELS_DOMAINE,
  LABELS_MATIERE,
  MATIERES,
  REGIONS,
} from './data/labels'
import { simulerToutes } from './engine/simulate'
import Stepper from './components/Stepper'
import Resultats from './components/Resultats'

const ETAPES = ['Résultats', 'Localisation', 'Passions', 'Motivation']

const PROFIL_INITIAL: ProfilEtudiant = {
  notes: {},
  region: null,
  mobilite: false,
  passions: [],
  motivation: 5,
  coherenceProjet: 5,
}

export default function App() {
  const [etape, setEtape] = useState(0)
  const [profil, setProfil] = useState<ProfilEtudiant>(PROFIL_INITIAL)
  const [termine, setTermine] = useState(false)

  const setNote = (matiere: Matiere, valeur: string) => {
    setProfil((p) => {
      const notes = { ...p.notes }
      if (valeur === '') {
        delete notes[matiere]
      } else {
        const n = Math.min(20, Math.max(0, Number(valeur)))
        notes[matiere] = n
      }
      return { ...p, notes }
    })
  }

  const togglePassion = (d: Domaine) => {
    setProfil((p) => ({
      ...p,
      passions: p.passions.includes(d)
        ? p.passions.filter((x) => x !== d)
        : [...p.passions, d],
    }))
  }

  const resultats = termine ? simulerToutes(FORMATIONS, profil) : []

  if (termine) {
    return (
      <div className="app">
        <header className="hero">
          <h1>Vos résultats</h1>
        </header>
        <Resultats
          resultats={resultats}
          onRecommencer={() => {
            setTermine(false)
            setEtape(0)
          }}
        />
        <footer className="footer">
          Simulateur d'admission Parcoursup · outil pédagogique
        </footer>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hero">
        <h1>Simulateur d'admission Parcoursup</h1>
        <p>
          Estimez vos chances d'être admis·e dans différentes formations selon
          vos résultats scolaires, votre localisation, vos passions et votre
          motivation.
        </p>
      </header>

      <Stepper etapes={ETAPES} courant={etape} />

      <div className="card">
        {etape === 0 && (
          <>
            <h2>Vos résultats scolaires</h2>
            <p className="subtitle">
              Indiquez vos moyennes sur 20 (laissez vide si non concerné·e).
            </p>
            <div className="grid">
              {MATIERES.map((m) => (
                <div className="field" key={m}>
                  <label htmlFor={m}>{LABELS_MATIERE[m]}</label>
                  <input
                    id={m}
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    placeholder="—"
                    value={profil.notes[m] ?? ''}
                    onChange={(e) => setNote(m, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {etape === 1 && (
          <>
            <h2>Votre localisation</h2>
            <p className="subtitle">
              Le secteur géographique influence l'accès à certaines licences.
            </p>
            <div className="field" style={{ maxWidth: 360 }}>
              <label htmlFor="region">Région de résidence</label>
              <select
                id="region"
                value={profil.region ?? ''}
                onChange={(e) =>
                  setProfil((p) => ({
                    ...p,
                    region: (e.target.value || null) as Region | null,
                  }))
                }
              >
                <option value="">— Choisir —</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={profil.mobilite}
                onChange={(e) =>
                  setProfil((p) => ({ ...p, mobilite: e.target.checked }))
                }
              />
              Je suis prêt·e à étudier dans une autre région (mobilité)
            </label>
          </>
        )}

        {etape === 2 && (
          <>
            <h2>Vos passions</h2>
            <p className="subtitle">
              Sélectionnez les domaines qui vous motivent le plus.
            </p>
            <div className="chips">
              {DOMAINES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${profil.passions.includes(d) ? 'selected' : ''}`}
                  onClick={() => togglePassion(d)}
                >
                  {LABELS_DOMAINE[d]}
                </button>
              ))}
            </div>
          </>
        )}

        {etape === 3 && (
          <>
            <h2>Votre motivation</h2>
            <p className="subtitle">
              Évaluez votre motivation et la cohérence de votre projet.
            </p>
            <div className="field" style={{ marginBottom: '1.25rem' }}>
              <label>Motivation pour vos études visées</label>
              <div className="range-row">
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={profil.motivation}
                  onChange={(e) =>
                    setProfil((p) => ({
                      ...p,
                      motivation: Number(e.target.value),
                    }))
                  }
                />
                <span className="range-value">{profil.motivation}/10</span>
              </div>
            </div>
            <div className="field">
              <label>Cohérence de votre projet d'orientation</label>
              <div className="range-row">
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={profil.coherenceProjet}
                  onChange={(e) =>
                    setProfil((p) => ({
                      ...p,
                      coherenceProjet: Number(e.target.value),
                    }))
                  }
                />
                <span className="range-value">{profil.coherenceProjet}/10</span>
              </div>
            </div>
          </>
        )}

        <div className="actions">
          <button
            className="btn btn-ghost"
            onClick={() => setEtape((e) => Math.max(0, e - 1))}
            disabled={etape === 0}
          >
            ← Précédent
          </button>
          {etape < ETAPES.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setEtape((e) => e + 1)}
            >
              Suivant →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setTermine(true)}>
              Simuler mes chances 🚀
            </button>
          )}
        </div>
      </div>

      <footer className="footer">
        Données d'exemple · Sources réelles (Parcoursup, data.gouv.fr, ONISEP) à
        intégrer
      </footer>
    </div>
  )
}
