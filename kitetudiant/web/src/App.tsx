import { useCallback, useEffect, useMemo, useState } from 'react'

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
  deconnecter,
  InscriptionRequise,
  jetonSession,
  positionDe,
  chercherArticles,
  chercherFormations,
  MILLESIME_LOYERS,
  SOURCE_LOYERS,
  SOURCE_PARCOURSUP,
  TYPOLOGIE_LOYERS,
  type AgregatRetours,
  type AideLogement,
  type FiltreFormations,
} from './donnees.ts'
import {
  ajouter,
  cartesGagnees,
  cartesDe,
  chargerCollection,
  enregistrerCollection,
  idEtape,
  type Obtention,
} from './collection.ts'
import { Collection } from './collection.tsx'
import { Epingle } from './illustrations.tsx'
import { Marque } from './marque.tsx'
import { ARTICLES, type Article } from '../../packages/articles/src/index.ts'
import { ListeArticles, PageArticle } from './blog.tsx'
import { cheminDe, routeDuChemin, type Route } from './routes.ts'
import { euros, eurosPrecis } from './nombres.ts'
import { affiniteCourte, affiniteNote, chancesCourtes } from './libelles.ts'
import { ETAPES, Question, REPONSES_PAR_DEFAUT } from './parcours.tsx'
import { Accueil } from './accueil.tsx'
import { Compte } from './compte.tsx'
import { TroisChoix } from './choix.tsx'
import { troisChoix, type PositionEleve } from './recommandations.ts'
import { localiser } from './geo.ts'
import { NoteDuLieu, PastilleNote, useAvisLieu, useVisible } from './avisLieu.tsx'
import { PanneauRetours, ResumeRetours } from './retours.tsx'

const ACADEMIES = [
  'Aix-Marseille', 'Amiens', 'Besançon', 'Bordeaux', 'Clermont-Ferrand', 'Corse',
  'Créteil', 'Dijon', 'Grenoble', 'Guadeloupe', 'Guyane', 'La Réunion', 'Lille',
  'Limoges', 'Lyon', 'Martinique', 'Mayotte', 'Montpellier', 'Nancy-Metz', 'Nantes',
  'Nice', 'Normandie', 'Orléans-Tours', 'Paris', 'Poitiers', 'Reims', 'Rennes',
  'Strasbourg', 'Toulouse', 'Versailles',
]

const VERDICTS: Record<Soutenabilite, { texte: string; classe: string }> = {
  soutenable: { texte: 'Finançable', classe: 'vert' },
  tendu: { texte: 'Tendu', classe: 'orange' },
  non_financable: { texte: 'Pas finançable en l’état', classe: 'rouge' },
  indeterminable: { texte: 'Reste-à-vivre non calculable', classe: 'gris' },
}

function Admission({ resultat }: { resultat: ResultatFormation }) {
  const a = resultat.admissibilite
  if (a.statut === 'donnee_manquante' || a.statut === 'effectif_insuffisant') {
    return <p className="admission">{a.raison}</p>
  }
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

/**
 * Une fiche de formation.
 *
 * Toute la mise en page tient la règle 5 de CLAUDE.md : les trois réponses
 * restent trois cases côte à côte, de même poids, jamais fondues en une note.
 * C'est la raison pour laquelle il n'y a ni médaille, ni score global, ni
 * classement visuel d'une fiche par rapport à une autre.
 *
 * La note publique de l'adresse figure sur la fiche, mais elle n'est PAS une
 * quatrième case : elle est en petit sous le lieu, dit « sur l'adresse », et
 * n'entre dans aucun tri (voir avisLieu.tsx).
 */
function Carte({
  resultat,
  tous,
  onOuvrir,
  ouvert,
  retours,
  verrouille,
  onInscrire,
}: {
  resultat: ResultatFormation
  tous: readonly ResultatFormation[]
  onOuvrir: () => void
  ouvert: boolean
  retours: AgregatRetours | undefined
  /** Ouvre le formulaire d'inscription depuis la fiche elle-même. */
  onInscrire: () => void
  /**
   * Vrai quand le montant existe mais demande un compte. À ne pas confondre
   * avec « non calculable », qui veut dire qu'une donnée manque réellement :
   * annoncer une donnée absente alors qu'elle est seulement retenue serait
   * faux, et c'est le genre de flou que ce projet s'interdit.
   */
  verrouille: boolean
}) {
  const { formation } = resultat
  const central = resultat.parScenario.central
  // Quand le montant est seulement verrouillé, le verdict « non calculable »
  // serait faux : le chiffre existe, il n'est pas encore montré.
  const verdict =
    verrouille && central.ravMensuel === null
      ? { texte: 'Visible après inscription', classe: 'gris' }
      : VERDICTS[central.soutenabilite]
  const jumeaux = ouvert ? jumeauxGeographiques(tous, resultat) : []

  // La note de l'adresse n'est demandée qu'une fois la fiche réellement
  // arrivée à l'écran : chaque appel est une requête Places facturée.
  const [ref, vu] = useVisible<HTMLElement>()
  const avis = useAvisLieu(formation.etablissement, formation.ville, vu)

  const resteTexte =
    central.ravMensuel === null
      ? verrouille
        ? 'après inscription'
        : 'non calculable'
      : euros(central.ravMensuel)

  return (
    <article className={`carte ${verdict.classe}`} ref={ref}>
      <div className="carte-tete">
        <h3 className="carte-titre">{formation.libelle}</h3>
        <span className={`verdict ${verdict.classe}`}>{verdict.texte}</span>
      </div>

      <p className="carte-lieu">
        <Epingle />
        <span>
          {formation.etablissement} · {formation.ville} ({formation.departement})
        </span>
      </p>
      <PastilleNote avis={avis} />

      {/* Trois cases de même taille : aucune ne domine, aucune ne s'additionne. */}
      <div className="trio">
        <div className="trio-case">
          <span className="trio-titre">Tes chances</span>
          <span className="trio-valeur">{chancesCourtes(resultat.admissibilite)}</span>
          <span className="trio-note">d’avoir une proposition</span>
        </div>
        <div className="trio-case">
          <span className="trio-titre">Ce qui te ressemble</span>
          <span className="trio-valeur">{affiniteCourte(resultat.affinite)}</span>
          <span className="trio-note">{affiniteNote(resultat.affinite)}</span>
        </div>
        <div className={`trio-case trio-reste ${verdict.classe}`}>
          <span className="trio-titre">Il te restera</span>
          <span className="trio-valeur">{resteTexte}</span>
          <span className="trio-note">
            {central.ravMensuel === null ? 'pour vivre, chaque mois' : 'par mois pour vivre'}
          </span>
        </div>
      </div>

      {central.ravMensuel !== null ? (
        <p className="fourchette">
          Entre {euros(resultat.parScenario.prudent.ravMensuel ?? 0)} et{' '}
          {euros(resultat.parScenario.optimiste.ravMensuel ?? 0)} selon le scénario de loyer
          et de job.
        </p>
      ) : null}

      <ResumeRetours agregat={retours} />

      {central.avertissements.map((a) => (
        <p className="avertissement" key={a}>
          {a}
        </p>
      ))}
      {resultat.raisonAide ? <p className="avertissement">{resultat.raisonAide}</p> : null}

      <div className="carte-actions">
        {verrouille ? (
          <button type="button" className="secondaire carte-deplier" onClick={onInscrire}>
            Créer mon compte pour voir le budget
          </button>
        ) : (
          <button
            type="button"
            className="secondaire carte-deplier"
            onClick={onOuvrir}
            aria-expanded={ouvert}
          >
            {ouvert ? 'Replier le budget' : 'Voir le budget, poste par poste'}
          </button>
        )}
      </div>

      {/* En savoir plus : des pages tenues par d'autres, ouvertes dans un
          nouvel onglet. On ne prétend pas connaître le site propre de
          l'établissement — l'open data Parcoursup ne le publie pas. */}
      {formation.lien || avis?.urlMaps ? (
        <p className="carte-liens">
          {formation.lien ? (
            <a href={formation.lien} target="_blank" rel="noreferrer">
              Fiche officielle Parcoursup
            </a>
          ) : null}
          {avis?.urlMaps ? (
            <a href={avis.urlMaps} target="_blank" rel="noreferrer">
              Voir l’adresse sur la carte
            </a>
          ) : null}
        </p>
      ) : null}

      {ouvert ? (
        <div className="detail">
          <Admission resultat={resultat} />

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

          <PanneauRetours codFormation={formation.id} />

          <NoteDuLieu avis={avis} />
        </div>
      ) : null}
    </article>
  )
}

export default function App() {
  const [vue, setVue] = useState<'accueil' | 'parcours' | 'collection' | 'blog' | 'article'>(
    () => {
      // L'adresse fait foi au chargement : ouvrir directement un article doit
      // afficher cet article, pas l'accueil.
      const route = routeDuChemin(window.location.pathname)
      return route === null || route.vue === 'accueil' ? 'accueil' : route.vue
    },
  )
  const [slug, setSlug] = useState<string | null>(() => {
    const route = routeDuChemin(window.location.pathname)
    return route !== null && route.vue === 'article' ? route.slug : null
  })
  const [etape, setEtape] = useState(0)
  const [reponses, setReponses] = useState<Reponses>(REPONSES_PAR_DEFAUT)
  const [resultats, setResultats] = useState<ResultatFormation[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [retours, setRetours] = useState<Map<string, AgregatRetours>>(new Map())
  /** Message du serveur quand le détail réclame un compte. null = pas de verrou. */
  const [verrou, setVerrou] = useState<string | null>(null)
  /** Vrai quand l'élève a demandé à s'inscrire : le formulaire prend l'écran. */
  const [formulaireCompte, setFormulaireCompte] = useState(false)
  const [connecte, setConnecte] = useState(() => jetonSession() !== '')
  /**
   * Position de l'élève, établie par son navigateur avec son accord, et gardée
   * UNIQUEMENT en mémoire : elle n'est ni stockée ni transmise (voir geo.ts).
   */
  const [position, setPosition] = useState<PositionEleve | null>(null)
  const [positionEnCours, setPositionEnCours] = useState(false)
  const [messagePosition, setMessagePosition] = useState<string | null>(null)
  /**
   * Cartes gagnées. Elles ne quittent jamais le navigateur : rien n'est envoyé
   * au serveur, et aucune carte ne s'obtient en invitant quelqu'un (collection.ts).
   */
  const [collection, setCollection] = useState<Obtention[]>(() => chargerCollection())

  /**
   * Les articles écrits depuis la console viennent s'ajouter à ceux du dépôt,
   * et l'emportent à identifiant égal : corriger un texte publié ne demande
   * alors pas de redéployer.
   */
  const [ajoutes, setAjoutes] = useState<readonly Article[]>([])
  useEffect(() => {
    let vivant = true
    void chercherArticles().then((a) => {
      if (vivant) setAjoutes(a)
    })
    return () => {
      vivant = false
    }
  }, [])
  const articles = useMemo<readonly Article[]>(() => {
    const parSlug = new Map(ARTICLES.map((a) => [a.slug, a]))
    for (const a of ajoutes) parSlug.set(a.slug, a)
    return [...parSlug.values()].sort((a, b) => b.publieLe.localeCompare(a.publieLe))
  }, [ajoutes])

  /**
   * Change de vue ET d'adresse. Seules les vues publiques ont une adresse :
   * le parcours de questions n'en a pas, il n'aurait aucun sens partagé.
   */
  const naviguer = useCallback((route: Route) => {
    window.history.pushState({}, '', cheminDe(route))
    setVue(route.vue)
    setSlug(route.vue === 'article' ? route.slug : null)
    window.scrollTo(0, 0)
  }, [])

  // Le bouton « précédent » du navigateur doit fonctionner comme partout.
  useEffect(() => {
    const surRetour = (): void => {
      const route = routeDuChemin(window.location.pathname)
      if (route === null) return
      setVue(route.vue)
      setSlug(route.vue === 'article' ? route.slug : null)
    }
    window.addEventListener('popstate', surRetour)
    return () => window.removeEventListener('popstate', surRetour)
  }, [])

  const gagner = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return
    setCollection((actuelle) => {
      const suivante = ajouter(actuelle, ids, new Date().toISOString().slice(0, 10))
      if (suivante.length !== actuelle.length) enregistrerCollection(suivante)
      return suivante
    })
  }, [])

  const nombreCartes = cartesDe(collection).length

  const demanderPosition = useCallback(async () => {
    setPositionEnCours(true)
    setMessagePosition(null)
    try {
      const r = await localiser()
      if (r.etat === 'trouvee') {
        const commune = positionDe(r.codeInsee)
        if (commune !== null) setPosition(commune)
        setMessagePosition(`Position retenue : ${r.nom}.`)
      } else if (r.etat === 'refusee') {
        // Dire non n'est pas une panne : on le formule comme un choix, pas
        // comme un échec, et le reste du site continue sans.
        setMessagePosition(
          'Tu as refusé le partage de position — le reste de la liste fonctionne quand même.',
        )
      } else {
        setMessagePosition(r.raison)
      }
    } finally {
      setPositionEnCours(false)
    }
  }, [])

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
      // Sans compte, le serveur refuse l'aide au logement — donc le
      // reste-à-vivre n'est pas calculable. On affiche quand même l'aperçu :
      // formations, établissements, villes et taux d'accès publiés. L'élève
      // voit ce qu'il obtiendra avant de donner son adresse.
      let parRef = new Map<string, AideLogement>()
      try {
        const aides = await chercherAidesLogement(demandes)
        parRef = new Map<string, AideLogement>(aides.map((a) => [a.ref, a]))
        setVerrou(null)
      } catch (e) {
        if (!(e instanceof InscriptionRequise)) throw e
        setVerrou(e.message)
        setConnecte(false)
      }
      const aujourdHui = new Date().toISOString().slice(0, 10)
      setRetours(await chercherAgregatsRetours(formations.map((f) => f.id)))
      const calcules = trierParPertinence(
        calculerResultats(formations, reponses, parRef, aujourdHui),
      )
      setResultats(calcules)
      // Une carte de ville ne se gagne que si un reste-à-vivre a réellement été
      // calculé : sans compte, l'aperçu ne chiffre rien et ne débloque rien.
      gagner(
        cartesGagnees({
          communesChiffrees: calcules.flatMap((r) =>
            r.parScenario.central.ravMensuel !== null && r.formation.codeInsee !== null
              ? [r.formation.codeInsee]
              : [],
          ),
          detailOuvert: false,
          bulletinLu: reponses.notesImportees,
          academieEleve: reponses.academie,
          academiesRegardees: calcules.map((r) => r.formation.academie),
        }),
      )
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
    }
  }, [reponses, gagner])

  const derniere = etape === ETAPES.length - 1
  const etapeCourante = ETAPES[etape]
  const complets = useMemo(
    () => resultats?.filter((r) => r.parScenario.central.ravMensuel !== null).length ?? 0,
    [resultats],
  )

  if (vue === 'blog') {
    return (
      <ListeArticles
        articles={articles}
        onArticle={(s) => naviguer({ vue: 'article', slug: s })}
        onRetour={() => naviguer({ vue: 'accueil' })}
      />
    )
  }

  if (vue === 'article') {
    const article = articles.find((a) => a.slug === slug)
    // Adresse inconnue : on montre la liste plutôt qu'une page vide, et on
    // remet l'adresse d'aplomb pour ne pas laisser une URL morte dans la barre.
    if (article === undefined) {
      return (
        <ListeArticles
          articles={articles}
          onArticle={(s) => naviguer({ vue: 'article', slug: s })}
          onRetour={() => naviguer({ vue: 'accueil' })}
        />
      )
    }
    return (
      <PageArticle
        article={article}
        onBlog={() => naviguer({ vue: 'blog' })}
        onCommencer={() => {
          naviguer({ vue: 'accueil' })
          setVue('parcours')
        }}
      />
    )
  }

  if (vue === 'collection') {
    return (
      <Collection
        collection={collection}
        onRetour={() => setVue(resultats === null ? 'accueil' : 'parcours')}
        onImporter={(cartes) => {
          setCollection((actuelle) => {
            const suivante = ajouter(
              actuelle,
              cartes.map((c) => c.id),
              new Date().toISOString().slice(0, 10),
            )
            enregistrerCollection(suivante)
            return suivante
          })
        }}
      />
    )
  }

  if (vue === 'accueil' && resultats === null) {
    return (
      <Accueil
        onCommencer={() => setVue('parcours')}
        onCollection={() => setVue('collection')}
        onBlog={() => naviguer({ vue: 'blog' })}
        onArticle={(s) => naviguer({ vue: 'article', slug: s })}
        cartes={nombreCartes}
      />
    )
  }

  if (formulaireCompte) {
    return (
      <main className="app">
        <header className="entete">
          <h1 className="marque">
            <Marque />
          </h1>
        </header>
        <Compte
          message={verrou ?? 'Ton compte te donne accès au détail de chaque budget.'}
          onOuvert={() => {
            setFormulaireCompte(false)
            setConnecte(true)
            void lancer()
          }}
          onAbandon={() => setFormulaireCompte(false)}
        />
      </main>
    )
  }

  if (resultats !== null) {
    return (
      <main className="app">
        <header className="entete entete-resultats">
          <div>
            <h1 className="marque">
            <Marque />
          </h1>
            <p className="baseline">Ce qu’il te restera pour vivre, vœu par vœu.</p>
          </div>
          {nombreCartes > 0 ? (
            <button type="button" className="pastille" onClick={() => setVue('collection')}>
              {nombreCartes}
              <span className="pastille-libelle"> cartes</span>
            </button>
          ) : null}
          {connecte ? (
            <button
              type="button"
              className="lien"
              onClick={() => {
                void deconnecter()
                setConnecte(false)
                void lancer()
              }}
            >
              Se déconnecter
            </button>
          ) : null}
        </header>

        {verrou ? (
          <section className="verrou">
            <h2>Le reste-à-vivre est derrière ton compte</h2>
            <p>{verrou}</p>
            <p className="verrou-detail">
              La liste ci-dessous est complète : chaque formation, son établissement, sa
              ville et son taux d’accès publié. Ce qui demande un compte, c’est le montant
              qu’il te restera chaque mois et le budget poste par poste.
            </p>
            <button type="button" className="principal" onClick={() => setFormulaireCompte(true)}>
              Créer mon compte — une adresse, un mot de passe
            </button>
            <p className="note">
              Aucune note, aucun vœu, aucun bulletin n’est enregistré. Seulement ton adresse,
              chiffrée.
            </p>
          </section>
        ) : null}

        <TroisChoix
          propositions={troisChoix(resultats, position, verrou !== null)}
          localisationEnCours={positionEnCours}
          onLocaliser={() => void demanderPosition()}
          onInscrire={() => setFormulaireCompte(true)}
        />
        {messagePosition ? <p className="note choix-message">{messagePosition}</p> : null}

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
              verrouille={verrou !== null}
              onInscrire={() => setFormulaireCompte(true)}
              onOuvrir={() => {
                const ouvrir = ouvert !== r.formation.id
                setOuvert(ouvrir ? r.formation.id : null)
                // Seulement quand le budget est réellement chiffré : sans
                // compte, le détail est verrouillé et rien n'a été lu.
                if (ouvrir && verrou === null) gagner([idEtape('detail')])
              }}
            />
          ))}
        </div>

        <div className="navigation">
          <button
            type="button"
            className="secondaire"
            onClick={() => {
              setResultats(null)
              setEtape(0)
              setVue('parcours')
            }}
          >
            Changer mes réponses
          </button>
        </div>

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
            KitEtudiant.fr n’est pas affilié à Parcoursup, au ministère ni aux CROUS.
            Rien de ce que tu fais ici n’est transmis à Parcoursup.
          </p>
        </footer>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="entete">
        <h1 className="marque">
            <Marque />
          </h1>
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
        <button
          type="button"
          className="secondaire"
          onClick={() => (etape > 0 ? setEtape(etape - 1) : setVue('accueil'))}
        >
          Retour
        </button>
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
