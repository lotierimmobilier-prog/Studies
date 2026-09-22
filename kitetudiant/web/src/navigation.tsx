/**
 * La navigation du site.
 *
 * ── Deux sites dans un seul ──────────────────────────────────────────────
 *
 * Un visiteur qui découvre KitEtudiant et un élève connecté qui compare ses
 * vœux ne font pas la même chose, et n'ont pas besoin de la même navigation.
 *
 * Le visiteur lit : l'accueil, un article, une fiche de formation. Il navigue
 * peu et veut de la largeur pour le texte. Il a donc une BARRE EN HAUT, comme
 * n'importe quel site qu'on découvre, avec « Se connecter » bien visible au
 * bout.
 *
 * L'élève connecté travaille : il fait des allers-retours entre la recherche,
 * ses vœux et ses cartes. Il a donc un RAIL À GAUCHE, comme une application,
 * où la destination courante reste sous les yeux. Et parce qu'une carte ou un
 * tableau de loyers réclament de la largeur, ce rail se replie sur ses icônes.
 *
 * ── Ce que le repli fait, et ne fait pas ─────────────────────────────────
 *
 * Replié, le rail passe de 15 rem à 4 rem : les mots disparaissent, les icônes
 * restent, et l'écran courant reste signalé. On ne perd jamais la navigation
 * de vue — c'est ce qui distingue ce repli d'un menu caché derrière un bouton.
 *
 * L'état est retenu dans le navigateur. Quelqu'un qui replie le rail le fait
 * pour gagner de la place sur une tâche, pas pour un seul écran, et le voir
 * revenir à chaque page serait un tic.
 *
 * ── Le téléphone ne suit aucune des deux formes ──────────────────────────
 *
 * En dessous de 1024 px, un rail latéral mangerait la moitié de l'écran. Un
 * élève connecté garde donc la BARRE DU BAS : elle est à portée de pouce, la
 * destination courante y est visible, et chaque déplacement coûte un geste.
 * Un tiroir en coûterait deux — ouvrir, choisir — à chaque fois.
 *
 * Le visiteur, lui, garde sa barre en haut, qui passe simplement sur deux
 * rangées : la marque et « Se connecter », puis les destinations en dessous.
 * Rien n'est masqué derrière un bouton « Menu » : cinq destinations tiennent,
 * et un menu qu'il faut ouvrir pour savoir ce qu'il contient ne s'explore pas.
 *
 * ── Ce qui n'y figure pas ────────────────────────────────────────────────
 *
 * Rien qui n'existe pas encore. Une entrée grisée en attendant son écran
 * serait une promesse.
 */

import { useEffect, useState } from 'react'

import {
  Boussole,
  Carnet,
  Chevrons,
  Etoile,
  Fiche,
  Loupe,
  Plume,
  Sortie,
  Toit,
} from './illustrations.tsx'
import { Marque } from './marque.tsx'
import { cheminDe, CHEMIN_TOQUE, type Route } from './routes.ts'

/**
 * Une entrée de navigation.
 *
 * Toutes ont une adresse, sans exception : une destination sans adresse ne se
 * partage pas, ne se met pas en favori, et le bouton « précédent » ne la
 * retrouve pas.
 */
interface Entree {
  readonly cle: string
  readonly libelle: string
  /** Libellé court, là où la place manque — barre du bas, barre du haut. */
  readonly court: string
  readonly icone: React.ReactNode
  readonly route: Route
  /** Vues considérées comme « ici », pour signaler l'entrée courante. */
  readonly actif: readonly string[]
}

export interface Navigation {
  readonly vue: string
  readonly connecte: boolean
  /** Nombre de cartes gagnées. Zéro : l'entrée s'affiche quand même. */
  readonly cartes: number
  readonly onNaviguer: (route: Route) => void
  readonly onDeconnexion: () => void
}

/* ------------------------------------------------------- l'état du repli */

const CLE_REPLI = 'kitetudiant.rail.replie'

/**
 * Le rail était-il replié la dernière fois ?
 *
 * Déplié par défaut : quelqu'un qui n'a jamais touché au bouton doit voir les
 * libellés. Un stockage refusé — navigation privée, cookies bloqués — donne
 * la même réponse que « jamais replié », ce qui est le bon comportement.
 */
function lireRepli(): boolean {
  try {
    return window.localStorage.getItem(CLE_REPLI) === '1'
  } catch {
    return false
  }
}

function ecrireRepli(replie: boolean): void {
  try {
    window.localStorage.setItem(CLE_REPLI, replie ? '1' : '0')
  } catch {
    // Stockage refusé : le choix ne survivra pas au rechargement, c'est tout.
  }
}

/* ------------------------------------------------------- la liste unique */

/**
 * Les destinations, dans l'ordre. La même liste pour les deux formes.
 *
 * Deux listes qui diffèrent selon l'état de connexion ou la taille de l'écran
 * finissent toujours par diverger : une destination ajoutée d'un côté et pas
 * de l'autre devient invisible pour la moitié des gens.
 */
function destinations(nav: Navigation): Entree[] {
  return [
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
      cle: 'voeux',
      libelle: 'Mes vœux',
      court: 'Vœux',
      icone: <Toit />,
      route: { vue: 'voeux' },
      actif: ['voeux'],
    },
    /* L'atelier de lettre de motivation.
     *
     * Entre les vœux et le blog : c'est l'étape qui vient juste après avoir
     * choisi, et avant de lire des articles. Visible sans compte — la lettre
     * se prépare bien avant de créer un dossier ici, et rien de ce qu'on y
     * écrit ne quitte le navigateur. */
    {
      cle: 'lettre',
      libelle: 'Ma lettre de motivation',
      court: 'Lettre',
      icone: <Plume />,
      route: { vue: 'lettre' },
      actif: ['lettre'],
    },
    {
      cle: 'blog',
      libelle: 'Le blog',
      court: 'Blog',
      icone: <Carnet />,
      route: { vue: 'blog' },
      actif: ['blog', 'article'],
    },
    /* L'entrée reste visible même à zéro carte.
     *
     * Elle ne l'était pas : on ne découvrait la collection qu'en ayant déjà
     * gagné quelque chose, donc par hasard. Une entrée cachée derrière la
     * chose qu'elle sert à découvrir ne se découvre jamais. */
    {
      cle: 'collection',
      libelle: nav.cartes > 0 ? `Mes cartes (${nav.cartes})` : 'Mes cartes',
      court: 'Cartes',
      icone: <Etoile />,
      route: { vue: 'collection' },
      actif: ['collection'],
    },
  ]
}

/** L'entrée de compte : l'espace personnel, ou l'invitation à se connecter. */
function entreeCompte(connecte: boolean): Entree {
  return connecte
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
      }
}

/* ------------------------------------------------------------- les liens */

function Lien({
  entree,
  courant,
  base,
  onNaviguer,
}: {
  readonly entree: Entree
  readonly courant: boolean
  /** Classe de base : « rail-lien » dans le rail, « haut-lien » en haut. */
  readonly base: string
  readonly onNaviguer: (route: Route) => void
}) {
  /* `aria-current="page"` et non une simple couleur : sans lui, un lecteur
     d'écran lit cinq destinations identiques et n'a aucun moyen de savoir
     laquelle est celle où l'on se trouve.

     `aria-label` porte TOUJOURS le libellé long, alors que le texte visible
     se réduit à « Écoles » ou « Blog » — et disparaît complètement quand le
     rail est replié. Sans cela, le nom accessible d'une même destination
     changerait avec la largeur de l'écran, et « Écoles », lu seul, ne dit pas
     ce qu'on y fait.

     `title` porte le même libellé : c'est la seule façon de retrouver le nom
     d'une icône à la souris, une fois le rail replié. */
  const marque = {
    'aria-label': entree.libelle,
    title: entree.libelle,
    ...(courant ? { 'aria-current': 'page' as const } : {}),
  }

  const route = entree.route
  return (
    <a
      className={courant ? `${base} ${base}-courant` : base}
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
 *
 * `compacte` rend la toque seule : le bandeau du nom fait 665 × 96, il ne
 * tient pas dans un rail replié à 4 rem.
 */
function MarqueBarre({
  surAccueil,
  compacte = false,
  onNaviguer,
}: {
  readonly surAccueil: boolean
  readonly compacte?: boolean
  readonly onNaviguer: (route: Route) => void
}) {
  const dessin = compacte ? (
    <img className="rail-toque" src={CHEMIN_TOQUE} alt="KitEtudiant.fr" width={30} height={30} />
  ) : (
    <Marque />
  )
  if (surAccueil) return dessin
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
      {dessin}
    </a>
  )
}

/* ------------------------------------------------- le visiteur : en haut */

/**
 * La barre du visiteur.
 *
 * Une rangée sur grand écran — marque, destinations, « Se connecter ». Deux
 * rangées sur téléphone, la seconde portant les destinations. C'est le CSS
 * qui décide du passage à la ligne : le balisage est le même dans les deux
 * cas, donc il n'y a rien à maintenir en double.
 */
function BarreVisiteur(nav: Navigation) {
  const liste = destinations(nav)
  const compte = entreeCompte(false)
  return (
    <header className="barre-haut">
      <div className="barre-haut-marque">
        <MarqueBarre surAccueil={nav.vue === 'accueil'} onNaviguer={nav.onNaviguer} />
      </div>

      <nav className="barre-haut-nav" aria-label="Navigation du site">
        <ul className="barre-haut-liste">
          {liste.map((e) => (
            <li key={e.cle}>
              <Lien
                entree={e}
                base="haut-lien"
                courant={e.actif.includes(nav.vue)}
                onNaviguer={nav.onNaviguer}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* « Se connecter » sort de la liste et devient un bouton.
          C'est la seule action de la barre ; la noyer entre cinq destinations
          reviendrait à dire qu'ouvrir un compte est aussi anodin que lire un
          article. */}
      <a
        className={
          compte.actif.includes(nav.vue) ? 'barre-haut-compte courant' : 'barre-haut-compte'
        }
        href={cheminDe(compte.route)}
        {...(compte.actif.includes(nav.vue) ? { 'aria-current': 'page' as const } : {})}
        onClick={(ev) => {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
          ev.preventDefault()
          nav.onNaviguer(compte.route)
        }}
      >
        Se connecter
      </a>
    </header>
  )
}

/* ------------------------------------------- l'élève connecté : sur le côté */

/**
 * Le rail de l'élève connecté, repliable.
 *
 * Le même balisage sert de rail à gauche au-dessus de 1024 px et de barre en
 * bas en dessous : c'est le CSS qui bascule. Le bouton de repli n'a de sens
 * que dans la première forme, et le CSS le masque dans la seconde.
 */
function RailApplication(nav: Navigation) {
  const [replie, setReplie] = useState(lireRepli)
  useEffect(() => {
    ecrireRepli(replie)
  }, [replie])

  const liste = [...destinations(nav), entreeCompte(true)]
  const surAccueil = nav.vue === 'accueil'

  return (
    <>
      {/* Sur téléphone, la marque ne peut pas tenir dans la barre du bas :
          elle y prendrait la largeur d'une destination sans en être une. Elle
          a donc son propre bandeau en haut, qui disparaît sur grand écran où
          le rail la porte déjà. */}
      <header className="barre-marque">
        <MarqueBarre surAccueil={surAccueil} onNaviguer={nav.onNaviguer} />
      </header>

      <nav className={replie ? 'rail rail-replie' : 'rail'} aria-label="Navigation du site">
        <div className="rail-tete">
          <div className="rail-marque">
            <MarqueBarre surAccueil={surAccueil} compacte={replie} onNaviguer={nav.onNaviguer} />
          </div>
          {/* `aria-expanded` porte l'état, et le libellé dit le GESTE à venir,
              pas l'état courant : un bouton nommé « Replié » laisse deviner
              s'il décrit ce qui est ou ce qui arrivera. */}
          <button
            type="button"
            className="rail-bascule"
            aria-expanded={!replie}
            aria-label={replie ? 'Déplier le menu' : 'Replier le menu'}
            title={replie ? 'Déplier le menu' : 'Replier le menu'}
            onClick={() => setReplie(!replie)}
          >
            <Chevrons />
          </button>
        </div>

        <ul className="rail-liste">
          {liste.map((e) => (
            <li key={e.cle}>
              <Lien
                entree={e}
                base="rail-lien"
                courant={e.actif.includes(nav.vue)}
                onNaviguer={nav.onNaviguer}
              />
            </li>
          ))}
        </ul>

        {/* La déconnexion est à part, en bas du rail, et jamais dans la barre
            du bas d'un téléphone : c'est une action, pas une destination, et
            une action posée d'un doigt à côté des onglets se déclenche par
            accident. Sur téléphone, elle vit dans « Mon espace ».

            Elle a maintenant une icône, et reste donc visible quand le rail
            est replié. Elle n'en avait pas, au motif qu'aucun pictogramme ne
            distingue « sortir » de « supprimer » — ce qui est vrai d'une croix
            ou d'une corbeille, mais pas d'une porte franchie par une flèche.
            Le libellé disparaissait alors avec le rail, et il n'existait plus
            aucun moyen de se déconnecter : ni ici, ni ailleurs.

            `aria-label` et `title` portent toujours le libellé complet : replié,
            le texte visible n'existe plus, et une icône seule sans nom
            accessible est un bouton muet. */}
        <button
          type="button"
          className="rail-deconnexion"
          onClick={nav.onDeconnexion}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <Sortie />
          <span className="rail-libelle">Se déconnecter</span>
        </button>
      </nav>
    </>
  )
}

export function BarreNavigation(nav: Navigation) {
  return nav.connecte ? <RailApplication {...nav} /> : <BarreVisiteur {...nav} />
}
