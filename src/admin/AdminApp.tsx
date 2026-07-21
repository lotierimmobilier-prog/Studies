import { useEffect, useState } from 'react'
import type { Configuration } from '../types'
import { chargerConfigAdmin, jetonAdminEnregistre } from '../api'
import AdminLogin from './AdminLogin'
import AdminPanel from './AdminPanel'

/**
 * Application d'administration. Accessible via l'ancre `#admin`. Gère la
 * connexion, puis charge la configuration complète et affiche le panneau.
 */
export default function AdminApp() {
  const [config, setConfig] = useState<Configuration | null>(null)
  const [chargement, setChargement] = useState(true)
  const [connecte, setConnecte] = useState(false)

  async function charger() {
    setChargement(true)
    try {
      const c = await chargerConfigAdmin()
      setConfig(c)
      setConnecte(true)
    } catch {
      setConnecte(false)
      setConfig(null)
    } finally {
      setChargement(false)
    }
  }

  // Au démarrage : si un jeton admin existe, tente de charger la config.
  useEffect(() => {
    if (jetonAdminEnregistre()) charger()
    else setChargement(false)
  }, [])

  if (chargement) {
    return (
      <div className="ecran-chargement">
        <span className="soleil-anime" aria-hidden="true">
          ⚙︎
        </span>
      </div>
    )
  }

  if (!connecte || !config) {
    return <AdminLogin onConnecte={charger} />
  }

  return (
    <AdminPanel
      configInitiale={config}
      onDeconnexion={() => {
        setConnecte(false)
        setConfig(null)
      }}
    />
  )
}
