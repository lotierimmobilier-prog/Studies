/**
 * La recherche directe de formations, par ville.
 *
 * ── Pourquoi cet écran existe ────────────────────────────────────────────
 *
 * Le parcours en sept questions répond à « où pourrais-je aller ? ». Il ne
 * répond pas à « qu'y a-t-il à Limoges ? », qui est la question de celui qui
 * sait déjà où il veut vivre — parce que sa famille y est, parce qu'il y a un
 * logement, parce qu'il ne veut pas partir. Lui imposer sept questions sur
 * ses notes et son budget avant de lui montrer une liste de formations, c'est
 * lui demander de payer un prix pour une réponse qui ne coûte rien.
 *
 * ── Ce que cet écran ne montre PAS, et le dit ────────────────────────────
 *
 * Le reste-à-vivre. Il dépend de la bourse, du logement, du train de vie et
 * de la contribution familiale — toutes choses que le parcours demande et
 * que cet écran ignore. Afficher un montant ici supposerait d'inventer ces
 * réponses, ce que la règle 1 de CLAUDE.md interdit.
 *
 * L'écran le dit donc en toutes lettres, et propose le parcours. Une absence
 * expliquée se lit comme une décision ; une absence muette se lit comme un
 * produit incomplet.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { chercherFormations, type Formation } from './donnees.ts'
import { CarteALaDemande, type PointCarte } from './carte.tsx'
import { FilAriane } from './filAriane.tsx'
import { Cle, Epingle, Fiche, Residence } from './illustrations.tsx'
import { liensLogement } from './logement.ts'
import { nombre } from './nombres.ts'
import { secteurDe } from './tri.ts'
import { THEMES, motsDuTheme } from './themes.ts'
import { cheminDe, type Route } from './routes.ts'

function Resultat({
  formation,
  onNaviguer,
}: {
  readonly formation: Formation
  readonly onNaviguer: (route: Route) => void
}) {
  const secteur = secteurDe(formation.statutEtablissement)
  const vers = { vue: 'formation', code: formation.id } as const
  return (
    <li className="ecole">
      {/* Le titre EST le lien vers la fiche. Un lien séparé « en savoir plus »
          au bas de la vignette oblige à chercher où cliquer, alors que le
          titre est ce qu'on lit en premier et ce qu'on vise naturellement. */}
      <h3 className="ecole-titre" title={formation.libelle}>
        <a
          href={cheminDe(vers)}
          onClick={(ev) => {
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
            ev.preventDefault()
            onNaviguer(vers)
          }}
        >
          {formation.libelle}
        </a>
      </h3>
      <p className="ecole-lieu">
        <Epingle />
        <span>
          {formation.etablissement} · {formation.ville} ({formation.departement})
        </span>
      </p>

      <p className="ecole-faits">
        {/* Le statut TEL QUE PUBLIÉ. Un statut absent s'affiche comme absent :
            l'écart de coût entre public et privé se compte en milliers
            d'euros par an, et deviner ici tromperait sur un montant. */}
        <span className={`ecole-etiquette ecole-${secteur ?? 'inconnu'}`}>
          {formation.statutEtablissement ?? 'statut non publié'}
        </span>
        {formation.tauxAcces !== null ? (
          <span className="ecole-etiquette">
            {formation.tauxAcces} % de taux d’accès
            {formation.session === '' ? '' : ` (session ${formation.session})`}
          </span>
        ) : (
          <span className="ecole-etiquette">taux d’accès non publié</span>
        )}
        {formation.capacite !== null ? (
          <span className="ecole-etiquette">{nombre(formation.capacite)} places</span>
        ) : null}
      </p>

      <p className="carte-liens">
        {formation.lien !== null ? (
          <a className="carte-lien" href={formation.lien} target="_blank" rel="noopener noreferrer">
            <Fiche />
            Fiche Parcoursup
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : null}
        {liensLogement(formation.ville).map((l) => (
          <a
            className="carte-lien"
            key={l.cle}
            href={l.url}
            title={l.note}
            target="_blank"
            rel="noopener noreferrer"
          >
            {l.cle === 'crous' ? <Residence /> : <Cle />}
            {l.cle === 'crous' ? 'Résidence universitaire' : 'Studios et T2'}
            <span aria-hidden="true"> ↗</span>
          </a>
        ))}
      </p>
    </li>
  )
}

export function RechercheEcoles({
  onNaviguer,
  onCommencer,
}: {
  readonly onNaviguer: (route: Route) => void
  /** Bascule vers le parcours en sept questions. */
  readonly onCommencer: () => void
}) {
  /* Les critères vivent dans l'adresse, pas seulement en mémoire.
   *
   * Deux raisons, et la seconde est la plus importante :
   *
   *   - « qu'y a-t-il à Limoges ? » est une question qu'on envoie à
   *     quelqu'un. Sans les critères dans l'adresse, le lien partagé ouvre
   *     un formulaire vide ;
   *   - depuis qu'un résultat mène à sa fiche, revenir en arrière est un
   *     geste ordinaire. Il ramenait sur une page vide : la recherche était
   *     perdue, et il fallait tout retaper. */
  const depart = new URLSearchParams(window.location.search)
  const [ville, setVille] = useState(depart.get('ville') ?? '')
  const [theme, setTheme] = useState(depart.get('theme') ?? '')
  const [mots, setMots] = useState(depart.get('mots') ?? '')
  const [resultats, setResultats] = useState<Formation[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const chercher = useCallback(async () => {
    if (ville.trim() === '' && theme === '' && mots.trim() === '') {
      // Sans critère, la requête ramènerait les formations les plus demandées
      // de France, ce qui n'est la réponse à aucune question posée.
      setErreur('Indique au moins une ville, un thème ou un mot-clé.')
      return
    }
    setEnCours(true)
    setErreur(null)
    /* `replaceState` et non `pushState` : chaque recherche remplace la
       précédente dans l'historique. Sans cela, cinq essais successifs
       obligeraient à appuyer cinq fois sur « précédent » pour sortir de la
       page. */
    const params = new URLSearchParams()
    if (ville.trim() !== '') params.set('ville', ville.trim())
    if (theme !== '') params.set('theme', theme)
    if (mots.trim() !== '') params.set('mots', mots.trim())
    const q = params.toString()
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${q === '' ? '' : `?${q}`}`,
    )
    try {
      /* Les mots du thème et ceux tapés à la main se cumulent en OU : un
         thème est un raccourci vers une liste de mots, pas un filtre qui
         exclurait ce que l'élève ajoute. */
      const motsCles = [
        ...motsDuTheme(theme),
        ...mots
          .split(/[\s,]+/)
          .map((m) => m.trim())
          .filter((m) => m.length > 1),
      ]
      setResultats(
        await chercherFormations({
          limite: 60,
          ...(ville.trim() === '' ? {} : { ville: ville.trim() }),
          ...(motsCles.length === 0 ? {} : { motsCles }),
        }),
      )
    } catch (e) {
      setErreur((e as Error).message)
      setResultats(null)
    } finally {
      setEnCours(false)
    }
  }, [ville, theme, mots])

  /* Les formations dont la position est publiée, seules à pouvoir figurer
     sur la carte. */
  const places: PointCarte[] = (resultats ?? [])
    .filter((f) => f.coordonnees !== null)
    .map((f) => ({
      cle: f.id,
      lat: f.coordonnees!.lat,
      lon: f.coordonnees!.lon,
      libelle: `${f.libelle} — ${f.etablissement}`,
    }))

  /* Une recherche déjà écrite dans l'adresse se relance toute seule, une
     seule fois. Sans le garde, `chercher` changeant à chaque frappe
     relancerait la requête à chaque caractère tapé. */
  const relancee = useRef(false)
  useEffect(() => {
    if (relancee.current) return
    relancee.current = true
    if (ville !== '' || theme !== '' || mots !== '') void chercher()
  }, [chercher, ville, theme, mots])

  return (
    <main className="app app-large">
      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: 'Chercher une école', route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      <h1 className="article-titre">Tu sais déjà où tu veux aller ?</h1>
      <p className="bloc-intro">
        Tape une ville, et regarde ce qui s’y trouve. Les formations, leurs établissements
        et leurs taux d’accès publiés — directement depuis l’open data du ministère.
      </p>

      <form
        className="recherche"
        role="search"
        onSubmit={(ev) => {
          ev.preventDefault()
          void chercher()
        }}
      >
        <div className="recherche-grille">
          <div>
            <label className="champ-label" htmlFor="ecoles-ville">
              Ville
            </label>
            <input
              id="ecoles-ville"
              type="search"
              className="recherche-champ"
              placeholder="Limoges, Toulouse, Saint-Étienne…"
              value={ville}
              onChange={(ev) => setVille(ev.target.value)}
              autoComplete="address-level2"
            />
          </div>
          <div>
            <label className="champ-label" htmlFor="ecoles-theme">
              Thème
            </label>
            <select
              id="ecoles-theme"
              className="recherche-champ"
              value={theme}
              onChange={(ev) => setTheme(ev.target.value)}
            >
              <option value="">Tous les thèmes</option>
              {THEMES.map((t) => (
                <option key={t.cle} value={t.cle}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="champ-label" htmlFor="ecoles-mots">
              Mots-clés <span className="note">(facultatif)</span>
            </label>
            <input
              id="ecoles-mots"
              type="search"
              className="recherche-champ"
              placeholder="droit, infirmier, informatique…"
              value={mots}
              onChange={(ev) => setMots(ev.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <button type="submit" className="principal" disabled={enCours}>
          {enCours ? 'Recherche…' : 'Chercher'}
        </button>
        {/* Dit d'où viennent les thèmes. Le ministère publie une filière
            « très agrégée » — BTS, Licence, CPGE — qui dit le TYPE de
            formation, pas sa discipline : « droit » ou « sport » n'existent
            nulle part dans ce jeu. Faire passer notre regroupement pour une
            nomenclature officielle serait un petit mensonge de plus. */}
        <p className="note recherche-mention">
          Les thèmes sont un regroupement de KitEtudiant.fr, pas une classification
          officielle : chacun cherche une liste de mots dans l’intitulé publié des
          formations. Une formation dont l’intitulé n’emploie pas ces mots n’y apparaîtra
          pas — d’où le champ de mots-clés à côté.
        </p>
      </form>

      {erreur !== null ? (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      ) : null}

      {resultats !== null ? (
        <>
          <p className="resume" role="status" aria-live="polite">
            {resultats.length === 0
              ? 'Aucune formation trouvée. Essaie une orthographe plus simple, ou moins de mots-clés.'
              : `${nombre(resultats.length)} formation${resultats.length > 1 ? 's' : ''} trouvée${resultats.length > 1 ? 's' : ''}.`}
          </p>

          {resultats.length > 0 ? (
            <>
              {/* Ce que cet écran ne peut pas dire, dit avant la liste et non
                  après : un élève qui fait défiler jusqu'en bas a déjà cru
                  que le site ne calculait rien. */}
              <div className="ecoles-rappel">
                <h3>Il manque le plus important</h3>
                <p>
                  Cette liste ne dit pas ce qu’il te <strong>restera pour vivre</strong> dans
                  chacune de ces villes. Ce montant dépend de ta bourse, de ton logement et
                  de ton budget — des choses que cette page ne connaît pas, et qu’elle
                  n’inventera pas.
                </p>
                <button type="button" className="principal" onClick={onCommencer}>
                  Répondre aux sept questions
                </button>
              </div>

              {/* La carte des résultats.
                  
                  Elle n'apparaît qu'à la demande, comme celle d'une fiche :
                  rien n'est demandé à l'IGN avant le clic, et le bouton le
                  dit avant, pas après.
                  
                  Les formations sans position publiée (0,27 % du jeu) ne s'y
                  trouvent pas, et le compte le dit. Les poser au centre de
                  leur commune ferait croire à une adresse. */}
              {places.length > 0 ? (
                <div className="ecoles-carte">
                  <CarteALaDemande
                    points={places}
                    hauteur={360}
                    libelleBouton={`Voir les ${nombre(places.length)} formations sur la carte`}
                    onPoint={(cle) => onNaviguer({ vue: 'formation', code: cle })}
                  />
                  {places.length < resultats.length ? (
                    <p className="note ecoles-carte-manquants">
                      {nombre(resultats.length - places.length)} formation
                      {resultats.length - places.length > 1 ? 's' : ''} sur{' '}
                      {nombre(resultats.length)} n’
                      {resultats.length - places.length > 1 ? 'ont' : 'a'} pas de position
                      publiée : elle{resultats.length - places.length > 1 ? 's ne figurent' : ' ne figure'}{' '}
                      pas sur la carte, mais bien dans la liste.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <ul className="ecoles">
                {resultats.map((f) => (
                  <Resultat formation={f} key={f.id} onNaviguer={onNaviguer} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
