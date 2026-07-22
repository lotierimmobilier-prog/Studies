import type { Document, Maison, Sejour, Textes } from '../types'
import { urlMedia } from '../api'
import { etatSejour, formaterDate, formaterHeure } from '../dates'

/** Bandeau de compte à rebours selon la phase du séjour. */
function Compteur({ arrivee, depart }: { arrivee: string; depart: string }) {
  const etat = etatSejour(arrivee, depart)

  if (etat.phase === 'avant') {
    return (
      <div className="compteur">
        <span className="compteur-nombre">{etat.jours}</span>
        <span className="compteur-texte">
          {etat.jours > 1 ? 'jours' : 'jour'} avant votre arrivée
        </span>
      </div>
    )
  }
  if (etat.phase === 'pendant') {
    return (
      <div className="compteur compteur--actif">
        <span className="compteur-badge">Séjour en cours</span>
        <span className="compteur-texte">
          {etat.joursRestants === 0
            ? "Dernier jour, bon retour à vous ☀︎"
            : `Encore ${etat.joursRestants} ${
                etat.joursRestants > 1 ? 'jours' : 'jour'
              } à profiter`}
        </span>
      </div>
    )
  }
  return (
    <div className="compteur">
      <span className="compteur-texte">
        Merci pour votre visite, à bientôt&nbsp;! 👋
      </span>
    </div>
  )
}

export default function SectionSejour({
  sejour,
  maison,
  documents,
  textes,
}: {
  sejour: Sejour
  maison: Maison
  documents: Document[]
  textes: Textes
}) {
  const photo = maison.photo ? urlMedia(maison.photo) : ''
  return (
    <section className="section">
      {photo && (
        <div className="hero-photo">
          <img src={photo} alt={`Façade de ${maison.nom}`} />
        </div>
      )}
      <div className={`hero-sejour ${photo ? 'hero-sejour--sous-photo' : ''}`}>
        <p className="hero-salut">Bonjour {sejour.nom},</p>
        <Compteur arrivee={sejour.arrivee} depart={sejour.depart} />
      </div>

      {sejour.messageHote && (
        <div className="carte carte--mot-hote">
          <span className="carte-etiquette">Un mot de vos hôtes</span>
          <p>{sejour.messageHote}</p>
        </div>
      )}

      <div className="grille-dates">
        <div className="carte carte-date">
          <span className="carte-date-icone">🛬</span>
          <span className="carte-etiquette">Arrivée</span>
          <strong>{formaterDate(sejour.arrivee)}</strong>
          <span className="carte-date-heure">
            à partir de {formaterHeure(sejour.arrivee)}
          </span>
        </div>
        <div className="carte carte-date">
          <span className="carte-date-icone">🛫</span>
          <span className="carte-etiquette">Départ</span>
          <strong>{formaterDate(sejour.depart)}</strong>
          <span className="carte-date-heure">
            avant {formaterHeure(sejour.depart)}
          </span>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="carte">
          <h2>📄 Documents</h2>
          <div className="liste-documents">
            {documents
              .filter((d) => d.url)
              .map((doc) => (
                <a
                  key={doc.id}
                  className="doc-lien"
                  href={urlMedia(doc.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="doc-icone" aria-hidden="true">
                    📄
                  </span>
                  <span className="doc-titre">{doc.titre}</span>
                  <span className="doc-action">Ouvrir ↗</span>
                </a>
              ))}
          </div>
        </div>
      )}

      <div className="carte">
        <h2>{textes.checklistTitre}</h2>
        <ul className="checklist">
          {textes.checklist.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
