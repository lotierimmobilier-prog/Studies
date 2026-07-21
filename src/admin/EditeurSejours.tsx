import type { Sejour } from '../types'
import { Champ, CarteEdition, ZoneTexte } from './champs'

const SEJOUR_VIDE: Sejour = {
  code: '',
  nom: '',
  arrivee: '',
  depart: '',
  voyageurs: undefined,
  messageHote: '',
}

export default function EditeurSejours({
  sejours,
  onChange,
}: {
  sejours: Sejour[]
  onChange: (s: Sejour[]) => void
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

      {sejours.map((s, i) => (
        <CarteEdition
          key={i}
          titre={s.nom || s.code || `Séjour ${i + 1}`}
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
