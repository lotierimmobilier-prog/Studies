import { FORMATIONS } from '../data/formations'
import { DOMAINES, LABELS_DOMAINE } from '../data/labels'
import { budgetMensuel, coutDeLaVie } from '../data/coutVie'

function Arrow() {
  return <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

interface AccueilProps {
  onCommencer: () => void
}

const FONCTIONS = [
  { icon: 'arrow', titre: 'Vois plus loin que tes notes.', texte: 'Tes résultats comptent. Tes passions, ta motivation et ton projet aussi. On regarde ton profil dans son ensemble.' },
  { icon: '◎', titre: 'Trouve ta place.', texte: 'Compare les formations, explore de nouvelles villes et découvre les parcours qui te correspondent.' },
  { icon: '€', titre: 'Garde les pieds sur terre.', texte: 'Frais de scolarité, logement, coût de la vie : construis un projet qui tient aussi dans ton budget.' },
]

export default function Accueil({ onCommencer }: AccueilProps) {
  const exemple = FORMATIONS.find((f) => f.id === 'licence-info-lyon') ?? FORMATIONS[0]
  const cout = coutDeLaVie(exemple.ville, exemple.region)
  const euros = (montant: number) => montant.toLocaleString('fr-FR') + ' €'

  return (
    <div className="accueil">
      <nav className="acc-nav" aria-label="Navigation principale">
        <a href="#" className="brand" aria-label="Cap Sup, accueil"><span className="brand-mark" aria-hidden="true"><Arrow /></span>cap sup<span className="brand-period">.</span></a>
        <div className="nav-links"><a href="#approche">L’approche</a><a href="#comment">Comment ça marche</a></div>
        <button className="btn btn-primary" onClick={onCommencer}>À toi de jouer <span aria-hidden="true"><Arrow /></span></button>
      </nav>

      <main>
        <header className="acc-hero">
          <div className="hero-copy">
            <div className="acc-eyebrow"><span /> TON AVENIR A DE L’AVENIR</div>
            <h1>La suite ?<br />Elle commence<br /><em>avec toi.</em><span className="title-star" aria-hidden="true">✳︎</span></h1>
            <p className="acc-lede">Estime tes chances d’admission à partir de tes résultats, de ta localisation, de tes passions et de ta motivation. Compare les formations, leur budget et construis ta liste de vœux.</p>
            <div className="acc-cta"><button className="btn btn-primary" onClick={onCommencer}>Explorer mes possibilités <span aria-hidden="true"><Arrow /></span></button><span className="cta-note">Ton profil. Ton rythme.</span></div>
            <div className="acc-reassure"><span>✓ Gratuit</span><span>✓ Sans inscription</span><span>✓ Sans pression</span></div>
          </div>
          <div className="journey-art" role="group" aria-label="Aperçu d’une formation de l’échantillon de démonstration">
            <div className="art-grid" />
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <span className="art-label">IL N’Y A PAS QU’UN SEUL CHEMIN.</span>
            <svg className="journey-path" viewBox="0 0 480 500" fill="none" aria-hidden="true"><path d="M70 450C30 345 310 410 350 300S110 240 150 140S360 170 410 45" stroke="#e2e7aa" strokeWidth="58" /><path d="M70 450C30 345 310 410 350 300S110 240 150 140S360 170 410 45" stroke="#526d4a" strokeWidth="2" strokeDasharray="5 8" /></svg>
            <div className="art-card profile-card"><span className="art-card-icon">☺</span><div><small>LE POINT DE DÉPART</small><strong>Toi, tout simplement.</strong><span>Des talents. Des envies. Du potentiel.</span></div></div>
            <div className="art-card possibility-card data-preview">
              <div className="card-kicker"><span className="tiny-dot" /> EXEMPLE · DONNÉES DE DÉMONSTRATION</div>
              <div className="mini-formation"><span>01</span><div><strong>{exemple.nom}</strong><small>{exemple.etablissement} · {exemple.ville}</small></div></div>
              <div className="preview-rate"><strong>{exemple.tauxAccesBase} %</strong><span>Taux d’accès de l’échantillon<br />Ce n’est pas ton estimation personnelle.</span></div>
              <div className="match-label"><span>Loyer indicatif / mois</span><b>{euros(cout.loyerStudio)}</b></div>
              <div className="match-label"><span>Budget de vie / mois, loyer inclus</span><b>{euros(budgetMensuel(exemple.ville, exemple.region))}</b></div>
            </div>
            <span className="art-sticker">Et pourquoi<br /><em>pas toi ?</em></span><span className="art-spark" aria-hidden="true">✳︎</span><span className="art-bottom">CAP SUR TON PROCHAIN CHAPITRE</span>
          </div>
        </header>

        <div className="trust-strip"><span>Un peu moins de flou.<br /><strong>Beaucoup plus de perspectives.</strong></span><div><b>{DOMAINES.length}</b><span>Domaines d’études proposés</span></div><div><b>{FORMATIONS.length}</b><span>Formations dans l’échantillon local</span></div><div><b>0 €</b><span>Pour utiliser le simulateur</span></div></div>

        <section className="acc-section" id="approche"><div className="section-heading"><div><div className="acc-eyebrow">UNE BOUSSOLE, À TA FAÇON</div><h2>Pas besoin d’avoir<br />déjà tout prévu.</h2></div><p>On t’aide à relier ce que tu aimes, ce que tu sais faire et ce qui est possible. La décision reste la tienne.</p></div><div className="acc-grid">{FONCTIONS.map((f, i) => <article className="acc-card" key={f.titre}><div className="feature-top"><span className="feature-icon" aria-hidden="true">{f.icon === 'arrow' ? <Arrow /> : f.icon}</span><span>0{i + 1}</span></div><h3>{f.titre}</h3><p>{f.texte}</p></article>)}</div></section>

        <section className="catalogue-section" aria-labelledby="catalogue-titre">
          <div className="section-heading"><div><div className="acc-eyebrow">LES PARCOURS DÉJÀ DANS STUDIES</div><h2 id="catalogue-titre">Des pistes concrètes à explorer.</h2></div><p>Quelques formations de l’échantillon local. La simulation recherche les données officielles en direct et utilise cet échantillon si elles sont indisponibles.</p></div>
          <div className="catalogue-grid">{FORMATIONS.slice(0, 6).map((f) => <article className="catalogue-card" key={f.id}>
            <span className="tag">{LABELS_DOMAINE[f.domaine]}</span><h3>{f.nom}</h3><p>{f.etablissement}</p><div className="catalogue-facts"><span>{f.ville}</span><span>{f.statut}</span></div><div className="catalogue-budget">Budget de vie indicatif, loyer inclus<strong>{euros(budgetMensuel(f.ville, f.region))}<small> / mois</small></strong></div>
            <button className="text-button" onClick={onCommencer}>Évaluer mon profil <Arrow /></button>
          </article>)}</div>
          <p className="source-note">Exemples de démonstration, pas un catalogue exhaustif. Les budgets de vie sont indicatifs et n’incluent pas les frais de scolarité.</p>
        </section>
        <section className="sources-section" aria-labelledby="sources-titre"><div><div className="acc-eyebrow">SAVOIR CE QUE L’ON COMPARE</div><h2 id="sources-titre">Les données, en toute clarté.</h2></div><div><h3>Formations et taux d’accès</h3><p>Le jeu public fr-esr-parcoursup fournit les établissements, les lieux, les capacités et les taux d’accès historiques. Ces taux sont distincts de tes chances estimées par le simulateur.</p><a href="https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-parcoursup/" target="_blank" rel="noreferrer">Consulter la source officielle <Arrow /></a></div><div><h3>Prix, logement et conseils</h3><p>Les frais proviennent de la base de prix, des sites d’écoles ou d’une estimation signalée dans les résultats. Les budgets par ville restent indicatifs. Les conseils fonctionnent aussi sans IA ; l’analyse de bulletin nécessite le service IA configuré.</p></div></section>

        <section className="how-section" id="comment"><div className="section-heading"><div><div className="acc-eyebrow">ON FAIT LE CHEMIN ENSEMBLE</div><h2>Du « je ne sais pas »<br />au « pourquoi pas ».</h2></div><button className="text-button" onClick={onCommencer}>C’est parti <span aria-hidden="true"><Arrow /></span></button></div><div className="acc-steps">{[{titre:'Raconte-nous un peu.', texte:'Tes notes, tes spécialités, tes envies et les endroits où tu te verrais étudier.'},{titre:'Ouvre les possibilités.', texte:'Explore tes chances estimées, compare les parcours et repère ceux qui te donnent envie.'},{titre:'Dessine ta prochaine étape.', texte:'Construis une liste de vœux équilibrée, avec les conseils et le budget pour avancer.'}].map((e,i)=><article className="acc-step" key={e.titre}><span className="acc-step-n">0{i+1}</span><h3>{e.titre}</h3><p>{e.texte}</p></article>)}</div></section>
        <section className="acc-final"><span className="final-spark" aria-hidden="true">✳︎</span><div className="acc-eyebrow">LE PREMIER PAS SUFFIT</div><h2>Ton futur n’est pas écrit.<br /><em>Et c’est une bonne nouvelle.</em></h2><button className="btn btn-primary" onClick={onCommencer}>Je découvre mes possibilités <span aria-hidden="true"><Arrow /></span></button><p>Pas de compte à créer. Juste de nouvelles pistes.</p></section>
      </main>
      <footer className="acc-footer"><a href="#" className="brand"><span className="brand-mark" aria-hidden="true"><Arrow /></span>cap sup.</a><p>Une boussole pour ton orientation, pas une prédiction.<br />Outil pédagogique indépendant de Parcoursup. Les estimations ne garantissent pas une admission.</p><span>À chacun son chemin.</span></footer>
    </div>
  )
}
