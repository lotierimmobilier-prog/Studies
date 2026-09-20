/**
 * L'écran d'attente, pendant que les formations se calculent.
 *
 * ── Pourquoi pas un compte à rebours en secondes ─────────────────────────
 *
 * Parce qu'on ne sait pas combien de temps ça prendra. Le calcul interroge
 * l'open data du ministère, puis OpenFisca : la durée dépend de deux serveurs
 * qui ne nous appartiennent pas et de la connexion de l'élève. Un « 3… 2…
 * 1… » serait donc une animation décorative qui se terminerait avant le
 * calcul, ou un compteur qui s'arrêterait à zéro en continuant de tourner.
 * Les deux sont des petits mensonges, et ce site refuse les petits mensonges
 * y compris sur des détails d'interface.
 *
 * ── Ce qui est décompté à la place ───────────────────────────────────────
 *
 * Les ÉTAPES, qui sont réelles et au nombre de quatre. Chacune se coche au
 * moment où elle se termine pour de bon, et le compteur en bas dit « 2 sur
 * 4 ». L'attente devient lisible : on sait où on en est, et on apprend au
 * passage d'où viennent les chiffres — ce qui est exactement ce que ce site
 * veut faire comprendre.
 *
 * Une étape qui traîne se voit, elle aussi. C'est un défaut de l'interface
 * naïve — un tourniquet unique pendant huit secondes ne dit pas si quelque
 * chose avance ou si tout est bloqué.
 *
 * ── Mouvement ────────────────────────────────────────────────────────────
 *
 * Le seul mouvement est une pulsation lente sur l'étape en cours, coupée
 * quand le système demande moins d'animations (`prefers-reduced-motion`).
 */

/** Les étapes du calcul, dans l'ordre où elles se produisent. */
export type EtapeCalcul = 'formations' | 'aides' | 'retours' | 'budget'

export const ETAPES_CALCUL: readonly {
  readonly cle: EtapeCalcul
  readonly titre: string
  readonly note: string
}[] = [
  {
    cle: 'formations',
    titre: 'On cherche les formations',
    note: 'Dans l’open data du ministère, avec leurs statistiques d’admission publiées',
  },
  {
    cle: 'aides',
    titre: 'On calcule ton aide au logement',
    note: 'Ville par ville, avec les barèmes officiels',
  },
  {
    cle: 'retours',
    titre: 'On rassemble les retours d’étudiants',
    note: 'Ce qu’ont dit ceux qui y sont déjà',
  },
  {
    cle: 'budget',
    titre: 'On établit ton reste-à-vivre',
    note: 'Loyer, bourse, CVEC, repas, transport — ligne par ligne',
  },
]

export function Chargement({ etape }: { readonly etape: EtapeCalcul | null }) {
  const rang = ETAPES_CALCUL.findIndex((e) => e.cle === etape)
  // Étape inconnue : on n'invente pas d'avancement, tout reste en attente.
  const courante = rang < 0 ? 0 : rang
  const faites = rang < 0 ? 0 : rang

  return (
    <div className="chargement" role="status" aria-live="polite">
      <div className="chargement-boite">
        <p className="chargement-sur">Un instant</p>
        <h2 className="chargement-titre">On regarde ce qui t’attend</h2>

        <ol className="chargement-etapes">
          {ETAPES_CALCUL.map((e, i) => {
            const etat = i < courante ? 'faite' : i === courante ? 'encours' : 'attente'
            return (
              <li className={`chargement-etape chargement-${etat}`} key={e.cle}>
                <span className="chargement-marque" aria-hidden="true" />
                <span className="chargement-texte">
                  <span className="chargement-etape-titre">{e.titre}</span>
                  <span className="chargement-etape-note">{e.note}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <p className="chargement-compte">
          {faites} sur {ETAPES_CALCUL.length}
        </p>
        <p className="note chargement-pied">
          Chaque euro affiché portera sa source et son millésime. C’est ce qui prend
          ce temps-là.
        </p>
      </div>
    </div>
  )
}
