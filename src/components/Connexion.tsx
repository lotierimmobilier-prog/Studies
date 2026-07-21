import { useState, type FormEvent } from 'react'
import { seConnecter } from '../api'
import type { Session } from '../types'

/** Écran de connexion voyageur : un simple code fourni par l'hôte. */
export default function Connexion({
  onConnecte,
}: {
  onConnecte: (session: Session) => void
}) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      const session = await seConnecter(code)
      onConnecte(session)
    } catch (err) {
      setErreur((err as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="connexion">
      <div className="connexion-carte">
        <div className="connexion-marque">
          <span className="connexion-soleil" aria-hidden="true">
            ☀︎
          </span>
          <h1>Bienvenue</h1>
          <p>Votre espace voyageur pour un séjour en toute sérénité</p>
        </div>

        <form onSubmit={soumettre} className="connexion-form">
          <label>
            Votre code d'accès
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ex. SOLEIL"
              autoComplete="off"
              autoCapitalize="characters"
              required
              autoFocus
            />
          </label>

          {erreur && <p className="connexion-erreur">{erreur}</p>}

          <button type="submit" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Entrer'}
          </button>
        </form>

        <p className="connexion-aide">
          Votre code d'accès vous a été communiqué par votre hôte. Un souci pour
          vous connecter&nbsp;? Contactez-le directement.
        </p>
      </div>
    </div>
  )
}
