interface StepperProps {
  etapes: string[]
  courant: number
}

/** Barre de progression des étapes du simulateur. */
export default function Stepper({ etapes, courant }: StepperProps) {
  return (
    <div className="stepper" role="list" aria-label="Étapes de la simulation">
      {etapes.map((etape, i) => {
        const etat = i === courant ? 'active' : i < courant ? 'done' : ''
        return (
          <div key={etape} className={`step-dot ${etat}`} role="listitem" aria-current={i === courant ? 'step' : undefined}>
            <span>{i < courant ? '✓' : i + 1}</span>
            <span>{etape}</span>
          </div>
        )
      })}
    </div>
  )
}
