import { useEffect, useState } from 'react'
import Connexion from './components/Connexion'
import Portail from './components/Portail'
import { oublierJeton, restaurerSession } from './api'
import type { Session } from './types'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [chargement, setChargement] = useState(true)

  // Au démarrage : tente de restaurer une session existante via le jeton.
  useEffect(() => {
    restaurerSession()
      .then((s) => setSession(s))
      .finally(() => setChargement(false))
  }, [])

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
