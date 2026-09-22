/**
 * Console d'administration.
 *
 * Elle ne fait que trois choses : poser les clés d'API, montrer l'état du
 * système, et dire ce qui ne va pas. Aucune valeur de clé n'est jamais affichée
 * — le serveur n'en renvoie que les quatre derniers caractères.
 */

import { useCallback, useEffect, useState } from 'react'
import { Marque } from '../marque.tsx'
import { nombre } from '../nombres.ts'

import { Articles } from './Articles.tsx'
import { Partenaires } from './Partenaires.tsx'
import { Statistiques } from './Statistiques.tsx'

import {
  chercherEtat,
  essayerEmploi,
  ecrireJeton,
  enregistrerCle,
  ErreurAdmin,
  lireJeton,
  oublierCle,
  type EssaiEmploi,
  type EtatSecret,
  type EtatSysteme,
} from './api.ts'

interface Libelle {
  readonly titre: string
  readonly role: string
  readonly ou: string
  /**
   * Service dont la clé fait partie. Deux clés d'un même service ne valent
   * rien l'une sans l'autre : la console doit le dire, sinon on pose la
   * première, on voit « configurée », et on croit avoir fini.
   */
  readonly service?: string
}

const LIBELLES: Record<string, Libelle> = {
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
  FRANCE_TRAVAIL_ID: {
    titre: 'France Travail — identifiant client',
    role: 'Sans lui, l’onglet « Après » d’une fiche n’affiche aucun nombre d’offres d’emploi.',
    ou: 'francetravail.io, « Mes applications » — commence par PAR_',
    service: 'France Travail',
  },
  FRANCE_TRAVAIL_SECRET: {
    titre: 'France Travail — clé secrète',
    role: 'Va avec l’identifiant ci-dessus. L’un sans l’autre ne sert à rien.',
    ou: 'francetravail.io, la même application',
    service: 'France Travail',
  },
}

/** Les clés d'un service, dans l'ordre où la console les présente. */
function clesDuService(service: string): string[] {
  return Object.entries(LIBELLES)
    .filter(([, l]) => l.service === service)
    .map(([nom]) => nom)
}

function Secret({
  secret,
  onChange,
  incomplet,
}: {
  secret: EtatSecret
  onChange: () => void
  /** Vrai quand cette clé est posée mais que son binôme manque. */
  incomplet: boolean
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

      {/* Une clé posée dont le binôme manque : le service reste éteint, et
          rien d'autre ne le dirait — la ligne au-dessus affiche
          « Configurée » en vert. */}
      {incomplet ? (
        <p className="avertissement">
          Il manque l’autre moitié : {LIBELLES[secret.nom]?.service} a besoin de ses deux
          clés. Tant qu’une seule est posée, la fonctionnalité reste éteinte.
        </p>
      ) : null}

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

/**
 * Cette clé est-elle posée alors que son binôme manque ?
 *
 * Sans ce contrôle, poser la première des deux affiche « Configurée » en
 * vert et laisse croire que c'est fait, alors que le service reste éteint.
 */
function binomeManquant(secrets: readonly EtatSecret[], secret: EtatSecret): boolean {
  const service = LIBELLES[secret.nom]?.service
  if (service === undefined || !secret.configure) return false
  return clesDuService(service).some(
    (nom) => nom !== secret.nom && !secrets.find((s) => s.nom === nom)?.configure,
  )
}

/**
 * Le bouton qui éprouve vraiment la connexion France Travail.
 *
 * « Configurée » ne veut dire que « une valeur est posée ». Une clé
 * recopiée de travers, révoquée, ou dont l'application n'a pas la bonne
 * portée s'affiche exactement pareil — et la panne ne se voit alors que sur
 * la fiche d'une formation, où personne ne la relie à la console.
 *
 * L'essai ne s'exécute qu'au clic : il consomme du quota chez France Travail,
 * dont la limite est de dix requêtes par seconde.
 */
function EssaiFranceTravail({ secrets }: { secrets: readonly EtatSecret[] }) {
  const [essai, setEssai] = useState<EssaiEmploi | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const posees = clesDuService('France Travail').every(
    (nom) => secrets.find((s) => s.nom === nom)?.configure,
  )

  return (
    <div className="essai">
      <button
        type="button"
        className="secondaire"
        disabled={occupe || !posees}
        onClick={() => {
          setOccupe(true)
          setErreur(null)
          essayerEmploi()
            .then(setEssai)
            .catch((e: unknown) => setErreur((e as Error).message))
            .finally(() => setOccupe(false))
        }}
      >
        {occupe ? 'Essai en cours…' : 'Tester la connexion France Travail'}
      </button>

      {!posees ? (
        <p className="note">Pose les deux clés pour pouvoir l’essayer.</p>
      ) : null}

      {essai !== null ? (
        <p className={essai.ok ? 'etat-ok' : 'erreur'}>
          {essai.ok ? 'La connexion fonctionne. ' : `Échec à l’étape « ${essai.etape} ». `}
          {essai.detail}
        </p>
      ) : null}
      {erreur !== null ? <p className="erreur">{erreur}</p> : null}
    </div>
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
        <h1 className="marque">
          <Marque />
        </h1>
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
              <Secret
                key={s.nom}
                secret={s}
                onChange={() => void rafraichir()}
                incomplet={binomeManquant(etat.secrets, s)}
              />
            ))}

            <EssaiFranceTravail secrets={etat.secrets} />
          </section>

          <section className="bloc">
            <h2>Base de données</h2>
            {!etat.base.configuree ? (
              <p className="note">
                Pas de <code>DATABASE_URL</code> : le site tourne sur le fichier chiffré
                et l’open data du ministère, comme avant. <strong>Ce n’est pas une
                panne</strong> — c’est le mode normal tant que la bascule n’est pas
                faite.
              </p>
            ) : etat.base.repond ? (
              <>
                <p className="etat-ok">
                  {etat.base.version ?? 'PostgreSQL'} répond sur{' '}
                  <strong>{etat.base.ou}</strong>.
                </p>
                <ul className="baremes">
                  {etat.base.migrations.length === 0 ? (
                    <li>
                      <span>Aucune migration appliquée</span>
                      <span className="note">
                        lance <code>PGURL=… bash kitetudiant/db/migrations/appliquer.sh</code>
                      </span>
                    </li>
                  ) : (
                    etat.base.migrations.map((m) => (
                      <li key={m}>
                        <span>{m}</span>
                        <span className="note">appliquée</span>
                      </li>
                    ))
                  )}
                </ul>

                {/* Sans ce bloc, la console affichait TOUT AU VERT pendant que
                    « Enregistrer dans mes vœux » échouait pour chaque
                    formation : `postgres-setup.sh` crée la base et applique
                    les migrations, mais ne charge pas les données de
                    référence — c'est `charger.sh`. Base configurée, base qui
                    répond, migrations appliquées, et table des formations
                    vide. Constaté en production le 21/09/2026. */}
                {etat.base.reference === null ? null : (
                  <ul className="baremes">
                    {Object.entries(etat.base.reference).map(([table, n]) => (
                      <li key={table}>
                        <span>reference.{table}</span>
                        <span className={n === 0 ? 'alerte' : 'note'}>
                          {n === null
                            ? 'comptage impossible'
                            : n === 0
                              ? 'VIDE — aucun vœu enregistrable'
                              : `${nombre(n)} lignes`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {Object.values(etat.base.reference ?? {}).some((n) => n === 0) ? (
                  <p className="alerte">
                    Les migrations sont appliquées mais les données de référence ne
                    sont pas chargées. Tant que c’est le cas, aucun élève ne peut
                    enregistrer un vœu. Lance{' '}
                    <code>PGURL=… bash kitetudiant/db/migrations/charger.sh</code>, après{' '}
                    <code>scripts/import/preparer.py</code> qui produit les CSV.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="alerte">
                Une adresse est configurée ({etat.base.ou}) mais la base ne répond pas :{' '}
                {etat.base.erreur ?? 'raison inconnue'}. Le site continue de fonctionner
                sans elle.
              </p>
            )}
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

          {/* Le compte des inscrits vit maintenant dans « Statistiques », qui
              en dit plus : actifs à trente jours, créations par jour, comptes
              approchant de la purge. Deux sections du même nom affichant des
              chiffres différents finiraient par se contredire. Seule
              l'alerte de configuration reste ici : elle doit se voir même
              quand les statistiques ne chargent pas. */}
          {!etat.comptes.configure ? (
            <section className="bloc">
              <h2>Comptes élèves</h2>
              <p className="alerte">
                COMPTES_MASTER_KEY n’est pas définie : l’inscription est impossible, et le
                détail du résultat est ouvert à tous. Pose la variable dans l’environnement
                du serveur, puis redémarre.
              </p>
            </section>
          ) : null}

          <Statistiques />

          <Articles />

          <Partenaires />

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
