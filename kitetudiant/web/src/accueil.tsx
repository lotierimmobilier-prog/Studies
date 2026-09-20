/**
 * Page d'accueil.
 *
 * Elle a un seul travail : faire comprendre en dix secondes que ce site aide à
 * CHOISIR une école ou une fac, puis s'effacer. Le cahier des charges fixe un
 * premier résultat utile en moins de 90 secondes, sans compte.
 *
 * Deux règles de CLAUDE.md pèsent directement sur le texte de cette page :
 *
 * - règle 5, les trois scores restent séparés, jamais de note globale unique.
 *   On ne promet donc nulle part « la meilleure école » dans l'absolu, ce qui
 *   supposerait un classement. On promet l'école qui te va, ce qui est une
 *   autre affirmation, et une affirmation que nos données savent tenir ;
 * - règle 6, toute donnée affichée porte son millésime. Aucun chiffre de cette
 *   page n'est décoratif : ils viennent tous du jeu de communes versionné.
 */

import {
  GENERE_LE,
  loyerDe,
  MILLESIME_LOYERS,
  nomCommune,
  NOMBRE_COMMUNES_AVEC_LOYER,
  SOURCE_LOYERS,
  SOURCE_PARCOURSUP,
  TYPOLOGIE_LOYERS,
} from './donnees.ts'
import { Boussole, Carnet, Epingle, PorteMonnaie } from './illustrations.tsx'
import { Marque } from './marque.tsx'
import { ARTICLES } from '../../packages/articles/src/index.ts'
import { cheminDe } from './routes.ts'
import {
  AVERTISSEMENT,
  enToutesLettres,
  fenetreProjetee,
  MILLESIME_CALENDRIER,
  PHASES,
  RELEVE_LE,
  SESSION_VISEE,
  SOURCE_CALENDRIER,
} from './calendrier.ts'
import { euros, eurosPrecis, nombre } from './nombres.ts'

/** Surface du logement type servant à l'illustration. */
const SURFACE = 25

const VILLES_EXEMPLE: readonly string[] = ['87085', '31555', '75113']

interface LigneVille {
  readonly code: string
  readonly nom: string
  readonly loyer: NonNullable<ReturnType<typeof loyerDe>>
}

function eurosParM2(v: number): string {
  return `${eurosPrecis(v)}/m²`
}

/**
 * Le référentiel écrit « Paris 13e Arrondissement ». Sur une page d'accueil,
 * « Paris 13e » suffit — le code INSEE reste la clé, seul l'affichage change.
 */
function nomLisible(nom: string): string {
  return nom.replace(/\s+Arrondissement$/i, '')
}

/** Date ISO du fichier de données, écrite en toutes lettres. */
function dateLisible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ------------------------------------------------------------------ hero */

function Hero({ onCommencer }: { onCommencer: () => void }) {
  return (
    <section className="hero">
      <p className="hero-sur">Orientation post-bac · Parcoursup</p>
      <h1 className="promesse">
        L’école supérieure qui te va, <em>et</em> dans laquelle tu pourras tenir.
      </h1>
      <p className="hero-texte">
        Fac, BUT, BTS, école d’ingénieurs, prépa : KitEtudiant.fr regarde chaque formation
        sous trois angles — tes chances d’y entrer, ce qu’elle vaut pour toi, et ce qu’il
        te restera pour vivre une fois sur place. Trois réponses, jamais fondues en une
        note.
      </p>
      <div className="cta-groupe">
        <button type="button" className="principal" onClick={onCommencer}>
          Trouver mes formations
        </button>
        <a className="cta-secondaire" href="#methode">
          Comment ça marche
        </a>
      </div>
      <p className="hero-mentions">
        Sept questions · aperçu sans compte · aucune note enregistrée
      </p>
    </section>
  )
}

/* ------------------------------------------------- bandeau de trois faits */

function Bandeau() {
  return (
    <section className="bandeau" aria-label="En bref">
      <div className="bandeau-item">
        <span className="bandeau-chiffre">{nombre(NOMBRE_COMMUNES_AVEC_LOYER)}</span>
        <span className="bandeau-libelle">
          communes dont le loyer est connu, millésime {MILLESIME_LOYERS}
        </span>
      </div>
      <div className="bandeau-item">
        <span className="bandeau-chiffre">3</span>
        <span className="bandeau-libelle">
          critères tenus séparés, jamais résumés en une note unique
        </span>
      </div>
      <div className="bandeau-item">
        <span className="bandeau-chiffre">0</span>
        <span className="bandeau-libelle">
          montant inventé : chaque euro porte sa source et sa date
        </span>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- les trois piliers */
// « axe » et « axes » sont déjà pris par l’affichage des résultats (App.tsx) :
// les réutiliser ici faisait hériter cette section de leur grille à deux colonnes.

const PICTOS = [Boussole, Carnet, PorteMonnaie] as const

const PILIERS: readonly { readonly titre: string; readonly question: string; readonly texte: string }[] = [
  {
    titre: 'Tes chances',
    question: 'Est-ce que je peux y entrer ?',
    texte:
      'Le taux d’accès réellement publié pour cette formation, l’an dernier, avec le nombre de candidats derrière. Pas une probabilité inventée pour ton dossier : le chiffre officiel, dit tel quel.',
  },
  {
    titre: 'Ce qui te ressemble',
    question: 'Est-ce que c’est fait pour moi ?',
    texte:
      'Tes notes par matière, la filière qui t’attire, ce que tu aimes faire. On regarde si la formation s’appuie sur ce que tu réussis déjà — sans jamais te fermer une porte.',
  },
  {
    titre: 'Ce qu’il te restera',
    question: 'Est-ce que je pourrai y vivre ?',
    texte:
      'Loyer de la ville, aide au logement, bourse, CVEC, repas : le reste-à-vivre mensuel, ligne par ligne. C’est ce qu’aucun autre outil d’orientation ne te dit.',
  },
]

function Piliers() {
  return (
    <section className="bloc piliers" id="piliers">
      <h2>Trois questions qu’il faut se poser ensemble</h2>
      <p className="bloc-intro">
        Une école excellente et inabordable reste inabordable. Une école abordable qui ne
        te ressemble pas se quitte au bout d’un an.
      </p>
      <div className="piliers-grille">
        {PILIERS.map((a, i) => {
          const Picto = PICTOS[i] ?? Boussole
          return (
          <article className="pilier" key={a.titre}>
            <span className="pilier-numero">
              <Picto />
            </span>
            <h3 className="pilier-titre">{a.titre}</h3>
            <p className="pilier-question">{a.question}</p>
            <p className="pilier-texte">{a.texte}</p>
          </article>
          )
        })}
      </div>
      <p className="bloc-chute">
        Les trois réponses restent côte à côte, chacune avec sa source.{' '}
        <strong>Le classement final, c’est toi qui le fais</strong> — c’est ton
        orientation, pas un résultat d’algorithme.
      </p>
    </section>
  )
}

/* ------------------------------------------------ la preuve par les loyers */

function Comparaison() {
  const lignes: LigneVille[] = []
  for (const code of VILLES_EXEMPLE) {
    const loyer = loyerDe(code)
    if (loyer !== null) lignes.push({ code, nom: nomCommune(code) ?? code, loyer })
  }
  const triees = [...lignes].sort((a, b) => a.loyer.euroParM2.central - b.loyer.euroParM2.central)
  const moinsCher = triees[0]
  const plusCher = triees[triees.length - 1]

  // Si le jeu de communes changeait et perdait ces villes, on préfère ne rien
  // montrer plutôt qu'une comparaison bancale.
  if (triees.length < 2 || !moinsCher || !plusCher) return null

  const ecart = (plusCher.loyer.euroParM2.central - moinsCher.loyer.euroParM2.central) * SURFACE

  return (
    <section className="bloc">
      <h2>
        <Epingle />
        Pourquoi la ville compte autant que l’école
      </h2>
      <p className="bloc-intro">
        Le même studio de {SURFACE} m², loyer d’annonce charges comprises, millésime{' '}
        {MILLESIME_LOYERS}.
      </p>
      <ul className="comparaison">
        {triees.map((l) => (
          <li key={l.code}>
            <span className="comparaison-ville">{nomLisible(l.nom)}</span>
            <span className="comparaison-montant">
              {euros(l.loyer.euroParM2.central * SURFACE)}
            </span>
            <span className="comparaison-m2">{eurosParM2(l.loyer.euroParM2.central)}</span>
          </li>
        ))}
      </ul>
      <p className="bloc-chute">
        <strong>{euros(ecart)} par mois</strong> séparent {nomLisible(moinsCher.nom)} de{' '}
        {nomLisible(plusCher.nom)}, à logement identique. Sur une licence de trois ans,
        c’est la différence entre un budget tenable et un job étudiant subi.
      </p>
    </section>
  )
}

/* ------------------------------------------------------- la chronologie */

/**
 * La chronologie de la session visée.
 *
 * Chaque étape porte DEUX lignes, et l'ordre n'est pas indifférent : la
 * fenêtre prévisionnelle d'abord — c'est ce que l'élève doit retenir — puis,
 * en dessous et en plus petit, la date réelle de la session précédente, qui
 * dit d'où la fenêtre est tirée. La seconde justifie la première.
 *
 * Seule la date de référence est une vraie date, donc seule elle porte une
 * balise `time` : marquer ainsi une fenêtre déduite la ferait passer pour un
 * fait auprès d'un lecteur d'écran comme d'un moteur de recherche.
 *
 * L'avertissement est DANS le bloc, avant les dates, et non relégué en note de
 * bas de page : un élève qui se fierait à une date supposée manquerait un vœu.
 * Il vient de calendrier.ts, pour qu'aucune vue ne puisse afficher les dates
 * sans lui.
 */
function Chronologie() {
  return (
    <section className="bloc" id="calendrier">
      <h2>Le calendrier de la session {SESSION_VISEE}, dans les grandes lignes</h2>
      <p className="bloc-intro">
        Trois phases qui se suivent toujours dans le même ordre : on regarde, on
        formule, on répond. Ce qui change d’une année sur l’autre, ce sont les dates —
        et celles de {SESSION_VISEE} ne sont pas encore fixées.
      </p>

      <p className="avertissement-calendrier">
        <strong>À lire avant de noter quoi que ce soit.</strong> {AVERTISSEMENT}
      </p>

      <ol className="chrono">
        {PHASES.map((phase) => (
          <li className="chrono-phase" key={phase.numero}>
            <p className="chrono-periode">{phase.periode}</p>
            <h3 className="chrono-titre">{phase.titre}</h3>
            <p className="chrono-resume">{phase.resume}</p>
            <ul className="chrono-etapes">
              {phase.etapes.map((e) => (
                <li className="chrono-etape" key={e.reference}>
                  <span className="chrono-date">{fenetreProjetee(e.reference)}</span>
                  <span className="chrono-quoi">{e.titre}</span>
                  {e.detail !== null ? <span className="chrono-detail">{e.detail}</span> : null}
                  {/* « Session 2026 » et non « en 2026 » : une session court sur
                      deux années civiles, et la première étape tombe en décembre
                      de l'année précédente. « En 2026 : … décembre 2025 » se lit
                      comme une faute. */}
                  <span className="chrono-repere">
                    Session {MILLESIME_CALENDRIER} :{' '}
                    <time dateTime={e.reference}>{enToutesLettres(e.reference)}</time>
                  </span>
                </li>
              ))}
            </ul>
            {phase.note !== null ? <p className="chrono-note">{phase.note}</p> : null}
          </li>
        ))}
      </ol>

      <p className="sources chrono-source">
        Fenêtres déduites du calendrier de la session {MILLESIME_CALENDRIER}, seule
        session publiée à ce jour. Source : {SOURCE_CALENDRIER}, millésime{' '}
        {MILLESIME_CALENDRIER}, relevé le {dateLisible(RELEVE_LE)}.
      </p>
    </section>
  )
}

/* ----------------------------------------------------------------- la page */

export function Accueil({
  onCommencer,
  onCollection,
  onBlog,
  onArticle,
  cartes,
}: {
  onCommencer: () => void
  onCollection: () => void
  onBlog: () => void
  onArticle: (slug: string) => void
  /** Nombre de cartes déjà gagnées. Zéro : la pastille ne s'affiche pas. */
  cartes: number
}) {
  return (
    <main className="app accueil">
      <header className="entete entete-accueil">
        <h1 className="marque">
          <Marque signature />
        </h1>
        <div className="entete-actions">
          <button type="button" className="entete-lien" onClick={onBlog}>
            Le blog
          </button>
          {/* La collection n'apparaît qu'une fois la première carte gagnée :
              pour un visiteur qui découvre le site, ce serait du bruit. */}
          {cartes > 0 ? (
            <button type="button" className="pastille" onClick={onCollection}>
              {cartes}
              <span className="pastille-libelle"> cartes</span>
            </button>
          ) : null}
          <button type="button" className="entete-cta" onClick={onCommencer}>
            Commencer
          </button>
        </div>
      </header>

      <Hero onCommencer={onCommencer} />
      <Bandeau />
      <Piliers />
      <Comparaison />

      <section className="bloc" id="methode">
        <h2>Comment ça marche</h2>
        <ol className="etapes-accueil">
          <li>
            <strong>Tu réponds à sept questions.</strong> Ton bac, tes notes — importées
            d’un bulletin ou saisies —, ce qui t’intéresse, ta bourse, ton budget.
          </li>
          <li>
            <strong>On sort les formations qui correspondent.</strong> Depuis l’open data
            du ministère, avec leurs statistiques d’admission réelles de l’an dernier.
          </li>
          <li>
            <strong>On calcule le reste-à-vivre de chacune.</strong> Ville par ville,
            aide au logement comprise. Tu déplies le budget, ligne par ligne, chaque euro
            avec sa source et son millésime.
          </li>
          <li>
            <strong>Tu compares et tu décides.</strong> Rien n’est masqué, rien n’est
            classé à ta place.
          </li>
          <li>
            <strong>Un compte pour le détail.</strong> La liste des formations, leur
            ville et leur taux d’accès s’affichent sans rien donner. Le reste-à-vivre
            chiffré et le budget poste par poste demandent une adresse e-mail et un mot
            de passe — rien d’autre, et jamais tes notes.
          </li>
        </ol>
        <div className="cta-groupe cta-groupe-bloc">
          <button type="button" className="principal" onClick={onCommencer}>
            Commencer les sept questions
          </button>
        </div>
      </section>

      <Chronologie />

      <section className="bloc">
        <h2>Ce que ce site ne fait pas</h2>
        <ul className="promesses">
          <li>
            <strong>Il ne classe pas les écoles entre elles.</strong> Pas de palmarès, pas
            de note globale : trois critères séparés, que tu pondères toi-même.
          </li>
          <li>
            <strong>Il ne transmet rien à Parcoursup.</strong> Aucun vœu que tu regardes
            ici n’en sort.
          </li>
          <li>
            <strong>Il ne masque aucune formation.</strong> Un vœu peut être signalé comme
            difficile à financer ; il n’est jamais retiré de la liste.
          </li>
          <li>
            <strong>Il n’invente aucun montant.</strong> Pas de valeur de repli, pas
            d’estimation déguisée : une donnée absente s’affiche comme absente.
          </li>
          <li>
            <strong>Il n’enregistre aucune donnée scolaire.</strong> Même inscrit, tes
            notes, tes bulletins et tes vœux restent dans ton navigateur. Le compte ne
            connaît que ton adresse, chiffrée, et il est effacé après trois ans sans
            usage.
          </li>
        </ul>
      </section>

      <section className="bloc">
        <h2>D’où viennent les chiffres</h2>
        <ul className="sources">
          <li>Formations et statistiques d’admission : {SOURCE_PARCOURSUP}.</li>
          <li>
            Loyers : {SOURCE_LOYERS}, typologie « {TYPOLOGIE_LOYERS} », millésime{' '}
            {MILLESIME_LOYERS}.
          </li>
          <li>Aide au logement : calculée par OpenFisca France.</li>
          <li>
            Bourses, aide au mérite, CVEC, tarif du restaurant universitaire : barèmes
            officiels datés, rattachés à leur arrêté.
          </li>
          <li>Jeu de communes assemblé le {dateLisible(GENERE_LE)}.</li>
        </ul>
      </section>

      <section className="bloc" id="blog">
        <h2>Bien gérer sa scolarité</h2>
        <p className="bloc-intro">
          Ce qu’il faut comprendre de la procédure, comment monter un dossier qui tient,
          et comment choisir une ville où l’on pourra rester jusqu’au diplôme.
        </p>
        <ul className="articles articles-apercu">
          {ARTICLES.slice(0, 3).map((a) => (
            <li key={a.slug}>
              <a
                className="article-vignette"
                href={cheminDe({ vue: 'article', slug: a.slug })}
                onClick={(ev) => {
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
                  ev.preventDefault()
                  onArticle(a.slug)
                }}
              >
                <h3 className="article-vignette-titre">{a.titre}</h3>
                <p className="article-vignette-chapeau">{a.chapeau}</p>
              </a>
            </li>
          ))}
        </ul>
        <div className="cta-groupe cta-groupe-bloc">
          <button type="button" className="secondaire" onClick={onBlog}>
            Tous les articles
          </button>
        </div>
      </section>

      <section className="cta-final">
        <h2>Tes vœux se décident maintenant.</h2>
        <p>
          Sept questions, et tu sauras lesquels tu peux tenir jusqu’au diplôme.
        </p>
        <button type="button" className="principal" onClick={onCommencer}>
          Trouver mes formations
        </button>
        <p className="hero-mentions">
          Gratuit · un compte pour le détail · aucune note enregistrée
        </p>
      </section>

      <footer className="pieds">
        <p className="non-affiliation">
          KitEtudiant.fr n’est pas affilié à Parcoursup, au ministère de l’Enseignement
          supérieur ni aux CROUS.
        </p>
      </footer>
    </main>
  )
}
