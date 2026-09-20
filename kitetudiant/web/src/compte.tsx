/**
 * Inscription et connexion.
 *
 * Le site s'adresse à des mineurs (règle 3 de CLAUDE.md), donc ce formulaire
 * ne demande que deux choses : une adresse et un mot de passe. Pas de prénom,
 * pas de date de naissance, pas de téléphone, pas de case « j'accepte de
 * recevoir des offres ». Ce qui n'est pas demandé n'a pas à être protégé.
 *
 * Le texte dit sans détour ce qui est stocké et ce qui ne l'est pas : un élève
 * de terminale a le droit de savoir ce qu'il donne avant de le donner.
 */

import { useState } from 'react'

import { CompteRefuse, connecter, inscrire } from './donnees.ts'

type Mode = 'inscription' | 'connexion'

export function Compte({
  message,
  mode: modeInitial = 'inscription',
  retour = 'Revenir à mes résultats sans compte',
  onOuvert,
  onAbandon,
}: {
  /** Pourquoi on demande un compte, formulé par le serveur. */
  readonly message: string
  /**
   * Le mode d'ouverture. Il vient de l'adresse : /connexion ouvre sur la
   * connexion, /inscription sur l'inscription. La bascule reste possible
   * depuis le formulaire — quelqu'un qui se trompe de lien ne doit pas avoir
   * à revenir en arrière.
   */
  readonly mode?: Mode
  readonly retour?: string
  readonly onOuvert: () => void
  readonly onAbandon: () => void
}) {
  const [mode, setMode] = useState<Mode>(modeInitial)
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function envoyer(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    try {
      await (mode === 'inscription' ? inscrire : connecter)(email, motDePasse)
      onOuvert()
    } catch (err) {
      setErreur(
        err instanceof CompteRefuse
          ? err.message
          : `Le service ne répond pas : ${(err as Error).message}`,
      )
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="compte" aria-labelledby="compte-titre">
      <h2 id="compte-titre">
        {mode === 'inscription' ? 'Crée ton compte' : 'Connecte-toi'}
      </h2>
      <p className="compte-pourquoi">{message}</p>

      <form onSubmit={(e) => void envoyer(e)} className="compte-form">
        <div className="champ">
          <label className="champ-label" htmlFor="compte-email">
            Adresse e-mail
          </label>
          <input
            id="compte-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="champ">
          <label className="champ-label" htmlFor="compte-mdp">
            Mot de passe
          </label>
          <input
            id="compte-mdp"
            type="password"
            autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
            required
            minLength={10}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
          {mode === 'inscription' ? (
            <p className="note">Dix caractères au minimum.</p>
          ) : null}
        </div>

        {erreur ? <p className="erreur">{erreur}</p> : null}

        <button type="submit" className="principal" disabled={enCours}>
          {enCours
            ? 'Un instant…'
            : mode === 'inscription'
              ? 'Créer mon compte et voir mes résultats'
              : 'Me connecter'}
        </button>
      </form>

      <p className="compte-bascule">
        {mode === 'inscription' ? 'Tu as déjà un compte ?' : 'Pas encore de compte ?'}{' '}
        <button
          type="button"
          className="lien"
          onClick={() => {
            setMode(mode === 'inscription' ? 'connexion' : 'inscription')
            setErreur(null)
          }}
        >
          {mode === 'inscription' ? 'Connecte-toi' : 'Inscris-toi'}
        </button>
      </p>

      <div className="compte-confiance">
        <h3>Ce qu’on garde, et ce qu’on ne garde pas</h3>
        <ul>
          <li>
            <strong>Gardé :</strong> ton adresse e-mail, chiffrée, et ton mot de passe sous
            forme d’empreinte. Rien d’autre.
          </li>
          <li>
            <strong>Pas gardé :</strong> tes notes, tes bulletins, tes vœux, tes réponses au
            questionnaire. Ils restent dans ce navigateur et ne sont jamais envoyés.
          </li>
          <li>
            <strong>Jamais :</strong> aucune revente, aucune publicité, aucun traceur.
          </li>
          <li>
            <strong>Effacé :</strong> un compte inutilisé pendant trois ans est supprimé
            automatiquement.
          </li>
        </ul>
      </div>

      <button type="button" className="lien compte-retour" onClick={onAbandon}>
        {retour}
      </button>
    </section>
  )
}
