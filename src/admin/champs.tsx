import type { ReactNode } from 'react'

/** Un champ texte simple avec libellé. */
export function Champ({
  label,
  valeur,
  onChange,
  type = 'text',
  placeholder,
  aide,
}: {
  label: string
  valeur: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  aide?: string
}) {
  return (
    <label className="champ">
      <span className="champ-label">{label}</span>
      <input
        type={type}
        value={valeur}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {aide && <small className="champ-aide">{aide}</small>}
    </label>
  )
}

/** Une zone de texte multiligne avec libellé. */
export function ZoneTexte({
  label,
  valeur,
  onChange,
  placeholder,
  lignes = 3,
}: {
  label: string
  valeur: string
  onChange: (v: string) => void
  placeholder?: string
  lignes?: number
}) {
  return (
    <label className="champ">
      <span className="champ-label">{label}</span>
      <textarea
        rows={lignes}
        value={valeur}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

/**
 * Éditeur d'une liste de chaînes (instructions, règlement, étapes…) :
 * chaque ligne est éditable, avec ajout et suppression.
 */
export function ListeChaines({
  label,
  valeurs,
  onChange,
  placeholder,
  ajoutLabel = 'Ajouter une ligne',
}: {
  label: string
  valeurs: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  ajoutLabel?: string
}) {
  function maj(i: number, v: string) {
    const copie = [...valeurs]
    copie[i] = v
    onChange(copie)
  }
  function supprimer(i: number) {
    onChange(valeurs.filter((_, j) => j !== i))
  }
  return (
    <div className="champ">
      <span className="champ-label">{label}</span>
      <div className="liste-chaines">
        {valeurs.map((v, i) => (
          <div className="liste-chaines-ligne" key={i}>
            <textarea
              rows={2}
              value={v}
              placeholder={placeholder}
              onChange={(e) => maj(i, e.target.value)}
            />
            <button
              type="button"
              className="btn-supprimer-ligne"
              onClick={() => supprimer(i)}
              aria-label="Supprimer cette ligne"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn-ajouter-ligne"
        onClick={() => onChange([...valeurs, ''])}
      >
        + {ajoutLabel}
      </button>
    </div>
  )
}

/** Bloc-carte pour un élément éditable (séjour, tutoriel, lieu…). */
export function CarteEdition({
  titre,
  onSupprimer,
  children,
}: {
  titre: string
  onSupprimer: () => void
  children: ReactNode
}) {
  return (
    <div className="carte-edition">
      <div className="carte-edition-entete">
        <strong>{titre}</strong>
        <button
          type="button"
          className="btn-supprimer"
          onClick={onSupprimer}
        >
          Supprimer
        </button>
      </div>
      {children}
    </div>
  )
}
