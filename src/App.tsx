import { useState } from 'react'
import type {
  Classe,
  Domaine,
  Formation,
  Matiere,
  ProfilEtudiant,
  Region,
  Specialite,
} from './types'
import { FORMATIONS } from './data/formations'
import { chargerFormations } from './data/opendata'
import {
  DOMAINES,
  LABELS_DOMAINE,
  LABELS_MATIERE,
  LABELS_SPECIALITE,
  MATIERES,
  REGIONS,
  SPECIALITES,
} from './data/labels'
import { simulerToutes } from './engine/simulate'
import { chargerPrix, type PrixFormation } from './data/prix'
import { chargerAvis, type AvisEcole } from './data/avis'
import { chargerConseil, type Conseil } from './data/conseil'
import {
  analyserBulletin,
  type AnalyseBulletin,
} from './data/bulletin'
import Stepper from './components/Stepper'
import Resultats from './components/Resultats'
import Accueil from './components/Accueil'

const ETAPES = ['Résultats', 'Localisation', 'Passions', 'Motivation']

const PROFIL_INITIAL: ProfilEtudiant = {
  classe: 'terminale',
  souhaits: '',
  specialites: [],
  notes: {},
  region: null,
  mobilite: false,
  passions: [],
  motivation: 5,
  coherenceProjet: 5,
}

type Statut = 'formulaire' | 'chargement' | 'resultats' | 'erreur'

export default function App() {
  const [vue, setVue] = useState<'accueil' | 'app'>('accueil')
  const [etape, setEtape] = useState(0)
  const [profil, setProfil] = useState<ProfilEtudiant>(PROFIL_INITIAL)
  const [statut, setStatut] = useState<Statut>('formulaire')
  const [formations, setFormations] = useState<Formation[]>([])
  const [sourceReelle, setSourceReelle] = useState(true)
  const [prix, setPrix] = useState<Map<string, PrixFormation>>(new Map())
  const [avis, setAvis] = useState<Map<string, AvisEcole>>(new Map())
  const [conseil, setConseil] = useState<Conseil | null>(null)
  const [bulletin, setBulletin] = useState<AnalyseBulletin | null>(null)
  const [bulletinStatut, setBulletinStatut] = useState<
    'idle' | 'analyse' | 'erreur'
  >('idle')
  const [bulletinErreur, setBulletinErreur] = useState('')

  const importerBulletin = async (fichier: File) => {
    setBulletinStatut('analyse')
    setBulletinErreur('')
    const res = await analyserBulletin(fichier)
    if (!res.ok) {
      setBulletinStatut('erreur')
      setBulletinErreur(res.erreur)
      return
    }
    setBulletin(res.analyse)
    setBulletinStatut('idle')
    // Pré-remplit les notes extraites.
    setProfil((p) => ({ ...p, notes: { ...p.notes, ...res.analyse.notes } }))
  }

  const lancerSimulation = async () => {
    setStatut('chargement')
    let liste: Formation[]
    try {
      // Données officielles en direct (open data fr-esr-parcoursup).
      // Si l'étudiant n'est pas mobile, on cible sa région pour prioriser le secteur.
      const reelles = await chargerFormations({
        region: profil.mobilite ? null : profil.region,
        limite: 300,
      })
      if (reelles.length === 0) throw new Error('Aucune formation renvoyée')
      liste = reelles
      setSourceReelle(true)
    } catch {
      // Repli sur l'échantillon local si l'API est indisponible.
      liste = FORMATIONS
      setSourceReelle(false)
    }
    setFormations(liste)
    setStatut('resultats')
    setConseil(null)

    // Prix des écoles récupérés côté serveur (scraping) pour les mieux classées.
    const resultats = simulerToutes(liste, profil)
    const top = resultats.slice(0, 24).map((r) => r.formation)
    chargerPrix(top)
      .then((mapPrix) => {
        setPrix(mapPrix)
        // Conseils personnalisés (IA côté serveur si configurée, sinon règles).
        return chargerConseil(profil, resultats, mapPrix, bulletin)
      })
      .then(setConseil)
      .catch(() => setConseil(null))

    // Avis Google (note ⭐) récupérés en parallèle ; repli silencieux si absent.
    setAvis(new Map())
    chargerAvis(top)
      .then(setAvis)
      .catch(() => setAvis(new Map()))
  }

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

  const MAX_SPECIALITES = 3
  const toggleSpecialite = (s: Specialite) => {
    setProfil((p) => {
      if (p.specialites.includes(s))
        return { ...p, specialites: p.specialites.filter((x) => x !== s) }
      if (p.specialites.length >= MAX_SPECIALITES) return p // limite atteinte
      return { ...p, specialites: [...p.specialites, s] }
    })
  }

  if (vue === 'accueil') {
    return <Accueil onCommencer={() => setVue('app')} />
  }

  if (statut === 'chargement') {
    return (
      <div className="app">
        <header className="hero">
          <h1>Simulation en cours…</h1>
        </header>
        <div className="card">
          <div className="loading">
            <div className="spinner" />
            Interrogation des données officielles Parcoursup…
          </div>
        </div>
      </div>
    )
  }

  if (statut === 'resultats') {
    const resultats = simulerToutes(formations, profil)
    return (
      <div className="app">
        <header className="hero">
          <h1>Vos résultats</h1>
        </header>
        {!sourceReelle && (
          <div className="error-box" style={{ marginBottom: '1.25rem' }}>
            ⚠️ Les données officielles n'ont pas pu être chargées (réseau ou API
            indisponible). Résultats calculés sur un échantillon de démonstration.
          </div>
        )}
        <Resultats
          resultats={resultats}
          prix={prix}
          avis={avis}
          conseil={conseil}
          sourceReelle={sourceReelle}
          onRecommencer={() => {
            setStatut('formulaire')
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
              Indiquez votre classe, puis vos moyennes — ou importez directement
              votre bulletin.
            </p>

            <div className="field" style={{ maxWidth: 260, marginBottom: '1rem' }}>
              <label htmlFor="classe">Votre classe actuelle</label>
              <select
                id="classe"
                value={profil.classe}
                onChange={(e) =>
                  setProfil((p) => ({
                    ...p,
                    classe: e.target.value as Classe,
                  }))
                }
              >
                <option value="seconde">Seconde</option>
                <option value="premiere">Première</option>
                <option value="terminale">Terminale</option>
              </select>
            </div>

            <div className="bulletin-zone">
              <div>
                <strong>📄 Importer un bulletin</strong>
                <div className="bulletin-hint">
                  PDF ou image. L'IA extrait vos notes et analyse les
                  appréciations.
                </div>
              </div>
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                {bulletinStatut === 'analyse' ? 'Analyse…' : 'Choisir un fichier'}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  style={{ display: 'none' }}
                  disabled={bulletinStatut === 'analyse'}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) importerBulletin(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {bulletinStatut === 'erreur' && (
              <div className="error-box" style={{ margin: '0 0 1rem', padding: '0.75rem 1rem' }}>
                ⚠️ {bulletinErreur}
              </div>
            )}
            {bulletin && (
              <div className="bulletin-analyse">
                <div className="advice-tag">✦ Analyse du bulletin</div>
                <p>{bulletin.appreciationGlobale}</p>
                <div className="subscores">
                  <span>
                    Sérieux <b>{bulletin.signaux.serieux}/10</b>
                  </span>
                  <span>
                    Participation <b>{bulletin.signaux.participation}/10</b>
                  </span>
                  <span>
                    Progression <b>{bulletin.signaux.progression}/10</b>
                  </span>
                </div>
              </div>
            )}

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

            <div style={{ marginTop: '1.4rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                {profil.classe === 'seconde'
                  ? 'Spécialités envisagées'
                  : 'Vos spécialités'}{' '}
                — jusqu'à {MAX_SPECIALITES} ({profil.specialites.length}/
                {MAX_SPECIALITES})
              </label>
              <div className="chips">
                {SPECIALITES.map((s) => {
                  const on = profil.specialites.includes(s)
                  const bloque =
                    !on && profil.specialites.length >= MAX_SPECIALITES
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${on ? 'selected' : ''}`}
                      disabled={bloque}
                      style={
                        bloque
                          ? { opacity: 0.4, cursor: 'not-allowed' }
                          : undefined
                      }
                      onClick={() => toggleSpecialite(s)}
                    >
                      {LABELS_SPECIALITE[s]}
                    </button>
                  )
                })}
              </div>
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
            <div className="field" style={{ marginTop: '1.25rem' }}>
              <label htmlFor="souhaits">
                {profil.classe === 'seconde'
                  ? 'Vos souhaits (métiers, domaines qui vous attirent) — pour vous conseiller des spécialités'
                  : 'Votre projet / vos souhaits (facultatif)'}
              </label>
              <textarea
                id="souhaits"
                rows={3}
                placeholder={
                  profil.classe === 'seconde'
                    ? 'Ex. : j\'aimerais travailler dans la santé ou l\'informatique…'
                    : 'Ex. : devenir ingénieur, hésite entre prépa et BUT…'
                }
                value={profil.souhaits}
                onChange={(e) =>
                  setProfil((p) => ({ ...p, souhaits: e.target.value }))
                }
              />
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
            <button className="btn btn-primary" onClick={lancerSimulation}>
              Simuler mes chances 🚀
            </button>
          )}
        </div>
      </div>

      <footer className="footer">
        Données en direct de l'open data officiel Parcoursup
        (fr-esr-parcoursup) · outil pédagogique
      </footer>
    </div>
  )
}
