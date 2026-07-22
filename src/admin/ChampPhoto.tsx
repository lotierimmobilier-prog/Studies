import { useRef, useState } from 'react'
import { envoyerImage, urlMedia } from '../api'

/**
 * Champ d'upload d'une photo : aperçu, bouton d'envoi (depuis l'appareil) et
 * suppression. Renvoie le chemin de l'image via `onChange`.
 */
export default function ChampPhoto({
  label,
  valeur,
  onChange,
  aide,
}: {
  label: string
  valeur: string
  onChange: (chemin: string) => void
  aide?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(null)
    setEnvoi(true)
    try {
      const chemin = await envoyerImage(fichier)
      onChange(chemin)
    } catch (err) {
      setErreur((err as Error).message)
    } finally {
      setEnvoi(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="champ champ-photo">
      <span className="champ-label">{label}</span>

      {valeur ? (
        <div className="photo-apercu">
          <img src={urlMedia(valeur)} alt="Aperçu de la photo" />
          <div className="photo-actions">
            <button
              type="button"
              className="btn-ajouter-ligne"
              onClick={() => inputRef.current?.click()}
              disabled={envoi}
            >
              Remplacer
            </button>
            <button
              type="button"
              className="btn-supprimer"
              onClick={() => onChange('')}
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="photo-depot"
          onClick={() => inputRef.current?.click()}
          disabled={envoi}
        >
          {envoi ? 'Envoi en cours…' : '📷 Choisir une photo'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={choisir}
      />

      {erreur && <small className="champ-erreur">{erreur}</small>}
      {aide && <small className="champ-aide">{aide}</small>}
    </div>
  )
}
