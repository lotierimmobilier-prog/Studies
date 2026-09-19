/**
 * Console d'administration.
 *
 * Elle ne fait que trois choses : poser les clés d'API, montrer l'état du
 * système, et dire ce qui ne va pas. Aucune valeur de clé n'est jamais affichée
 * — le serveur n'en renvoie que les quatre derniers caractères.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  chercherEtat,
  ecrireJeton,
  enregistrerCle,
  ErreurAdmin,
  lireJeton,
  oublierCle,
  type EtatSecret,
  type EtatSysteme,
} from './api.ts'

const LIBELLES: Record<string, { titre: string; role: string; ou: string }> = {
  ANTHROPIC_API_KEY: {
    titre: 'Lecture des bulletins',
    role: 'Sans elle, l’import de bulletin est indisponible et l’élève saisit ses moyennes à la main.',
    ou: 'console.anthropic.com',
  },
  GOOGLE_MAPS_API_KEY: {
    titre: 'Note publique des lieux',
    role: 'Sans elle, la section « note publique de l’adresse » ne s’affiche pas.',
    ou: 'Google Cloud Console, API Places',
  },
}

function Secret({
  secret,
  onChange,
}: {
  secret: EtatSecret
  onChange: () => void
}) {
  const [valeur, setValeur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const infos = LIBELLES[secret.nom]

  async function agir(action: () => Promise<unknown>) {
    setOccupe(true)
    setMessage(null)
    try {
      await action()
      setValeur('')
      onChange()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <article className="secret">
      <h3>{infos?.titre ?? secret.nom}</h3>
      <p className="note">
        <code>{secret.nom}</code> — {infos?.role}
      </p>

      <p className={secret.configure ? 'etat-ok' : 'etat-absent'}>
        {secret.configure ? (
          <>
            Configurée, se termine par <strong>…{secret.fin}</strong> — posée{' '}
            {secret.provenance === 'environnement'
              ? 'dans l’environnement du serveur'
              : 'depuis cette console'}
            {secret.enregistreLe
              ? ` le ${new Date(secret.enregistreLe).toLocaleDateString('fr-FR')}`
              : ''}
            .
          </>
        ) : (
          <>Non configurée. {infos ? `À créer sur ${infos.ou}.` : null}</>
        )}
      </p>

      {secret.provenance === 'environnement' ? (
        <p className="note">
          Cette clé vient de l’environnement du serveur : elle ne peut pas être
          modifiée depuis ici. Changez-la au déploiement.
        </p>
      ) : (
        <div className="secret-actions">
          <label className="champ">
            <span className="champ-label">Nouvelle valeur</span>
            <span className="champ-saisie">
              <input
                type="password"
                autoComplete="off"
                value={valeur}
                placeholder="collez la clé ici"
                onChange={(e) => setValeur(e.target.value)}
              />
            </span>
          </label>
          <div className="navigation">
            <button
              type="button"
              className="principal"
              disabled={occupe || valeur.trim().length < 8}
              onClick={() => void agir(() => enregistrerCle(secret.nom, valeur.trim()))}
            >
              Enregistrer
            </button>
            {secret.configure ? (
              <button
                type="button"
                className="secondaire"
                disabled={occupe}
                onClick={() => void agir(() => oublierCle(secret.nom))}
              >
                Oublier
              </button>
            ) : null}
          </div>
        </div>
      )}
      {message ? <p className="erreur">{message}</p> : null}
    </article>
  )
}

export function Console() {
  const [jeton, setJeton] = useState(lireJeton())
  const [etat, setEtat] = useState<EtatSysteme | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [statut, setStatut] = useState<number | null>(null)

  const rafraichir = useCallback(async () => {
    setErreur(null)
    try {
      setEtat(await chercherEtat())
    } catch (e) {
      setEtat(null)
      setErreur((e as Error).message)
      setStatut(e instanceof ErreurAdmin ? e.statut : null)
    }
  }, [])

  useEffect(() => {
    if (lireJeton()) void rafraichir()
  }, [rafraichir])

  function connecter() {
    ecrireJeton(jeton.trim())
    void rafraichir()
  }

  const peuPerimes = etat?.baremes.filter((b) => b.perime) ?? []
  const vides = etat?.baremes.filter((b) => b.vide) ?? []

  return (
    <main className="app admin">
      <header className="entete">
        <h1>KITETUDIANT</h1>
        <p className="baseline">Administration</p>
      </header>

      {etat === null ? (
        <section className="etape">
          <h2>Jeton d’administration</h2>
          <p className="aide">
            Il est défini par <code>ADMIN_TOKEN</code> dans l’environnement du serveur.
            Il n’est pas stocké ici : il disparaît à la fermeture de l’onglet.
          </p>
          <label className="champ">
            <span className="champ-label">Jeton</span>
            <span className="champ-saisie">
              <input
                type="password"
                autoComplete="off"
                value={jeton}
                onChange={(e) => setJeton(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') connecter()
                }}
              />
            </span>
          </label>
          <div className="navigation">
            <button type="button" className="principal" onClick={connecter}>
              Entrer
            </button>
          </div>
          {erreur ? (
            <>
              <p className="erreur">{erreur}</p>
              {statut === 421 ? (
                <p className="note">
                  Lancez d’abord le certificat : <code>DOMAIN=… TLS=1 TLS_EMAIL=…
                  bash deploy/vps-setup.sh</code>
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : (
        <>
          <section className="bloc">
            <h2>Clés d’API</h2>
            <p className="bloc-intro">
              Elles sont chiffrées au repos et ne ressortent jamais d’ici : seuls les
              quatre derniers caractères s’affichent. Une clé posée dans
              l’environnement du serveur l’emporte toujours sur celle d’ici.
            </p>
            {etat.secrets.map((s) => (
              <Secret key={s.nom} secret={s} onChange={() => void rafraichir()} />
            ))}
          </section>

          <section className="bloc">
            <h2>Barèmes</h2>
            {peuPerimes.length === 0 && vides.length === 0 ? (
              <p className="note">Tous les barèmes sont à jour.</p>
            ) : null}
            {peuPerimes.length > 0 ? (
              <p className="avertissement">
                {peuPerimes.length === 1
                  ? '1 barème a dépassé sa date de dernière vérification.'
                  : `${peuPerimes.length} barèmes ont dépassé leur date de dernière vérification.`}{' '}
                Relancez l’extraction OpenFisca ou vérifiez la source officielle.
              </p>
            ) : null}
            <ul className="baremes">
              {etat.baremes.map((b) => (
                <li key={b.cle} className={b.perime ? 'perime' : b.vide ? 'vide' : ''}>
                  <span>{b.libelle}</span>
                  <span className="note">
                    {b.vide
                      ? 'aucune valeur — traité comme donnée manquante'
                      : `millésime ${b.millesime}${
                          b.verifieLe ? `, vérifié le ${b.verifieLe}` : ''
                        }${b.perime ? ' — à revérifier' : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="bloc">
            <h2>Retours d’étudiants</h2>
            {etat.millesimes.length === 0 ? (
              <p className="note">Aucun retour déposé, aucune année.</p>
            ) : (
              <ul className="baremes">
                {etat.millesimes.map((m) => (
                  <li key={m.millesime}>
                    <span>{m.millesime}</span>
                    <span className="note">
                      {m.retours} retour{m.retours > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="navigation">
            <button type="button" className="secondaire" onClick={() => void rafraichir()}>
              Rafraîchir
            </button>
            <button
              type="button"
              className="secondaire"
              onClick={() => {
                ecrireJeton('')
                setJeton('')
                setEtat(null)
              }}
            >
              Se déconnecter
            </button>
          </div>

          <footer className="pieds">
            <p>État relevé le {new Date(etat.le).toLocaleString('fr-FR')}.</p>
          </footer>
        </>
      )}
    </main>
  )
}
