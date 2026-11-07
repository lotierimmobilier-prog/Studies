/**
 * Rédaction d'articles depuis la console d'administration.
 *
 * ── Pourquoi un formulaire et pas un éditeur riche ───────────────────────
 *
 * Un éditeur riche produit du HTML, et du HTML publié sur le site est un
 * chemin d'exécution de script chez le visiteur. Le corps est donc saisi en
 * texte brut, dans une mini-syntaxe de quatre règles, et converti côté serveur
 * en blocs typés que des composants React rendent. Quoi qu'on tape ici, rien
 * ne s'exécute chez un lecteur.
 *
 * ── Qui valide ───────────────────────────────────────────────────────────
 *
 * Le serveur, seul. Cette page grise le bouton quand elle voit un champ
 * manifestement vide, mais elle ne re-décrit pas les règles : elle affiche le
 * refus tel qu'il revient. Deux validations qui divergent, c'est un article
 * refusé sans explication lisible.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  enTexte,
  minutesDeLecture,
  slugDe,
  type Article,
} from '../../../packages/articles/src/index.ts'
import { cheminDe } from '../routes.ts'
import { listerArticles, publierArticle, retirerArticle } from './api.ts'

const AIDE_CORPS = [
  '## en début de ligne : un titre de section',
  '- en début de ligne : un point de liste',
  '> en début de ligne : un encadré (mise en garde, point à retenir)',
  'tout le reste : un paragraphe. Une ligne vide sépare deux paragraphes.',
]

/** Un brouillon en cours de saisie. */
interface Brouillon {
  titre: string
  chapeau: string
  corps: string
  motsCles: string
  /** Non vide quand on reprend un article déjà publié : le slug est alors figé. */
  slugRepris: string
}

const VIDE: Brouillon = { titre: '', chapeau: '', corps: '', motsCles: '', slugRepris: '' }

function dateLisible(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function Articles() {
  const [articles, setArticles] = useState<readonly Article[] | null>(null)
  const [brouillon, setBrouillon] = useState<Brouillon>(VIDE)
  const [occupe, setOccupe] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const rafraichir = useCallback(async () => {
    try {
      setArticles(await listerArticles())
    } catch (e) {
      setRefus((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void rafraichir()
  }, [rafraichir])

  function modifier(champ: keyof Brouillon, valeur: string): void {
    setBrouillon((b) => ({ ...b, [champ]: valeur }))
    setSucces(null)
  }

  const slug = brouillon.slugRepris !== '' ? brouillon.slugRepris : slugDe(brouillon.titre)
  const pret =
    brouillon.titre.trim() !== '' && brouillon.chapeau.trim() !== '' && brouillon.corps.trim() !== ''

  async function publier(): Promise<void> {
    setOccupe(true)
    setRefus(null)
    setSucces(null)
    try {
      const publie = await publierArticle({
        titre: brouillon.titre.trim(),
        chapeau: brouillon.chapeau.trim(),
        corps: brouillon.corps,
        motsCles: brouillon.motsCles
          .split(',')
          .map((m) => m.trim())
          .filter((m) => m !== ''),
        ...(brouillon.slugRepris !== '' ? { slug: brouillon.slugRepris } : {}),
      })
      setBrouillon(VIDE)
      setSucces(`« ${publie.titre} » est en ligne, ${minutesDeLecture(publie)} min de lecture.`)
      await rafraichir()
    } catch (e) {
      setRefus((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  function reprendre(article: Article): void {
    setRefus(null)
    setSucces(null)
    setBrouillon({
      titre: article.titre,
      chapeau: article.chapeau,
      corps: enTexte(article.corps),
      motsCles: article.motsCles.join(', '),
      slugRepris: article.slug,
    })
  }

  async function retirer(article: Article): Promise<void> {
    setOccupe(true)
    setRefus(null)
    setSucces(null)
    try {
      await retirerArticle(article.slug)
      await rafraichir()
    } catch (e) {
      setRefus((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <section className="bloc">
      <h2>Articles du blog</h2>
      <p className="bloc-intro">
        Les articles de fond vivent dans le dépôt : ils sont versionnés et pré-rendus au
        build, donc visibles des moteurs de recherche sans exécuter de JavaScript. Ceux
        écrits ici s’ajoutent à eux immédiatement, sans déploiement — mais ils ne sont pas
        pré-rendus. Un article d’ici qui reprend l’identifiant d’un article du dépôt le
        recouvre : c’est ainsi qu’on corrige un texte sans attendre une mise en ligne.
      </p>

      <article className="secret">
        <h3>{brouillon.slugRepris !== '' ? 'Corriger un article' : 'Écrire un article'}</h3>

        <label className="champ">
          <span className="champ-label">Titre</span>
          <span className="champ-saisie">
            <input
              type="text"
              value={brouillon.titre}
              placeholder="Ce qui compte vraiment dans vos bulletins"
              onChange={(e) => modifier('titre', e.target.value)}
            />
          </span>
        </label>
        <p className="note">
          Adresse de l’article :{' '}
          <code>{slug === '' ? '—' : cheminDe({ vue: 'article', slug })}</code>
          {brouillon.slugRepris !== ''
            ? ' — figée : republier sous ce même identifiant remplace l’article, sans le faire remonter en tête de liste.'
            : ' — déduite du titre.'}
        </p>

        <label className="champ champ-espace">
          <span className="champ-label">
            Chapeau — sert aussi de description dans les résultats de recherche
          </span>
          <span className="champ-saisie">
            <textarea
              rows={3}
              value={brouillon.chapeau}
              placeholder="Une ou deux phrases qui disent ce que le lecteur va apprendre."
              onChange={(e) => modifier('chapeau', e.target.value)}
            />
          </span>
        </label>
        <p className="note">{brouillon.chapeau.trim().length} caractères — entre 70 et 220.</p>

        <label className="champ champ-espace">
          <span className="champ-label">Corps</span>
          <span className="champ-saisie">
            <textarea
              rows={16}
              className="saisie-corps"
              value={brouillon.corps}
              placeholder={'## Une section\n\nUn paragraphe.\n\n- un point\n- un autre\n\n> Un encadré.'}
              onChange={(e) => modifier('corps', e.target.value)}
            />
          </span>
        </label>
        <ul className="aide-syntaxe">
          {AIDE_CORPS.map((ligne) => (
            <li key={ligne}>{ligne}</li>
          ))}
        </ul>
        <p className="note">
          Aucun montant en euros dans un article : un chiffre écrit ici échappe à sa source
          et à son millésime, et devient faux dès que le barème change. Renvoyez au
          calculateur du site.
        </p>

        <label className="champ champ-espace">
          <span className="champ-label">Mots-clés, séparés par des virgules</span>
          <span className="champ-saisie">
            <input
              type="text"
              value={brouillon.motsCles}
              placeholder="parcoursup, bulletins, terminale"
              onChange={(e) => modifier('motsCles', e.target.value)}
            />
          </span>
        </label>

        <div className="navigation">
          <button
            type="button"
            className="principal"
            disabled={occupe || !pret}
            onClick={() => void publier()}
          >
            {brouillon.slugRepris !== '' ? 'Remplacer l’article' : 'Publier'}
          </button>
          {brouillon.titre !== '' || brouillon.corps !== '' ? (
            <button
              type="button"
              className="secondaire"
              disabled={occupe}
              onClick={() => {
                setBrouillon(VIDE)
                setRefus(null)
                setSucces(null)
              }}
            >
              Abandonner
            </button>
          ) : null}
        </div>

        {refus ? <p className="erreur">{refus}</p> : null}
        {succes ? <p className="etat-ok">{succes}</p> : null}
      </article>

      <h3 className="articles-titre">Écrits depuis la console</h3>
      {articles === null ? (
        <p className="note">Chargement…</p>
      ) : articles.length === 0 ? (
        <p className="note">
          Aucun pour l’instant. Les articles du dépôt, eux, sont déjà en ligne.
        </p>
      ) : (
        <ul className="articles-admin">
          {articles.map((a) => (
            <li key={a.slug}>
              <div>
                <strong>{a.titre}</strong>
                <span className="note">
                  {dateLisible(a.publieLe)}
                  {a.revuLe !== null ? ` · revu le ${dateLisible(a.revuLe)}` : ''} ·{' '}
                  {minutesDeLecture(a)} min · <code>{a.slug}</code>
                </span>
              </div>
              <div className="articles-admin-actions">
                <button type="button" className="secondaire" disabled={occupe} onClick={() => reprendre(a)}>
                  Reprendre
                </button>
                <button
                  type="button"
                  className="secondaire"
                  disabled={occupe}
                  onClick={() => void retirer(a)}
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
