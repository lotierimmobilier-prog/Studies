import { useEffect, useState } from 'react'
import Connexion from './components/Connexion'
import Portail from './components/Portail'
import AdminApp from './admin/AdminApp'
import { oublierJeton, restaurerSession } from './api'
import type { Session } from './types'

/** Vrai si l'URL cible l'administration (#admin). */
function estAdmin(): boolean {
  return window.location.hash.replace('#', '').toLowerCase() === 'admin'
}

export default function App() {
  const [admin, setAdmin] = useState(estAdmin())
  const [session, setSession] = useState<Session | null>(null)
  const [chargement, setChargement] = useState(true)

  // Réagit aux changements d'ancre (#admin ↔ portail).
  useEffect(() => {
    const onHash = () => setAdmin(estAdmin())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Au démarrage : tente de restaurer une session voyageur existante.
  useEffect(() => {
    restaurerSession()
      .then((s) => setSession(s))
      .finally(() => setChargement(false))
  }, [])

  if (admin) return <AdminApp />

  function deconnexion() {
    oublierJeton()
    setSession(null)
  }

  if (chargement) {
    return (
      <div className="ecran-chargement">
        <span className="soleil-anime" aria-hidden="true">
          ☀︎
        </span>
      </div>
    )
  }

  return session ? (
    <Portail session={session} onDeconnexion={deconnexion} />
  ) : (
    <Connexion onConnecte={setSession} />
  )
}
