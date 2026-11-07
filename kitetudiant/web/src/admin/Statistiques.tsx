/**
 * Les statistiques, dans la console d'administration.
 *
 * ── Ce que cet écran montre, et ce qu'il ne peut pas montrer ─────────────
 *
 * Deux sources, séparées à dessein :
 *
 *   - les COMPTES, dont on ne voit que des compteurs. Aucune adresse, pas
 *     même partielle : le fichier des comptes les chiffre au repos pour
 *     qu'on ne puisse pas les énumérer, et une console qui les déchiffrerait
 *     en bloc annulerait cette protection sur une base d'utilisateurs
 *     MINEURS (règle 3 de CLAUDE.md) ;
 *   - les RELEVÉS anonymes, qui n'ont jamais porté d'identifiant et ne
 *     peuvent donc être rattachés à personne.
 *
 * On ne peut pas, depuis cet écran, savoir ce qu'UN élève a fait. Ce n'est
 * pas une limite qu'il faudrait lever un jour : c'est la raison pour laquelle
 * la page d'accueil peut promettre que les notes et les vœux restent dans le
 * navigateur.
 *
 * ── Sur les barres ───────────────────────────────────────────────────────
 *
 * Elles sont proportionnelles au plus grand de la série, et le nombre est
 * TOUJOURS écrit à côté. Une barre sans son chiffre se lit de travers dès que
 * l'échelle change ; elle est ici un repère visuel, jamais la donnée.
 */

import { useCallback, useEffect, useState } from 'react'

import { communeLisible } from '../communes.ts'
import {
  chercherStatistiques,
  telechargerReleves,
  type Comptage,
  type StatistiquesAdmin,
} from './api.ts'

function dateLisible(iso: string | null): string {
  if (iso === null) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Une série en barres. Le nombre est écrit, la barre n'est qu'un repère. */
function Serie({ titre, valeurs }: { readonly titre: string; readonly valeurs: readonly Comptage[] }) {
  if (valeurs.length === 0) {
    // Une absence s'affiche comme une absence : une série vide n'est pas une
    // série de zéros.
    return (
      <div className="stat-serie">
        <h4>{titre}</h4>
        <p className="note">Aucune donnée pour cette période.</p>
      </div>
    )
  }
  const plus = Math.max(...valeurs.map((v) => v.nombre))
  return (
    <div className="stat-serie">
      <h4>{titre}</h4>
      <ul className="stat-barres">
        {valeurs.map((v) => (
          <li key={v.valeur}>
            <span className="stat-libelle">{v.valeur}</span>
            <span className="stat-barre">
              <span style={{ width: `${Math.round((v.nombre / plus) * 100)}%` }} />
            </span>
            <span className="stat-nombre">{v.nombre}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Statistiques() {
  const [stats, setStats] = useState<StatistiquesAdmin | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [depuis, setDepuis] = useState('')
  const [jusqua, setJusqua] = useState('')
  const [enCours, setEnCours] = useState(false)

  const charger = useCallback(async () => {
    setEnCours(true)
    setErreur(null)
    try {
      setStats(await chercherStatistiques(depuis || undefined, jusqua || undefined))
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
    }
  }, [depuis, jusqua])

  useEffect(() => {
    void charger()
    // Au premier rendu seulement : ensuite, c'est le bouton qui commande.
    // Recharger à chaque frappe dans un champ de date ferait une requête par
    // caractère tapé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (erreur !== null) return <p className="alerte">{erreur}</p>
  if (stats === null) return <p className="note">Chargement des statistiques…</p>

  const c = stats.comptes
  const r = stats.releves

  return (
    <section className="bloc">
      <h2>Statistiques</h2>

      <div className="stat-periode">
        <label htmlFor="stat-depuis">Du</label>
        <input
          id="stat-depuis"
          type="date"
          value={depuis}
          onChange={(ev) => setDepuis(ev.target.value)}
        />
        <label htmlFor="stat-jusqua">au</label>
        <input
          id="stat-jusqua"
          type="date"
          value={jusqua}
          onChange={(ev) => setJusqua(ev.target.value)}
        />
        <button type="button" className="secondaire" disabled={enCours} onClick={() => void charger()}>
          {enCours ? 'Chargement…' : 'Appliquer'}
        </button>
        <button
          type="button"
          className="secondaire"
          onClick={() => void telechargerReleves(depuis || undefined, jusqua || undefined)}
        >
          Exporter en CSV
        </button>
      </div>

      {/* ------------------------------------------------------- comptes */}
      <h3>Comptes élèves</h3>
      {!c.configure ? (
        <p className="alerte">
          COMPTES_MASTER_KEY n’est pas définie : il n’y a pas de comptes à compter.
        </p>
      ) : (
        <>
          <ul className="stat-chiffres">
            <li>
              <span className="stat-grand">{c.comptes}</span>
              <span className="note">inscrits</span>
            </li>
            <li>
              <span className="stat-grand">{c.actifs30j}</span>
              <span className="note">vus ces 30 jours</span>
            </li>
            <li>
              <span className="stat-grand">{c.sessionsActives}</span>
              <span className="note">sessions ouvertes</span>
            </li>
            <li>
              <span className="stat-grand">{c.bientotPurges}</span>
              <span className="note">purgés d’ici 90 jours</span>
            </li>
          </ul>
          <p className="note">
            Du {dateLisible(c.premierCompteLe)} au {dateLisible(c.dernierCompteLe)}. Aucune
            adresse e-mail n’est lisible depuis cette console : elles sont chiffrées au
            repos, et le rester est ce qui protège des utilisateurs mineurs.
          </p>
          <Serie
            titre="Créations par jour"
            valeurs={c.creationsParJour.map((j) => ({ valeur: j.le, nombre: j.nombre }))}
          />
        </>
      )}

      {/* ------------------------------------------------------- relevés */}
      <h3>Usage du simulateur</h3>
      <p className="note">
        Relevés <strong>anonymes</strong> : aucun identifiant, aucune note exacte — des
        tranches —, aucun vœu, aucune adresse IP. Ils ne sont rattachables à personne, et
        deux relevés du même élève sont indistinguables de deux relevés d’élèves
        différents.
      </p>

      {r.total === 0 ? (
        <p className="note">Aucun relevé sur cette période.</p>
      ) : (
        <>
          <ul className="stat-chiffres">
            <li>
              <span className="stat-grand">{r.total}</span>
              <span className="note">simulations</span>
            </li>
            <li>
              <span className="stat-grand">{r.boursiers.oui}</span>
              <span className="note">boursiers déclarés</span>
            </li>
            <li>
              <span className="stat-grand">{r.communes.length}</span>
              <span className="note">communes simulées</span>
            </li>
          </ul>
          <p className="note">
            Du {dateLisible(r.duPremier)} au {dateLisible(r.auDernier)}.
          </p>

          <div className="stat-grille">
            <Serie titre="Par jour" valeurs={r.parJour} />
            <Serie titre="Type de bac" valeurs={r.parTypeBac} />
            <Serie titre="Moyenne (par tranche)" valeurs={r.parTrancheMoyenne} />
            <Serie titre="Reste-à-vivre (par tranche)" valeurs={r.parTrancheReste} />
            <Serie titre="Jusqu’où ils peuvent aller" valeurs={r.parMobilite} />
            <Serie titre="Académie" valeurs={r.parAcademie} />
            <Serie titre="Filière demandée" valeurs={r.parFiliere} />
            {/* Les communes sont relevées par leur code INSEE — c'est la clé
                pivot du projet, et elle ne bouge pas quand un nom change. Mais
                « 87085 » ne dit rien à qui lit un tableau : on le remplace ici
                par « Limoges (87) », le département tranchant les homonymes.
                Le code brut reste affiché quand la table ne connaît pas la
                commune : c'est alors la seule information dont on dispose. */}
            <Serie
              titre="Communes les plus simulées"
              valeurs={r.communes.map((c) => ({
                valeur: communeLisible(c.valeur),
                nombre: c.nombre,
              }))}
            />
          </div>
        </>
      )}
    </section>
  )
}
