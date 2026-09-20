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

import { useEffect } from 'react'

import {
  MENTION_SOURCE,
  minutesDeLecture,
  type Article,
  type Bloc,
} from '../../packages/articles/src/index.ts'
import { Marque } from './marque.tsx'
import { adresseComplete, cheminDe } from './routes.ts'

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
  onRetour,
}: {
  articles: readonly Article[]
  onArticle: (slug: string) => void
  onRetour: () => void
}) {
  useMetadonnees(
    'Bien gérer sa scolarité — le blog de KitEtudiant.fr',
    'Comprendre Parcoursup, monter son dossier, choisir sa ville et tenir son budget : ' +
      'des articles courts et vérifiables pour les lycéens et leurs familles.',
    adresseComplete({ vue: 'blog' }),
  )

  return (
    <main className="app">
      <header className="entete entete-accueil">
        <h1 className="marque">
          <Marque />
        </h1>
        <button type="button" className="entete-cta" onClick={onRetour}>
          Retour au site
        </button>
      </header>

      <section className="bloc">
        <h2>Bien gérer sa scolarité</h2>
        <p className="bloc-intro">
          Ce qu’il faut comprendre de Parcoursup, comment monter un dossier qui tient, et
          comment choisir une ville où l’on pourra rester jusqu’au diplôme. Des articles
          courts, sans chiffre inventé.
        </p>

        <ul className="articles">
          {articles.map((a) => (
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

export function PageArticle({
  article,
  onBlog,
  onCommencer,
}: {
  article: Article
  onBlog: () => void
  onCommencer: () => void
}) {
  useMetadonnees(
    `${article.titre} — KitEtudiant.fr`,
    article.chapeau,
    adresseComplete({ vue: 'article', slug: article.slug }),
  )

  return (
    <main className="app">
      <header className="entete entete-accueil">
        <h1 className="marque">
          <Marque />
        </h1>
        <button type="button" className="entete-cta" onClick={onBlog}>
          Tous les articles
        </button>
      </header>

      <article className="article">
        <p className="article-pied">
          {dateLisible(article.publieLe)}
          {article.revuLe !== null ? ` · revu le ${dateLisible(article.revuLe)}` : ''} ·{' '}
          {minutesDeLecture(article)} min de lecture
        </p>
        <h2 className="article-titre">{article.titre}</h2>
        <p className="article-chapeau">{article.chapeau}</p>

        {article.corps.map((bloc, i) => (
          <Contenu bloc={bloc} key={`${bloc.type}-${i}`} />
        ))}

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
