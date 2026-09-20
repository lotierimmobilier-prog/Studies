/**
 * La fiche d'une formation, à son adresse propre.
 *
 * ── Pourquoi cet écran existe ────────────────────────────────────────────
 *
 * Jusqu'ici une formation n'était qu'une carte dans une liste de résultats.
 * On ne pouvait ni la partager, ni la mettre en favori, ni y revenir le
 * lendemain, ni la faire lire à ses parents. Elle n'avait pas d'adresse, donc
 * elle n'existait pas en dehors de la session qui l'avait produite.
 *
 * ── Trois onglets, et pourquoi trois ─────────────────────────────────────
 *
 * Admission, Vivre ici, Après. Ce sont trois questions de nature différente,
 * auxquelles répondent trois jeux de données différents, avec trois degrés de
 * solidité différents. Les empiler sur une seule page laisserait croire
 * qu'elles se valent ; les séparer oblige à dire, sur chacune, d'où vient ce
 * qu'on affiche.
 *
 * Les onglets ne sont PAS une note globale déguisée : aucun ne classe la
 * formation, aucun ne produit de score, et l'ordre est toujours le même quelle
 * que soit la formation (règle 5 de CLAUDE.md).
 *
 * ── Ce que cette page n'affiche pas, et le dit ───────────────────────────
 *
 * Le reste-à-vivre. Il dépend de la bourse, du logement, du train de vie et de
 * la contribution familiale — toutes choses que le parcours demande et que
 * cette page ignore. L'afficher ici supposerait d'inventer ces réponses, ce
 * que la règle 1 interdit. L'onglet « Vivre ici » le dit en toutes lettres et
 * propose le parcours.
 */

import { useEffect, useState } from 'react'

import { CarteALaDemande } from './carte.tsx'
import { FilAriane } from './filAriane.tsx'
import { liensLogement } from './logement.ts'
import { euros, eurosPrecis, nombre } from './nombres.ts'
import { adresseComplete, cheminDe, type Route } from './routes.ts'
import {
  formationParCode,
  loyerDe,
  nomCommune,
  SOURCE_PARCOURSUP,
  SURFACE_TYPE,
  type Formation,
} from './donnees.ts'

type Onglet = 'admission' | 'vivre' | 'apres'

const ONGLETS: readonly { readonly cle: Onglet; readonly libelle: string }[] = [
  { cle: 'admission', libelle: 'Admission' },
  { cle: 'vivre', libelle: 'Vivre ici' },
  { cle: 'apres', libelle: 'Après' },
]

/* ------------------------------------------------------------ une donnée */

/**
 * Un chiffre et ce qu'il veut dire.
 *
 * `null` ne disparaît pas : il s'affiche « non publié ». Une case vide se lit
 * comme un oubli du site ; « non publié » se lit comme une information sur le
 * jeu de données, et c'en est une.
 */
function Donnee({
  libelle,
  valeur,
  unite = '',
  precision,
}: {
  readonly libelle: string
  readonly valeur: number | null
  readonly unite?: string
  readonly precision?: string
}) {
  return (
    <div className={valeur === null ? 'donnee donnee-absente' : 'donnee'}>
      <span className="donnee-valeur">
        {valeur === null ? 'non publié' : `${nombre(valeur)}${unite}`}
      </span>
      <span className="donnee-libelle">{libelle}</span>
      {precision !== undefined ? <span className="note">{precision}</span> : null}
    </div>
  )
}

/* --------------------------------------------------------- les mentions */

/**
 * La répartition des admis par mention au bac.
 *
 * Rapportée aux ADMIS, jamais aux présents : le ministère publie « combien
 * d'admis avaient telle mention », et ramener ces effectifs à autre chose
 * donnerait un total qui ne tombe pas à cent.
 *
 * Si une seule série manque, la répartition n'est pas affichée du tout : des
 * barres dont la somme ne fait pas le compte donnent une impression de
 * précision qu'elles n'ont pas.
 */
function Mentions({ formation }: { readonly formation: Formation }) {
  const s = formation.stats
  const parts = [
    { libelle: 'Félicitations', valeur: s.admisMentionTBF },
    { libelle: 'Mention très bien', valeur: s.admisMentionTB },
    { libelle: 'Mention bien', valeur: s.admisMentionB },
    { libelle: 'Mention assez bien', valeur: s.admisMentionAB },
    { libelle: 'Sans mention', valeur: s.admisSansMention },
  ]
  if (parts.some((p) => p.valeur === null)) {
    return (
      <p className="note">
        La répartition par mention n’est pas publiée en entier pour cette formation.
      </p>
    )
  }
  const total = parts.reduce((somme, p) => somme + (p.valeur ?? 0), 0)
  if (total === 0) return null
  return (
    <>
      <h4 className="fiche-sous-titre">Les mentions qu’avaient les admis</h4>
      <ul className="mentions">
        {parts.map((p) => {
          const part = Math.round((100 * (p.valeur ?? 0)) / total)
          return (
            <li key={p.libelle} className="mention">
              <span className="mention-libelle">{p.libelle}</span>
              <span className="mention-barre" aria-hidden="true">
                <span className="mention-part" style={{ width: `${part}%` }} />
              </span>
              <span className="mention-chiffre">
                {part} % <span className="note">({p.valeur} admis)</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="note">
        Ces chiffres décrivent une <strong>promotion</strong>, pas un élève. Une formation
        où beaucoup d’admis avaient une mention n’empêche personne d’y entrer sans.
      </p>
    </>
  )
}

/* --------------------------------------------------------- les onglets */

function Admission({ formation }: { readonly formation: Formation }) {
  const s = formation.stats
  return (
    <>
      <div className="donnees">
        <Donnee libelle="Places offertes" valeur={s.capacite} />
        <Donnee libelle="Admis" valeur={s.admisTotal} />
        <Donnee
          libelle="Taux d’accès"
          valeur={s.tauxAcces}
          unite=" %"
          precision="part des candidats ayant reçu une proposition"
        />
        <Donnee libelle="Admis boursiers" valeur={s.admisBoursiers} />
      </div>

      <h4 className="fiche-sous-titre">D’où venaient les admis</h4>
      <div className="donnees">
        <Donnee libelle="Bac général" valeur={s.admisBacGeneral} />
        <Donnee libelle="Bac technologique" valeur={s.admisBacTechno} />
        <Donnee libelle="Bac professionnel" valeur={s.admisBacPro} />
        <Donnee libelle="Même académie" valeur={s.admisMemeAcademie} />
      </div>

      <Mentions formation={formation} />

      <p className="fiche-source">
        {SOURCE_PARCOURSUP} — session {formation.session || 'non précisée'}.
        {s.selective
          ? ' Formation sélective : le dossier est examiné.'
          : ' Formation non sélective.'}
      </p>
    </>
  )
}

function VivreIci({
  formation,
  onCommencer,
}: {
  readonly formation: Formation
  readonly onCommencer: () => void
}) {
  const loyer = loyerDe(formation.codeInsee)
  const commune = formation.codeInsee === null ? null : nomCommune(formation.codeInsee)

  return (
    <>
      {loyer === null ? (
        <p className="avertissement">
          L’indicateur des loyers ne couvre pas {commune ?? formation.ville}. Aucun montant
          n’est affiché ici — nous préférons ne rien dire plutôt que d’avancer un chiffre
          pris ailleurs.
        </p>
      ) : (
        <>
          <div className="donnees">
            <Donnee
              libelle={`Loyer estimé d’un ${SURFACE_TYPE} m²`}
              valeur={Math.round(loyer.euroParM2.central * SURFACE_TYPE)}
              unite=" €"
              precision={`entre ${euros(
                Math.round(loyer.euroParM2.bas * SURFACE_TYPE),
              )} et ${euros(Math.round(loyer.euroParM2.haut * SURFACE_TYPE))} par mois`}
            />
          </div>
          <p className="note">
            Soit {eurosPrecis(loyer.euroParM2.central)} par m², charges comprises, pour un
            bien loué vide. {loyer.source}, millésime {loyer.millesime}.
            {loyer.qualite === 'commune'
              ? ' Estimation à l’échelle de la commune.'
              : ` Estimation à l’échelle « ${loyer.qualite} » : la commune a trop peu d’annonces pour être estimée seule.`}
          </p>
        </>
      )}

      {/* Le RAV n'est PAS calculé ici, et la page le dit. Il dépend de la
          bourse, du train de vie et de la contribution familiale, que cette
          page ignore : l'afficher supposerait de les inventer. */}
      <div className="encadre-action">
        <p>
          Ce loyer n’est pas ton reste-à-vivre. Pour savoir ce qu’il te resterait vraiment
          chaque mois, il faut ta situation : bourse, logement, aide de tes parents, train
          de vie.
        </p>
        <button type="button" className="principal" onClick={onCommencer}>
          Voir ce qu’il me restera pour vivre
        </button>
      </div>

      <h4 className="fiche-sous-titre">Se loger sur place</h4>
      <ul className="liens-logement">
        {liensLogement(formation.ville).map((lien) => (
          <li key={lien.cle}>
            <a href={lien.url} target="_blank" rel="noopener noreferrer">
              {lien.libelle}
            </a>
            <span className="note">{lien.note}</span>
          </li>
        ))}
      </ul>

      {formation.coordonnees !== null ? (
        <CarteALaDemande
          points={[
            {
              cle: formation.id,
              lat: formation.coordonnees.lat,
              lon: formation.coordonnees.lon,
              libelle: `${formation.etablissement} — ${formation.ville}`,
            },
          ]}
        />
      ) : (
        <p className="note">
          La position de cette formation n’est pas publiée : la carte ne s’affiche pas.
        </p>
      )}
    </>
  )
}

/**
 * La recherche de cette formation sur le site de l'Onisep.
 *
 * ── Pourquoi un lien et pas le contenu ───────────────────────────────────
 *
 * L'Onisep publie de vraies fiches de débouchés, ce que Parcoursup ne fait
 * pas. Mais son jeu est sous licence ODbL, qui impose le partage à
 * l'identique : l'intégrer engagerait tout ce qu'on en dérive, pour toujours.
 * Un lien vers leur recherche n'utilise aucune de leurs données et ne
 * déclenche aucune obligation (décision D13).
 *
 * ── Ce qui n'a pas pu être vérifié ───────────────────────────────────────
 *
 * onisep.fr répond 403 à notre environnement de développement, comme
 * leboncoin. Le format des paramètres de recherche n'a donc PAS été
 * confirmé sur pièce. Le libellé du lien dit « chercher » et non « la fiche
 * de cette formation » : si le paramètre est ignoré, l'élève arrive quand
 * même sur le site où l'information se trouve, et le lien n'aura rien promis
 * qu'il ne tient pas.
 */
function rechercheOnisep(libelle: string): string {
  const requete = libelle.replace(/\s*-\s*/g, ' ').trim()
  return `https://www.onisep.fr/recherche?context=formation&text=${encodeURIComponent(requete)}`
}

/**
 * L'onglet « Après ».
 *
 * Il dit surtout ce que l'open data NE publie PAS. C'est volontaire : un
 * onglet vide se lit comme une page inachevée, alors qu'un onglet qui explique
 * pourquoi il est vide dit quelque chose de vrai sur les données publiques —
 * et évite qu'on aille chercher ailleurs un chiffre qui n'existe nulle part.
 */
function Apres({ formation }: { readonly formation: Formation }) {
  return (
    <>
      <p>
        Le jeu Parcoursup décrit qui entre dans une formation. Il ne décrit pas ce que
        deviennent ceux qui en sortent : ni taux de réussite, ni poursuite d’études, ni
        insertion. Ces chiffres existent pour certains diplômes, mais pas formation par
        formation, et nous ne les inventerons pas.
      </p>
      <h4 className="fiche-sous-titre">Ce qu’on peut dire quand même</h4>
      <ul className="article-liste">
        <li>
          Cette formation est classée « {formation.filiere || 'non précisée'} » par le
          ministère. C’est le <strong>type</strong> de formation, pas la discipline.
        </li>
        <li>
          {formation.stats.selective
            ? 'Elle est sélective : le dossier est examiné, et le rang d’appel compte.'
            : 'Elle n’est pas sélective : les candidats du secteur sont prioritaires, et le rang d’appel joue moins.'}
        </li>
      </ul>
      <h4 className="fiche-sous-titre">Où trouver les débouchés</h4>
      <p>
        L’Onisep publie des fiches de débouchés par diplôme. Nous ne reprenons pas leur
        contenu ici : leur licence impose un partage à l’identique, qui engagerait tout ce
        qu’on en dérive. On t’y emmène plutôt directement.
      </p>
      <p className="liens-externes">
        <a
          href={rechercheOnisep(formation.libelle)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Chercher cette formation sur l’Onisep
          <span aria-hidden="true"> ↗</span>
        </a>
      </p>
    </>
  )
}

/* ------------------------------------------------------------- la page */

export function PageFormation({
  code,
  onNaviguer,
  onCommencer,
}: {
  readonly code: string
  readonly onNaviguer: (route: Route) => void
  readonly onCommencer: () => void
}) {
  const [formation, setFormation] = useState<Formation | null>(null)
  const [etat, setEtat] = useState<'charge' | 'prete' | 'absente' | 'erreur'>('charge')
  const [message, setMessage] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('admission')

  useEffect(() => {
    let vivant = true
    setEtat('charge')
    formationParCode(code)
      .then((f) => {
        if (!vivant) return
        setFormation(f)
        setEtat(f === null ? 'absente' : 'prete')
      })
      .catch((e: unknown) => {
        if (!vivant) return
        setMessage((e as Error).message)
        setEtat('erreur')
      })
    return () => {
      vivant = false
    }
  }, [code])

  // Titre et lien canonique : sans eux, toutes les fiches partagent le titre
  // de l'accueil, et un moteur les voit comme une seule page.
  useEffect(() => {
    const precedent = document.title
    if (formation !== null) {
      document.title = `${formation.libelle} — ${formation.etablissement} | KitEtudiant.fr`
      let lien = document.head.querySelector('link[rel="canonical"]')
      if (lien === null) {
        lien = document.createElement('link')
        lien.setAttribute('rel', 'canonical')
        document.head.append(lien)
      }
      lien.setAttribute('href', adresseComplete({ vue: 'formation', code }))
    }
    return () => {
      document.title = precedent
    }
  }, [formation, code])

  return (
    <main className="app">
      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Chercher une école', route: { vue: 'recherche' } },
          { libelle: formation?.libelle ?? 'Formation', route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      {etat === 'charge' ? (
        <section className="bloc">
          <p className="note" role="status" aria-live="polite">
            Chargement de la fiche…
          </p>
        </section>
      ) : null}

      {etat === 'absente' ? (
        <section className="bloc">
          <h2>Cette formation n’existe pas dans les données publiées</h2>
          <p>
            Le code <code>{code}</code> ne correspond à aucune formation de la session
            publiée par le ministère. Il a pu changer d’une année sur l’autre.
          </p>
          <p className="note">
            Nous n’ouvrons pas une formation approchante : une adresse partagée qui ouvre
            la mauvaise école est pire qu’une adresse qui ne s’ouvre pas, parce que
            personne ne s’en aperçoit.
          </p>
          <div className="navigation">
            <button
              type="button"
              className="principal"
              onClick={() => onNaviguer({ vue: 'recherche' })}
            >
              Chercher une école
            </button>
          </div>
        </section>
      ) : null}

      {etat === 'erreur' ? (
        <section className="bloc">
          <p className="erreur">{message}</p>
        </section>
      ) : null}

      {formation !== null && etat === 'prete' ? (
        <article className="fiche-formation">
          <header className="fiche-entete">
            <h1>{formation.libelle}</h1>
            <p className="fiche-lieu">
              {formation.uai !== null ? (
                <a href={cheminDe({ vue: 'etablissement', uai: formation.uai })}
                  onClick={(ev) => {
                    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
                    ev.preventDefault()
                    onNaviguer({ vue: 'etablissement', uai: formation.uai! })
                  }}
                >
                  {formation.etablissement}
                </a>
              ) : (
                formation.etablissement
              )}{' '}
              — {formation.ville} ({formation.departement})
            </p>
            {formation.statutEtablissement !== null ? (
              <p className="note">
                Statut publié : {formation.statutEtablissement}.
                {formation.statutEtablissement.startsWith('Privé')
                  ? ' Les frais de scolarité d’un établissement privé ne sont pas publiés dans l’open data : renseigne-toi auprès de l’école.'
                  : ''}
              </p>
            ) : null}
          </header>

          <div className="fiche-onglets" role="tablist" aria-label="Sections de la fiche">
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                type="button"
                role="tab"
                id={`onglet-${o.cle}`}
                aria-selected={onglet === o.cle}
                aria-controls={`panneau-${o.cle}`}
                className={onglet === o.cle ? 'onglet onglet-actif' : 'onglet'}
                onClick={() => setOnglet(o.cle)}
              >
                {o.libelle}
              </button>
            ))}
          </div>

          <div
            className="fiche-panneau"
            role="tabpanel"
            id={`panneau-${onglet}`}
            aria-labelledby={`onglet-${onglet}`}
          >
            {onglet === 'admission' ? <Admission formation={formation} /> : null}
            {onglet === 'vivre' ? (
              <VivreIci formation={formation} onCommencer={onCommencer} />
            ) : null}
            {onglet === 'apres' ? <Apres formation={formation} /> : null}
          </div>

          {formation.lien !== null ? (
            <p className="note">
              <a href={formation.lien} target="_blank" rel="noopener noreferrer">
                La fiche officielle sur Parcoursup
              </a>
            </p>
          ) : null}
        </article>
      ) : null}
    </main>
  )
}
