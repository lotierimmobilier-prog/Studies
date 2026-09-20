/**
 * L'espace personnel.
 *
 * ── Ce qu'il montre, et pourquoi il n'y a pas plus ───────────────────────
 *
 * Un espace personnel répond d'abord à une question de confiance : « qu'est-ce
 * que ce site sait de moi ? ». La réponse honnête, ici, tient en quatre
 * lignes — une adresse e-mail et trois dates. Il n'y a ni nom, ni adresse
 * postale, ni téléphone, ni date de naissance.
 *
 * Ce n'est pas un formulaire resté à moitié fait. La règle 3 de CLAUDE.md
 * impose la minimisation parce que les titulaires sont MINEURS, et rien dans
 * le calcul n'a besoin de ces données : seule la commune sert à chiffrer un
 * loyer, et elle reste dans le navigateur avec le reste des réponses.
 *
 * L'écran le dit donc explicitement. Une absence que personne n'explique se
 * lit comme une fonctionnalité manquante ; une absence expliquée se lit comme
 * une décision — et c'en est une.
 *
 * ── Le récapitulatif vient du NAVIGATEUR ─────────────────────────────────
 *
 * Les réponses au parcours et les cartes gagnées ne sont pas sur le serveur.
 * La page d'accueil le promet noir sur blanc : « même inscrit, tes notes, tes
 * bulletins et tes vœux restent dans ton navigateur ». Ce récapitulatif lit
 * donc la mémoire de l'application et le stockage local, jamais le compte.
 *
 * La conséquence est réelle et elle est dite à l'écran : ce récapitulatif ne
 * suit pas d'un appareil à l'autre. Taire cette limite ferait croire à une
 * sauvegarde qui n'existe pas — et l'élève s'en apercevrait au pire moment.
 */

import { useEffect, useState } from 'react'

import {
  changerMotDePasse,
  profilCompte,
  supprimerCompte,
  CompteRefuse,
  type ProfilCompte,
} from './donnees.ts'
import { FilAriane } from './filAriane.tsx'
import { Marque } from './marque.tsx'
import { nombre } from './nombres.ts'
import { chargerCollection, villesDe } from './collection.ts'
import { LIBELLES_MATIERE } from '../../packages/profil-scolaire/src/index.ts'
import type { Reponses } from './calcul.ts'
import type { Route } from './routes.ts'

/**
 * Le bac, tel qu'on le dit. La clé technique — « general » — est ce que le
 * calcul manipule ; l'afficher telle quelle donnerait à l'élève le sentiment
 * de lire un journal de débogage plutôt que son propre dossier.
 */
const LIBELLES_BAC: Readonly<Record<Reponses['typeBac'], string>> = {
  general: 'Bac général',
  technologique: 'Bac technologique',
  professionnel: 'Bac professionnel',
  autre: 'Autre',
}

const LIBELLES_MOBILITE: Readonly<Record<Reponses['mobilite'], string>> = {
  meme_ville: 'ma ville',
  meme_region: 'ma région',
  france: 'toute la France',
}

function dateLisible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ------------------------------------------------- ce que le site sait */

function Coordonnees({ profil }: { readonly profil: ProfilCompte }) {
  return (
    <section className="bloc-compte">
      <h2>Tes coordonnées</h2>
      <dl className="compte-faits">
        <div className="compte-fait">
          <dt>Adresse e-mail</dt>
          <dd>{profil.email}</dd>
        </div>
        <div className="compte-fait">
          <dt>Inscrit le</dt>
          <dd>{dateLisible(profil.inscritLe)}</dd>
        </div>
        <div className="compte-fait">
          <dt>Dernière connexion</dt>
          <dd>{dateLisible(profil.vuLe)}</dd>
        </div>
        <div className="compte-fait">
          <dt>Cette session expire le</dt>
          <dd>{dateLisible(profil.sessionExpireLe)}</dd>
        </div>
      </dl>

      {/* Cette liste EST la réponse à « quelles sont mes coordonnées ? ».
          Sans elle, l'écran aurait l'air d'un formulaire inachevé. */}
      <div className="compte-rien">
        <h3>Ce que nous ne savons pas de toi</h3>
        <ul>
          <li>Ni ton nom, ni ton prénom.</li>
          <li>Ni ton adresse, ni ton téléphone, ni ta date de naissance.</li>
          <li>Ni tes notes, ni tes bulletins, ni les formations que tu regardes.</li>
        </ul>
        <p className="note">
          Ce n’est pas un formulaire à compléter : nous ne demandons rien de tout cela,
          parce que rien de tout cela n’entre dans un calcul. Ton adresse e-mail sert à te
          reconnaître, et elle est chiffrée. Ta commune sert à estimer un loyer, et elle
          ne quitte pas ton navigateur.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------- mot de passe */

function MotDePasse() {
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [fait, setFait] = useState(false)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(ev: React.FormEvent): Promise<void> {
    ev.preventDefault()
    setErreur(null)
    setFait(false)
    // La seule vérification faite ici : les deux saisies concordent. Tout le
    // reste — longueur, ancien mot de passe — est jugé par le serveur, et son
    // message est repris tel quel. Revalider des deux côtés, c'est créer deux
    // règles qui divergeront.
    if (nouveau !== confirmation) {
      setErreur('Les deux saisies du nouveau mot de passe ne sont pas identiques.')
      return
    }
    setEnCours(true)
    try {
      await changerMotDePasse(ancien, nouveau)
      setAncien('')
      setNouveau('')
      setConfirmation('')
      setFait(true)
    } catch (e) {
      setErreur(
        e instanceof CompteRefuse ? e.message : 'Le changement n’a pas pu aboutir. Réessaie.',
      )
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="bloc-compte">
      <h2>Changer ton mot de passe</h2>
      <p className="bloc-intro">
        Ton mot de passe actuel est demandé : sans lui, quelqu’un qui trouverait ton
        téléphone déverrouillé pourrait t’enfermer hors de ton propre compte.
      </p>
      <form className="compte-mdp" onSubmit={(ev) => void soumettre(ev)}>
        <label className="champ-label" htmlFor="mdp-ancien">
          Mot de passe actuel
        </label>
        <input
          id="mdp-ancien"
          type="password"
          autoComplete="current-password"
          value={ancien}
          onChange={(ev) => setAncien(ev.target.value)}
          required
        />

        <label className="champ-label" htmlFor="mdp-nouveau">
          Nouveau mot de passe
        </label>
        <input
          id="mdp-nouveau"
          type="password"
          autoComplete="new-password"
          value={nouveau}
          onChange={(ev) => setNouveau(ev.target.value)}
          required
        />

        <label className="champ-label" htmlFor="mdp-confirmation">
          Répète le nouveau mot de passe
        </label>
        <input
          id="mdp-confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(ev) => setConfirmation(ev.target.value)}
          required
        />

        {erreur !== null ? (
          <p className="compte-erreur" role="alert">
            {erreur}
          </p>
        ) : null}
        {fait ? (
          <p className="compte-ok" role="status">
            Mot de passe changé. Tes autres appareils ont été déconnectés ; celui-ci reste
            connecté.
          </p>
        ) : null}

        <button type="submit" className="principal" disabled={enCours}>
          {enCours ? 'Changement…' : 'Changer mon mot de passe'}
        </button>
      </form>
    </section>
  )
}

/* ------------------------------------------------- récapitulatif local */

function Recapitulatif({ reponses }: { readonly reponses: Reponses | null }) {
  const collection = chargerCollection()
  const villes = villesDe(collection)
  const matieres = reponses === null ? [] : Object.entries(reponses.notes)

  return (
    <section className="bloc-compte">
      <h2>Tes choix et tes demandes</h2>
      <p className="bloc-intro">
        Ce récapitulatif est lu dans <strong>ton navigateur</strong>, pas dans ton compte.
        Il ne nous est jamais envoyé — et c’est pour cela qu’il ne te suivra pas sur un
        autre appareil.
      </p>

      {reponses === null ? (
        <p className="note">
          Tu n’as pas encore répondu aux sept questions sur cet appareil. Le récapitulatif
          apparaîtra dès que tu les auras remplies.
        </p>
      ) : null}

      {/* UNE seule liste de définitions. Un « dt » posé hors d'un « dl » est
          du HTML invalide : le navigateur le rattache à ce qu'il trouve, et
          un lecteur d'écran n'annonce plus la paire. */}
      <dl className="compte-faits">
        {reponses !== null ? (
          <>
            <div className="compte-fait">
              <dt>Ton bac</dt>
              <dd>{LIBELLES_BAC[reponses.typeBac]}</dd>
            </div>
            <div className="compte-fait">
              <dt>Ta commune</dt>
              <dd>
                {reponses.villeResidence === '' ? 'non renseignée' : reponses.villeResidence}
              </dd>
            </div>
            <div className="compte-fait">
              <dt>Jusqu’où tu peux aller</dt>
              <dd>{LIBELLES_MOBILITE[reponses.mobilite]}</dd>
            </div>
            <div className="compte-fait">
              <dt>Filière visée</dt>
              <dd>{reponses.filiere === '' ? 'non renseignée' : reponses.filiere}</dd>
            </div>
            <div className="compte-fait">
              <dt>Bourse</dt>
              <dd>
                {reponses.echelonInconnu
                  ? 'échelon inconnu'
                  : reponses.echelonBourse === null
                    ? 'non boursier'
                    : `échelon ${reponses.echelonBourse}`}
              </dd>
            </div>
            <div className="compte-fait">
              <dt>Bulletins déposés</dt>
              <dd>{nombre(reponses.bulletins.length)}</dd>
            </div>
            {matieres.length > 0 ? (
              <div className="compte-fait">
                <dt>Moyennes retenues</dt>
                <dd>
                  {matieres
                    .map(
                      ([m, v]) =>
                        `${LIBELLES_MATIERE[m as keyof typeof LIBELLES_MATIERE] ?? m} : ${v}`,
                    )
                    .join(' · ')}
                </dd>
              </div>
            ) : null}
          </>
        ) : null}

        {/* Les villes comparées viennent de la collection, qui survit au
            rechargement : elles s'affichent même sans parcours en cours. */}
        <div className="compte-fait">
          <dt>Villes comparées</dt>
          <dd>{villes.length === 0 ? 'aucune pour l’instant' : nombre(villes.length)}</dd>
        </div>
      </dl>
    </section>
  )
}

/* -------------------------------------------------------- effacement */

function Effacer({ onEfface }: { readonly onEfface: () => void }) {
  const [confirme, setConfirme] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function effacer(): Promise<void> {
    setEnCours(true)
    setErreur(null)
    try {
      await supprimerCompte()
      onEfface()
    } catch (e) {
      setErreur(e instanceof CompteRefuse ? e.message : 'L’effacement n’a pas abouti.')
      setEnCours(false)
    }
  }

  return (
    <section className="bloc-compte bloc-compte-effacer">
      <h2>Effacer ton compte</h2>
      <p className="bloc-intro">
        Ton adresse et ton mot de passe sont supprimés de nos fichiers, définitivement.
        Tu pourras te réinscrire plus tard avec la même adresse.
      </p>
      <p className="note">
        Tes réponses et tes cartes ne sont pas concernées : elles n’ont jamais quitté ton
        navigateur. Pour les effacer aussi, vide les données de site de ton navigateur.
      </p>

      {erreur !== null ? (
        <p className="compte-erreur" role="alert">
          {erreur}
        </p>
      ) : null}

      {/* Deux gestes, pas un. Un bouton d'effacement immédiat se clique par
          accident ; une case à cocher demande une intention. */}
      <label className="compte-confirme">
        <input
          type="checkbox"
          checked={confirme}
          onChange={(ev) => setConfirme(ev.target.checked)}
        />
        <span>Je comprends que mon compte sera supprimé définitivement.</span>
      </label>
      <button
        type="button"
        className="secondaire compte-danger"
        disabled={!confirme || enCours}
        onClick={() => void effacer()}
      >
        {enCours ? 'Effacement…' : 'Effacer mon compte'}
      </button>
    </section>
  )
}

/* -------------------------------------------------------------- l'écran */

export function MonCompte({
  reponses,
  onNaviguer,
  onDeconnexion,
}: {
  /** Les réponses en mémoire, ou `null` si le parcours n'a pas été fait ici. */
  readonly reponses: Reponses | null
  readonly onNaviguer: (route: Route) => void
  /** Appelé après un effacement : la session n'existe plus. */
  readonly onDeconnexion: () => void
}) {
  const [profil, setProfil] = useState<ProfilCompte | null>(null)
  const [charge, setCharge] = useState(false)

  useEffect(() => {
    let vivant = true
    void profilCompte().then((p) => {
      if (!vivant) return
      setProfil(p)
      setCharge(true)
    })
    return () => {
      vivant = false
    }
  }, [])

  return (
    <main className="app app-large">
      <header className="entete entete-accueil">
        <h1 className="marque">
          <Marque />
        </h1>
        <button
          type="button"
          className="entete-cta"
          onClick={() => onNaviguer({ vue: 'accueil' })}
        >
          Retour au site
        </button>
      </header>

      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Mon compte', route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      <h2 className="article-titre">Mon compte</h2>

      {!charge ? (
        <p className="note">Chargement…</p>
      ) : profil === null ? (
        /* Session absente ou expirée. On le dit, et on propose le geste qui
           répare — plutôt qu'une page vide dont on ne sait que faire. */
        <section className="bloc-compte">
          <h2>Tu n’es pas connecté</h2>
          <p className="bloc-intro">
            Ta session a peut-être expiré : elle dure trente jours. Reconnecte-toi pour
            retrouver cet espace.
          </p>
          <button
            type="button"
            className="principal"
            onClick={() => onNaviguer({ vue: 'connexion' })}
          >
            Se connecter
          </button>
        </section>
      ) : (
        <>
          <Coordonnees profil={profil} />
          <Recapitulatif reponses={reponses} />
          <MotDePasse />
          <Effacer
            onEfface={() => {
              onDeconnexion()
              onNaviguer({ vue: 'accueil' })
            }}
          />
        </>
      )}
    </main>
  )
}
