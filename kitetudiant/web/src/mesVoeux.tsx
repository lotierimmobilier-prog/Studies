/**
 * La liste de vœux.
 *
 * ── Ce qu'elle enregistre, et ce qu'elle n'enregistre pas ────────────────
 *
 * Le serveur garde ce qui identifie un CHOIX : un code de formation, une
 * session, un rang, et un signalement quand l'élève en pose un. Il ne garde
 * ni note, ni moyenne, ni bourse, ni reste-à-vivre (décision D1).
 *
 * Conséquence assumée, et écrite à l'écran : **le reste-à-vivre n'est pas
 * enregistré à côté d'un vœu**. Il se calcule dans le navigateur à partir de
 * réponses qui ne montent pas. Sur l'appareil où le parcours a été fait, la
 * ligne peut l'afficher ; sur un autre, elle dit pourquoi elle ne le peut
 * pas. Le recalculer côté serveur avec des hypothèses qu'on n'a pas serait
 * inventer un montant, ce que la règle 1 interdit.
 *
 * ── Aucun vœu n'est jamais retiré par l'application ──────────────────────
 *
 * Règle 4 de CLAUDE.md. Le bouton « Retirer » existe, et c'est l'élève qui
 * l'actionne. Rien dans cet écran ne trie, ne masque ni n'écarte un vœu :
 * l'ordre affiché est celui que l'élève a posé, et le signalement se lit à
 * côté du vœu, jamais à sa place.
 */

import { useCallback, useEffect, useState } from 'react'

import { FilAriane } from './filAriane.tsx'
import {
  InscriptionRequise,
  VoeuxIndisponibles,
  ajouterVoeu,
  chercherVoeux,
  deplacerVoeu,
  formationParCode,
  retirerVoeu,
  signalerVoeu,
  type Formation,
  type Voeu,
} from './donnees.ts'
import { cheminDe, type Route } from './routes.ts'
import { useMetadonnees } from './metadonnees.ts'

/** Comme Parcoursup. Le serveur et la base le vérifient aussi. */
const VOEUX_MAX = 10

type Etat = 'charge' | 'prete' | 'deconnecte' | 'indisponible' | 'erreur'

/**
 * Le libellé d'une formation, cherché à la demande.
 *
 * Le serveur ne stocke QUE le code — c'est la clé pivot, et recopier un
 * libellé en base le figerait à la version du jour de l'ajout. On le relit
 * donc à l'affichage, chez le ministère.
 *
 * Tant qu'il n'est pas arrivé, on montre le code plutôt qu'un vide : un vœu
 * qui apparaît comme une ligne blanche donne l'impression d'avoir été perdu.
 */
function useLibelles(voeux: readonly Voeu[]): Map<string, Formation> {
  const [connus, setConnus] = useState<Map<string, Formation>>(new Map())
  useEffect(() => {
    let vivant = true
    const manquants = voeux.map((v) => v.codeFormation).filter((c) => !connus.has(c))
    if (manquants.length === 0) return
    void Promise.all(manquants.map((c) => formationParCode(c).catch(() => null))).then(
      (trouvees) => {
        if (!vivant) return
        setConnus((avant) => {
          const suivante = new Map(avant)
          trouvees.forEach((f, i) => {
            if (f !== null) suivante.set(manquants[i]!, f)
          })
          return suivante
        })
      },
    )
    return () => {
      vivant = false
    }
  }, [voeux, connus])
  return connus
}

function LigneVoeu({
  voeu,
  formation,
  premier,
  dernier,
  occupe,
  onNaviguer,
  onDeplacer,
  onRetirer,
  onSignaler,
}: {
  readonly voeu: Voeu
  readonly formation: Formation | undefined
  readonly premier: boolean
  readonly dernier: boolean
  readonly occupe: boolean
  readonly onNaviguer: (route: Route) => void
  readonly onDeplacer: (vers: 'haut' | 'bas') => void
  readonly onRetirer: () => void
  readonly onSignaler: (texte: string | null) => void
}) {
  const [saisie, setSaisie] = useState(voeu.signalement ?? '')
  const [ouvert, setOuvert] = useState(false)
  const vers: Route = { vue: 'formation', code: voeu.codeFormation }

  return (
    <li className="voeu">
      <span className="voeu-rang" aria-hidden="true">
        {voeu.rang}
      </span>

      <div className="voeu-corps">
        <a
          className="voeu-titre"
          href={cheminDe(vers)}
          onClick={(ev) => {
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
            ev.preventDefault()
            onNaviguer(vers)
          }}
        >
          {formation?.libelle ?? `Formation ${voeu.codeFormation}`}
        </a>
        {formation !== undefined ? (
          <span className="note">
            {formation.etablissement} · {formation.ville} ({formation.departement})
          </span>
        ) : (
          <span className="note">Chargement du détail…</span>
        )}

        {voeu.signalement !== null ? (
          <p className="voeu-signalement">
            <strong>Noté :</strong> {voeu.signalement}
          </p>
        ) : null}

        {ouvert ? (
          <form
            className="voeu-note"
            onSubmit={(ev) => {
              ev.preventDefault()
              onSignaler(saisie.trim() === '' ? null : saisie.trim())
              setOuvert(false)
            }}
          >
            <label className="champ-label" htmlFor={`note-${voeu.rang}`}>
              Ce que tu veux te rappeler sur ce vœu
            </label>
            <input
              id={`note-${voeu.rang}`}
              type="text"
              maxLength={300}
              value={saisie}
              placeholder="loyer élevé, internat à confirmer…"
              onChange={(ev) => setSaisie(ev.target.value)}
            />
            <div className="navigation">
              <button type="submit" className="secondaire" disabled={occupe}>
                Enregistrer
              </button>
              <button type="button" className="lien" onClick={() => setOuvert(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="voeu-actions">
        {/* Les flèches portent le titre de la formation dans leur nom
            accessible : « monter » répété dix fois ne dit pas quoi. */}
        <button
          type="button"
          className="voeu-fleche"
          disabled={premier || occupe}
          aria-label={`Monter ${formation?.libelle ?? voeu.codeFormation}`}
          onClick={() => onDeplacer('haut')}
        >
          ↑
        </button>
        <button
          type="button"
          className="voeu-fleche"
          disabled={dernier || occupe}
          aria-label={`Descendre ${formation?.libelle ?? voeu.codeFormation}`}
          onClick={() => onDeplacer('bas')}
        >
          ↓
        </button>
        <button type="button" className="lien" onClick={() => setOuvert((o) => !o)}>
          {voeu.signalement === null ? 'Noter' : 'Modifier la note'}
        </button>
        <button
          type="button"
          className="lien voeu-retirer"
          disabled={occupe}
          onClick={onRetirer}
        >
          Retirer
        </button>
      </div>
    </li>
  )
}

export function MesVoeux({
  connecte,
  onNaviguer,
}: {
  readonly connecte: boolean
  readonly onNaviguer: (route: Route) => void
}) {
  useMetadonnees({
    titre: 'Mes vœux — KitEtudiant.fr',
    description: 'Ta liste de travail : les formations que tu envisages, dans ton ordre.',
    prive: true,
  })
  const [voeux, setVoeux] = useState<readonly Voeu[]>([])
  const [etat, setEtat] = useState<Etat>('charge')
  const [message, setMessage] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const libelles = useLibelles(voeux)

  const traiter = useCallback((e: unknown) => {
    if (e instanceof InscriptionRequise) {
      setEtat('deconnecte')
      return
    }
    if (e instanceof VoeuxIndisponibles) {
      setMessage((e as Error).message)
      setEtat('indisponible')
      return
    }
    setMessage((e as Error).message)
    setEtat('erreur')
  }, [])

  useEffect(() => {
    if (!connecte) {
      setEtat('deconnecte')
      return
    }
    let vivant = true
    chercherVoeux()
      .then((liste) => {
        if (!vivant) return
        setVoeux(liste)
        setEtat('prete')
      })
      .catch((e: unknown) => {
        if (vivant) traiter(e)
      })
    return () => {
      vivant = false
    }
  }, [connecte, traiter])

  const agir = useCallback(
    (action: () => Promise<readonly Voeu[]>) => {
      setOccupe(true)
      action()
        .then((liste) => {
          setVoeux(liste)
          setEtat('prete')
          setMessage(null)
        })
        .catch(traiter)
        .finally(() => setOccupe(false))
    },
    [traiter],
  )

  return (
    <main className="app app-large">
      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Mes vœux', route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      <h1 className="article-titre">Mes vœux</h1>

      {/* Cette page s'appelle « Mes vœux », plafonne à dix comme Parcoursup, et
          propose de « retirer » un vœu. Rien n'y disait que la liste ne part
          nulle part. Un élève de dix-sept ans pouvait raisonnablement croire
          ses vœux déposés — et découvrir le contraire après la date limite. */}
      <p className="bloc-intro">
        Ta liste de travail, ici, sur KitEtudiant. <strong>Elle ne part pas sur
        Parcoursup</strong> : c’est sur parcoursup.gouv.fr que les vœux se formulent
        et se confirment. Dix au maximum, comme là-bas, pour que ta liste d’ici
        ressemble à celle de là-bas.
      </p>

      {etat === 'charge' ? (
        <p className="note" role="status" aria-live="polite">
          Chargement de ta liste…
        </p>
      ) : null}

      {etat === 'deconnecte' ? (
        <section className="bloc">
          <h2>Connecte-toi pour retrouver tes vœux</h2>
          <p>
            Une liste de vœux se construit sur plusieurs semaines, et rarement sur le même
            appareil. C’est la seule chose que le site enregistre pour toi : un code de
            formation et son rang.
          </p>
          <p className="note">
            Tes notes, ton budget et tes réponses au parcours, eux, restent dans ce
            navigateur. Ils ne sont pas envoyés, même une fois connecté.
          </p>
          <div className="navigation">
            <button
              type="button"
              className="principal"
              onClick={() => onNaviguer({ vue: 'connexion' })}
            >
              Se connecter
            </button>
            <button
              type="button"
              className="secondaire"
              onClick={() => onNaviguer({ vue: 'inscription' })}
            >
              Créer un compte
            </button>
          </div>
        </section>
      ) : null}

      {etat === 'indisponible' ? (
        <section className="bloc">
          <h2>Pas encore activé sur ce serveur</h2>
          {/* Une session finie se répare en se reconnectant ; ceci, non. Lui
              proposer de se reconnecter en boucle lui ferait perdre son temps
              sur un problème qui n'est pas le sien. */}
          <p>{message}</p>
          <p className="note">
            Tes vœux ne sont pas perdus : ils ne sont simplement pas encore enregistrables.
            En attendant, la recherche et les fiches fonctionnent normalement.
          </p>
        </section>
      ) : null}

      {etat === 'erreur' ? <p className="erreur">{message}</p> : null}

      {etat === 'prete' ? (
        <section className="bloc">
          <p className="bloc-intro">
            {voeux.length === 0
              ? 'Ta liste est vide. Ajoute une formation depuis sa fiche, et tu la retrouveras ici sur n’importe quel appareil.'
              : `${voeux.length} vœu${voeux.length > 1 ? 'x' : ''} sur ${VOEUX_MAX}. L’ordre est le tien : rien ici ne les classe à ta place.`}
          </p>

          {voeux.length === 0 ? (
            <div className="navigation">
              <button
                type="button"
                className="principal"
                onClick={() => onNaviguer({ vue: 'recherche' })}
              >
                Chercher une école
              </button>
            </div>
          ) : (
            <>
              <ol className="voeux">
                {voeux.map((v, i) => (
                  <LigneVoeu
                    key={`${v.codeFormation}-${v.session}`}
                    voeu={v}
                    formation={libelles.get(v.codeFormation)}
                    premier={i === 0}
                    dernier={i === voeux.length - 1}
                    occupe={occupe}
                    onNaviguer={onNaviguer}
                    onDeplacer={(vers) => agir(() => deplacerVoeu(v.rang, vers))}
                    onRetirer={() => agir(() => retirerVoeu(v.rang))}
                    onSignaler={(texte) => agir(() => signalerVoeu(v.rang, texte))}
                  />
                ))}
              </ol>

              {/* Dit une fois, sous la liste, et pas sur chaque ligne : répété
                  dix fois il deviendrait du décor qu'on ne lit plus. */}
              <p className="note">
                Le reste-à-vivre n’est pas enregistré à côté d’un vœu : il dépend de ta
                bourse, de ton logement et de ton budget, qui ne quittent pas ton
                navigateur. Ouvre une fiche depuis l’appareil où tu as fait le parcours
                pour le revoir.
              </p>
            </>
          )}
        </section>
      ) : null}
    </main>
  )
}

/**
 * Le bouton d'ajout, posé sur une fiche de formation.
 *
 * Il dit ce qu'il fait AVANT de le faire : un élève non connecté voit
 * « Enregistrer dans mes vœux » et arrive sur la page de connexion en le
 * cliquant, plutôt que de découvrir après coup que rien n'a été enregistré.
 */
export function BoutonVoeu({
  code,
  session,
  connecte,
  onNaviguer,
}: {
  readonly code: string
  readonly session: number
  readonly connecte: boolean
  readonly onNaviguer: (route: Route) => void
}) {
  const [etat, setEtat] = useState<'repos' | 'occupe' | 'ajoute' | 'erreur'>('repos')
  const [message, setMessage] = useState<string | null>(null)

  if (!connecte) {
    return (
      <div className="voeu-ajout">
        <button
          type="button"
          className="secondaire"
          onClick={() => onNaviguer({ vue: 'connexion' })}
        >
          Enregistrer dans mes vœux
        </button>
        <span className="note">
          Une liste de travail, pas un dépôt de vœux : rien n’est envoyé à Parcoursup.
          Il faut un compte pour la retrouver d’un appareil à l’autre.
        </span>
      </div>
    )
  }

  return (
    <div className="voeu-ajout">
      <button
        type="button"
        className="secondaire"
        disabled={etat === 'occupe' || etat === 'ajoute'}
        onClick={() => {
          setEtat('occupe')
          setMessage(null)
          ajouterVoeu(code, session)
            .then(() => setEtat('ajoute'))
            .catch((e: unknown) => {
              setMessage((e as Error).message)
              setEtat('erreur')
            })
        }}
      >
        {etat === 'ajoute' ? 'Dans tes vœux ✓' : 'Enregistrer dans mes vœux'}
      </button>
      {etat === 'ajoute' ? (
        <button type="button" className="lien" onClick={() => onNaviguer({ vue: 'voeux' })}>
          Voir ma liste
        </button>
      ) : null}
      {message !== null ? <span className="erreur">{message}</span> : null}
    </div>
  )
}
