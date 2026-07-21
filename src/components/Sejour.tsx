import type { Sejour } from '../types'
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

const CHECKLIST_ARRIVEE = [
  { icone: '🔑', texte: 'Récupérer les clés dans la boîte à clés' },
  { icone: '📶', texte: 'Se connecter au Wi-Fi' },
  { icone: '❄️', texte: 'Découvrir la climatisation et les équipements' },
  { icone: '🏖️', texte: 'Repérer les bonnes adresses autour' },
]

export default function SectionSejour({ sejour }: { sejour: Sejour }) {
  return (
    <section className="section">
      <div className="hero-sejour">
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

      <div className="carte">
        <h2>Pour bien commencer</h2>
        <ul className="checklist">
          {CHECKLIST_ARRIVEE.map((item) => (
            <li key={item.texte}>
              <span aria-hidden="true">{item.icone}</span>
              {item.texte}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
