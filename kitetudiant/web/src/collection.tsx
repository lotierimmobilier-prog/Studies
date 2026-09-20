/**
 * La collection, à l'écran.
 *
 * Deux choses vivent ici : l'affichage des cartes, et la fabrication de
 * l'image qu'on partage.
 *
 * L'image est dessinée dans un canvas, dans le navigateur, avec les polices du
 * système. Aucune requête ne part, aucun identifiant n'est glissé dedans,
 * aucun lien de suivi : on ne saura jamais qui l'a vue. C'est le prix assumé
 * du refus de pister des mineurs, et l'adresse du site y suffit pour que la
 * carte circule.
 *
 * Règle de placement, volontaire : aucune carte n'apparaît sur l'écran des
 * résultats. Le moment où un élève décide de son avenir n'est pas le moment où
 * on lui fait gagner un badge.
 */

import { useCallback, useRef, useState } from 'react'

import {
  ETAPES_CARTES,
  cartesDe,
  exporter,
  idEtape,
  importer,
  recompensesPossibles,
  separerCartes,
  type Carte,
  type Obtention,
} from './collection.ts'
import { NOMBRE_COMMUNES_AVEC_LOYER } from './donnees.ts'
import { Marque } from './marque.tsx'
import { nombre } from './nombres.ts'
import { FilAriane } from './filAriane.tsx'
import type { Route } from './routes.ts'

/* ------------------------------------------------------------ une carte */

export function VignetteCarte({ carte }: { carte: Carte }) {
  return (
    <article className={`carte-collec carte-collec-${carte.rarete}`}>
      {carte.mention !== null ? (
        <p className="carte-collec-mention">{carte.mention}</p>
      ) : null}
      <h3 className="carte-collec-titre">{carte.titre}</h3>
      {carte.valeur !== null ? <p className="carte-collec-valeur">{carte.valeur}</p> : null}
      <p className="carte-collec-detail">{carte.detail}</p>
      {carte.provenance !== null ? (
        <p className="carte-collec-source">{carte.provenance}</p>
      ) : null}
    </article>
  )
}

/* -------------------------------------------------- l'image à partager */

const LARGEUR = 1080
const HAUTEUR = 1080

/** Coupe un texte en lignes qui tiennent dans une largeur donnée. */
function enLignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const lignes: string[] = []
  let courante = ''
  for (const mot of texte.split(' ')) {
    const essai = courante === '' ? mot : `${courante} ${mot}`
    if (ctx.measureText(essai).width > largeur && courante !== '') {
      lignes.push(courante)
      courante = mot
    } else {
      courante = essai
    }
  }
  if (courante !== '') lignes.push(courante)
  return lignes
}

const POLICE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/**
 * Dessine la carte dans un canvas. Exportée à part de la fonction qui
 * télécharge : celle-ci est testable, l'autre dépend du navigateur.
 */
export function dessinerCarte(canvas: HTMLCanvasElement, carte: Carte): void {
  canvas.width = LARGEUR
  canvas.height = HAUTEUR
  const ctx = canvas.getContext('2d')
  if (ctx === null) return

  // Fond. Les couleurs sont écrites ici plutôt que lues dans le thème : une
  // image partagée quitte le site, elle ne suit plus le mode clair ou sombre
  // de personne. Ce sont les teintes de la marque, en clair.
  const ciel = ctx.createLinearGradient(0, 0, 0, HAUTEUR)
  ciel.addColorStop(0, '#e2ecef')
  ciel.addColorStop(1, '#f7f9fa')
  ctx.fillStyle = ciel
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR)

  const marge = 90
  const large = LARGEUR - marge * 2

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(marge, marge, large, HAUTEUR - marge * 2, 36)
  ctx.fill()

  // Teal, marine, gris : les trois teintes du logo.
  const teinte =
    carte.rarete === 'rare' ? '#1b8184' : carte.rarete === 'peu-frequente' ? '#19304a' : '#546475'
  ctx.fillStyle = teinte
  ctx.beginPath()
  ctx.roundRect(marge, marge, large, 14, [36, 36, 0, 0])
  ctx.fill()

  let y = marge + 130
  const x = marge + 70

  if (carte.mention !== null) {
    ctx.fillStyle = teinte
    ctx.font = `600 26px ${POLICE}`
    for (const ligne of enLignes(ctx, carte.mention, large - 140)) {
      ctx.fillText(ligne, x, y)
      y += 34
    }
  }

  y += 70
  ctx.fillStyle = '#17222e'
  ctx.font = `700 76px ${POLICE}`
  for (const ligne of enLignes(ctx, carte.titre, large - 140)) {
    ctx.fillText(ligne, x, y)
    y += 86
  }

  if (carte.valeur !== null) {
    y += 40
    ctx.fillStyle = teinte
    ctx.font = `700 110px ${POLICE}`
    ctx.fillText(carte.valeur, x, y)
    y += 40
  }

  y += 70
  ctx.fillStyle = '#546475'
  ctx.font = `400 34px ${POLICE}`
  for (const ligne of enLignes(ctx, carte.detail, large - 140)) {
    ctx.fillText(ligne, x, y)
    y += 48
  }

  if (carte.provenance !== null) {
    y += 30
    ctx.fillStyle = '#7f8c9c'
    ctx.font = `400 24px ${POLICE}`
    for (const ligne of enLignes(ctx, carte.provenance, large - 140)) {
      ctx.fillText(ligne, x, y)
      y += 34
    }
  }

  // Pied : l'adresse du site, sans paramètre de suivi. C'est tout ce qui
  // ramène ici, et c'est volontaire.
  ctx.fillStyle = '#17222e'
  ctx.font = `700 34px ${POLICE}`
  ctx.fillText('KitEtudiant.fr', x, HAUTEUR - marge - 90)
  ctx.fillStyle = '#546475'
  ctx.font = `400 28px ${POLICE}`
  ctx.fillText('Tout pour bien démarrer ta vie étudiante', x, HAUTEUR - marge - 48)
}

/** Nom de fichier lisible, sans accent ni espace. */
function nomFichier(carte: Carte): string {
  const propre = carte.titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `kitetudiant-${propre || 'carte'}.png`
}

function BoutonPartage({ carte }: { carte: Carte }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const partager = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    dessinerCarte(canvas, carte)
    canvas.toBlob((blob) => {
      if (blob === null) {
        setMessage('Ton navigateur n’a pas pu fabriquer l’image.')
        return
      }
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = nomFichier(carte)
      lien.click()
      URL.revokeObjectURL(url)
      setMessage('Image enregistrée.')
    }, 'image/png')
  }, [carte])

  return (
    <>
      <button type="button" className="secondaire carte-collec-partage" onClick={partager}>
        Partager cette carte
      </button>
      {message !== null ? <p className="note">{message}</p> : null}
      {/* Hors écran : il sert à fabriquer l'image, pas à être regardé. */}
      <canvas ref={canvasRef} className="carte-collec-canvas" aria-hidden="true" />
    </>
  )
}

/* -------------------------------------------------------- la page entière */

/** Les six récompenses, dans un ordre fixe : celui où on les rencontre. */
const TOUTES_RECOMPENSES = (
  [
    'premier-budget',
    'trois-villes',
    'bulletin',
    'detail',
    'hors-academie',
    'dix-villes',
    'trois-bulletins',
    'vingt-villes',
  ] as const
).map((id) => ({ id, definition: ETAPES_CARTES[id] }))

export function Collection({
  collection,
  onRetour,
  onNaviguer,
  onImporter,
}: {
  collection: readonly Obtention[]
  onRetour: () => void
  onNaviguer: (route: Route) => void
  onImporter: (cartes: Obtention[]) => void
}) {
  const cartes = cartesDe(collection)
  const { recompenses, villes } = separerCartes(cartes)
  const totalRecompenses = recompensesPossibles()
  const [choisie, setChoisie] = useState<string | null>(null)
  // Seules les cartes de ville se partagent en image : une récompense ne dit
  // rien à qui la reçoit, une carte de ville porte un loyer et sa source.
  const active = villes.find((c) => c.id === choisie) ?? villes[0] ?? null

  const lireFichier = useCallback(
    (fichier: File) => {
      void fichier.text().then((texte) => {
        const lues = importer(texte)
        if (lues !== null) onImporter(lues)
      })
    },
    [onImporter],
  )

  return (
    <main className="app app-large">
      <header className="entete entete-accueil">
        <h1 className="marque">
          <Marque />
        </h1>
        <button type="button" className="entete-cta" onClick={onRetour}>
          Retour
        </button>
      </header>

      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Ta collection', route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      {/* Les récompenses d'abord, et seules dans leur section. Mêlées aux
          villes, elles disparaissaient : le compteur annonçait « 8 sur 1 253 »,
          un dénominateur écrasé par l'album, qui faisait passer six
          récompenses méritées pour un score dérisoire. */}
      <section className="bloc">
        <h2>Tes récompenses</h2>
        <p className="bloc-intro">
          Elles marquent ce que tu as fait avec le site — un budget calculé, des
          villes comparées, un bulletin lu. Elles se gagnent en t’en servant, jamais
          en invitant quelqu’un, et restent dans ton navigateur.
        </p>

        <p className="collec-compte">
          <strong>
            {recompenses.length} sur {totalRecompenses}
          </strong>{' '}
          obtenues
        </p>
        <div
          className="collec-jauge"
          role="progressbar"
          aria-valuenow={recompenses.length}
          aria-valuemin={0}
          aria-valuemax={totalRecompenses}
          aria-label="Récompenses obtenues"
        >
          <span style={{ width: `${(recompenses.length / totalRecompenses) * 100}%` }} />
        </div>

        <ul className="recompenses">
          {TOUTES_RECOMPENSES.map(({ id, definition }) => {
            const obtenue = recompenses.find((c) => c.id === idEtape(id)) ?? null
            return (
              <li
                key={id}
                className={obtenue !== null ? 'recompense recompense-obtenue' : 'recompense'}
              >
                <span className="recompense-etat" aria-hidden="true" />
                <span className="recompense-texte">
                  <strong>{definition.titre}</strong>
                  <span>{definition.detail}</span>
                </span>
                {/* Une récompense non obtenue reste VISIBLE et lisible : elle
                    dit quoi faire pour l'avoir. La masquer laisserait croire
                    qu'il n'y a plus rien à gagner. */}
                <span className="recompense-mention">
                  {obtenue !== null ? 'obtenue' : 'à obtenir'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="bloc">
        <h2>Tes villes</h2>
        <p className="bloc-intro">
          Chaque ville dont tu as regardé le budget laisse une carte : son loyer, et
          sa place parmi les {nombre(NOMBRE_COMMUNES_AVEC_LOYER)} communes couvertes.
          Personne ne les aura toutes — c’est un album, pas un score.
        </p>

        {villes.length === 0 ? (
          <p className="note">
            Aucune ville pour l’instant. Compare un premier budget et la première
            carte arrivera.
          </p>
        ) : (
          <>
            <p className="collec-compte">
              <strong>{villes.length}</strong> ville{villes.length > 1 ? 's' : ''} gardée
              {villes.length > 1 ? 's' : ''}
            </p>
            <div className="collec-grille">
              {villes.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`collec-choix${active?.id === c.id ? ' collec-choix-actif' : ''}`}
                  onClick={() => setChoisie(c.id)}
                  aria-pressed={active?.id === c.id}
                >
                  <VignetteCarte carte={c} />
                </button>
              ))}
            </div>
            {active !== null ? <BoutonPartage carte={active} /> : null}
          </>
        )}
      </section>

      <section className="bloc">
        <h2>Changer d’appareil</h2>
        <p className="bloc-intro">
          Ta collection ne quitte pas ce navigateur. Pour la reprendre ailleurs,
          enregistre-la et rouvre le fichier là-bas.
        </p>
        <div className="cta-groupe">
          <a
            className="cta-secondaire"
            download="kitetudiant-collection.json"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(exporter(collection))}`}
          >
            Enregistrer ma collection
          </a>
          <label className="cta-secondaire">
            Ouvrir une collection
            <input
              type="file"
              accept="application/json"
              className="collec-fichier"
              onChange={(e) => {
                const fichier = e.target.files?.[0]
                if (fichier !== undefined) lireFichier(fichier)
              }}
            />
          </label>
        </div>
      </section>
    </main>
  )
}
