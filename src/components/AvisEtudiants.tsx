import { useState } from 'react'
import {
  chargerTemoignages,
  soumettreTemoignage,
  type SyntheseTemoignages,
  type TemoignageEtudiant,
} from '../data/temoignages'

/** Affichage d'une note en étoiles pleines/vides. */
function Etoiles({ note }: { note: number }) {
  return (
    <span className="etoiles" aria-label={`${note} sur 5`}>
      {'★★★★★'.slice(0, note)}
      <span className="etoiles-vides">{'★★★★★'.slice(note)}</span>
    </span>
  )
}

/** Sélecteur d'étoiles (1 à 5) pour le formulaire. */
function SelecteurEtoiles({
  note,
  onChange,
}: {
  note: number
  onChange: (n: number) => void
}) {
  return (
    <div className="etoiles-choix" role="radiogroup" aria-label="Note sur 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`etoile-btn${n <= note ? ' active' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          aria-pressed={n === note}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const ANNEE_COURANTE = new Date().getFullYear()
const ANNEES = Array.from({ length: 16 }, (_, i) => ANNEE_COURANTE - i)

function LigneTemoignage({ t }: { t: TemoignageEtudiant }) {
  return (
    <li className="temoignage">
      <div className="temoignage-tete">
        <Etoiles note={t.note} />
        {t.annee && <span className="temoignage-annee">Étudiant·e en {t.annee}</span>}
      </div>
      <p className="temoignage-texte">{t.commentaire}</p>
    </li>
  )
}

/**
 * Panneau « avis étudiants » d'un établissement : dépliable, chargé à la
 * demande. Affiche la moyenne + les avis approuvés et permet d'en déposer un
 * (modéré côté serveur avant publication).
 */
export default function AvisEtudiants({ etablissement }: { etablissement: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [synthese, setSynthese] = useState<SyntheseTemoignages | null>(null)
  const [chargement, setChargement] = useState(false)

  const [note, setNote] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const [annee, setAnnee] = useState<number | ''>('')
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const charger = async () => {
    setChargement(true)
    setSynthese(await chargerTemoignages(etablissement))
    setChargement(false)
  }

  const basculer = () => {
    const prochain = !ouvert
    setOuvert(prochain)
    if (prochain && synthese === null && !chargement) void charger()
  }

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (note < 1) {
      setMessage({ ok: false, texte: 'Choisis une note (1 à 5 étoiles).' })
      return
    }
    setEnvoi(true)
    setMessage(null)
    const r = await soumettreTemoignage({
      etablissement,
      note,
      commentaire,
      annee: annee === '' ? undefined : annee,
    })
    setEnvoi(false)
    if (r.ok) {
      const publie = r.temoignage.statut === 'approuve'
      setMessage({
        ok: true,
        texte: publie
          ? 'Merci ! Ton avis est publié.'
          : 'Merci ! Ton avis sera visible après modération.',
      })
      setNote(0)
      setCommentaire('')
      setAnnee('')
      if (publie) await charger()
    } else {
      setMessage({ ok: false, texte: `Avis refusé : ${r.raison}` })
    }
  }

  const nb = synthese?.nombre ?? 0

  return (
    <div className="avis-etudiants">
      <button type="button" className="avis-toggle no-print" onClick={basculer} aria-expanded={ouvert}>
        💬 Avis étudiants
        {synthese && nb > 0 && (
          <>
            {' '}
            · <Etoiles note={Math.round(synthese.moyenne ?? 0)} /> {synthese.moyenne}/5 ({nb})
          </>
        )}
        <span className="avis-chevron">{ouvert ? '▲' : '▼'}</span>
      </button>

      {ouvert && (
        <div className="avis-panneau">
          {chargement ? (
            <p className="subtitle">Chargement des avis…</p>
          ) : nb === 0 ? (
            <p className="subtitle">
              Aucun avis pour l'instant. Sois le premier à partager ton expérience.
            </p>
          ) : (
            <ul className="temoignages">
              {synthese!.temoignages.map((t) => (
                <LigneTemoignage key={t.id} t={t} />
              ))}
            </ul>
          )}

          <form className="avis-form no-print" onSubmit={envoyer}>
            <div className="avis-form-tete">
              <SelecteurEtoiles note={note} onChange={setNote} />
              <select
                value={annee}
                onChange={(e) => setAnnee(e.target.value === '' ? '' : Number(e.target.value))}
                aria-label="Année d'études"
              >
                <option value="">Année (option)</option>
                {ANNEES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Ton avis sur cette école (respectueux et argumenté)…"
              maxLength={1000}
              rows={3}
            />
            <div className="avis-form-pied">
              <span className="avis-note-moderation">
                Avis modéré avant publication.
              </span>
              <button type="submit" className="btn btn-primary" disabled={envoi}>
                {envoi ? 'Envoi…' : 'Publier mon avis'}
              </button>
            </div>
            {message && (
              <p className={`avis-message ${message.ok ? 'ok' : 'ko'}`}>{message.texte}</p>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
