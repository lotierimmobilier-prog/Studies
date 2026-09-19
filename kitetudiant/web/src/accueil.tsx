/**
 * Page d'accueil.
 *
 * Elle doit faire comprendre la promesse et s'effacer : le cahier des charges
 * fixe un premier résultat utile en moins de 90 secondes, sans compte. Un seul
 * bouton compte, et aucun chiffre n'est ici décoratif — ceux qui s'affichent
 * viennent du jeu de communes versionné, avec leur millésime, comme l'exige la
 * règle 6 de CLAUDE.md.
 */

import {
  loyerDe,
  MILLESIME_LOYERS,
  nomCommune,
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

/**
 * Le référentiel écrit « Paris 13e Arrondissement ». Sur une page d'accueil,
 * « Paris 13e » suffit — le code INSEE reste la clé, seul l'affichage change.
 */
function nomLisible(nom: string): string {
  return nom.replace(/\s+Arrondissement$/i, '')
}

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
      <h2>Le même studio, trois villes</h2>
      <p className="bloc-intro">
        {SURFACE} m², loyer d’annonce charges comprises, millésime {MILLESIME_LOYERS}.
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
        <strong>{euros(ecart)} par mois</strong> séparent {nomLisible(moinsCher.nom)} de {nomLisible(plusCher.nom)}, à
        logement identique. C’est ce que la plupart des outils d’orientation ne disent pas.
      </p>
    </section>
  )
}

export function Accueil({ onCommencer }: { onCommencer: () => void }) {
  return (
    <main className="app accueil">
      <header className="entete">
        <h1>KITETUDIANT</h1>
      </header>

      <section className="hero">
        <h2 className="promesse">
          Ce qu’il te restera pour vivre, vœu par vœu.
        </h2>
        <p className="hero-texte">
          Parcoursup te dit si tu peux entrer. Pas si tu peux rester. KITETUDIANT
          calcule, pour chaque formation, ce qu’il te restera chaque mois une fois
          le loyer, les courses et les transports payés.
        </p>
        <button type="button" className="principal" onClick={onCommencer}>
          Commencer
        </button>
        <p className="hero-mentions">
          Sept questions, sans compte, rien d’enregistré.
        </p>
      </section>

      <Comparaison />

      <section className="bloc">
        <h2>Comment ça marche</h2>
        <ol className="etapes-accueil">
          <li>
            <strong>Tu réponds à sept questions.</strong> Ton bac, tes notes — importées
            d’un bulletin ou saisies —, ce qui t’intéresse, ta bourse, ton budget.
          </li>
          <li>
            <strong>On croise deux choses, sans les mélanger.</strong> Ce qui te
            correspond d’un côté, ce qu’il te restera pour vivre de l’autre. Jamais
            une note unique qui écraserait les deux.
          </li>
          <li>
            <strong>Tu déplies le budget, ligne par ligne.</strong> Chaque euro porte
            sa source et son millésime. Si une donnée manque, c’est écrit.
          </li>
        </ol>
      </section>

      <section className="bloc">
        <h2>Ce que ce site ne fait pas</h2>
        <ul className="promesses">
          <li>
            <strong>Il ne transmet rien à Parcoursup.</strong> Aucun vœu que tu regardes
            ici n’en sort.
          </li>
          <li>
            <strong>Il ne masque aucune formation.</strong> Un vœu peut être signalé
            comme difficile à financer ; il n’est jamais retiré de la liste.
          </li>
          <li>
            <strong>Il n’invente aucun montant.</strong> Pas de valeur de repli, pas
            d’estimation déguisée : une donnée absente s’affiche comme absente.
          </li>
          <li>
            <strong>Il ne note pas les établissements.</strong> Les retours d’étudiants
            portent sur trois points chiffrés, jamais sur une réputation.
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
        </ul>
      </section>

      <div className="accueil-fin">
        <button type="button" className="principal" onClick={onCommencer}>
          Voir ce qu’il me restera
        </button>
      </div>

      <footer className="pieds">
        <p className="non-affiliation">
          KITETUDIANT n’est pas affilié à Parcoursup, au ministère de l’Enseignement
          supérieur ni aux CROUS.
        </p>
      </footer>
    </main>
  )
}
