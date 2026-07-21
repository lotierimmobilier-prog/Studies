import { useState } from 'react'
import type { Session } from '../types'
import SectionSejour from './Sejour'
import SectionAcces from './Acces'
import SectionTutoriels from './Tutoriels'
import SectionTourisme from './Tourisme'
import SectionGalerie from './Galerie'
import SectionContact from './Contact'

type Onglet =
  | 'sejour'
  | 'acces'
  | 'galerie'
  | 'tutoriels'
  | 'tourisme'
  | 'contact'

export default function Portail({
  session,
  onDeconnexion,
}: {
  session: Session
  onDeconnexion: () => void
}) {
  const [onglet, setOnglet] = useState<Onglet>('sejour')
  const { maison, sejour, tutoriels, tourisme, galerie } = session

  // L'onglet Galerie n'apparaît que si des photos ont été ajoutées.
  const onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'sejour', libelle: 'Séjour', icone: '🏖️' },
    { id: 'acces', libelle: 'Accès', icone: '🔑' },
    ...(galerie.length > 0
      ? [{ id: 'galerie' as const, libelle: 'Photos', icone: '📸' }]
      : []),
    { id: 'tutoriels', libelle: 'Tutos', icone: '🎬' },
    { id: 'tourisme', libelle: 'Tourisme', icone: '🧭' },
    { id: 'contact', libelle: 'Contact', icone: '📞' },
  ]

  return (
    <div className="portail">
      <header className="entete">
        <div className="entete-marque">
          <span className="entete-soleil" aria-hidden="true">
            ☀︎
          </span>
          <div>
            <strong>{maison.nom}</strong>
            {maison.sousTitre && <small>{maison.sousTitre}</small>}
          </div>
        </div>
        <button
          type="button"
          className="btn-deconnexion"
          onClick={onDeconnexion}
        >
          Se déconnecter
        </button>
      </header>

      <nav className="nav-onglets" aria-label="Sections">
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`onglet ${onglet === o.id ? 'onglet--actif' : ''}`}
            onClick={() => setOnglet(o.id)}
            aria-current={onglet === o.id ? 'page' : undefined}
          >
            <span className="onglet-icone" aria-hidden="true">
              {o.icone}
            </span>
            <span className="onglet-libelle">{o.libelle}</span>
          </button>
        ))}
      </nav>

      <main className="contenu">
        {onglet === 'sejour' && (
          <SectionSejour sejour={sejour} maison={maison} />
        )}
        {onglet === 'acces' && <SectionAcces maison={maison} />}
        {onglet === 'galerie' && <SectionGalerie galerie={galerie} />}
        {onglet === 'tutoriels' && <SectionTutoriels tutoriels={tutoriels} />}
        {onglet === 'tourisme' && <SectionTourisme lieux={tourisme} />}
        {onglet === 'contact' && <SectionContact maison={maison} />}
      </main>

      <footer className="pied">
        <span>
          {maison.nom} · Bon séjour&nbsp;! ☀︎
        </span>
      </footer>
    </div>
  )
}
