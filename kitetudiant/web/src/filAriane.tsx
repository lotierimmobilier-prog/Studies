/**
 * Le fil d'Ariane.
 *
 * Il répond à une seule question : « où suis-je, et comment je remonte ? ».
 * Les pages profondes du site — un article, la collection, un formulaire —
 * n'offraient qu'un bouton « Retour » qui ne disait pas vers quoi.
 *
 * ── Ce que c'est vraiment ────────────────────────────────────────────────
 *
 * Une liste ordonnée dans un `nav` étiqueté. Ce n'est pas de la décoration
 * sémantique : un lecteur d'écran annonce « navigation, fil d'Ariane, liste de
 * trois éléments », ce qui est exactement l'information dont son utilisateur a
 * besoin. Une suite de `span` séparés par des chevrons ne dirait rien.
 *
 * La page courante est le dernier maillon, sans lien, et porte
 * `aria-current="page"`. Elle reste dans le fil plutôt que d'en être retirée :
 * un fil qui s'arrête au parent oblige à deviner où l'on est.
 *
 * ── Les liens sont de vrais liens ────────────────────────────────────────
 *
 * Chaque maillon a une adresse. Le clic ordinaire navigue sans recharger ; le
 * clic du milieu et le clic modifié sont laissés au navigateur, comme partout
 * ailleurs sur ce site. Un fil d'Ariane dont on ne peut pas ouvrir un maillon
 * dans un onglet n'est qu'un décor.
 *
 * ── Le séparateur ────────────────────────────────────────────────────────
 *
 * Il est posé en CSS, jamais dans le texte. Écrit en dur entre deux maillons,
 * il serait lu à voix haute à chaque étape — « accueil, barre oblique, blog,
 * barre oblique… » — ce qui rend le fil pénible à écouter.
 */

import { cheminDe, type Route } from './routes.ts'

export interface Maillon {
  readonly libelle: string
  /** `null` pour le dernier maillon : la page où l'on se trouve déjà. */
  readonly route: Route | null
}

export function FilAriane({
  maillons,
  onNaviguer,
}: {
  readonly maillons: readonly Maillon[]
  readonly onNaviguer: (route: Route) => void
}) {
  return (
    <nav className="fil" aria-label="Fil d’Ariane">
      <ol className="fil-liste">
        {maillons.map((m) => (
          <li className="fil-maillon" key={m.libelle}>
            {m.route === null ? (
              <span className="fil-ici" aria-current="page">
                {m.libelle}
              </span>
            ) : (
              <a
                className="fil-lien"
                href={cheminDe(m.route)}
                onClick={(ev) => {
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
                  ev.preventDefault()
                  onNaviguer(m.route!)
                }}
              >
                {m.libelle}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
