import { useCallback, useMemo, useState } from 'react'

import type { LigneBudget, Soutenabilite } from '../../packages/budget-engine/src/types.ts'
import {
  calculerResultats,
  jumeauxGeographiques,
  loyerMensuelBrut,
  motsClesDe,
  refAide,
  SCENARIOS,
  trierParPertinence,
  type Reponses,
  type ResultatFormation,
} from './calcul.ts'
import {
  chercherAgregatsRetours,
  chercherAidesLogement,
  chercherFormations,
  MILLESIME_LOYERS,
  SOURCE_LOYERS,
  SOURCE_PARCOURSUP,
  TYPOLOGIE_LOYERS,
  type AgregatRetours,
  type AideLogement,
  type FiltreFormations,
} from './donnees.ts'
import { ETAPES, Question, REPONSES_PAR_DEFAUT } from './parcours.tsx'
import { PanneauRetours, ResumeRetours } from './retours.tsx'

const ACADEMIES = [
  'Aix-Marseille', 'Amiens', 'Besançon', 'Bordeaux', 'Clermont-Ferrand', 'Corse',
  'Créteil', 'Dijon', 'Grenoble', 'Guadeloupe', 'Guyane', 'La Réunion', 'Lille',
  'Limoges', 'Lyon', 'Martinique', 'Mayotte', 'Montpellier', 'Nancy-Metz', 'Nantes',
  'Nice', 'Normandie', 'Orléans-Tours', 'Paris', 'Poitiers', 'Reims', 'Rennes',
  'Strasbourg', 'Toulouse', 'Versailles',
]

/** Le signe moins typographique, pas le trait d'union du clavier. */
function euros(v: number): string {
  const arrondi = Math.round(v)
  const absolu = Math.abs(arrondi).toLocaleString('fr-FR')
  return `${arrondi < 0 ? '\u2212' : ''}${absolu} €`
}

function eurosPrecis(v: number): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

const VERDICTS: Record<Soutenabilite, { texte: string; classe: string }> = {
  soutenable: { texte: 'Finançable', classe: 'vert' },
  tendu: { texte: 'Tendu', classe: 'orange' },
  non_financable: { texte: 'Pas finançable en l’état', classe: 'rouge' },
  indeterminable: { texte: 'Reste-à-vivre non calculable', classe: 'gris' },
}

function Admission({ resultat }: { resultat: ResultatFormation }) {
  const a = resultat.admissibilite
  if (a.statut === 'donnee_manquante') {
    return <p className="admission">{a.raison}</p>
  }
  if (a.statut === 'effectif_insuffisant') {
    return <p className="admission">{a.raison}</p>
  }
  // Une borne basse à zéro ne dit rien : mieux vaut annoncer un plafond.
  const enonce =
    a.bas === 0
      ? `Moins de ${a.haut} % de chances d’avoir une proposition`
      : `Entre ${a.bas} et ${a.haut} % de chances d’avoir une proposition`
  return (
    <p className="admission">
      <strong>{enonce}</strong> — estimation à partir du taux d’accès publié (
      {a.tauxAccesPublie} %) et de {a.effectifAdmis} admis en {a.millesime}. Ce n’est
      pas un modèle calibré.
    </p>
  )
}

function Ligne({ ligne }: { ligne: LigneBudget }) {
  const nom = ligne.poste.replace(/_/g, ' ')
  if (ligne.statut === 'calcule') {
    return (
      <li className={ligne.sens === 'depense' ? 'ligne depense' : 'ligne ressource'}>
        <span className="ligne-poste">{nom}</span>
        <span className="ligne-montant">
          {ligne.sens === 'depense' ? '−' : '+'} {eurosPrecis(ligne.mensualise)}
        </span>
        <span className="ligne-source">
          {ligne.valeur.hypothese} — <em>{ligne.valeur.source}</em> (millésime {ligne.valeur.millesime})
        </span>
      </li>
    )
  }
  return (
    <li className={ligne.statut === 'manquant' ? 'ligne manquante' : 'ligne sans-objet'}>
      <span className="ligne-poste">{nom}</span>
      <span className="ligne-montant">
        {ligne.statut === 'manquant' ? 'donnée manquante' : 'sans objet'}
      </span>
      <span className="ligne-source">{ligne.raison}</span>
    </li>
  )
}

function Carte({
  resultat,
  tous,
  onOuvrir,
  ouvert,
  retours,
}: {
  resultat: ResultatFormation
  tous: readonly ResultatFormation[]
  onOuvrir: () => void
  ouvert: boolean
  retours: AgregatRetours | undefined
}) {
  const central = resultat.parScenario.central
  const verdict = VERDICTS[central.soutenabilite]
  const jumeaux = ouvert ? jumeauxGeographiques(tous, resultat) : []
  return (
    <article className={`carte ${verdict.classe}`}>
      <div className="carte-rav">
        {central.ravMensuel === null ? (
          <span className="rav-absent">Non calculable</span>
        ) : (
          <>
            <span className="rav">{euros(central.ravMensuel)}</span>
            <span className="rav-unite">par mois pour vivre</span>
          </>
        )}
        <span className={`verdict ${verdict.classe}`}>{verdict.texte}</span>
      </div>

      <h3>{resultat.formation.libelle}</h3>
      <p className="etab">
        {resultat.formation.etablissement} — {resultat.formation.ville} (
        {resultat.formation.departement})
      </p>

      {central.ravMensuel !== null ? (
        <p className="fourchette">
          Entre {euros(resultat.parScenario.prudent.ravMensuel ?? 0)} et{' '}
          {euros(resultat.parScenario.optimiste.ravMensuel ?? 0)} selon le scénario de loyer et de job.
        </p>
      ) : null}

      <div className="axes">
        <div className="axe">
          <span className="axe-titre">Ce qui te correspond</span>
          {resultat.affinite.domaineInconnu ? (
            <span className="axe-absent">Domaine non reconnu</span>
          ) : (
            <span className="axe-valeur">{resultat.affinite.score}/100</span>
          )}
        </div>
        <div className="axe">
          <span className="axe-titre">Ce qu’il te reste</span>
          <span className="axe-valeur">
            {central.ravMensuel === null ? 'non calculable' : euros(central.ravMensuel)}
          </span>
        </div>
      </div>

      <Admission resultat={resultat} />
      <ResumeRetours agregat={retours} />

      {central.avertissements.map((a) => (
        <p className="avertissement" key={a}>
          {a}
        </p>
      ))}
      {resultat.raisonAide ? <p className="avertissement">{resultat.raisonAide}</p> : null}

      <button type="button" className="lien" onClick={onOuvrir}>
        {ouvert ? 'Replier le budget' : 'Voir le budget, poste par poste'}
      </button>

      {ouvert ? (
        <div className="detail">
          {resultat.affinite.raisons.length > 0 ? (
            <div className="raisons">
              <h4>Pourquoi cette formation te correspond, ou pas</h4>
              <ul>
                {resultat.affinite.raisons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {resultat.admissibilite.statut === 'fourchette' &&
          resultat.admissibilite.facteurs.length > 0 ? (
            <div className="raisons">
              <h4>Ce qui joue sur tes chances</h4>
              <ul>
                {resultat.admissibilite.facteurs.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <h4>Ton budget mensuel</h4>
          <ul className="lignes">
            {central.lignes.map((l) => (
              <Ligne key={l.poste} ligne={l} />
            ))}
          </ul>

          {jumeaux.length > 0 ? (
            <div className="jumeaux">
              <h4>La même filière ailleurs</h4>
              <p className="note">
                Ce n’est pas un classement des villes : c’est l’écart de reste-à-vivre,
                à formation comparable.
              </p>
              <ul>
                {jumeaux.map((j) => (
                  <li key={j.resultat.formation.id}>
                    <strong>{j.resultat.formation.ville}</strong> — {euros(j.ecart)} de plus par mois
                    <span className="note"> ({j.resultat.formation.etablissement})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <PanneauRetours codFormation={resultat.formation.id} />

          {resultat.formation.lien ? (
            <p>
              <a href={resultat.formation.lien} target="_blank" rel="noreferrer">
                La fiche officielle sur Parcoursup
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default function App() {
  const [etape, setEtape] = useState(0)
  const [reponses, setReponses] = useState<Reponses>(REPONSES_PAR_DEFAUT)
  const [resultats, setResultats] = useState<ResultatFormation[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [retours, setRetours] = useState<Map<string, AgregatRetours>>(new Map())

  const majReponses = useCallback((partiel: Partial<Reponses>) => {
    setReponses((r) => ({ ...r, ...partiel }))
  }, [])

  const lancer = useCallback(async () => {
    setEnCours(true)
    setErreur(null)
    try {
      const filtre: FiltreFormations = { limite: 40 }
      const motsCles = motsClesDe(reponses.passions)
      if (motsCles.length > 0) Object.assign(filtre, { motsCles })
      if (reponses.mobilite !== 'france' && reponses.academie) {
        Object.assign(filtre, { academie: reponses.academie })
      }
      const formations = await chercherFormations(filtre)
      const demandes = formations.flatMap((f) =>
        SCENARIOS.flatMap((s) => {
          const loyer = loyerMensuelBrut(f, reponses, s)
          if (f.codeInsee === null || loyer === null) return []
          return [
            {
              ref: refAide(f.id, s),
              codeInsee: f.codeInsee,
              loyerMensuel: loyer,
              anneeNaissance: reponses.anneeNaissance,
            },
          ]
        }),
      )
      const aides = await chercherAidesLogement(demandes)
      const parRef = new Map<string, AideLogement>(aides.map((a) => [a.ref, a]))
      const aujourdHui = new Date().toISOString().slice(0, 10)
      setRetours(await chercherAgregatsRetours(formations.map((f) => f.id)))
      setResultats(trierParPertinence(calculerResultats(formations, reponses, parRef, aujourdHui)))
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
    }
  }, [reponses])

  const derniere = etape === ETAPES.length - 1
  const etapeCourante = ETAPES[etape]
  const complets = useMemo(
    () => resultats?.filter((r) => r.parScenario.central.ravMensuel !== null).length ?? 0,
    [resultats],
  )

  if (resultats !== null) {
    return (
      <main className="app">
        <header className="entete">
          <h1>KITETUDIANT</h1>
          <p className="baseline">Ce qu’il te restera pour vivre, vœu par vœu.</p>
        </header>

        <p className="resume">
          {resultats.length} formations trouvées, {complets} avec un reste-à-vivre calculé.
          Classées d’abord par ce qui te correspond, puis par ce qu’il te restera pour
          vivre. Les deux ne sont jamais additionnés, et aucun vœu n’est retiré de la liste.
        </p>

        <div className="cartes">
          {resultats.map((r) => (
            <Carte
              key={r.formation.id}
              resultat={r}
              tous={resultats}
              retours={retours.get(r.formation.id)}
              ouvert={ouvert === r.formation.id}
              onOuvrir={() => setOuvert(ouvert === r.formation.id ? null : r.formation.id)}
            />
          ))}
        </div>

        <button type="button" className="secondaire" onClick={() => setResultats(null)}>
          Changer mes réponses
        </button>

        <footer className="pieds">
          <p>
            Loyers : {SOURCE_LOYERS}, millésime {MILLESIME_LOYERS}, typologie «{' '}
            {TYPOLOGIE_LOYERS} ».
          </p>
          <p>Formations et statistiques d’admission : {SOURCE_PARCOURSUP}.</p>
          <p>
            L’estimation de chances lit les statistiques publiées ; ce n’est pas un
            modèle calibré et elle n’a pas été rétro-testée. En dessous de 30 admis
            connus, aucune estimation n’est donnée.
          </p>
          <p>
            Aide au logement calculée par OpenFisca France. Bourses, aide au mérite,
            CVEC et tarif du restaurant universitaire : barèmes officiels datés.
          </p>
          <p>
            Retours d’étudiants : trois axes chiffrés, archivés par année universitaire.
            Aucun commentaire libre n’est collecté, et aucune note d’établissement n’est
            calculée. En dessous de cinq retours sur une année, rien n’est publié.
          </p>
          <p className="non-affiliation">
            KITETUDIANT n’est pas affilié à Parcoursup, au ministère ni aux CROUS.
            Rien de ce que tu fais ici n’est transmis à Parcoursup.
          </p>
        </footer>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="entete">
        <h1>KITETUDIANT</h1>
        <p className="baseline">Ce qu’il te restera pour vivre, vœu par vœu.</p>
      </header>

      <div className="progression" aria-label={`Étape ${etape + 1} sur ${ETAPES.length}`}>
        {ETAPES.map((_, i) => (
          <span key={i} className={i <= etape ? 'pas fait' : 'pas'} />
        ))}
      </div>

      <section className="etape">
        <p className="compteur">
          Question {etape + 1} sur {ETAPES.length}
        </p>
        <h2>{etapeCourante?.titre}</h2>
        <p className="aide">{etapeCourante?.aide}</p>

        <Question etape={etape} reponses={reponses} academies={ACADEMIES} onChange={majReponses} />
      </section>

      {erreur ? <p className="erreur">{erreur}</p> : null}

      <div className="navigation">
        {etape > 0 ? (
          <button type="button" className="secondaire" onClick={() => setEtape(etape - 1)}>
            Retour
          </button>
        ) : null}
        {derniere ? (
          <button type="button" className="principal" onClick={lancer} disabled={enCours}>
            {enCours ? 'Calcul en cours…' : 'Voir ce qu’il me restera'}
          </button>
        ) : (
          <button type="button" className="principal" onClick={() => setEtape(etape + 1)}>
            Continuer
          </button>
        )}
      </div>

      <p className="sans-compte">Sans compte, sans e-mail, rien n’est enregistré.</p>
    </main>
  )
}
