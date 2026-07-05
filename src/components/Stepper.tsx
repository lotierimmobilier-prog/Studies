interface StepperProps {
  etapes: string[]
  courant: number
}

/** Barre de progression des étapes du simulateur. */
export default function Stepper({ etapes, courant }: StepperProps) {
  return (
    <div className="stepper">
      {etapes.map((etape, i) => {
        const etat = i === courant ? 'active' : i < courant ? 'done' : ''
        return (
          <div key={etape} className={`step-dot ${etat}`}>
            <span>{i < courant ? '✓' : i + 1}</span>
            <span>{etape}</span>
          </div>
        )
      })}
    </div>
  )
}
