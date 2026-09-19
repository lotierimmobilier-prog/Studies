/**
 * Page d'accueil.
 *
 * Elle a un seul travail : faire comprendre en dix secondes que ce site aide à
 * CHOISIR une école ou une fac, puis s'effacer. Le cahier des charges fixe un
 * premier résultat utile en moins de 90 secondes, sans compte.
 *
 * Deux règles de CLAUDE.md pèsent directement sur le texte de cette page :
 *
 * - règle 5, les trois scores restent séparés, jamais de note globale unique.
 *   On ne promet donc nulle part « la meilleure école » dans l'absolu, ce qui
 *   supposerait un classement. On promet l'école qui te va, ce qui est une
 *   autre affirmation, et une affirmation que nos données savent tenir ;
 * - règle 6, toute donnée affichée porte son millésime. Aucun chiffre de cette
 *   page n'est décoratif : ils viennent tous du jeu de communes versionné.
 */

import {
  GENERE_LE,
  loyerDe,
  MILLESIME_LOYERS,
  nomCommune,
  NOMBRE_COMMUNES_AVEC_LOYER,
  SOURCE_LOYERS,
  SOURCE_PARCOURSUP,
  TYPOLOGIE_LOYERS,
} from './donnees.ts'

/** Surface du logement type servant à l'illustration. */
const SURFACE = 25

const VILLES_EXEMPLE: readonly string[] = ['87085', '31555', '75113']

interface LigneVille {
  readonly code: string
  readonly nom: string
  readonly loyer: NonNullable<ReturnType<typeof loyerDe>>
}

function euros(v: number): string {
  return `${Math.round(v).toLocaleString('fr-FR')} €`
}

function eurosParM2(v: number): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/m²`
}

function nombre(v: number): string {
  return v.toLocaleString('fr-FR')
}

/**
 * Le référentiel écrit « Paris 13e Arrondissement ». Sur une page d'accueil,
 * « Paris 13e » suffit — le code INSEE reste la clé, seul l'affichage change.
 */
function nomLisible(nom: string): string {
  return nom.replace(/\s+Arrondissement$/i, '')
}

/** Date ISO du fichier de données, écrite en toutes lettres. */
function dateLisible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ------------------------------------------------------------------ hero */

function Hero({ onCommencer }: { onCommencer: () => void }) {
  return (
    <section className="hero">
      <p className="hero-sur">Orientation post-bac · Parcoursup</p>
      <h1 className="promesse">
        L’école supérieure qui te va, <em>et</em> dans laquelle tu pourras tenir.
      </h1>
      <p className="hero-texte">
        Fac, BUT, BTS, école d’ingénieurs, prépa : KITETUDIANT regarde chaque formation
        sous trois angles — tes chances d’y entrer, ce qu’elle vaut pour toi, et ce qu’il
        te restera pour vivre une fois sur place. Trois réponses, jamais fondues en une
        note.
      </p>
      <div className="cta-groupe">
        <button type="button" className="principal" onClick={onCommencer}>
          Trouver mes formations
        </button>
        <a className="cta-secondaire" href="#methode">
          Comment ça marche
        </a>
      </div>
      <p className="hero-mentions">
        Sept questions · aperçu sans compte · aucune note enregistrée
      </p>
    </section>
  )
}

/* ------------------------------------------------- bandeau de trois faits */

function Bandeau() {
  return (
    <section className="bandeau" aria-label="En bref">
      <div className="bandeau-item">
        <span className="bandeau-chiffre">{nombre(NOMBRE_COMMUNES_AVEC_LOYER)}</span>
        <span className="bandeau-libelle">
          communes dont le loyer est connu, millésime {MILLESIME_LOYERS}
        </span>
      </div>
      <div className="bandeau-item">
        <span className="bandeau-chiffre">3</span>
        <span className="bandeau-libelle">
          critères tenus séparés, jamais résumés en une note unique
        </span>
      </div>
      <div className="bandeau-item">
        <span className="bandeau-chiffre">0</span>
        <span className="bandeau-libelle">
          montant inventé : chaque euro porte sa source et sa date
        </span>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- les trois piliers */
// « axe » et « axes » sont déjà pris par l’affichage des résultats (App.tsx) :
// les réutiliser ici faisait hériter cette section de leur grille à deux colonnes.

const PILIERS: readonly { readonly titre: string; readonly question: string; readonly texte: string }[] = [
  {
    titre: 'Tes chances',
    question: 'Est-ce que je peux y entrer ?',
    texte:
      'Le taux d’accès réellement publié pour cette formation, l’an dernier, avec le nombre de candidats derrière. Pas une probabilité inventée pour ton dossier : le chiffre officiel, dit tel quel.',
  },
  {
    titre: 'Ce qui te ressemble',
    question: 'Est-ce que c’est fait pour moi ?',
    texte:
      'Tes notes par matière, la filière qui t’attire, ce que tu aimes faire. On regarde si la formation s’appuie sur ce que tu réussis déjà — sans jamais te fermer une porte.',
  },
  {
    titre: 'Ce qu’il te restera',
    question: 'Est-ce que je pourrai y vivre ?',
    texte:
      'Loyer de la ville, aide au logement, bourse, CVEC, repas : le reste-à-vivre mensuel, ligne par ligne. C’est ce qu’aucun autre outil d’orientation ne te dit.',
  },
]

function Piliers() {
  return (
    <section className="bloc piliers" id="piliers">
      <h2>Trois questions qu’il faut se poser ensemble</h2>
      <p className="bloc-intro">
        Une école excellente et inabordable reste inabordable. Une école abordable qui ne
        te ressemble pas se quitte au bout d’un an.
      </p>
      <div className="piliers-grille">
        {PILIERS.map((a, i) => (
          <article className="pilier" key={a.titre}>
            <span className="pilier-numero">{i + 1}</span>
            <h3 className="pilier-titre">{a.titre}</h3>
            <p className="pilier-question">{a.question}</p>
            <p className="pilier-texte">{a.texte}</p>
          </article>
        ))}
      </div>
      <p className="bloc-chute">
        Les trois réponses restent côte à côte, chacune avec sa source.{' '}
        <strong>Le classement final, c’est toi qui le fais</strong> — c’est ton
        orientation, pas un résultat d’algorithme.
      </p>
    </section>
  )
}

/* ------------------------------------------------ la preuve par les loyers */

function Comparaison() {
  const lignes: LigneVille[] = []
  for (const code of VILLES_EXEMPLE) {
    const loyer = loyerDe(code)
    if (loyer !== null) lignes.push({ code, nom: nomCommune(code) ?? code, loyer })
  }
  const triees = [...lignes].sort((a, b) => a.loyer.euroParM2.central - b.loyer.euroParM2.central)
  const moinsCher = triees[0]
  const plusCher = triees[triees.length - 1]

  // Si le jeu de communes changeait et perdait ces villes, on préfère ne rien
  // montrer plutôt qu'une comparaison bancale.
  if (triees.length < 2 || !moinsCher || !plusCher) return null

  const ecart = (plusCher.loyer.euroParM2.central - moinsCher.loyer.euroParM2.central) * SURFACE

  return (
    <section className="bloc">
      <h2>Pourquoi la ville compte autant que l’école</h2>
      <p className="bloc-intro">
        Le même studio de {SURFACE} m², loyer d’annonce charges comprises, millésime{' '}
        {MILLESIME_LOYERS}.
      </p>
      <ul className="comparaison">
        {triees.map((l) => (
          <li key={l.code}>
            <span className="comparaison-ville">{nomLisible(l.nom)}</span>
            <span className="comparaison-montant">
              {euros(l.loyer.euroParM2.central * SURFACE)}
            </span>
            <span className="comparaison-m2">{eurosParM2(l.loyer.euroParM2.central)}</span>
          </li>
        ))}
      </ul>
      <p className="bloc-chute">
        <strong>{euros(ecart)} par mois</strong> séparent {nomLisible(moinsCher.nom)} de{' '}
        {nomLisible(plusCher.nom)}, à logement identique. Sur une licence de trois ans,
        c’est la différence entre un budget tenable et un job étudiant subi.
      </p>
    </section>
  )
}

/* ----------------------------------------------------------------- la page */

export function Accueil({ onCommencer }: { onCommencer: () => void }) {
  return (
    <main className="app accueil">
      <header className="entete entete-accueil">
        <h1 className="marque">KITETUDIANT</h1>
        <button type="button" className="entete-cta" onClick={onCommencer}>
          Commencer
        </button>
      </header>

      <Hero onCommencer={onCommencer} />
      <Bandeau />
      <Piliers />
      <Comparaison />

      <section className="bloc" id="methode">
        <h2>Comment ça marche</h2>
        <ol className="etapes-accueil">
          <li>
            <strong>Tu réponds à sept questions.</strong> Ton bac, tes notes — importées
            d’un bulletin ou saisies —, ce qui t’intéresse, ta bourse, ton budget.
          </li>
          <li>
            <strong>On sort les formations qui correspondent.</strong> Depuis l’open data
            du ministère, avec leurs statistiques d’admission réelles de l’an dernier.
          </li>
          <li>
            <strong>On calcule le reste-à-vivre de chacune.</strong> Ville par ville,
            aide au logement comprise. Tu déplies le budget, ligne par ligne, chaque euro
            avec sa source et son millésime.
          </li>
          <li>
            <strong>Tu compares et tu décides.</strong> Rien n’est masqué, rien n’est
            classé à ta place.
          </li>
          <li>
            <strong>Un compte pour le détail.</strong> La liste des formations, leur
            ville et leur taux d’accès s’affichent sans rien donner. Le reste-à-vivre
            chiffré et le budget poste par poste demandent une adresse e-mail et un mot
            de passe — rien d’autre, et jamais tes notes.
          </li>
        </ol>
        <div className="cta-groupe cta-groupe-bloc">
          <button type="button" className="principal" onClick={onCommencer}>
            Commencer les sept questions
          </button>
        </div>
      </section>

      <section className="bloc">
        <h2>Ce que ce site ne fait pas</h2>
        <ul className="promesses">
          <li>
            <strong>Il ne classe pas les écoles entre elles.</strong> Pas de palmarès, pas
            de note globale : trois critères séparés, que tu pondères toi-même.
          </li>
          <li>
            <strong>Il ne transmet rien à Parcoursup.</strong> Aucun vœu que tu regardes
            ici n’en sort.
          </li>
          <li>
            <strong>Il ne masque aucune formation.</strong> Un vœu peut être signalé comme
            difficile à financer ; il n’est jamais retiré de la liste.
          </li>
          <li>
            <strong>Il n’invente aucun montant.</strong> Pas de valeur de repli, pas
            d’estimation déguisée : une donnée absente s’affiche comme absente.
          </li>
          <li>
            <strong>Il n’enregistre aucune donnée scolaire.</strong> Même inscrit, tes
            notes, tes bulletins et tes vœux restent dans ton navigateur. Le compte ne
            connaît que ton adresse, chiffrée, et il est effacé après trois ans sans
            usage.
          </li>
        </ul>
      </section>

      <section className="bloc">
        <h2>D’où viennent les chiffres</h2>
        <ul className="sources">
          <li>Formations et statistiques d’admission : {SOURCE_PARCOURSUP}.</li>
          <li>
            Loyers : {SOURCE_LOYERS}, typologie « {TYPOLOGIE_LOYERS} », millésime{' '}
            {MILLESIME_LOYERS}.
          </li>
          <li>Aide au logement : calculée par OpenFisca France.</li>
          <li>
            Bourses, aide au mérite, CVEC, tarif du restaurant universitaire : barèmes
            officiels datés, rattachés à leur arrêté.
          </li>
          <li>Jeu de communes assemblé le {dateLisible(GENERE_LE)}.</li>
        </ul>
      </section>

      <section className="cta-final">
        <h2>Tes vœux se décident maintenant.</h2>
        <p>
          Sept questions, et tu sauras lesquels tu peux tenir jusqu’au diplôme.
        </p>
        <button type="button" className="principal" onClick={onCommencer}>
          Trouver mes formations
        </button>
        <p className="hero-mentions">
          Gratuit · un compte pour le détail · aucune note enregistrée
        </p>
      </section>

      <footer className="pieds">
        <p className="non-affiliation">
          KITETUDIANT n’est pas affilié à Parcoursup, au ministère de l’Enseignement
          supérieur ni aux CROUS.
        </p>
      </footer>
    </main>
  )
}
