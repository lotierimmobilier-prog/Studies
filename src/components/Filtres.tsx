import type { Domaine } from '../types'
import { LABELS_DOMAINE } from '../data/labels'
import type { CriteresFiltre } from '../engine/filtres'

interface FiltresProps {
  criteres: CriteresFiltre
  onChange: (c: CriteresFiltre) => void
  domaines: Domaine[]
  villes: string[]
  /** Afficher le filtre par note (seulement si des avis Google existent). */
  avecNote: boolean
  /** Nombre de résultats après filtrage (pour le retour visuel). */
  nbResultats: number
  /** Nombre total avant filtrage. */
  nbTotal: number
}

/** Barre de recherche et filtres au-dessus des résultats. */
export default function Filtres({
  criteres,
  onChange,
  domaines,
  villes,
  avecNote,
  nbResultats,
  nbTotal,
}: FiltresProps) {
  const set = (patch: Partial<CriteresFiltre>) => onChange({ ...criteres, ...patch })
  const actif =
    Boolean(criteres.texte?.trim()) ||
    Boolean(criteres.domaine) ||
    Boolean(criteres.ville) ||
    Boolean(criteres.selectivite) ||
    criteres.coutMax != null ||
    criteres.noteMin != null

  return (
    <div className="filtres">
      <div className="filtres-row">
        <input
          type="search"
          className="filtre-recherche"
          placeholder="🔎 Rechercher une formation, une école, une ville…"
          value={criteres.texte ?? ''}
          onChange={(e) => set({ texte: e.target.value })}
          aria-label="Rechercher"
        />
      </div>

      <div className="filtres-row">
        <select
          value={criteres.domaine ?? ''}
          onChange={(e) => set({ domaine: e.target.value as Domaine | '' })}
          aria-label="Domaine"
        >
          <option value="">Tous les domaines</option>
          {domaines.map((d) => (
            <option key={d} value={d}>
              {LABELS_DOMAINE[d]}
            </option>
          ))}
        </select>

        <select
          value={criteres.ville ?? ''}
          onChange={(e) => set({ ville: e.target.value })}
          aria-label="Ville"
        >
          <option value="">Toutes les villes</option>
          {villes.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={criteres.selectivite ?? ''}
          onChange={(e) =>
            set({ selectivite: e.target.value as CriteresFiltre['selectivite'] })
          }
          aria-label="Sélectivité"
        >
          <option value="">Sélective ou non</option>
          <option value="non-selective">Non sélective</option>
          <option value="selective">Sélective</option>
        </select>

        <select
          value={criteres.coutMax ?? ''}
          onChange={(e) =>
            set({ coutMax: e.target.value === '' ? null : Number(e.target.value) })
          }
          aria-label="Coût maximum"
        >
          <option value="">Tout budget</option>
          <option value="0">Gratuit</option>
          <option value="500">≤ 500 €/an</option>
          <option value="3000">≤ 3 000 €/an</option>
          <option value="8000">≤ 8 000 €/an</option>
          <option value="15000">≤ 15 000 €/an</option>
        </select>

        {avecNote && (
          <select
            value={criteres.noteMin ?? ''}
            onChange={(e) =>
              set({ noteMin: e.target.value === '' ? null : Number(e.target.value) })
            }
            aria-label="Note Google minimale"
          >
            <option value="">Toute note</option>
            <option value="3">⭐ ≥ 3/5</option>
            <option value="3.5">⭐ ≥ 3,5/5</option>
            <option value="4">⭐ ≥ 4/5</option>
          </select>
        )}

        {actif && (
          <button
            type="button"
            className="btn btn-ghost filtre-reset"
            onClick={() => onChange({})}
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div className="filtres-compte">
        {actif ? (
          <>
            <strong>{nbResultats}</strong> formation{nbResultats > 1 ? 's' : ''} sur{' '}
            {nbTotal}
          </>
        ) : (
          <>{nbTotal} formations analysées</>
        )}
      </div>
    </div>
  )
}
