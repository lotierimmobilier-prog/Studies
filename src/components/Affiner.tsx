import { useEffect, useState } from 'react'
import type { ProfilEtudiant, ResultatSimulation } from '../types'
import { chargerQuestions, type QuestionCiblage } from '../data/questions'
import {
  chargerConseil,
  type Conseil,
  type ReponseCiblage,
} from '../data/conseil'
import type { PrixFormation } from '../data/prix'
import type { AnalyseBulletin } from '../data/bulletin'

interface AffinerProps {
  profil: ProfilEtudiant
  resultats: ResultatSimulation[]
  prix: Map<string, PrixFormation>
  bulletin: AnalyseBulletin | null
  /** Reçoit le conseil recalculé, plus ciblé, à afficher à la place du conseil initial. */
  onConseil: (c: Conseil) => void
}

/**
 * Panneau « Affiner mon projet » : pose quelques questions de ciblage
 * (générées par l'IA côté serveur, sinon règles) et recalcule un conseil plus
 * précis à partir des réponses — pour sortir d'un conseil généraliste.
 */
export default function Affiner({
  profil,
  resultats,
  prix,
  bulletin,
  onConseil,
}: AffinerProps) {
  const [questions, setQuestions] = useState<QuestionCiblage[] | null>(null)
  const [reponses, setReponses] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState(false)
  const [fait, setFait] = useState(false)

  useEffect(() => {
    let vivant = true
    chargerQuestions(profil, resultats).then((qs) => {
      if (vivant) setQuestions(qs)
    })
    return () => {
      vivant = false
    }
    // On ne recharge pas les questions à chaque frappe : dépendances volontairement stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!questions || questions.length === 0) return null

  const nbRepondu = Object.keys(reponses).length

  const valider = async () => {
    setEnvoi(true)
    const payload: ReponseCiblage[] = questions
      .filter((q) => reponses[q.id])
      .map((q) => ({ question: q.question, reponse: reponses[q.id] }))
    const conseil = await chargerConseil(profil, resultats, prix, bulletin, payload)
    onConseil(conseil)
    setEnvoi(false)
    setFait(true)
  }

  return (
    <section className="affiner">
      <div className="affiner-tete">
        <span className="affiner-tag">🎯 Affine ton projet</span>
        <p className="subtitle" style={{ margin: '0.3rem 0 0' }}>
          Quelques questions pour des conseils vraiment ciblés (au lieu de
          généralistes). Réponds à celles qui te parlent.
        </p>
      </div>

      <div className="affiner-questions">
        {questions.map((q) => (
          <div key={q.id} className="affiner-q">
            <div className="affiner-q-titre">{q.question}</div>
            <div className="affiner-options">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`affiner-opt${reponses[q.id] === opt ? ' active' : ''}`}
                  onClick={() =>
                    setReponses((r) => ({ ...r, [q.id]: opt }))
                  }
                  aria-pressed={reponses[q.id] === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="affiner-pied">
        <button
          type="button"
          className="btn btn-primary"
          onClick={valider}
          disabled={envoi || nbRepondu === 0}
        >
          {envoi
            ? 'Analyse…'
            : fait
              ? 'Mettre à jour mes conseils'
              : 'Voir mes conseils ciblés'}
        </button>
        {fait && !envoi && (
          <span className="affiner-ok">
            ✓ Conseils mis à jour d'après tes réponses.
          </span>
        )}
      </div>
    </section>
  )
}
