import { useState, type FormEvent } from 'react'
import { seConnecterAdmin } from '../api'

/** Écran de connexion à l'administration (mot de passe). */
export default function AdminLogin({
  onConnecte,
}: {
  onConnecte: () => void
}) {
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await seConnecterAdmin(motDePasse)
      onConnecte()
    } catch (err) {
      setErreur((err as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="connexion connexion--admin">
      <div className="connexion-carte">
        <div className="connexion-marque">
          <span className="connexion-soleil connexion-soleil--admin" aria-hidden="true">
            ⚙︎
          </span>
          <h1>Administration</h1>
          <p>Gérez les séjours et le contenu de votre maison</p>
        </div>

        <form onSubmit={soumettre} className="connexion-form">
          <label>
            Mot de passe administrateur
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              autoFocus
            />
          </label>

          {erreur && <p className="connexion-erreur">{erreur}</p>}

          <button type="submit" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="connexion-aide">
          <a href="./">← Retour au portail voyageur</a>
        </p>
      </div>
    </div>
  )
}
