import { useMemo, useState } from 'react'
import { TUTORIELS } from '../data/tutoriels'
import type { Tutoriel } from '../types'
import VideoCapsule from './VideoCapsule'

function CarteTutoriel({ tuto }: { tuto: Tutoriel }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <article className="carte carte-tuto">
      <VideoCapsule video={tuto.video} />
      <div className="carte-tuto-corps">
        <span className="carte-etiquette">
          {tuto.icone} {tuto.categorie}
        </span>
        <h3>{tuto.titre}</h3>
        <p>{tuto.description}</p>
        {tuto.etapes && tuto.etapes.length > 0 && (
          <>
            <button
              type="button"
              className="lien-detail"
              onClick={() => setOuvert((v) => !v)}
              aria-expanded={ouvert}
            >
              {ouvert ? 'Masquer les étapes' : 'Voir les étapes'}
            </button>
            {ouvert && (
              <ol className="etapes">
                {tuto.etapes.map((etape, i) => (
                  <li key={i}>{etape}</li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export default function SectionTutoriels() {
  const categories = useMemo(
    () => ['Tout', ...Array.from(new Set(TUTORIELS.map((t) => t.categorie)))],
    [],
  )
  const [filtre, setFiltre] = useState('Tout')

  const liste =
    filtre === 'Tout'
      ? TUTORIELS
      : TUTORIELS.filter((t) => t.categorie === filtre)

  return (
    <section className="section">
      <h1 className="section-titre">Tutoriels de la maison</h1>
      <p className="section-intro">
        De courtes vidéos pour prendre en main chaque équipement en toute
        simplicité.
      </p>

      <div className="filtres">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`puce ${filtre === c ? 'puce--active' : ''}`}
            onClick={() => setFiltre(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grille-tutos">
        {liste.map((tuto) => (
          <CarteTutoriel key={tuto.id} tuto={tuto} />
        ))}
      </div>
    </section>
  )
}
