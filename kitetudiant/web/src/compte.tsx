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

import { useEffect, useState } from 'react'

import { ecrireAnneeNaissance, lireAnneeNaissance } from './age.ts'
import { useMetadonnees } from './metadonnees.ts'

import {
  CompteRefuse,
  connecter,
  departGoogle,
  inscrire,
  moyensDeConnexion,
} from './donnees.ts'

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
  /* Le titre suit le mode : /connexion et /inscription sont deux adresses,
     et le même titre sur les deux les rendrait indistinguables dans un
     historique de navigation comme dans un index. */
  useMetadonnees({
    titre:
      mode === 'connexion'
        ? 'Se connecter — KitEtudiant.fr'
        : 'Créer un compte — KitEtudiant.fr',
    description:
      'Un compte sert à retrouver ta liste de vœux d’un appareil à l’autre. ' +
      'Une adresse, un mot de passe, rien d’autre.',
    prive: true,
  })
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  /* L'année déjà saisie au parcours, s'il y est passé. Pré-remplie plutôt
     que redemandée à blanc : la reposer donnerait l'impression qu'on ne
     l'a pas gardée, ou qu'on la vérifie. */
  const [annee, setAnnee] = useState<string>(() => {
    const connue = lireAnneeNaissance()
    return connue === null ? '' : String(connue)
  })
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // La connexion Google dépend d'identifiants posés sur le serveur. On
  // demande plutôt que de deviner : un bouton qui mène à un mur est pire
  // qu'un bouton absent.
  const [google, setGoogle] = useState(false)

  useEffect(() => {
    let vivant = true
    void moyensDeConnexion().then((m) => {
      if (vivant) setGoogle(m.google)
    })
    return () => {
      vivant = false
    }
  }, [])

  async function envoyer(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    try {
      await (mode === 'inscription' ? inscrire : connecter)(email, motDePasse)
      /* Gardée seulement après une inscription réussie, et seulement si
         elle est plausible : une année tapée à moitié n'a rien à faire en
         mémoire. `ecrireAnneeNaissance` écarte le reste. */
      if (mode === 'inscription' && annee !== '') {
        ecrireAnneeNaissance(Number.parseInt(annee, 10))
      }
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
      {/* h1 et non h2 : dans les vues « connexion » et « inscription », ce
          formulaire EST la page, et son titre est le titre de la page.
          Depuis que la marque a rejoint la barre de navigation, plus aucun
          h1 ne le précède. */}
      <h1 id="compte-titre">
        {mode === 'inscription' ? 'Crée ton compte' : 'Connecte-toi'}
      </h1>
      <p className="compte-pourquoi">{message}</p>

      {google ? (
        <div className="compte-google">
          {/* Un LIEN, pas un bouton qui appellerait du JavaScript de Google.
              Aucun script tiers n'est chargé sur ce site : Google n'apprend
              l'existence d'un élève qu'au moment où celui-ci clique. Sur un
              site qui s'adresse à des mineurs, la différence n'est pas
              cosmétique. */}
          <a className="secondaire compte-google-lien" href={departGoogle(window.location.pathname)}>
            Continuer avec Google
          </a>
          <p className="note">
            Google nous transmet ton adresse e-mail, rien d’autre — ni ton nom, ni ta photo.
          </p>
          <p className="compte-ou">ou</p>
        </div>
      ) : null}

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

        {/* Demandée à l'inscription, et seulement là.
            Quelqu'un qui crée un compte sans passer par les sept questions
            n'a jamais donné son année : sans elle, les écrans qui parlent de
            bail ou de contrat ne savent pas à qui ils s'adressent, et
            devraient poser la question au pire moment.

            Elle ne part PAS au serveur. Le compte ne porte que l'adresse
            e-mail (voir `ProfilCompte`), et ajouter l'année de naissance d'un
            mineur à une base de données pour un choix d'affichage que le
            navigateur fait déjà serait un recul sur la règle 3. */}
        {mode === 'inscription' ? (
          <div className="champ">
            <label className="champ-label" htmlFor="compte-annee">
              Ton année de naissance
            </label>
            <input
              id="compte-annee"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              min={1930}
              max={new Date().getFullYear()}
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
            />
            <p className="note">
              Elle sert à savoir ce qu’on peut te proposer : avant dix-huit ans, un
              bail ou un contrat se signe avec un parent. Elle reste dans ce
              navigateur et n’est enregistrée sur aucun serveur.
            </p>
          </div>
        ) : null}

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
        <h2>Ce qu’on garde, et ce qu’on ne garde pas</h2>
        <ul>
          <li>
            <strong>Gardé :</strong> ton adresse e-mail, chiffrée, et ton mot de passe sous
            forme d’empreinte. Rien d’autre.
          </li>
          <li>
            <strong>Pas gardé :</strong> tes notes, tes réponses au questionnaire, ton
            budget. Ils restent dans ce navigateur et ne sont jamais envoyés.
          </li>
          {/* Cette ligne manquait, et son absence rendait la précédente FAUSSE
              pour les bulletins : elle les rangeait parmi ce qui « ne part
              jamais », alors que déposer un bulletin l'envoie au serveur puis
              à l'API Claude, qui en fait la lecture (server/bulletinScolaire.ts).
              Rien n'est écrit sur disque, mais « non conservé » et « jamais
              envoyé » sont deux choses différentes, et c'est la seconde qui
              était écrite — à des mineurs, sur leurs bulletins. */}
          <li>
            <strong>Envoyé, mais pas conservé :</strong> si tu déposes un bulletin, le
            fichier part sur notre serveur puis à l’API Claude, qui en lit les moyennes
            et les appréciations. Il n’est enregistré nulle part, et le texte des
            appréciations n’est pas gardé — seuls les chiffres et un résumé te
            reviennent. Tu peux aussi saisir tes moyennes à la main : dans ce cas rien
            ne part.
          </li>
          {/* Cette ligne manquait, et son absence rendait la précédente FAUSSE.
              D1 a fait monter la liste de vœux au serveur — c'est ce qui permet
              de la retrouver d'un appareil à l'autre — mais le texte continuait
              de promettre l'inverse, à des mineurs, au moment précis où on leur
              demande de créer un compte. */}
          <li>
            <strong>Gardé aussi, si tu le demandes :</strong> ta liste de vœux. Un code
            de formation et son rang, rien d’autre — ni note, ni montant, ni commentaire.
            C’est ce qui te permet de la retrouver d’un téléphone à l’autre.
          </li>
          {/* « Aucune publicité » est tombé le jour où l'accueil a porté un
              lien partenaire rémunéré (web/src/partenaires.ts). La phrase a
              été réécrite EN MÊME TEMPS que le lien est apparu, pas après :
              c'est la troisième promesse de ce site à devoir être réparée,
              et les deux premières l'avaient été trop tard.

              Ce qui reste vrai reste écrit tel quel. Ce qui a changé est
              nommé, avec ce qui le borne : le partenaire n'apprend rien de
              toi tant que tu ne cliques pas, puisque aucun script tiers
              n'est chargé. */}
          <li>
            <strong>Jamais :</strong> aucune revente de tes données, aucun traceur,
            aucune bannière.
          </li>
          <li>
            <strong>Dit franchement :</strong> une page du site propose un partenaire
            pour comparer énergie, assurance et mobile, et il nous rémunère si tu
            souscris. Il n’apprend rien de toi tant que tu ne cliques pas, et rien de
            ce que tu fais ici ne lui est transmis.
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
