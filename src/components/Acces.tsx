import { useState } from 'react'
import type { Maison } from '../types'

/** Bouton de copie pour un code / mot de passe. */
function Copiable({ valeur }: { valeur: string }) {
  const [copie, setCopie] = useState(false)
  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur)
      setCopie(true)
      setTimeout(() => setCopie(false), 1500)
    } catch {
      /* copie indisponible : on ignore */
    }
  }
  return (
    <button type="button" className="copiable" onClick={copier}>
      <code>{valeur}</code>
      <span className="copiable-action">{copie ? '✓ copié' : 'copier'}</span>
    </button>
  )
}

export default function SectionAcces({ maison }: { maison: Maison }) {
  return (
    <section className="section">
      <h1 className="section-titre">Accès à la maison</h1>
      <p className="section-intro">
        Toutes les informations pratiques pour entrer et vous installer.
      </p>

      <div className="grille-info">
        <div className="carte carte-info">
          <span className="carte-info-icone">📍</span>
          <span className="carte-etiquette">Adresse</span>
          <strong>{maison.adresse}</strong>
          {maison.lienCarte && (
            <a
              className="lien-bouton"
              href={maison.lienCarte}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir dans Maps ↗
            </a>
          )}
        </div>

        <div className="carte carte-info">
          <span className="carte-info-icone">📶</span>
          <span className="carte-etiquette">Wi-Fi</span>
          <div className="ligne-info">
            <span>Réseau</span>
            <Copiable valeur={maison.wifi.reseau} />
          </div>
          <div className="ligne-info">
            <span>Mot de passe</span>
            <Copiable valeur={maison.wifi.motDePasse} />
          </div>
        </div>

        {maison.codeAcces && (
          <div className="carte carte-info">
            <span className="carte-info-icone">🔐</span>
            <span className="carte-etiquette">Code boîte à clés</span>
            <Copiable valeur={maison.codeAcces} />
          </div>
        )}

        {maison.parking && (
          <div className="carte carte-info">
            <span className="carte-info-icone">🅿️</span>
            <span className="carte-etiquette">Stationnement</span>
            <p>{maison.parking}</p>
          </div>
        )}
      </div>

      <div className="carte">
        <h2>🛬 À votre arrivée</h2>
        <ol className="etapes">
          {maison.instructionsArrivee.map((etape, i) => (
            <li key={i}>{etape}</li>
          ))}
        </ol>
      </div>

      <div className="carte">
        <h2>🛫 Avant votre départ</h2>
        <ol className="etapes">
          {maison.instructionsDepart.map((etape, i) => (
            <li key={i}>{etape}</li>
          ))}
        </ol>
      </div>

      <div className="carte">
        <h2>📋 Règlement de la maison</h2>
        <ul className="checklist checklist--simple">
          {maison.reglement.map((regle, i) => (
            <li key={i}>
              <span aria-hidden="true">•</span>
              {regle}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
