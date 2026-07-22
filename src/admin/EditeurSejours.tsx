import type { CalendrierSource, Sejour } from '../types'
import { Champ, CarteEdition, ZoneTexte } from './champs'

const SEJOUR_VIDE: Sejour = {
  code: '',
  nom: '',
  arrivee: '',
  depart: '',
  voyageurs: undefined,
  messageHote: '',
}

/** Panneau de synchronisation du planning (calendriers iCal). */
function PanneauSync({
  calendriers,
  onChange,
  onSync,
  enCours,
  message,
}: {
  calendriers: CalendrierSource[]
  onChange: (c: CalendrierSource[]) => void
  onSync: () => void
  enCours: boolean
  message: string | null
}) {
  function maj(i: number, patch: Partial<CalendrierSource>) {
    onChange(calendriers.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }
  return (
    <div className="carte-edition carte-sync">
      <strong className="carte-edition-sous-titre">
        🔄 Synchroniser le planning (Airbnb, Booking…)
      </strong>
      <p className="sync-aide">
        Collez le <strong>lien iCal</strong> d'export de votre calendrier
        (Airbnb : <em>Calendrier → Disponibilités → Synchroniser les
        calendriers → Exporter</em>). La synchronisation crée un séjour aux
        bonnes dates pour chaque réservation, avec un code généré
        automatiquement — il vous reste à ajouter le prénom du voyageur.
      </p>

      {calendriers.map((c, i) => (
        <div className="ligne-duo" key={c.id}>
          <Champ
            label="Nom (facultatif)"
            valeur={c.nom ?? ''}
            onChange={(v) => maj(i, { nom: v })}
            placeholder="ex. Airbnb"
          />
          <Champ
            label="Lien iCal (.ics)"
            valeur={c.url}
            onChange={(v) => maj(i, { url: v })}
            placeholder="https://www.airbnb.fr/calendar/ical/…"
          />
          <button
            type="button"
            className="btn-supprimer-ligne btn-supprimer-ligne--bas"
            onClick={() => onChange(calendriers.filter((_, j) => j !== i))}
            aria-label="Supprimer ce calendrier"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="sync-actions">
        <button
          type="button"
          className="btn-ajouter-ligne"
          onClick={() =>
            onChange([
              ...calendriers,
              { id: `cal-${Date.now()}`, url: '', nom: '' },
            ])
          }
        >
          + un calendrier
        </button>
        <button
          type="button"
          className="btn-enregistrer btn-sync"
          onClick={onSync}
          disabled={enCours || calendriers.length === 0}
        >
          {enCours ? 'Synchronisation…' : 'Synchroniser maintenant'}
        </button>
      </div>

      {message && <p className="sync-message">{message}</p>}
    </div>
  )
}

export default function EditeurSejours({
  sejours,
  onChange,
  calendriers,
  onChangeCalendriers,
  onSync,
  syncEnCours,
  syncMessage,
}: {
  sejours: Sejour[]
  onChange: (s: Sejour[]) => void
  calendriers: CalendrierSource[]
  onChangeCalendriers: (c: CalendrierSource[]) => void
  onSync: () => void
  syncEnCours: boolean
  syncMessage: string | null
}) {
  function maj(i: number, patch: Partial<Sejour>) {
    onChange(sejours.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }
  function supprimer(i: number) {
    onChange(sejours.filter((_, j) => j !== i))
  }
  function ajouter() {
    onChange([...sejours, { ...SEJOUR_VIDE }])
  }

  return (
    <div className="editeur">
      <div className="editeur-intro">
        <h2>Séjours</h2>
        <p>
          Créez un séjour par réservation. Le voyageur se connecte avec le{' '}
          <strong>code</strong> que vous choisissez, et il est accueilli avec le{' '}
          <strong>prénom / nom</strong> indiqué.
        </p>
      </div>

      <PanneauSync
        calendriers={calendriers}
        onChange={onChangeCalendriers}
        onSync={onSync}
        enCours={syncEnCours}
        message={syncMessage}
      />

      {sejours.map((s, i) => (
        <CarteEdition
          key={i}
          titre={`${s.nom || s.code || `Séjour ${i + 1}`}${
            s.plateforme ? ` · ${s.plateforme}` : ''
          }`}
          onSupprimer={() => supprimer(i)}
        >
          <div className="grille-champs">
            <Champ
              label="Code d'accès"
              valeur={s.code}
              onChange={(v) => maj(i, { code: v })}
              placeholder="ex. SOLEIL"
              aide="Ce que le voyageur saisit pour se connecter."
            />
            <Champ
              label="Prénom / nom (accueil)"
              valeur={s.nom}
              onChange={(v) => maj(i, { nom: v })}
              placeholder="ex. Marie"
              aide="Affiché « Bonjour … »"
            />
            <Champ
              label="Arrivée"
              type="datetime-local"
              valeur={s.arrivee}
              onChange={(v) => maj(i, { arrivee: v })}
            />
            <Champ
              label="Départ"
              type="datetime-local"
              valeur={s.depart}
              onChange={(v) => maj(i, { depart: v })}
            />
            <Champ
              label="Nombre de voyageurs"
              type="number"
              valeur={s.voyageurs != null ? String(s.voyageurs) : ''}
              onChange={(v) =>
                maj(i, { voyageurs: v ? Number(v) : undefined })
              }
              placeholder="ex. 4"
            />
          </div>
          <ZoneTexte
            label="Message de bienvenue (facultatif)"
            valeur={s.messageHote ?? ''}
            onChange={(v) => maj(i, { messageHote: v })}
            placeholder="Un petit mot personnalisé pour accueillir vos voyageurs…"
          />
        </CarteEdition>
      ))}

      <button type="button" className="btn-ajouter" onClick={ajouter}>
        + Ajouter un séjour
      </button>
    </div>
  )
}
