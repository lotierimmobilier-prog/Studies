/**
 * La barre de navigation du site.
 *
 * ── Pourquoi elle remplace les en-têtes de page ──────────────────────────
 *
 * Chaque écran portait jusqu'ici son propre en-tête : le logo, et UN bouton
 * choisi par l'écran — « Retour au site », « Tous les articles », « Chercher
 * une école ». Ce bouton changeait de page en page, ce qui veut dire que
 * depuis n'importe où, une seule destination était atteignable, et jamais la
 * même. Pour aller du blog à la recherche d'écoles, il fallait passer par
 * l'accueil.
 *
 * Une barre permanente règle ça : toutes les destinations, tout le temps, au
 * même endroit, et l'écran courant est signalé.
 *
 * ── Deux formes, un seul composant ───────────────────────────────────────
 *
 * Au-dessus de 1024 px, un rail vertical à gauche. En dessous, une barre
 * fixée en bas de l'écran — là où se trouve le pouce, et là où toutes les
 * applications mobiles la mettent. Un rail latéral sur un téléphone mange la
 * moitié de la largeur ; une barre en haut se fait recouvrir par le clavier
 * et par les barres du navigateur.
 *
 * C'est la même liste dans les deux cas, dans le même ordre. Deux listes
 * différentes selon la taille de l'écran finissent toujours par diverger.
 *
 * ── Ce qui n'y figure pas ────────────────────────────────────────────────
 *
 * Rien qui n'existe pas encore. Une entrée « Mes vœux » grisée en attendant
 * son écran serait une promesse ; on l'ajoutera avec l'écran (jalon MVP1-G).
 *
 * « Mes cartes » n'apparaît qu'une fois la première gagnée : pour un visiteur
 * qui découvre le site, ce serait du bruit.
 */

import { Boussole, Carnet, Etoile, Fiche, Loupe } from './illustrations.tsx'
import { Marque } from './marque.tsx'
import { cheminDe, type Route } from './routes.ts'

/** Une entrée de la barre. `action` sert aux vues sans adresse. */
interface Entree {
  readonly cle: string
  readonly libelle: string
  /** Libellé court, pour la barre du bas où la place manque. */
  readonly court: string
  readonly icone: React.ReactNode
  readonly route: Route | null
  readonly action?: () => void
  /** Vues considérées comme « ici », pour signaler l'entrée courante. */
  readonly actif: readonly string[]
}

export interface Navigation {
  readonly vue: string
  readonly connecte: boolean
  /** Nombre de cartes gagnées. Zéro : l'entrée ne s'affiche pas. */
  readonly cartes: number
  readonly onNaviguer: (route: Route) => void
  readonly onCollection: () => void
  readonly onDeconnexion: () => void
}

function entrees(nav: Navigation): Entree[] {
  const liste: Entree[] = [
    {
      cle: 'accueil',
      libelle: 'Accueil',
      court: 'Accueil',
      icone: <Boussole />,
      route: { vue: 'accueil' },
      actif: ['accueil', 'parcours'],
    },
    {
      cle: 'recherche',
      libelle: 'Chercher une école',
      court: 'Écoles',
      icone: <Loupe />,
      route: { vue: 'recherche' },
      // Une fiche de formation ou d'établissement est une destination de la
      // recherche : l'entrée reste allumée pour dire d'où l'on vient.
      actif: ['recherche', 'formation', 'etablissement'],
    },
    {
      cle: 'blog',
      libelle: 'Le blog',
      court: 'Blog',
      icone: <Carnet />,
      route: { vue: 'blog' },
      actif: ['blog', 'article'],
    },
  ]

  if (nav.cartes > 0) {
    liste.push({
      cle: 'collection',
      libelle: `Mes cartes (${nav.cartes})`,
      court: 'Cartes',
      icone: <Etoile />,
      route: null,
      action: nav.onCollection,
      actif: ['collection'],
    })
  }

  liste.push(
    nav.connecte
      ? {
          cle: 'compte',
          libelle: 'Mon espace',
          court: 'Espace',
          icone: <Fiche />,
          route: { vue: 'compte' },
          actif: ['compte'],
        }
      : {
          cle: 'connexion',
          libelle: 'Se connecter',
          court: 'Connexion',
          icone: <Fiche />,
          route: { vue: 'connexion' },
          actif: ['connexion', 'inscription'],
        },
  )

  return liste
}

function Lien({
  entree,
  courant,
  onNaviguer,
}: {
  readonly entree: Entree
  readonly courant: boolean
  readonly onNaviguer: (route: Route) => void
}) {
  const classe = courant ? 'rail-lien rail-lien-courant' : 'rail-lien'
  /* `aria-current="page"` et non une simple couleur : sans lui, un lecteur
     d'écran lit cinq destinations identiques et n'a aucun moyen de savoir
     laquelle est celle où l'on se trouve.
  
     `aria-label` porte TOUJOURS le libellé long, alors que le texte visible
     se réduit à « Écoles » ou « Blog » sur téléphone. Sans cela, le nom
     accessible d'une même destination changerait avec la largeur de
     l'écran — et « Écoles », lu seul, ne dit pas ce qu'on y fait. */
  const marque = {
    'aria-label': entree.libelle,
    ...(courant ? { 'aria-current': 'page' as const } : {}),
  }

  if (entree.route === null) {
    return (
      <button type="button" className={classe} onClick={entree.action} {...marque}>
        {entree.icone}
        <span className="rail-libelle">{entree.libelle}</span>
        <span className="rail-court">{entree.court}</span>
      </button>
    )
  }
  const route = entree.route
  return (
    <a
      className={classe}
      href={cheminDe(route)}
      {...marque}
      onClick={(ev) => {
        // Clic modifié ou bouton du milieu : le navigateur ouvre dans un
        // onglet, comme pour n'importe quel lien.
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
        ev.preventDefault()
        onNaviguer(route)
      }}
    >
      {entree.icone}
      <span className="rail-libelle">{entree.libelle}</span>
      <span className="rail-court">{entree.court}</span>
    </a>
  )
}

/**
 * La marque, lien vers l'accueil — sauf quand on y est déjà.
 *
 * Un lien vers la page où l'on se trouve n'a nulle part où mener, et un
 * lecteur d'écran l'annonce quand même comme une destination.
 */
function MarqueBarre({
  surAccueil,
  onNaviguer,
}: {
  readonly surAccueil: boolean
  readonly onNaviguer: (route: Route) => void
}) {
  if (surAccueil) return <Marque />
  return (
    <a
      className="marque-lien"
      href={cheminDe({ vue: 'accueil' })}
      aria-label="KitEtudiant.fr — retour à l’accueil"
      onClick={(ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
        ev.preventDefault()
        onNaviguer({ vue: 'accueil' })
      }}
    >
      <Marque />
    </a>
  )
}

export function BarreNavigation(nav: Navigation) {
  const liste = entrees(nav)
  const surAccueil = nav.vue === 'accueil'
  return (
    <>
      {/* Sur téléphone, la marque ne peut pas tenir dans la barre du bas : elle
          y prendrait la largeur d'une destination sans en être une. Elle a donc
          son propre bandeau en haut, qui disparaît sur grand écran où le rail
          la porte déjà. Sans ce bandeau, le logo n'apparaîtrait nulle part sur
          un téléphone. */}
      <header className="barre-marque">
        <MarqueBarre surAccueil={surAccueil} onNaviguer={nav.onNaviguer} />
      </header>

      <nav className="rail" aria-label="Navigation du site">
        <div className="rail-marque">
          <MarqueBarre surAccueil={surAccueil} onNaviguer={nav.onNaviguer} />
        </div>

        <ul className="rail-liste">
          {liste.map((e) => (
            <li key={e.cle}>
              <Lien entree={e} courant={e.actif.includes(nav.vue)} onNaviguer={nav.onNaviguer} />
            </li>
          ))}
        </ul>

        {/* La déconnexion est à part, en bas du rail et jamais dans la barre
            du bas d'un téléphone : c'est une action, pas une destination, et
            une action irréversible posée d'un doigt à côté des onglets se
            déclenche par accident. Sur téléphone, elle vit dans « Mon
            espace », qui est la page faite pour ça. */}
        {nav.connecte ? (
          <button type="button" className="rail-deconnexion" onClick={nav.onDeconnexion}>
            Se déconnecter
          </button>
        ) : null}
      </nav>
    </>
  )
}
