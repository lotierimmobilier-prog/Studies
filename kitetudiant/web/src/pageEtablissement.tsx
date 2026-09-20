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

import { useEffect, useState } from 'react'

import { FilAriane } from './filAriane.tsx'
import { adresseComplete, cheminDe, type Route } from './routes.ts'
import {
  formationsDeLEtablissement,
  SOURCE_PARCOURSUP,
  type Formation,
} from './donnees.ts'

/** Limite de l'API. Au-delà, la page le dit plutôt que de laisser croire. */
const LIMITE_API = 100

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

  useEffect(() => {
    const precedent = document.title
    if (premiere !== undefined) {
      document.title = `${nom} — ses formations | KitEtudiant.fr`
      let lien = document.head.querySelector('link[rel="canonical"]')
      if (lien === null) {
        lien = document.createElement('link')
        lien.setAttribute('rel', 'canonical')
        document.head.append(lien)
      }
      lien.setAttribute('href', adresseComplete({ vue: 'etablissement', uai }))
    }
    return () => {
      document.title = precedent
    }
  }, [premiere, nom, uai])

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

        {formations.length > 0 ? (
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
        ) : null}
      </section>
    </main>
  )
}
