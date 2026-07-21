import { useMemo, useState } from 'react'
import type { LieuTourisme } from '../types'

function CarteLieu({ lieu }: { lieu: LieuTourisme }) {
  return (
    <article className="carte carte-lieu">
      <div className="carte-lieu-entete">
        <span className="carte-lieu-icone" aria-hidden="true">
          {lieu.icone}
        </span>
        <div>
          <h3>{lieu.nom}</h3>
          {lieu.distance && (
            <span className="carte-lieu-distance">📍 {lieu.distance}</span>
          )}
        </div>
      </div>
      <p>{lieu.description}</p>

      {lieu.conseilHote && (
        <p className="conseil-hote">
          <span aria-hidden="true">💬</span> {lieu.conseilHote}
        </p>
      )}

      <div className="carte-lieu-actions">
        {lieu.telephone && (
          <a className="lien-bouton" href={`tel:${lieu.telephone.replace(/\s/g, '')}`}>
            📞 Appeler
          </a>
        )}
        {lieu.lienCarte && (
          <a
            className="lien-bouton"
            href={lieu.lienCarte}
            target="_blank"
            rel="noreferrer"
          >
            🗺️ Itinéraire
          </a>
        )}
        {lieu.siteWeb && (
          <a
            className="lien-bouton"
            href={lieu.siteWeb}
            target="_blank"
            rel="noreferrer"
          >
            🌐 Site web
          </a>
        )}
      </div>
    </article>
  )
}

export default function SectionTourisme({ lieux }: { lieux: LieuTourisme[] }) {
  const categories = useMemo(
    () => ['Tout', ...Array.from(new Set(lieux.map((l) => l.categorie)))],
    [lieux],
  )
  const [filtre, setFiltre] = useState('Tout')

  const liste =
    filtre === 'Tout' ? lieux : lieux.filter((l) => l.categorie === filtre)

  return (
    <section className="section">
      <h1 className="section-titre">Tourisme & bonnes adresses</h1>
      <p className="section-intro">
        Nos coups de cœur pour profiter pleinement de la région.
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

      {liste.length === 0 ? (
        <p className="vide">Aucune adresse pour le moment.</p>
      ) : (
        <div className="grille-lieux">
          {liste.map((lieu) => (
            <CarteLieu key={lieu.id} lieu={lieu} />
          ))}
        </div>
      )}
    </section>
  )
}
