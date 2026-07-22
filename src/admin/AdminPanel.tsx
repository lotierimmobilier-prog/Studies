import { useState } from 'react'
import type { Configuration } from '../types'
import {
  enregistrerConfigAdmin,
  oublierJetonAdmin,
  synchroniserPlanning,
} from '../api'
import EditeurSejours from './EditeurSejours'
import EditeurMaison from './EditeurMaison'
import EditeurTutoriels from './EditeurTutoriels'
import EditeurTourisme from './EditeurTourisme'
import EditeurGalerie from './EditeurGalerie'

type Onglet = 'sejours' | 'maison' | 'galerie' | 'tutoriels' | 'tourisme'

const ONGLETS: { id: Onglet; libelle: string; icone: string }[] = [
  { id: 'sejours', libelle: 'Séjours', icone: '🗓️' },
  { id: 'maison', libelle: 'La maison', icone: '🏠' },
  { id: 'galerie', libelle: 'Galerie', icone: '📸' },
  { id: 'tutoriels', libelle: 'Tutoriels', icone: '🎬' },
  { id: 'tourisme', libelle: 'Tourisme', icone: '🧭' },
]

export default function AdminPanel({
  configInitiale,
  onDeconnexion,
}: {
  configInitiale: Configuration
  onDeconnexion: () => void
}) {
  const [config, setConfig] = useState<Configuration>(configInitiale)
  const [onglet, setOnglet] = useState<Onglet>('sejours')
  const [modifie, setModifie] = useState(false)
  const [etat, setEtat] = useState<'repos' | 'enregistrement' | 'ok' | 'erreur'>(
    'repos',
  )
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [syncEnCours, setSyncEnCours] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  function patch(p: Partial<Configuration>) {
    setConfig((c) => ({ ...c, ...p }))
    setModifie(true)
    setEtat('repos')
  }

  async function enregistrer() {
    setEtat('enregistrement')
    setMessageErreur(null)
    try {
      await enregistrerConfigAdmin(config)
      setModifie(false)
      setEtat('ok')
      setTimeout(() => setEtat('repos'), 2500)
    } catch (err) {
      setMessageErreur((err as Error).message)
      setEtat('erreur')
    }
  }

  async function synchroniser() {
    setSyncEnCours(true)
    setSyncMessage(null)
    try {
      // On enregistre d'abord (pour prendre en compte les liens iCal saisis).
      await enregistrerConfigAdmin(config)
      const { resultat, config: neuf } = await synchroniserPlanning()
      setConfig(neuf)
      setModifie(false)
      const parts = [
        `${resultat.ajouts} séjour(s) ajouté(s)`,
        `${resultat.misAJour} mis à jour`,
      ]
      if (resultat.erreurs.length)
        parts.push(`⚠︎ ${resultat.erreurs.join(' ; ')}`)
      setSyncMessage(`✓ Synchronisation terminée : ${parts.join(', ')}.`)
    } catch (err) {
      setSyncMessage(`⚠︎ ${(err as Error).message}`)
    } finally {
      setSyncEnCours(false)
    }
  }

  function deconnexion() {
    oublierJetonAdmin()
    onDeconnexion()
  }

  return (
    <div className="admin">
      <header className="admin-entete">
        <div className="admin-marque">
          <span className="entete-soleil entete-soleil--admin" aria-hidden="true">
            ⚙︎
          </span>
          <div>
            <strong>Administration</strong>
            <small>{config.maison.nom}</small>
          </div>
        </div>
        <div className="admin-actions">
          <a className="lien-bouton" href="./">
            Voir le site ↗
          </a>
          <button
            type="button"
            className="btn-deconnexion"
            onClick={deconnexion}
          >
            Quitter
          </button>
        </div>
      </header>

      <nav className="admin-onglets" aria-label="Sections">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`onglet ${onglet === o.id ? 'onglet--actif' : ''}`}
            onClick={() => setOnglet(o.id)}
            aria-current={onglet === o.id ? 'page' : undefined}
          >
            <span className="onglet-icone" aria-hidden="true">
              {o.icone}
            </span>
            <span className="onglet-libelle">{o.libelle}</span>
          </button>
        ))}
      </nav>

      <main className="admin-contenu">
        {onglet === 'sejours' && (
          <EditeurSejours
            sejours={config.sejours}
            onChange={(sejours) => patch({ sejours })}
            calendriers={config.calendriers}
            onChangeCalendriers={(calendriers) => patch({ calendriers })}
            onSync={synchroniser}
            syncEnCours={syncEnCours}
            syncMessage={syncMessage}
          />
        )}
        {onglet === 'maison' && (
          <EditeurMaison
            maison={config.maison}
            onChange={(maison) => patch({ maison })}
          />
        )}
        {onglet === 'galerie' && (
          <EditeurGalerie
            galerie={config.galerie}
            onChange={(galerie) => patch({ galerie })}
          />
        )}
        {onglet === 'tutoriels' && (
          <EditeurTutoriels
            tutoriels={config.tutoriels}
            onChange={(tutoriels) => patch({ tutoriels })}
          />
        )}
        {onglet === 'tourisme' && (
          <EditeurTourisme
            tourisme={config.tourisme}
            onChange={(tourisme) => patch({ tourisme })}
          />
        )}
      </main>

      <div className="barre-enregistrement">
        {etat === 'erreur' && messageErreur && (
          <span className="barre-erreur">⚠︎ {messageErreur}</span>
        )}
        {etat === 'ok' && (
          <span className="barre-ok">✓ Modifications enregistrées</span>
        )}
        {modifie && etat !== 'ok' && (
          <span className="barre-info">Modifications non enregistrées</span>
        )}
        <button
          type="button"
          className="btn-enregistrer"
          onClick={enregistrer}
          disabled={etat === 'enregistrement' || !modifie}
        >
          {etat === 'enregistrement' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
