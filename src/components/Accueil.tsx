/**
 * Page d'accueil : présente le simulateur aux lycéens.
 * Ton professionnel et rassurant, avec une pointe d'humour.
 */

interface AccueilProps {
  onCommencer: () => void
}

const FONCTIONS = [
  {
    emoji: '🎯',
    titre: 'Ton taux d\'admission, estimé',
    texte:
      'À partir des vrais taux d\'accès Parcoursup. Fini le « au feeling » : tu vois où tu as tes chances.',
  },
  {
    emoji: '📄',
    titre: 'Ton bulletin analysé',
    texte:
      'Tu importes ton bulletin, l\'IA lit tes notes et tes appréciations. Elle fait le sale boulot.',
  },
  {
    emoji: '💶',
    titre: 'Prix + coût de la vie',
    texte:
      'Frais de scolarité et loyer par ville. Parce que « logé chez papa-maman » n\'est pas toujours une option.',
  },
  {
    emoji: '🧭',
    titre: 'Des conseils sur-mesure',
    texte:
      'Spécialités à choisir, liste de vœux équilibrée. Comme un prof principal, mais dispo à 2 h du mat.',
  },
]

const ETAPES = [
  {
    n: 1,
    titre: 'Ton profil',
    texte: 'Notes, spécialités, région, passions et motivation. Ou juste ton bulletin.',
  },
  {
    n: 2,
    titre: 'La simulation',
    texte: 'On interroge les données officielles et on calcule tes chances, formation par formation.',
  },
  {
    n: 3,
    titre: 'Ta liste de vœux',
    texte: 'Ambitieux, réalistes, valeurs sûres — avec prix, loyer et conseils personnalisés.',
  },
]

export default function Accueil({ onCommencer }: AccueilProps) {
  return (
    <div className="accueil">
      <nav className="acc-nav">
        <div className="acc-logo">
          <span aria-hidden="true">🧭</span> Cap&nbsp;Sup
        </div>
        <button className="btn btn-primary acc-nav-cta" onClick={onCommencer}>
          Simuler mes chances
        </button>
      </nav>

      <header className="acc-hero">
        <div className="acc-eyebrow">Orientation · Parcoursup</div>
        <h1>
          Parcoursup,
          <br />
          sans la boule au ventre.
        </h1>
        <p className="acc-lede">
          Estime tes chances d&apos;admission dans les formations qui te
          plaisent, à partir des <strong>données officielles</strong> — et
          repars avec une liste de vœux équilibrée, des conseils et le budget
          qui va avec.
        </p>
        <div className="acc-cta">
          <button className="btn btn-primary acc-cta-main" onClick={onCommencer}>
            Simuler mes chances 🚀
          </button>
          <a className="acc-cta-link" href="#comment">
            Voir comment ça marche
          </a>
        </div>
        <div className="acc-reassure">
          <span>✓ 100 % gratuit</span>
          <span>✓ Sans inscription</span>
          <span>✓ Données officielles</span>
        </div>
      </header>

      <section className="acc-stats">
        <div>
          <b>14 252</b>
          <span>formations couvertes</span>
        </div>
        <div>
          <b>4</b>
          <span>critères analysés</span>
        </div>
        <div>
          <b>0 €</b>
          <span>et aucun compte</span>
        </div>
      </section>

      <section className="acc-section">
        <h2>Tout ce qu&apos;un simulateur devrait faire (et un peu plus)</h2>
        <div className="acc-grid">
          {FONCTIONS.map((f) => (
            <div className="acc-card" key={f.titre}>
              <div className="acc-card-emoji" aria-hidden="true">
                {f.emoji}
              </div>
              <h3>{f.titre}</h3>
              <p>{f.texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="acc-section" id="comment">
        <h2>Comment ça marche</h2>
        <p className="acc-sub">Trois étapes, cinq minutes, zéro prise de tête.</p>
        <div className="acc-steps">
          {ETAPES.map((e) => (
            <div className="acc-step" key={e.n}>
              <div className="acc-step-n">{e.n}</div>
              <div>
                <h3>{e.titre}</h3>
                <p>{e.texte}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="acc-joke">
        <p>
          <strong>Spoiler :</strong> non, tu ne vas pas « finir sans rien ».
          L&apos;idée, c&apos;est justement de bâtir une liste où tu tentes tes
          rêves <em>et</em> où tu sécurises tes arrières. On s&apos;occupe des
          maths, toi tu gères la motivation.
        </p>
      </section>

      <section className="acc-final">
        <h2>Prêt·e à y voir clair&nbsp;?</h2>
        <p>Ton orientation mérite mieux qu&apos;un tirage au sort.</p>
        <button className="btn btn-primary acc-cta-main" onClick={onCommencer}>
          Lancer ma simulation
        </button>
      </section>

      <footer className="acc-footer">
        <p>
          Outil pédagogique et indépendant. Les estimations reposent sur un
          modèle simplifié et des données publiques ; elles ne préjugent pas des
          décisions réelles des formations Parcoursup.
        </p>
      </footer>
    </div>
  )
}
