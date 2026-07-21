import { useState, type FormEvent } from 'react'
import { seConnecter } from '../api'
import type { Session } from '../types'

/** Écran de connexion : login + mot de passe fournis par l'hôte. */
export default function Connexion({
  onConnecte,
}: {
  onConnecte: (session: Session) => void
}) {
  const [login, setLogin] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      const session = await seConnecter(login, motDePasse)
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
            Identifiant
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              placeholder="votre identifiant"
              required
              autoFocus
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          {erreur && <p className="connexion-erreur">{erreur}</p>}

          <button type="submit" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Entrer'}
          </button>
        </form>

        <p className="connexion-aide">
          Vos identifiants vous ont été communiqués par votre hôte. Un souci pour
          vous connecter&nbsp;? Contactez-le directement.
        </p>
      </div>
    </div>
  )
}
