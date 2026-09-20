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
  cartesDe,
  cartesPossibles,
  exporter,
  importer,
  LIBELLE_RARETE,
  type Carte,
  type Obtention,
} from './collection.ts'
import { NOMBRE_COMMUNES_AVEC_LOYER } from './donnees.ts'
import { Marque } from './marque.tsx'

/* ------------------------------------------------------------ une carte */

export function VignetteCarte({ carte }: { carte: Carte }) {
  return (
    <article className={`carte-collec carte-collec-${carte.rarete}`}>
      <p className="carte-collec-rarete">{LIBELLE_RARETE[carte.rarete]}</p>
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
  ciel.addColorStop(0, '#dcecf3')
  ciel.addColorStop(1, '#eef3f8')
  ctx.fillStyle = ciel
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR)

  const marge = 90
  const large = LARGEUR - marge * 2

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(marge, marge, large, HAUTEUR - marge * 2, 36)
  ctx.fill()

  // Turquoise, marine, gris : les trois teintes du logo.
  const teinte =
    carte.rarete === 'rare' ? '#098090' : carte.rarete === 'peu-frequente' ? '#05335c' : '#485773'
  ctx.fillStyle = teinte
  ctx.beginPath()
  ctx.roundRect(marge, marge, large, 14, [36, 36, 0, 0])
  ctx.fill()

  let y = marge + 130
  const x = marge + 70

  ctx.fillStyle = teinte
  ctx.font = `600 30px ${POLICE}`
  ctx.fillText(LIBELLE_RARETE[carte.rarete].toUpperCase(), x, y)

  y += 90
  ctx.fillStyle = '#0e1e2b'
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
  ctx.fillStyle = '#485773'
  ctx.font = `400 34px ${POLICE}`
  for (const ligne of enLignes(ctx, carte.detail, large - 140)) {
    ctx.fillText(ligne, x, y)
    y += 48
  }

  if (carte.provenance !== null) {
    y += 30
    ctx.fillStyle = '#7d8ba4'
    ctx.font = `400 24px ${POLICE}`
    for (const ligne of enLignes(ctx, carte.provenance, large - 140)) {
      ctx.fillText(ligne, x, y)
      y += 34
    }
  }

  // Pied : l'adresse du site, sans paramètre de suivi. C'est tout ce qui
  // ramène ici, et c'est volontaire.
  ctx.fillStyle = '#0e1e2b'
  ctx.font = `700 34px ${POLICE}`
  ctx.fillText('KitEtudiant.fr', x, HAUTEUR - marge - 90)
  ctx.fillStyle = '#485773'
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

export function Collection({
  collection,
  onRetour,
  onImporter,
}: {
  collection: readonly Obtention[]
  onRetour: () => void
  onImporter: (cartes: Obtention[]) => void
}) {
  const cartes = cartesDe(collection)
  const total = cartesPossibles(NOMBRE_COMMUNES_AVEC_LOYER)
  const [choisie, setChoisie] = useState<string | null>(null)
  const active = cartes.find((c) => c.id === choisie) ?? cartes[0] ?? null

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
    <main className="app">
      <header className="entete entete-accueil">
        <h1 className="marque">
          <Marque />
        </h1>
        <button type="button" className="entete-cta" onClick={onRetour}>
          Retour
        </button>
      </header>

      <section className="bloc">
        <h2>Ta collection</h2>
        <p className="bloc-intro">
          {cartes.length} carte{cartes.length > 1 ? 's' : ''} sur {total.toLocaleString('fr-FR')}.
          Chaque carte se gagne en te servant du site — jamais en invitant
          quelqu’un. Elles restent dans ton navigateur : rien n’est envoyé.
        </p>

        {cartes.length === 0 ? (
          <p className="note">
            Aucune carte pour l’instant. Compare une première ville et la première
            arrivera.
          </p>
        ) : (
          <>
            <div className="collec-grille">
              {cartes.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`collec-choix${active?.id === c.id ? ' collec-choix-actif' : ''}`}
                  onClick={() => setChoisie(c.id)}
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
