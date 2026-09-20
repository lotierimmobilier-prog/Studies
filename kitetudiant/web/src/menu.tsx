/**
 * Le menu de l'en-tête.
 *
 * Il était jusqu'ici réduit à trois boutons posés dans l'accueil, et le
 * formulaire de compte n'existait que comme une porte qui s'ouvrait devant une
 * fonctionnalité payante. Un visiteur qui avait déjà un compte n'avait aucun
 * moyen de se connecter depuis la page d'accueil.
 *
 * ── Ce que le menu montre, et quand ──────────────────────────────────────
 *
 * Déconnecté : le blog, se connecter, créer un compte. Quatre entrées « du
 * dehors », toutes de même nature, qui tiennent en ligne.
 *
 * Connecté : le blog, puis TOUT le reste derrière « Mon espace ». Posées à
 * plat, les entrées personnelles — cartes, compte, déconnexion — faisaient
 * cinq boutons de poids visuel égal dans lesquels rien ne ressortait, et la
 * barre débordait dès qu'on y ajoutait quoi que ce soit. Les regrouper dit
 * aussi quelque chose de juste : ce sont les affaires de l'élève, pas des
 * pages du site.
 *
 * « Mon compte » a longtemps été jugé inutile ici, au motif que le site ne
 * connaît qu'une adresse chiffrée et qu'une page affichant cette seule donnée
 * n'apprendrait rien. C'était se tromper de question. L'élève, lui, ne SAIT
 * pas ce que le site garde de lui — et il n'a aucun moyen de le vérifier, ni
 * de changer son mot de passe, ni d'effacer son compte. Cette page existe
 * pour répondre « voici tout ce que nous savons », et cette réponse est
 * d'autant plus utile qu'elle est courte.
 *
 * La collection de cartes n'apparaît qu'une fois la première gagnée : pour un
 * visiteur qui découvre le site, ce serait du bruit.
 *
 * ── Pourquoi des liens et pas des boutons ────────────────────────────────
 *
 * Connexion et inscription ont une vraie adresse. On peut donc les ouvrir dans
 * un onglet, les mettre en favori, envoyer « le lien d'inscription » à
 * quelqu'un, et revenir en arrière. Le clic ordinaire est intercepté pour
 * naviguer sans recharger ; le clic du milieu et le clic modifié sont laissés
 * au navigateur, comme pour n'importe quel lien.
 *
 * ── Sur téléphone ────────────────────────────────────────────────────────
 *
 * À partir de cinq entrées, la barre ne tient plus sur 390 px. Le menu se
 * replie derrière un bouton, qui est un vrai bouton — avec `aria-expanded` et
 * `aria-controls` — et non une case à cocher déguisée. Il se ferme à la touche
 * d'échappement et au clic à l'extérieur, parce qu'un menu qui ne se ferme que
 * par son propre bouton piège les gens.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { cheminDe, type Route } from './routes.ts'

export interface EntreesMenu {
  readonly connecte: boolean
  /** Nombre de cartes gagnées. Zéro : l'entrée ne s'affiche pas. */
  readonly cartes: number
  readonly onNaviguer: (route: Route) => void
  readonly onCollection: () => void
  readonly onDeconnexion: () => void
  readonly onCommencer: () => void
}

/**
 * Un panneau qui s'ouvre sous son bouton.
 *
 * Deux exigences, et elles ne sont pas décoratives. `aria-expanded` dit
 * l'état à qui n'a pas la couleur pour le lire ; `aria-haspopup` prévient
 * qu'un panneau va s'ouvrir plutôt qu'une page se charger, ce qui évite de
 * quitter la page pour rien.
 *
 * La fermeture à l'échappement et au clic dehors est gérée par le menu qui
 * l'englobe : deux jeux d'écouteurs sur la même zone se marcheraient dessus,
 * et l'un des deux finirait par ne plus fermer.
 */
function Panneau({
  titre,
  ouvert,
  onBascule,
  children,
}: {
  readonly titre: React.ReactNode
  readonly ouvert: boolean
  readonly onBascule: () => void
  readonly children: React.ReactNode
}) {
  const identifiant = useId()
  return (
    <div className="menu-panneau">
      <button
        type="button"
        className="entete-lien menu-panneau-bouton"
        aria-expanded={ouvert}
        aria-haspopup="true"
        aria-controls={identifiant}
        onClick={onBascule}
      >
        {titre}
        <span className="menu-chevron" aria-hidden="true" />
      </button>
      <div
        id={identifiant}
        className={ouvert ? 'menu-panneau-liste menu-panneau-ouvert' : 'menu-panneau-liste'}
      >
        {children}
      </div>
    </div>
  )
}

/** Un lien de menu qui navigue sans recharger, sans cesser d'être un lien. */
function LienMenu({
  route,
  onNaviguer,
  onApres,
  className,
  children,
}: {
  route: Route
  onNaviguer: (route: Route) => void
  onApres: () => void
  className: string
  children: React.ReactNode
}) {
  return (
    <a
      className={className}
      href={cheminDe(route)}
      onClick={(ev) => {
        // Clic modifié ou bouton du milieu : on laisse le navigateur ouvrir
        // dans un nouvel onglet, comme pour n'importe quel lien.
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
        ev.preventDefault()
        onNaviguer(route)
        onApres()
      }}
    >
      {children}
    </a>
  )
}

export function Menu({
  connecte,
  cartes,
  onNaviguer,
  onCollection,
  onDeconnexion,
  onCommencer,
}: EntreesMenu) {
  const [ouvert, setOuvert] = useState(false)
  const [espace, setEspace] = useState(false)
  const identifiant = useId()
  const zone = useRef<HTMLDivElement>(null)

  /* Un seul point de fermeture pour les deux niveaux. Deux jeux d'écouteurs
     sur la même zone se marcheraient dessus, et l'un finirait par ne plus
     fermer — un menu qui reste ouvert piège les gens. */
  const fermer = useCallback(() => {
    setOuvert(false)
    setEspace(false)
  }, [])

  useEffect(() => {
    if (!ouvert) return
    function surTouche(e: KeyboardEvent): void {
      if (e.key === 'Escape') fermer()
    }
    function surClic(e: MouseEvent): void {
      if (zone.current !== null && !zone.current.contains(e.target as Node)) fermer()
    }
    document.addEventListener('keydown', surTouche)
    document.addEventListener('mousedown', surClic)
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.removeEventListener('mousedown', surClic)
    }
  }, [ouvert, fermer])

  return (
    <div className="menu" ref={zone}>
      <button
        type="button"
        className="menu-bascule"
        aria-expanded={ouvert}
        aria-controls={identifiant}
        onClick={() => setOuvert((o) => !o)}
      >
        <span className="menu-barres" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Menu
      </button>

      <nav
        id={identifiant}
        className={ouvert ? 'menu-entrees menu-entrees-ouvert' : 'menu-entrees'}
        aria-label="Navigation principale"
      >
        <LienMenu
          route={{ vue: 'blog' }}
          onNaviguer={onNaviguer}
          onApres={fermer}
          className="entete-lien"
        >
          Le blog
        </LienMenu>

        <LienMenu
          route={{ vue: 'recherche' }}
          onNaviguer={onNaviguer}
          onApres={fermer}
          className="entete-lien"
        >
          Chercher une école
        </LienMenu>

        {/* Déconnecté, la pastille reste dans la barre : les cartes vivent
            dans le navigateur, on peut en avoir sans compte, et il n'y a
            alors pas d'« espace » derrière quoi les ranger. */}
        {cartes > 0 && !connecte ? (
          <button
            type="button"
            className="pastille"
            onClick={() => {
              onCollection()
              fermer()
            }}
          >
            {cartes}
            <span className="pastille-libelle"> cartes</span>
          </button>
        ) : null}

        {connecte ? (
          <Panneau
            titre="Mon espace"
            ouvert={espace}
            onBascule={() => setEspace((e) => !e)}
          >
            <button
              type="button"
              className="menu-entree"
              onClick={() => {
                onCommencer()
                fermer()
              }}
            >
              <span className="menu-entree-titre">Ma recherche</span>
              <span className="menu-entree-note">Les sept questions, et tes résultats</span>
            </button>

            <button
              type="button"
              className="menu-entree"
              onClick={() => {
                onCollection()
                fermer()
              }}
            >
              <span className="menu-entree-titre">
                Mes cartes
                {cartes > 0 ? <span className="menu-entree-compte">{cartes}</span> : null}
              </span>
              <span className="menu-entree-note">
                {cartes > 0
                  ? 'Les villes et les paliers déjà gagnés'
                  : 'Aucune pour l’instant — elles se gagnent en se servant du site'}
              </span>
            </button>

            <LienMenu
              route={{ vue: 'compte' }}
              onNaviguer={onNaviguer}
              onApres={fermer}
              className="menu-entree"
            >
              <span className="menu-entree-titre">Mon compte</span>
              <span className="menu-entree-note">Ce que le site sait de toi, et ton mot de passe</span>
            </LienMenu>

            {/* La déconnexion est détachée : c'est la seule entrée qui défait
                quelque chose, et elle ne doit pas se cliquer par glissement. */}
            <button
              type="button"
              className="menu-entree menu-entree-sortie"
              onClick={() => {
                onDeconnexion()
                fermer()
              }}
            >
              <span className="menu-entree-titre">Se déconnecter</span>
            </button>
          </Panneau>
        ) : (
          <>
            <LienMenu
              route={{ vue: 'connexion' }}
              onNaviguer={onNaviguer}
              onApres={fermer}
              className="entete-lien"
            >
              Se connecter
            </LienMenu>
            <LienMenu
              route={{ vue: 'inscription' }}
              onNaviguer={onNaviguer}
              onApres={fermer}
              className="entete-lien"
            >
              Créer un compte
            </LienMenu>
          </>
        )}

        <button
          type="button"
          className="entete-cta"
          onClick={() => {
            onCommencer()
            fermer()
          }}
        >
          Commencer
        </button>
      </nav>
    </div>
  )
}
