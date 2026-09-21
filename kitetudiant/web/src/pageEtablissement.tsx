/**
 * La page d'un établissement, par son code UAI.
 *
 * ── Pourquoi par l'UAI et jamais par le nom ──────────────────────────────
 *
 * Deux établissements peuvent porter le même nom, et un nom se réécrit d'une
 * session à l'autre — fusion d'universités, changement de campus, faute de
 * frappe corrigée. L'UAI, lui, ne bouge pas. C'est la clé pivot des
 * établissements (CLAUDE.md), et c'est ce qui fait qu'une adresse partagée
 * aujourd'hui ouvrira le même établissement dans deux ans.
 *
 * ── Ce que la page montre ────────────────────────────────────────────────
 *
 * Les formations de l'établissement, et rien de plus. Pas de note, pas de
 * classement, pas de « meilleur choix » : ce serait exactement la note globale
 * unique que la règle 5 interdit, déguisée en palmarès d'établissement.
 *
 * L'ordre est celui du nombre de vœux reçus — c'est-à-dire la popularité
 * auprès des candidats, pas une qualité. La page le dit.
 */

import { useEffect, useMemo, useState } from 'react'

import { FilAriane } from './filAriane.tsx'
import { nombre } from './nombres.ts'
import { adresseComplete, cheminDe, type Route } from './routes.ts'
import { libelleDuTheme, specialitesDesLibelles } from './themes.ts'
import { useMetadonnees } from './metadonnees.ts'
import { lienOffresFranceTravail } from '../../packages/metiers/src/index.ts'
import {
  chercherDebouches,
  EmploiIndisponible,
  formationsDeLEtablissement,
  SOURCE_PARCOURSUP,
  type DebouchesEtablissement,
  type Formation,
} from './donnees.ts'

/** Limite de l'API. Au-delà, la page le dit plutôt que de laisser croire. */
const LIMITE_API = 100

function dateLisible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Les débouchés de l'école, spécialité par spécialité.
 *
 * ── Ce que ces chiffres sont, et ce qu'ils ne sont pas ───────────────────
 *
 * Ce ne sont PAS les débouchés des diplômés de cette école : personne ne
 * publie le devenir des sortants formation par formation, et nous ne
 * l'inventerons pas. C'est le nombre d'annonces ouvertes aujourd'hui dans
 * les secteurs vers lesquels ses spécialités mènent — un ordre de grandeur
 * sur un bassin d'emploi, pas une promesse d'embauche.
 *
 * Le rapprochement spécialité → métiers est le NÔTRE. Parcoursup ne le
 * publie pas, et la page le dit plutôt que de le laisser croire officiel.
 */
function Debouches({
  formations,
  codeInsee,
}: {
  readonly formations: readonly Formation[]
  readonly codeInsee: string | null
}) {
  // `useMemo` parce que le tableau sert de dépendance à l'effet : recalculé à
  // chaque rendu, il relancerait le comptage en boucle.
  const specialites = useMemo(
    () => specialitesDesLibelles(formations.map((f) => f.libelle)),
    [formations],
  )
  const cles = specialites.join(',')

  const [debouches, setDebouches] = useState<DebouchesEtablissement | null>(null)
  const [etat, setEtat] = useState<'charge' | 'prete' | 'indisponible' | 'erreur' | 'aucune'>(
    'charge',
  )
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (cles === '') {
      setEtat('aucune')
      return
    }
    let vivant = true
    setEtat('charge')
    chercherDebouches(cles.split(','), codeInsee)
      .then((d) => {
        if (!vivant) return
        setDebouches(d)
        setEtat('prete')
      })
      .catch((e: unknown) => {
        if (!vivant) return
        if (e instanceof EmploiIndisponible) {
          setEtat('indisponible')
          return
        }
        setMessage((e as Error).message)
        setEtat('erreur')
      })
    return () => {
      vivant = false
    }
  }, [cles, codeInsee])

  // Aucune spécialité reconnue : on ne montre rien. Proposer des secteurs au
  // hasard serait pire que de se taire.
  if (etat === 'aucune') return null

  if (etat === 'charge') {
    return (
      <section className="bloc">
        <h2>Vers quels métiers mènent ces formations</h2>
        <p className="note" role="status" aria-live="polite">
          Comptage des offres d’emploi…
        </p>
      </section>
    )
  }

  if (etat === 'indisponible' || etat === 'erreur' || debouches === null) {
    return (
      <section className="bloc">
        <h2>Vers quels métiers mènent ces formations</h2>
        <p className="note">
          Le comptage des offres d’emploi n’est pas disponible pour l’instant
          {message === null ? '' : ` (${message})`}.
        </p>
      </section>
    )
  }

  const { specialites: comptees, region, demandees, releveLe } = debouches
  const tues = demandees - comptees.length

  return (
    <section className="bloc">
      <h2>Vers quels métiers mènent ces formations</h2>

      {/* La mise en garde AVANT les chiffres, pas après : un lecteur qui fait
          défiler jusqu'en bas les a déjà lus comme un verdict. */}
      <p className="bloc-intro">
        Ce ne sont pas les débouchés des diplômés de cette école — personne ne publie le
        devenir des sortants, formation par formation. Ce sont les annonces ouvertes le{' '}
        {dateLisible(releveLe)} dans les secteurs vers lesquels ces spécialités mènent.
      </p>
      <p className="note">
        Beaucoup de recrutements ne passent jamais par une annonce, et un secteur peut
        embaucher sans publier. Ces chiffres situent un ordre de grandeur, rien de plus. Le
        rapprochement entre une spécialité et ses métiers est le nôtre : Parcoursup ne le
        publie pas.
      </p>
      {/* L'ordre est celui de l'école, pas celui des chiffres. Sans cette
          phrase, une spécialité placée en tête avec mille offres devant une
          autre qui en compte cinquante mille se lirait comme un classement
          des débouchés — et le lecteur en tirerait l'inverse du vrai. */}
      <p className="note">
        Ces spécialités sont rangées par <strong>nombre de formations</strong> que l’école y
        propose — c’est ce qu’elle enseigne le plus, <strong>pas</strong> un classement des
        débouchés.
      </p>

      <ul className="specialites">
        {comptees.map((sp) => {
          const libelle = libelleDuTheme(sp.cle)
          return (
            <li key={sp.cle} className="specialite">
              <div className="specialite-tete">
                <a
                  className="specialite-titre"
                  href={lienOffresFranceTravail(libelle, region)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {libelle}
                  <span aria-hidden="true"> ↗</span>
                </a>
                <p className="note">{sp.note}</p>
              </div>
              <div className="specialite-chiffres">
                <span className="specialite-chiffre">
                  <strong>{sp.enFrance === null ? 'non compté' : nombre(sp.enFrance)}</strong>
                  <span className="note"> en France</span>
                </span>
                {region !== null ? (
                  <span className="specialite-chiffre">
                    <strong>{sp.enRegion === null ? 'non compté' : nombre(sp.enRegion)}</strong>
                    <span className="note"> dans la région</span>
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Ce qui n'est pas compté est DIT. Une liste tronquée en silence laisse
          croire que l'école ne fait que ça. */}
      {tues > 0 ? (
        <p className="note">
          Cette école couvre {nombre(demandees)} spécialités ; les {nombre(comptees.length)}{' '}
          les plus enseignées sont comptées ici. Chaque comptage interroge France Travail,
          dont le quota est limité.
        </p>
      ) : null}

      <p className="fiche-source">{debouches.source}</p>
    </section>
  )
}


export function PageEtablissement({
  uai,
  onNaviguer,
}: {
  readonly uai: string
  readonly onNaviguer: (route: Route) => void
}) {
  const [formations, setFormations] = useState<readonly Formation[]>([])
  const [etat, setEtat] = useState<'charge' | 'prete' | 'erreur'>('charge')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    setEtat('charge')
    formationsDeLEtablissement(uai)
      .then((liste) => {
        if (!vivant) return
        setFormations(liste)
        setEtat('prete')
      })
      .catch((e: unknown) => {
        if (!vivant) return
        setMessage((e as Error).message)
        setEtat('erreur')
      })
    return () => {
      vivant = false
    }
  }, [uai])

  const premiere = formations[0]
  const nom = premiere?.etablissement ?? uai

  /* Même correction que sur la fiche de formation : la ville dans le titre,
     et une description propre au lieu de celle de l'accueil. */
  useMetadonnees(
    premiere === undefined
      ? { titre: document.title, description: '' }
      : {
          titre: `${nom} (${premiere.ville}) — toutes ses formations sur Parcoursup | KitEtudiant.fr`,
          description:
            `Les ${formations.length} formations de ${nom} publiées sur Parcoursup : ` +
            `places, taux d’accès, sélectivité, et le coût de la vie à ${premiere.ville}.`,
          canonique: adresseComplete({ vue: 'etablissement', uai }),
        },
  )

  return (
    <main className="app app-large">
      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Chercher une école', route: { vue: 'recherche' } },
          { libelle: nom, route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      <section className="bloc">
        <h1>{nom}</h1>
        {premiere !== undefined ? (
          <p className="bloc-intro">
            {premiere.ville} ({premiere.departement}) · académie de {premiere.academie}
            {premiere.statutEtablissement !== null
              ? ` · ${premiere.statutEtablissement}`
              : ''}
          </p>
        ) : null}
        <p className="note">
          Code UAI <code>{uai}</code> — l’identifiant officiel de l’établissement.
        </p>

        {etat === 'charge' ? (
          <p className="note" role="status" aria-live="polite">
            Chargement des formations…
          </p>
        ) : null}
        {etat === 'erreur' ? <p className="erreur">{message}</p> : null}

        {etat === 'prete' && formations.length === 0 ? (
          <>
            <h3>Aucune formation publiée sous ce code</h3>
            <p>
              Le code UAI <code>{uai}</code> n’apparaît pas dans la session publiée par le
              ministère. L’établissement existe peut-être, mais il ne recrute pas par
              Parcoursup cette année — ou il a changé de code.
            </p>
          </>
        ) : null}

      </section>

      {/* AVANT la liste des formations, et c'est tout le sujet : une
          université en publie jusqu'à cent, et une synthèse enterrée sous
          cent vignettes n'est lue par personne. Le détail vient après. */}
      {etat === 'prete' && formations.length > 0 ? (
        <Debouches formations={formations} codeInsee={premiere?.codeInsee ?? null} />
      ) : null}

      {/* La section entière est conditionnelle, et pas seulement son contenu :
          un « bloc » vide dessinerait un cadre bordé autour de rien. */}
      {formations.length > 0 ? (
        <section className="bloc">
          <h2>Les formations de cette école</h2>
          <>
            <p>
              {formations.length === LIMITE_API
                ? `Les ${LIMITE_API} formations les plus demandées de cet établissement. Il y en a peut-être davantage : l’open data n’en renvoie pas plus d’un coup.`
                : `${formations.length} formation${formations.length > 1 ? 's' : ''} publiée${formations.length > 1 ? 's' : ''} pour cet établissement.`}{' '}
              {formations.length > 1 ? (
                <>
                  Elles sont rangées par nombre de vœux reçus — c’est la popularité auprès
                  des candidats, <strong>pas une qualité</strong>.
                </>
              ) : (
                <>
                  Le nombre de vœux reçus mesure la popularité auprès des candidats,{' '}
                  <strong>pas une qualité</strong>.
                </>
              )}
            </p>
            <ul className="formations-etablissement">
              {formations.map((f) => (
                <li key={f.id}>
                  <a
                    className="formation-vignette"
                    href={cheminDe({ vue: 'formation', code: f.id })}
                    onClick={(ev) => {
                      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
                      ev.preventDefault()
                      onNaviguer({ vue: 'formation', code: f.id })
                    }}
                  >
                    <span className="formation-vignette-titre">{f.libelle}</span>
                    <span className="note">
                      {f.filiere}
                      {f.stats.selective ? ' · sélective' : ' · non sélective'}
                      {f.stats.capacite !== null
                        ? ` · ${f.stats.capacite} places`
                        : ' · places non publiées'}
                      {f.stats.tauxAcces !== null
                        ? ` · ${f.stats.tauxAcces} % de taux d’accès`
                        : ''}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="fiche-source">{SOURCE_PARCOURSUP}</p>
          </>
        </section>
      ) : null}
    </main>
  )
}
