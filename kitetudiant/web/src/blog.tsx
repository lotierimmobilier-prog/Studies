/**
 * Le blog.
 *
 * Deux vues : la liste des articles, et un article. Le corps d'un article est
 * une suite de blocs typés — paragraphe, titre, liste, encadré — rendus par
 * des composants React. Aucun HTML brut n'est injecté : un article écrit
 * depuis la console d'administration ne peut donc pas exécuter de script.
 *
 * Chaque article met à jour le titre de l'onglet, la description et le lien
 * canonique. C'est le minimum pour être indexé correctement ; le pré-rendu des
 * pages, lui, se fait au moment du build (scripts/prerendre.mjs).
 */

import { useEffect, useMemo, useState } from 'react'

import {
  MENTION_SOURCE,
  minutesDeLecture,
  type Article,
  type Bloc,
} from '../../packages/articles/src/index.ts'
import { adresseComplete, cheminDe, type Route } from './routes.ts'
import { FilAriane } from './filAriane.tsx'
import { chercherArticles } from '../../packages/articles/src/recherche.ts'

/* --------------------------------------------------------- les métadonnées */

/** Pose ou remplace une balise `meta`/`link` de l'en-tête du document. */
function poser(selecteur: string, creer: () => Element, appliquer: (e: Element) => void): void {
  let element = document.head.querySelector(selecteur)
  if (element === null) {
    element = creer()
    document.head.append(element)
  }
  appliquer(element)
}

/**
 * Met à jour ce qu'un moteur de recherche et un réseau social liront.
 *
 * Sans cela, tous les articles partageraient le titre et la description de la
 * page d'accueil : dix pages identiques aux yeux d'un moteur, donc dix pages
 * qui ne se classent sur rien.
 */
function useMetadonnees(titre: string, description: string, canonique: string): void {
  useEffect(() => {
    const precedent = document.title
    document.title = titre
    poser('meta[name="description"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'description')
      return m
    }, (e) => e.setAttribute('content', description))
    poser('link[rel="canonical"]', () => {
      const l = document.createElement('link')
      l.setAttribute('rel', 'canonical')
      return l
    }, (e) => e.setAttribute('href', canonique))
    return () => {
      document.title = precedent
    }
  }, [titre, description, canonique])
}

/* ------------------------------------------------------------- les blocs */

function Contenu({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case 'titre':
      return <h2 className="article-titre-section">{bloc.texte}</h2>
    case 'liste':
      return (
        <ul className="article-liste">
          {bloc.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )
    case 'encadre':
      return <p className="article-encadre">{bloc.texte}</p>
    case 'paragraphe':
      return <p className="article-paragraphe">{bloc.texte}</p>
  }
}

/* ------------------------------------------------------------- la liste */

function dateLisible(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function ListeArticles({
  articles,
  onArticle,
  onNaviguer,
}: {
  articles: readonly Article[]
  onArticle: (slug: string) => void
  onNaviguer: (route: Route) => void
}) {
  const [requete, setRequete] = useState('')
  const trouvailles = useMemo(() => chercherArticles(articles, requete), [articles, requete])

  useMetadonnees(
    'Bien gérer sa scolarité — le blog de KitEtudiant.fr',
    'Comprendre Parcoursup, monter son dossier, choisir sa ville et tenir son budget : ' +
      'des articles courts et vérifiables pour les lycéens et leurs familles.',
    adresseComplete({ vue: 'blog' }),
  )

  return (
    <main className="app app-large">
      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Le blog', route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      <section className="bloc">
        <h1>Bien gérer sa scolarité</h1>
        <p className="bloc-intro">
          Ce qu’il faut comprendre de Parcoursup, comment monter un dossier qui tient, et
          comment choisir une ville où l’on pourra rester jusqu’au diplôme. Des articles
          courts, sans chiffre inventé.
        </p>

        {/* La recherche tourne dans le navigateur : les onze articles sont
            déjà chargés quand cette page s'affiche. Rien n'est envoyé, donc
            rien n'est conservé — ce qui est la façon la plus sûre de tenir
            la promesse « aucun traceur » faite à des mineurs. */}
        <form
          className="recherche"
          role="search"
          onSubmit={(ev) => ev.preventDefault()}
        >
          <label className="champ-label" htmlFor="recherche-articles">
            Chercher dans les articles
          </label>
          <div className="recherche-ligne">
            <input
              id="recherche-articles"
              type="search"
              className="recherche-champ"
              placeholder="bourse, logement, confirmation…"
              value={requete}
              onChange={(ev) => setRequete(ev.target.value)}
              autoComplete="off"
            />
            {requete !== '' ? (
              <button type="button" className="recherche-effacer" onClick={() => setRequete('')}>
                Effacer
              </button>
            ) : null}
          </div>
          {/* Annoncé à voix haute : sans cela, un lecteur d'écran ne dit rien
              quand la liste se réduit sous les doigts. */}
          <p className="note recherche-compte" role="status" aria-live="polite">
            {requete === ''
              ? `${articles.length} article${articles.length > 1 ? 's' : ''}`
              : trouvailles.length === 0
                ? 'Aucun article ne contient tous ces mots.'
                : `${trouvailles.length} article${trouvailles.length > 1 ? 's' : ''} sur ${articles.length}`}
          </p>
        </form>

        <ul className="articles">
          {trouvailles.map(({ article: a, extrait }) => (
            <li key={a.slug}>
              <a
                className="article-vignette"
                href={cheminDe({ vue: 'article', slug: a.slug })}
                onClick={(ev) => {
                  // Clic modifié ou bouton du milieu : on laisse le navigateur
                  // ouvrir dans un nouvel onglet, comme pour n'importe quel lien.
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
                  ev.preventDefault()
                  onArticle(a.slug)
                }}
              >
                <h3 className="article-vignette-titre">{a.titre}</h3>
                <p className="article-vignette-chapeau">{a.chapeau}</p>
                {/* L'extrait montre OÙ le mot a été trouvé. Sans lui, un
                    résultat dont le titre et le chapeau ne contiennent pas
                    la requête a l'air d'une erreur. */}
                {extrait !== null ? <p className="article-vignette-extrait">{extrait}</p> : null}
                <p className="article-vignette-pied">
                  {dateLisible(a.publieLe)} · {minutesDeLecture(a)} min de lecture
                </p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------ un article */

/**
 * Les questions fréquentes, au bas de l'article.
 *
 * Elles ne répètent pas le texte par paresse : chacune est la réponse à une
 * question posée, autoportante, lisible sans avoir lu ce qui précède. C'est
 * ce qui les rend utiles à deux lecteurs très différents — celui qui arrive
 * avec une question précise et fait défiler, et le moteur génératif qui ne
 * cite jamais un article mais toujours un passage.
 *
 * De vraies balises `h3` dans une `section` étiquetée, et non une liste de
 * `div` : c'est ce qui permet d'y naviguer d'un titre à l'autre au lecteur
 * d'écran, et c'est aussi ce qui donne sa structure aux données que le
 * pré-rendu déclare (kitetudiant/scripts/prerendre.ts).
 */
function Questions({ article }: { readonly article: Article }) {
  const questions = article.questions ?? []
  if (questions.length === 0) return null
  return (
    <section className="questions" aria-labelledby="questions-titre">
      <h3 className="questions-titre" id="questions-titre">
        Questions fréquentes
      </h3>
      <dl className="questions-liste">
        {questions.map((q) => (
          <div className="questions-paire" key={q.question}>
            <dt className="questions-question">{q.question}</dt>
            <dd className="questions-reponse">{q.reponse}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function PageArticle({
  article,
  onNaviguer,
  onCommencer,
}: {
  article: Article
  onNaviguer: (route: Route) => void
  onCommencer: () => void
}) {
  useMetadonnees(
    `${article.titre} — KitEtudiant.fr`,
    article.chapeau,
    adresseComplete({ vue: 'article', slug: article.slug }),
  )

  return (
    <main className="app">
      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Le blog', route: { vue: 'blog' } },
          // Le titre de l'article ferme le fil : un fil qui s'arrête au parent
          // oblige à deviner où l'on se trouve.
          { libelle: article.titre, route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      <article className="article">
        <p className="article-pied">
          {dateLisible(article.publieLe)}
          {article.revuLe !== null ? ` · revu le ${dateLisible(article.revuLe)}` : ''} ·{' '}
          {minutesDeLecture(article)} min de lecture
        </p>
        <h1 className="article-titre">{article.titre}</h1>
        <p className="article-chapeau">{article.chapeau}</p>

        {article.corps.map((bloc, i) => (
          <Contenu bloc={bloc} key={`${bloc.type}-${i}`} />
        ))}

        <Questions article={article} />

        <p className="article-source">{MENTION_SOURCE}</p>

        <div className="cta-groupe cta-groupe-bloc">
          <button type="button" className="principal" onClick={onCommencer}>
            Voir ce qu’il me restera pour vivre
          </button>
        </div>
      </article>
    </main>
  )
}
