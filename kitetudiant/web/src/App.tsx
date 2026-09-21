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
  sessionDepuisTicket,
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
  envoyerReleve,
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
import { Chargement, type EtapeCalcul } from './chargement.tsx'
import { RechercheEcoles } from './rechercheEcoles.tsx'
import { BarreNavigation } from './navigation.tsx'
import { MesVoeux } from './mesVoeux.tsx'
import { PageFormation } from './pageFormation.tsx'
import { PageEtablissement } from './pageEtablissement.tsx'
import { MonCompte } from './monCompte.tsx'
import { Cle, Epingle, Etoile, Fiche, Loupe, Residence, Toit } from './illustrations.tsx'
import { liensLogement } from './logement.ts'
import { moyenneGenerale } from '../../packages/profil-scolaire/src/index.ts'
import { trancheMoyenne, trancheReste } from '../../packages/statistiques/src/index.ts'
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
import { BarreTri } from './barreTri.tsx'
import { SANS_FILTRE, classer, filtrer, type Classement, type Filtres } from './tri.ts'

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
/**
 * Une recherche web sur l'établissement.
 *
 * L'open data Parcoursup ne publie pas l'adresse du site des écoles : nous
 * ne l'avons pas, et fabriquer une URL plausible à partir du nom serait
 * inventer une donnée — ce que ce projet s'interdit. On propose donc une
 * recherche, et le libellé du lien dit « chercher », pas « le site ».
 *
 * La ville accompagne le nom : « Université de Lorraine » seule ramène des
 * pages de toute la région, et l'élève cherche UN site précis.
 */
/**
 * L'ancre d'une fiche dans la page.
 *
 * Préfixée, parce qu'un identifiant de formation est un code du ministère —
 * « 1234 » — et qu'un `id` purement numérique n'est pas un sélecteur CSS
 * valide : `document.querySelector('#1234')` lève une erreur.
 */
function ancreDe(idFormation: string): string {
  return `formation-${idFormation}`
}

function rechercheWeb(etablissement: string, ville: string): string {
  const requete = `${etablissement} ${ville} site officiel`.trim()
  return `https://www.google.com/search?q=${encodeURIComponent(requete)}`
}

function Carte({
  resultat,
  tous,
  onOuvrir,
  ouvert,
  retours,
  verrouille,
  onInscrire,
  onNaviguer,
}: {
  resultat: ResultatFormation
  tous: readonly ResultatFormation[]
  onOuvrir: () => void
  ouvert: boolean
  retours: AgregatRetours | undefined
  /** Ouvre le formulaire d'inscription depuis la fiche elle-même. */
  onInscrire: () => void
  onNaviguer: (route: Route) => void
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
    <article className={`carte ${verdict.classe}`} id={ancreDe(formation.id)} ref={ref}>
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

      {/* En savoir plus. Ce sont des pages tenues par d'AUTRES : chaque
          libellé dit où il mène, et « ↗ » dit qu'on quitte le site. Rien
          n'est chargé depuis ces domaines tant qu'on n'a pas cliqué — la
          promesse « aucun traceur » faite à des mineurs porte sur ce que
          cette page exécute, et un lien n'exécute rien.

          Le site propre de l'établissement n'est pas dans l'open data
          Parcoursup : on ne le devine pas, on propose une recherche et on
          le dit. */}
      {/* Chaque lien porte un picto qui dit sa nature, ce qui permet des
          libellés courts : « Fiche Parcoursup de la formation » et
          « Chercher le site de l'école » remplissaient une ligne à eux deux.
          Le titre complet reste au survol et pour un lecteur d'écran. */}
      <p className="carte-liens">
        {/* La fiche détaillée du site, en PREMIER — avant la fiche officielle
            de Parcoursup. Elle a une adresse propre, donc elle s'envoie, se
            met en favori et s'ouvre dans un onglet comme n'importe quel lien. */}
        <a
          className="carte-lien"
          href={cheminDe({ vue: 'formation', code: formation.id })}
          onClick={(ev) => {
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
            ev.preventDefault()
            onNaviguer({ vue: 'formation', code: formation.id })
          }}
        >
          <Loupe />
          Voir le détail
        </a>
        {formation.lien ? (
          <a
            className="carte-lien"
            href={formation.lien}
            title="La fiche officielle de cette formation sur Parcoursup"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Fiche />
            Fiche Parcoursup
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : null}
        {avis?.urlMaps ? (
          <a
            className="carte-lien"
            href={avis.urlMaps}
            title={avis.miseEnGarde}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Etoile />
            {avis.note.toFixed(1)}/5 sur l’adresse
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : null}
        <a
          className="carte-lien"
          href={rechercheWeb(formation.etablissement, formation.ville)}
          title="Une recherche web : l’open data ne publie pas l’adresse du site des établissements"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Loupe />
          Site de l’école
          <span aria-hidden="true"> ↗</span>
        </a>
      </p>

      {/* Se loger. Le CROUS d'abord, parce que c'est ce que les articles du
          site conseillent et que la résidence universitaire est la solution
          la moins chère — un produit qui conseille une chose puis met en
          avant son contraire ne mérite pas qu'on le croie.

          Le site n'a aucun lien avec ces services et ne peut pas vérifier ce
          qu'on y trouve : les libellés disent « chercher », jamais
          « trouver ». */}
      <p className="carte-liens carte-logement">
        <span className="carte-logement-titre">
          <Toit />
          Se loger à {formation.ville}
        </span>
        {liensLogement(formation.ville).map((l) => (
          <a
            className="carte-lien"
            key={l.cle}
            href={l.url}
            title={l.note}
            target="_blank"
            rel="noopener noreferrer"
          >
            {l.cle === 'crous' ? <Residence /> : <Cle />}
            {l.cle === 'crous' ? 'Résidence universitaire' : 'Studios et T2'}
            <span aria-hidden="true"> ↗</span>
          </a>
        ))}
      </p>

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
  const [vue, setVue] = useState<
    | 'accueil'
    | 'parcours'
    | 'collection'
    | 'blog'
    | 'article'
    | 'connexion'
    | 'inscription'
    | 'compte'
    | 'recherche'
    | 'formation'
    | 'etablissement'
    | 'voeux'
  >(
    () => {
      // L'adresse fait foi au chargement : ouvrir directement un article doit
      // afficher cet article, pas l'accueil.
      const route = routeDuChemin(window.location.pathname)
      return route === null || route.vue === 'accueil' ? 'accueil' : route.vue
    },
  )
  /**
   * L'adresse courante, quand il y en a une.
   *
   * Un seul état plutôt qu'un champ par paramètre — un pour le slug d'article,
   * un pour le code de formation, un pour l'UAI : trois champs parallèles
   * finissent toujours par se désynchroniser, et rien ne le signale.
   */
  const [adresse, setAdresse] = useState<Route>(() => {
    return routeDuChemin(window.location.pathname) ?? { vue: 'accueil' }
  })
  const slug = adresse.vue === 'article' ? adresse.slug : null
  const [etape, setEtape] = useState(0)
  const [reponses, setReponses] = useState<Reponses>(REPONSES_PAR_DEFAUT)
  const [resultats, setResultats] = useState<ResultatFormation[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  /**
   * L'étape du calcul en cours, pour l'écran d'attente. Elle est posée au
   * moment où le travail commence RÉELLEMENT : une étape affichée avant
   * qu'elle démarre serait un avancement inventé.
   */
  const [etapeCalcul, setEtapeCalcul] = useState<EtapeCalcul | null>(null)
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
   * Classement et filtres de la liste. Ils partent à « ce qui te correspond »
   * et SANS aucun filtre : la liste s'ouvre entière, et c'est l'élève qui
   * choisit d'en écarter (règle 4 de CLAUDE.md).
   */
  const [classement, setClassement] = useState<Classement>('pertinence')
  const [filtres, setFiltres] = useState<Filtres>(SANS_FILTRE)
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
   * Ferme la session. `deconnecter` oublie le jeton localement AVANT de
   * prévenir le serveur, et n'échoue jamais : il ne reste qu'à rafraîchir
   * l'affichage.
   */
  const seDeconnecter = useCallback(async () => {
    await deconnecter()
    setConnecte(false)
  }, [])

  /**
   * Change de vue ET d'adresse. Seules les vues publiques ont une adresse :
   * le parcours de questions n'en a pas, il n'aurait aucun sens partagé.
   */
  const naviguer = useCallback((route: Route) => {
    window.history.pushState({}, '', cheminDe(route))
    setVue(route.vue)
    setAdresse(route)
    window.scrollTo(0, 0)
  }, [])

  /**
   * Le retour de Google.
   *
   * Le serveur nous renvoie avec un ticket dans l'adresse — il ne peut pas
   * faire autrement : une redirection est une navigation ordinaire, sans
   * en-tête « Authorization ». On l'échange immédiatement contre le vrai
   * jeton, puis on efface le paramètre de la barre d'adresse avec
   * `replaceState` : inutile de le laisser dans l'historique alors qu'il est
   * déjà consommé.
   */
  useEffect(() => {
    const parametres = new URLSearchParams(window.location.search)
    const ticket = parametres.get('ticket')
    const annulee = parametres.get('connexion') === 'annulee'
    if (ticket === null && !annulee) return

    const nettoyer = (): void => {
      parametres.delete('ticket')
      parametres.delete('connexion')
      const reste = parametres.toString()
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${reste === '' ? '' : `?${reste}`}`,
      )
    }

    if (annulee) {
      // L'élève a refusé l'autorisation chez Google. Ce n'est pas une erreur,
      // c'est une décision : on le ramène sans message d'échec.
      nettoyer()
      return
    }

    void sessionDepuisTicket(ticket!)
      .then(() => setConnecte(true))
      .catch((e: unknown) => setErreur((e as Error).message))
      .finally(nettoyer)
  }, [])

  // Le bouton « précédent » du navigateur doit fonctionner comme partout.
  useEffect(() => {
    const surRetour = (): void => {
      const route = routeDuChemin(window.location.pathname)
      if (route === null) return
      setVue(route.vue)
      setAdresse(route)
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
    setEtapeCalcul('formations')
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
      setEtapeCalcul('aides')
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
      setEtapeCalcul('retours')
      setRetours(await chercherAgregatsRetours(formations.map((f) => f.id)))
      setEtapeCalcul('budget')
      const calcules = trierParPertinence(
        calculerResultats(formations, reponses, parRef, aujourdHui),
      )
      setResultats(calcules)

      /* Un relevé ANONYME d'usage : pas d'identifiant, pas de note exacte,
         pas de vœu. Il dit quelles villes et quelles filières intéressent,
         et à quel reste-à-vivre les simulations aboutissent — de quoi savoir
         où le site sert, sans constituer de dossier sur un mineur.

         Les TRANCHES sont calculées ici et non côté serveur : une note
         exacte qui partirait sur le réseau serait déjà partie, même si le
         serveur la jetait ensuite. */
      const chiffres = calcules.filter((r) => r.parScenario.central.ravMensuel !== null)
      envoyerReleve({
        typeBac: reponses.typeBac,
        academie: reponses.academie,
        trancheMoyenne: trancheMoyenne(moyenneGenerale(reponses.notes)),
        boursier: reponses.echelonInconnu ? null : reponses.echelonBourse !== null,
        mobilite: reponses.mobilite,
        filiere: reponses.filiere === '' ? null : reponses.filiere,
        communes: chiffres.flatMap((r) => (r.formation.codeInsee === null ? [] : [r.formation.codeInsee])),
        trancheReste: trancheReste(
          chiffres.length === 0
            ? null
            : Math.max(...chiffres.map((r) => r.parScenario.central.ravMensuel ?? 0)),
        ),
        bulletins: reponses.bulletins.length,
        formations: calcules.length,
      })

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
          bulletinsLus: reponses.bulletins.length,
          academieEleve: reponses.academie,
          academiesRegardees: calcules.map((r) => r.formation.academie),
        }),
      )
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
      setEtapeCalcul(null)
    }
  }, [reponses, gagner])

  const derniere = etape === ETAPES.length - 1
  const etapeCourante = ETAPES[etape]
  const complets = useMemo(
    () => resultats?.filter((r) => r.parScenario.central.ravMensuel !== null).length ?? 0,
    [resultats],
  )

  /**
   * La liste telle qu'elle s'affiche : filtrée d'abord, classée ensuite.
   *
   * `ecartes` n'est pas un rebut : c'est ce que la barre affiche en clair,
   * avec le bouton qui le ramène. Un filtre dont on ne voit pas la portée
   * serait indiscernable d'un vœu retiré de la vue (règle 4 de CLAUDE.md).
   */
  /**
   * Ouvre une fiche depuis un encadré de tête, et y amène l'écran.
   *
   * Trois précautions :
   *
   * - Si le détail est VERROUILLÉ, on ouvre le formulaire d'inscription
   *   plutôt qu'une fiche dépliée sur un budget masqué. Montrer un détail
   *   vide serait une fausse promesse.
   * - Si un filtre écarte la formation mise en avant, on le lève : sinon le
   *   clic n'aurait aucun effet visible, et rien ne dirait pourquoi.
   * - Le défilement attend le rendu suivant. Appelé tout de suite, il
   *   viserait une fiche que React n'a pas encore dépliée, et l'écran
   *   s'arrêterait au mauvais endroit.
   */
  const voirDetail = useCallback(
    (idFormation: string) => {
      if (verrou !== null) {
        setFormulaireCompte(true)
        return
      }
      setFiltres(SANS_FILTRE)
      setOuvert(idFormation)
      gagner([idEtape('detail')])
      requestAnimationFrame(() => {
        const cible = document.getElementById(`formation-${idFormation}`)
        cible?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    [verrou, gagner],
  )

  const { retenus, ecartes } = useMemo(
    () => filtrer(resultats ?? [], filtres),
    [resultats, filtres],
  )
  const affiches = useMemo(() => classer(retenus, classement), [retenus, classement])

  /* Posé avant toute vue : l'attente couvre l'écran, quelle que soit la page
     d'où l'on est parti — la dernière question du parcours, ou l'accueil.
     C'est le seul écran SANS la barre de navigation : pendant qu'un calcul
     tourne, proposer d'aller ailleurs ne ferait que le faire perdre. */
  if (enCours) return <Chargement etape={etapeCalcul} />

  /**
   * La coque commune à tous les écrans : la barre de navigation, puis la
   * page.
   *
   * Elle est appliquée ici, une fois, plutôt que dans chaque composant
   * d'écran. Chaque écran portait auparavant son propre en-tête avec UN
   * bouton différent — « Retour au site », « Tous les articles », « Chercher
   * une école » — si bien que, depuis n'importe où, une seule destination
   * était atteignable, et jamais la même.
   */
  /* La classe dit QUELLE navigation est en place, parce que la mise en page
     de la coque en dépend : le visiteur a une barre en haut et une seule
     colonne, l'élève connecté un rail à gauche et donc une grille. Sans cette
     distinction, la page vide laisserait la colonne du rail absent. */
  const coque = (page: React.ReactNode) => (
    <div className={connecte ? 'coque coque-app' : 'coque coque-visiteur'}>
      <BarreNavigation
        vue={vue}
        connecte={connecte}
        cartes={nombreCartes}
        onNaviguer={naviguer}
        onDeconnexion={() => void seDeconnecter()}
      />
      <div className="coque-page">{page}</div>
    </div>
  )

  /* Les deux pages à clé pivot. Elles sont posées avant les autres vues
     parce qu'elles se suffisent à elles-mêmes : elles ne dépendent ni du
     parcours, ni des résultats, ni d'une session. C'est ce qui permet
     d'ouvrir une adresse de formation reçue par message sans rien avoir
     rempli au préalable. */
  if (vue === 'formation' && adresse.vue === 'formation') {
    return coque(
      <PageFormation
        code={adresse.code}
        connecte={connecte}
        onNaviguer={naviguer}
        onCommencer={() => {
          setVue('parcours')
          setEtape(0)
        }}
      />
    )
  }

  if (vue === 'etablissement' && adresse.vue === 'etablissement') {
    return coque(<PageEtablissement uai={adresse.uai} onNaviguer={naviguer} />)
  }

  if (vue === 'voeux') {
    return coque(<MesVoeux connecte={connecte} onNaviguer={naviguer} />)
  }

  if (vue === 'recherche') {
    return coque(
      <RechercheEcoles
        onNaviguer={naviguer}
        onCommencer={() => {
          setVue('parcours')
          setEtape(0)
        }}
      />
    )
  }

  if (vue === 'compte') {
    return coque(
      <MonCompte
        /* `reponses` vaut REPONSES_PAR_DEFAUT tant que rien n'a été rempli.
           Les afficher telles quelles donnerait à l'élève un récapitulatif
           de réponses qu'il n'a jamais données — une valeur de repli
           silencieuse, ce que CLAUDE.md interdit. On ne les passe donc que
           si le parcours a réellement été entamé ici. */
        reponses={resultats === null && etape === 0 ? null : reponses}
        onNaviguer={naviguer}
        onDeconnexion={() => setConnecte(false)}
      />
    )
  }

  if (vue === 'blog') {
    return coque(
      <ListeArticles
        articles={articles}
        onNaviguer={naviguer}
        onArticle={(s) => naviguer({ vue: 'article', slug: s })}
      />
    )
  }

  if (vue === 'article') {
    const article = articles.find((a) => a.slug === slug)
    // Adresse inconnue : on montre la liste plutôt qu'une page vide, et on
    // remet l'adresse d'aplomb pour ne pas laisser une URL morte dans la barre.
    if (article === undefined) {
      return coque(
        <ListeArticles
          articles={articles}
          onNaviguer={naviguer}
          onArticle={(s) => naviguer({ vue: 'article', slug: s })}
        />,
      )
    }
    return coque(
      <PageArticle
        article={article}
        onNaviguer={naviguer}
        onCommencer={() => {
          naviguer({ vue: 'accueil' })
          setVue('parcours')
        }}
      />
    )
  }

  if (vue === 'collection') {
    return coque(
      <Collection
        collection={collection}
        onNaviguer={naviguer}
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
    return coque(
      <Accueil
        onCommencer={() => setVue('parcours')}
        onNaviguer={naviguer}
        onArticle={(s) => naviguer({ vue: 'article', slug: s })}
      />
    )
  }

  // Connexion et inscription ont chacune leur adresse. Le composant est le
  // même : seul le mode initial change, et l'utilisateur peut basculer de
  // l'un à l'autre depuis le formulaire.
  if (vue === 'connexion' || vue === 'inscription') {
    return coque(
      <main className="app">
        <Compte
          mode={vue === 'connexion' ? 'connexion' : 'inscription'}
          message={
            vue === 'connexion'
              ? 'Retrouve tes simulations et le détail de chaque budget.'
              : 'Ton compte te donne accès au détail de chaque budget.'
          }
          onOuvert={() => {
            setConnecte(true)
            naviguer({ vue: 'accueil' })
          }}
          onAbandon={() => naviguer({ vue: 'accueil' })}
        />
      </main>
    )
  }

  if (formulaireCompte) {
    return coque(
      <main className="app">
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
    return coque(
      <main className="app app-large">
        {/* La marque, la pastille des cartes et la déconnexion ont rejoint
            le rail : elles y sont sur tous les écrans, et non plus sur
            celui-ci seulement. Il ne reste ici que le titre de la page. */}
        <header className="entete entete-resultats">
          <h1 className="promesse-resultats">Ce que tu peux viser l’an prochain</h1>
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
          onVoirDetail={voirDetail}
        />
        {messagePosition ? <p className="note choix-message">{messagePosition}</p> : null}

        <p className="resume">
          {resultats.length} formations trouvées, {complets} avec un reste-à-vivre calculé.
          Classées d’abord par ce qui te correspond, puis par ce qu’il te restera pour
          vivre. Les deux ne sont jamais additionnés, et aucun vœu n’est retiré de la liste.
        </p>

        <BarreTri
          resultats={resultats}
          classement={classement}
          filtres={filtres}
          ecartes={ecartes.length}
          onClassement={setClassement}
          onFiltres={setFiltres}
        />

        <div className="cartes">
          {affiches.map((r) => (
            <Carte
              key={r.formation.id}
              resultat={r}
              tous={resultats}
              retours={retours.get(r.formation.id)}
              ouvert={ouvert === r.formation.id}
              verrouille={verrou !== null}
              onInscrire={() => setFormulaireCompte(true)}
              onNaviguer={naviguer}
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

  return coque(
    <main className="app">
      <header className="entete">
        <h1 className="promesse-parcours">La meilleure solution pour l’année prochaine.</h1>
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
