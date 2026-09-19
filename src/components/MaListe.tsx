import { exporterTexte, type VoeuSauve } from '../data/liste'

interface MaListeProps {
  voeux: VoeuSauve[]
  onRetirer: (id: string) => void
  onVider: () => void
}

/** Déclenche le téléchargement d'un fichier texte (récapitulatif de la liste). */
function telecharger(voeux: VoeuSauve[]): void {
  const contenu = exporterTexte(voeux)
  const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ma-liste-voeux-parcoursup.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function copier(voeux: VoeuSauve[]): Promise<void> {
  try {
    await navigator.clipboard.writeText(exporterTexte(voeux))
  } catch {
    // Presse-papiers indisponible : on ignore silencieusement.
  }
}

/**
 * Panneau « Ma liste de vœux » : short-list sauvegardée localement, avec
 * export (téléchargement, copie, impression/PDF).
 */
export default function MaListe({ voeux, onRetirer, onVider }: MaListeProps) {
  return (
    <section className="maliste">
      <div className="maliste-head">
        <h3 style={{ margin: 0 }}>📌 Ma liste de vœux ({voeux.length})</h3>
        {voeux.length > 0 && (
          <div className="maliste-actions no-print">
            <button type="button" className="btn btn-ghost" onClick={() => telecharger(voeux)}>
              ⬇︎ Télécharger
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => copier(voeux)}>
              ⧉ Copier
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              🖨 Imprimer / PDF
            </button>
            <button type="button" className="btn btn-ghost" onClick={onVider}>
              Vider
            </button>
          </div>
        )}
      </div>

      {voeux.length === 0 ? (
        <p className="subtitle" style={{ margin: '0.4rem 0 0' }}>
          Ajoute des formations avec le bouton <strong>＋ Ma liste</strong> pour
          constituer et sauvegarder ta short-list de vœux. Elle est conservée sur
          cet appareil.
        </p>
      ) : (
        <ol className="maliste-items">
          {voeux.map((v) => (
            <li key={v.id}>
              <div>
                <div className="maliste-nom">{v.nom}</div>
                <div className="maliste-meta">
                  {v.etablissement} · {v.ville} · ~{v.probabilite}% de chances
                </div>
              </div>
              <button
                type="button"
                className="maliste-retirer no-print"
                onClick={() => onRetirer(v.id)}
                aria-label={`Retirer ${v.nom}`}
                title="Retirer"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
