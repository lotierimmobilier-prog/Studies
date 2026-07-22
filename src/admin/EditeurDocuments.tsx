import { useRef, useState } from 'react'
import type { Document } from '../types'
import { envoyerFichier, urlMedia } from '../api'

/**
 * Gestion des documents téléchargeables (PDF « Guide d'accueil »…).
 * Upload depuis l'appareil, titre modifiable, remplacement et suppression.
 */
export default function EditeurDocuments({
  documents,
  onChange,
}: {
  documents: Document[]
  onChange: (d: Document[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // Index du document à remplacer (null = ajout d'un nouveau).
  const [cible, setCible] = useState<number | null>(null)

  function ouvrirSelecteur(index: number | null) {
    setCible(index)
    inputRef.current?.click()
  }

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(null)
    setEnvoi(true)
    try {
      const url = await envoyerFichier(fichier)
      if (cible === null) {
        const titre = fichier.name.replace(/\.[^.]+$/, '') || 'Document'
        onChange([...documents, { id: `doc-${Date.now()}`, titre, url }])
      } else {
        onChange(documents.map((d, j) => (j === cible ? { ...d, url } : d)))
      }
    } catch (err) {
      setErreur((err as Error).message)
    } finally {
      setEnvoi(false)
      setCible(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="carte-edition">
      <strong className="carte-edition-sous-titre">
        Documents (PDF) — Guide d'accueil…
      </strong>

      {documents.map((doc, i) => (
        <div className="ligne-duo" key={doc.id}>
          <label className="champ">
            <span className="champ-label">Titre</span>
            <input
              type="text"
              value={doc.titre}
              placeholder="ex. Guide d'accueil"
              onChange={(e) =>
                onChange(
                  documents.map((d, j) =>
                    j === i ? { ...d, titre: e.target.value } : d,
                  ),
                )
              }
            />
          </label>
          <div className="champ">
            <span className="champ-label">Fichier</span>
            {doc.url ? (
              <a
                className="lien-bouton"
                href={urlMedia(doc.url)}
                target="_blank"
                rel="noreferrer"
              >
                📄 Voir le PDF ↗
              </a>
            ) : (
              <button
                type="button"
                className="btn-ajouter-ligne"
                onClick={() => ouvrirSelecteur(i)}
                disabled={envoi}
              >
                Choisir un fichier
              </button>
            )}
          </div>
          <div className="doc-actions-admin">
            {doc.url && (
              <button
                type="button"
                className="btn-ajouter-ligne"
                onClick={() => ouvrirSelecteur(i)}
                disabled={envoi}
              >
                Remplacer
              </button>
            )}
            <button
              type="button"
              className="btn-supprimer-ligne btn-supprimer-ligne--bas"
              onClick={() => onChange(documents.filter((_, j) => j !== i))}
              aria-label="Supprimer ce document"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {erreur && <small className="champ-erreur">{erreur}</small>}

      <button
        type="button"
        className="btn-ajouter-ligne"
        onClick={() => ouvrirSelecteur(null)}
        disabled={envoi}
      >
        {envoi ? 'Envoi en cours…' : "+ un document (PDF)"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={choisir}
      />
    </div>
  )
}
