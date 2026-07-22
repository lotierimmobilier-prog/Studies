import { useRef, useState } from 'react'
import type { PhotoGalerie } from '../types'
import { envoyerImage, urlMedia } from '../api'

export default function EditeurGalerie({
  galerie,
  onChange,
}: {
  galerie: PhotoGalerie[]
  onChange: (g: PhotoGalerie[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function ajouter(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? [])
    if (!fichiers.length) return
    setErreur(null)
    setEnvoi(true)
    try {
      const ajouts: PhotoGalerie[] = []
      for (const f of fichiers) {
        const url = await envoyerImage(f)
        ajouts.push({ id: `photo-${Date.now()}-${ajouts.length}`, url, legende: '' })
      }
      onChange([...galerie, ...ajouts])
    } catch (err) {
      setErreur((err as Error).message)
    } finally {
      setEnvoi(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function majLegende(i: number, legende: string) {
    onChange(galerie.map((p, j) => (j === i ? { ...p, legende } : p)))
  }
  function supprimer(i: number) {
    onChange(galerie.filter((_, j) => j !== i))
  }
  function deplacer(i: number, sens: -1 | 1) {
    const j = i + sens
    if (j < 0 || j >= galerie.length) return
    const copie = [...galerie]
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
    onChange(copie)
  }

  return (
    <div className="editeur">
      <div className="editeur-intro">
        <h2>Galerie photos</h2>
        <p>
          Ajoutez des photos de la maison. Elles apparaissent dans un onglet{' '}
          <strong>Photos</strong> pour vos voyageurs (agrandissement au clic).
        </p>
      </div>

      {erreur && <p className="connexion-erreur">{erreur}</p>}

      {galerie.length > 0 && (
        <div className="grille-galerie-admin">
          {galerie.map((photo, i) => (
            <div className="galerie-carte-admin" key={photo.id}>
              <img src={urlMedia(photo.url)} alt="" />
              <input
                type="text"
                className="galerie-legende-input"
                value={photo.legende ?? ''}
                placeholder="Légende (facultatif)"
                onChange={(e) => majLegende(i, e.target.value)}
              />
              <div className="galerie-carte-actions">
                <button
                  type="button"
                  onClick={() => deplacer(i, -1)}
                  disabled={i === 0}
                  aria-label="Déplacer à gauche"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => deplacer(i, 1)}
                  disabled={i === galerie.length - 1}
                  aria-label="Déplacer à droite"
                >
                  ›
                </button>
                <button
                  type="button"
                  className="galerie-supprimer"
                  onClick={() => supprimer(i)}
                  aria-label="Supprimer"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn-ajouter"
        onClick={() => inputRef.current?.click()}
        disabled={envoi}
      >
        {envoi ? 'Envoi en cours…' : '📷 Ajouter des photos'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={ajouter}
      />
    </div>
  )
}
