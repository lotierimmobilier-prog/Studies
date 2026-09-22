/**
 * L'atelier de lettre de motivation.
 *
 * ── Ce que Jean-Paul fait ici, et ce qu'il ne fait pas ────────────────────
 *
 * IL NE RÉDIGE RIEN. Pas une phrase, pas une transition, pas une formule de
 * politesse. La fiche du ministère, citée en tête de l'écran, dit « évitez
 * absolument le recours à des logiciels de type ChatGPT ou équivalent » : un
 * site qui affiche cet avertissement et compose la lettre à côté se
 * contredirait à deux centimètres d'intervalle, et ferait courir à l'élève
 * exactement le risque dont la fiche le prévient.
 *
 * Il POSE LES QUESTIONS de la fiche, une par une, et il RELIT : il compte les
 * caractères, cherche le prénom que la fiche interdit, repère les questions
 * restées vides et deux brouillons trop semblables. Des constats vérifiables,
 * jamais une appréciation sur le fond — « ta motivation est peu
 * convaincante » serait un jugement de machine sur un mineur.
 *
 * Rien de ce qui est écrit ici ne quitte le navigateur (règle 3).
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import {
  AVERTISSEMENT_IA,
  CALENDRIER,
  CAS_IFSI,
  FORMULATIONS,
  LONGUEUR,
  MILLESIME_LETTRE,
  QUESTIONS,
  RELECTURE,
  SOURCE_LETTRE,
  SYNONYMES,
} from '../../packages/articles/src/lettreMotivation.ts'
import {
  amorceFormation,
  assembler,
  avancement,
  avecAmorce,
  chargerBrouillons,
  enregistrerBrouillons,
  QUESTION_PREREMPLIE,
  longueur,
  messageDeChargement,
  poser,
  relire,
  type Brouillon,
  type Reponses,
} from './lettre.ts'
import { nombre } from './nombres.ts'
import {
  chercherVoeux,
  formationParCode,
  type Formation,
  type Voeu as VoeuEnregistre,
} from './donnees.ts'

/** Le brouillon vide d'une formation. */
function vide(codeFormation: string): Brouillon {
  return { codeFormation, reponses: {}, texte: '', modifieLe: new Date().toISOString() }
}

/* Sans vœu enregistré, l'atelier sert quand même : beaucoup d'élèves écrivent
   leur lettre avant d'avoir créé un compte ici. Ce code désigne ce
   brouillon-là, et il ne peut pas entrer en collision avec un `cod_aff_form`,
   qui est toujours numérique. */
const SANS_VOEU = 'brouillon-libre'

export interface Voeu {
  readonly code: string
  readonly libelle: string
  readonly etablissement: string
}

/* Le prénom sert UNIQUEMENT à le chercher dans le brouillon, parce que la
   fiche interdit de le faire figurer. Il est demandé ici plutôt que lu sur le
   compte : l'atelier s'ouvre sans être connecté, et une identité de mineur
   qui ne traverse aucun réseau est une identité qui ne fuit pas (règle 3). */
const CLE_IDENTITE = 'kitetudiant.lettre.identite'

function lireIdentite(): string {
  try {
    return window.localStorage.getItem(CLE_IDENTITE) ?? ''
  } catch {
    return ''
  }
}

/**
 * Les vœux enregistrés, avec leur intitulé résolu.
 *
 * Rend aussi la RAISON d'une liste vide. Le premier jet avalait toutes les
 * erreurs — `if (!(e instanceof InscriptionRequise)) return` ne fait rien dans
 * l'une ni l'autre branche — et une panne de l'API se présentait exactement
 * comme « tu n'as aucun vœu ». Une donnée manquante s'affiche comme manquante
 * (CLAUDE.md), pas comme une absence de données.
 */
function useVoeux(connecte: boolean): { voeux: Voeu[]; panne: string | null } {
  const [voeux, setVoeux] = useState<Voeu[]>([])
  const [panne, setPanne] = useState<string | null>(null)
  useEffect(() => {
    if (!connecte) return
    let vivant = true
    chercherVoeux()
      .then(async (liste: readonly VoeuEnregistre[]) => {
        const formations = await Promise.all(
          liste.map((v) => formationParCode(v.codeFormation).catch(() => null)),
        )
        if (!vivant) return
        setPanne(null)
        setVoeux(
          liste.map((v, i) => {
            const f: Formation | null = formations[i] ?? null
            return {
              code: v.codeFormation,
              // Un intitulé introuvable ne devient pas une absence : le code
              // reste affiché, pour que l'élève reconnaisse quand même sa ligne.
              libelle: f?.libelle ?? `Formation ${v.codeFormation}`,
              etablissement: f?.etablissement ?? '',
            }
          }),
        )
      })
      .catch((e: unknown) => {
        if (!vivant) return
        // La décision vit dans `messageDeChargement`, pour être testée : un
        // `catch` qui redeviendrait muet ne se verrait pas autrement.
        setPanne(messageDeChargement(e))
      })
    return () => {
      vivant = false
    }
  }, [connecte])
  return { voeux, panne }
}

export function AtelierLettre({ connecte }: { readonly connecte: boolean }) {
  const { voeux, panne } = useVoeux(connecte)
  const [brouillons, setBrouillons] = useState<Brouillon[]>([])
  const [courant, setCourant] = useState<string>(SANS_VOEU)
  const [ifsi, setIfsi] = useState(false)
  const [aides, setAides] = useState(false)
  const [nomSaisi, setNomSaisi] = useState('')

  useEffect(() => {
    setBrouillons(chargerBrouillons())
    setNomSaisi(lireIdentite())
  }, [])

  /* Le premier vœu, dès que la liste arrive.
     Ouvrir sur « brouillon sans vœu » quand l'élève en a dix revient à lui
     demander de choisir avant de pouvoir commencer — et à perdre le
     pré-remplissage, qui dépend justement du vœu. On ne bouscule pas un choix
     déjà fait : seulement l'état initial. */
  const [voeuChoisi, setVoeuChoisi] = useState(false)
  useEffect(() => {
    if (voeuChoisi || voeux.length === 0) return
    setCourant(voeux[0]!.code)
  }, [voeux, voeuChoisi])

  const identite = useMemo(
    () => nomSaisi.split(/\s+/).filter((m) => m.trim() !== ''),
    [nomSaisi],
  )

  /* L'intitulé exact du vœu, la seule chose que le site peut pré-remplir :
     c'est une donnée de l'open data Parcoursup, pas une phrase. Voir
     `amorceFormation` dans lettre.ts. */
  const amorce = useMemo(() => {
    const v = voeux.find((x) => x.code === courant)
    return v === undefined ? '' : amorceFormation(v.libelle, v.etablissement)
  }, [voeux, courant])

  const brouillon = useMemo(() => {
    const trouve = brouillons.find((b) => b.codeFormation === courant) ?? vide(courant)
    return { ...trouve, reponses: avecAmorce(trouve.reponses, amorce) }
  }, [brouillons, courant, amorce])

  const avance = avancement(brouillon.reponses)

  const enregistrer = useCallback(
    (suivant: Brouillon) => {
      setBrouillons((precedents) => {
        const liste = poser(precedents, suivant)
        enregistrerBrouillons(liste)
        return liste
      })
    },
    [],
  )

  const assemble = assembler(brouillon.reponses)

  /* Un texte VIDE suit les réponses, il n'en diverge pas.
   *
   * Sans cette règle, le pré-remplissage cassait tout : à l'ouverture,
   * `texte` valait la chaîne vide et l'assemblage valait déjà l'intitulé du
   * vœu. La page annonçait donc « tu as retouché le texte à la main » à
   * quelqu'un qui n'avait rien écrit, et le brouillon ne se remplissait plus
   * jamais — chaque réponse suivante était considérée comme une divergence.
   */
  const suitLesReponses = brouillon.texte === '' || brouillon.texte === assemble
  const texteCourant = suitLesReponses ? assemble : brouillon.texte
  const desynchronise = !suitLesReponses && assemble !== ''

  const repondre = useCallback(
    (cle: string, valeur: string) => {
      const reponses: Reponses = { ...brouillon.reponses, [cle]: valeur }
      enregistrer({
        ...brouillon,
        reponses,
        // Tant que l'élève n'a pas retouché le texte assemblé, il suit ses
        // réponses. Dès qu'il y touche, ses corrections ne sont plus écrasées.
        texte: suitLesReponses ? assembler(reponses) : brouillon.texte,
        modifieLe: new Date().toISOString(),
      })
    },
    [brouillon, enregistrer, suitLesReponses],
  )

  /* La longueur et la relecture portent sur ce qui est À L'ÉCRAN, et non sur
     le champ enregistré : sinon un brouillon jamais retouché serait compté
     pour zéro caractère alors qu'il en affiche trois cents. */
  const l = longueur(texteCourant, ifsi)
  const remarques = relire(
    { ...brouillon, texte: texteCourant },
    { identite, ifsi, autres: brouillons },
  )


  return (
    <section className="lettre">
      {/* ------------------------------------------------------ l'en-tête */}
      <header className="lettre-tete">
        <h2>Ta lettre de motivation</h2>
        {/* Deux lignes, pas cinq.
            Sur un téléphone, le chapô précédent occupait un tiers du premier
            écran, et la première question n'arrivait qu'après trois défilements.
            Ce qu'il disait d'essentiel — le site n'écrit pas à ta place — tient
            en une phrase ; le reste se découvre en faisant. */}
        <p className="lettre-chapeau">
          Les questions de la fiche du ministère, dans l’ordre.{' '}
          <strong>Les phrases restent les tiennes</strong> : rien ici n’écrit à ta place.
        </p>

        {/* La phrase du ministère, citée sans retouche. C'est un avertissement
            que l'État adresse à l'élève ; l'adoucir serait le lui cacher, et le
            replier reviendrait au même sur la seule page où il compte.

            Il est resserré, pas allégé : c'était le bloc le plus lourd de la
            page, posé avant qu'on sache de quoi il parle. Il garde son trait,
            sa source et son texte entier — il cesse seulement d'écraser la
            première question. */}
        <blockquote className="lettre-avertissement">
          <p>{AVERTISSEMENT_IA}</p>
          <cite>
            {SOURCE_LETTRE} ({MILLESIME_LETTRE})
          </cite>
        </blockquote>
      </header>

      {/* ------------------------------------------------------ les réglages */}
      {/* Le vœu et la limite de longueur sont deux RÉGLAGES, pas deux étapes.
          Empilés pleine largeur, ils se lisaient comme le début du parcours et
          repoussaient la première question d'un écran. Réunis sur une ligne,
          ils redeviennent ce qu'ils sont : un choix qu'on fait une fois. */}
      <div className="lettre-barre">
        <div className="lettre-voeu">
          <label className="champ-label" htmlFor="lettre-formation">
            Pour quelle formation ?
          </label>
          <select
            id="lettre-formation"
            className="recherche-champ"
            value={courant}
            onChange={(ev) => {
              setVoeuChoisi(true)
              setCourant(ev.target.value)
            }}
          >
            {/* Les vœux d'abord, le brouillon libre en dernier : quand il y en a,
                c'est l'un d'eux qu'on vient écrire. Le brouillon sans vœu reste
                pour qui prépare sa lettre avant d'avoir un compte. */}
            {voeux.map((v) => (
              <option key={v.code} value={v.code}>
                {v.libelle}
                {v.etablissement === '' ? '' : ` — ${v.etablissement}`}
              </option>
            ))}
            <option value={SANS_VOEU}>Un brouillon, sans vœu rattaché</option>
          </select>
          {panne === null ? null : <p className="erreur">{panne}</p>}
          <p className="note">
            Un texte par formation. La fiche est nette : « Pas de copier/coller ! » —
            c’est ce qui se repère le plus vite à la lecture de deux dossiers.
          </p>
        </div>

        {/* La longueur dépend du type de formation : c'est un réglage, pas une
            question. Replié, il ne coupe plus la page en deux avant la
            première question. */}
        <details className="lettre-reglages">
          <summary>C’est un IFSI (soins infirmiers) ?</summary>
          <label className="lettre-ifsi">
            <input
              type="checkbox"
              checked={ifsi}
              onChange={(ev) => setIfsi(ev.target.checked)}
            />
            <span>Oui — la limite passe à {nombre(LONGUEUR.ifsi)} caractères</span>
          </label>
          {ifsi ? (
            <div className="lettre-ifsi-detail">
              <h3>{CAS_IFSI.titre}</h3>
              <ul>
                {CAS_IFSI.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </details>
      </div>

      {/* ------------------------------------------------------- l'atelier */}
      {/* Deux colonnes sur grand écran, et c'est le cœur de cette page.

          Avant : six questions, puis le brouillon tout en bas. On répondait à
          tout sans jamais voir sa lettre se former, et le compteur — la seule
          chose qui dit si l'on tient dans les 1 500 caractères — vivait à six
          défilements de l'endroit où l'on tape. Pendant ce temps la moitié
          droite de l'écran restait vide.

          Maintenant le brouillon, son compteur et la relecture sont collés à
          droite : chaque phrase écrite à gauche s'y ajoute sous les yeux.

          L'ORDRE DU CODE NE CHANGE PAS — questions, puis brouillon, puis
          relecture. C'est la grille qui déplace la colonne, pas le DOM : un
          lecteur d'écran et un téléphone gardent l'ordre du parcours. */}
      <div className="lettre-atelier">
        <div className="lettre-colonne">
          <h3 className="lettre-titre">Les questions de la fiche</h3>
          {/* Six questions, c'est long quand on ne voit pas la fin. Dire où on
              en est coûte une ligne et transforme une liste en parcours. */}
          <p className="lettre-avancement">
            {avance.remplies === 0 ? (
              <>
                Commence par la question que tu veux : l’ordre n’a pas d’importance, et
                tout est gardé si tu t’arrêtes.
              </>
            ) : (
              <>
                {/* « 0 sur 6 question remplie » ne se dit pas. Le nombre porte
                    son nom, accordé, et le cas zéro a sa propre phrase. */}
                <strong>
                  {avance.remplies} question{avance.remplies > 1 ? 's' : ''} sur{' '}
                  {avance.total}
                </strong>{' '}
                {avance.remplies === avance.total
                  ? 'Ton brouillon est prêt à relire.'
                  : 'Tu peux t’arrêter et revenir : tout est gardé.'}
              </>
            )}
          </p>
          {/* La même information, en un coup d'œil. `aria-hidden` parce que la
              phrase juste au-dessus la dit déjà : la répéter ferait annoncer
              six fois « rempli, vide » à un lecteur d'écran. */}
          <ol className="lettre-jauge" aria-hidden="true">
            {QUESTIONS.map((q) => (
              <li
                key={q.cle}
                className={
                  (brouillon.reponses[q.cle] ?? '').trim() === ''
                    ? 'lettre-cran'
                    : 'lettre-cran rempli'
                }
              />
            ))}
          </ol>

          <ol className="lettre-questions">
            {QUESTIONS.map((q, i) => (
              <li key={q.cle} className="lettre-question">
                {/* Le numéro était celui d'une liste ordinaire : gris, minuscule,
                    perdu dans la marge. En pastille, il dit d'un coup d'œil
                    combien il en reste — et il marque celles qui sont faites. */}
                <span
                  className={
                    (brouillon.reponses[q.cle] ?? '').trim() === ''
                      ? 'lettre-numero'
                      : 'lettre-numero rempli'
                  }
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <label className="champ-label" htmlFor={`q-${q.cle}`}>
                  {q.question}
                </label>
                <textarea
                  id={`q-${q.cle}`}
                  className="lettre-champ"
                  rows={3}
                  value={brouillon.reponses[q.cle] ?? ''}
                  onChange={(ev) => repondre(q.cle, ev.target.value)}
                />
                {q.cle === QUESTION_PREREMPLIE && amorce !== '' &&
                (brouillon.reponses[q.cle] ?? '') === amorce ? (
                  <p className="note lettre-prerempli">
                    Rempli avec l’intitulé exact de ton vœu, tel que Parcoursup le
                    publie — la fiche le demande. À compléter et à réécrire : c’est un
                    début de phrase, pas une phrase.
                  </p>
                ) : null}
                <p className="note lettre-pourquoi">{q.pourquoi}</p>
                <details className="lettre-pistes">
                  <summary>Des pistes, si tu sèches</summary>
                  <ul>
                    {q.pistes.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <p className="note">
                    Ce sont des directions, pas des phrases à recopier : une formule
                    reprise telle quelle par des milliers de candidats se repère autant
                    qu’un texte de machine.
                  </p>
                </details>
              </li>
            ))}
          </ol>
        </div>

        {/* ------------------------------------------------- le brouillon */}
        <aside className="lettre-colonne lettre-sortie">
          <div className="lettre-sortie-collee">
            <h3 className="lettre-titre">Ton brouillon</h3>
            <p className="note">
              Fait de tes réponses, dans l’ordre du plan que la fiche recommande : une
              introduction d’une phrase, un développement, une conclusion. Tu peux le
              réécrire entièrement — c’est même le but.
            </p>
            {desynchronise ? (
              <p className="note lettre-desync">
                Tu as retouché le texte à la main : tes réponses ne l’écrasent plus.{' '}
                <button
                  type="button"
                  className="lien"
                  onClick={() =>
                    enregistrer({
                      ...brouillon,
                      texte: assemble,
                      modifieLe: new Date().toISOString(),
                    })
                  }
                >
                  Repartir de mes réponses
                </button>
              </p>
            ) : null}
            <textarea
              className="lettre-texte"
              rows={12}
              value={texteCourant}
              aria-describedby="lettre-compteur"
              onChange={(ev) =>
                enregistrer({
                  ...brouillon,
                  texte: ev.target.value,
                  modifieLe: new Date().toISOString(),
                })
              }
            />
            {/* Le compteur porte une jauge : « 1 210 sur 1 500 » demande un
                calcul, une barre qui se remplit n'en demande aucun. Le chiffre
                reste — c'est lui qui est exact, et lui que la jauge illustre. */}
            <p
              id="lettre-compteur"
              className={`lettre-compteur${l.depasse ? ' depasse' : ''}`}
            >
              <span
                className="lettre-remplissage"
                aria-hidden="true"
                style={{
                  // Bornée à 100 % : au-delà, c'est la couleur et la phrase qui
                  // disent le dépassement, pas une barre qui sort du cadre.
                  '--part': `${Math.min(100, Math.round((l.caracteres / l.limite) * 100))}%`,
                } as CSSProperties}
              />
              <strong>{nombre(l.caracteres)}</strong> caractères sur {nombre(l.limite)}
              {l.depasse
                ? ` — ${nombre(-l.restants)} de trop`
                : ` — il t’en reste ${nombre(l.restants)}`}
              <span className="note"> · {LONGUEUR.mots} environ</span>
            </p>

            {/* --------------------------------- la relecture de Jean-Paul */}
            <h3 className="lettre-titre">Ce que Jean-Paul a vérifié</h3>
            <p className="note">
              Jean-Paul est une machine, pas un professeur. Il compte, il compare, il
              cherche ton prénom — il ne juge pas ce que tu as écrit, et n’en tire
              aucune note.
            </p>

            {remarques.length === 0 ? (
              <p className="lettre-ok">
                {texteCourant.trim() === ''
                  ? 'Rien à vérifier pour l’instant : commence par répondre aux questions.'
                  : 'Rien à signaler. Fais relire par un proche ou un professeur, la fiche le recommande.'}
              </p>
            ) : (
              <ul className="lettre-remarques">
                {remarques.map((r) => (
                  <li key={r.cle} className={`lettre-remarque ${r.gravite}`}>
                    {r.texte}
                  </li>
                ))}
              </ul>
            )}

            {/* Le prénom est descendu ici, à côté de ce qu'il sert à faire.
                En tête de page, c'était un champ de plus à franchir avant la
                première question, et on ne comprenait pas pourquoi un site qui
                répète ne rien demander demandait un nom. */}
            <details className="lettre-identite">
              <summary>Donner mon prénom, pour qu’il le cherche</summary>
              <label className="champ-label" htmlFor="lettre-nom">
                Ton prénom et ton nom <span className="note">(facultatif)</span>
              </label>
              <input
                id="lettre-nom"
                type="text"
                className="recherche-champ"
                autoComplete="off"
                placeholder="pour que Jean-Paul les cherche dans ton texte"
                value={nomSaisi}
                onChange={(ev) => {
                  setNomSaisi(ev.target.value)
                  try {
                    window.localStorage.setItem(CLE_IDENTITE, ev.target.value)
                  } catch {
                    // Stockage refusé : la vérification marchera pour cette session.
                  }
                }}
              />
              <p className="note">
                La fiche interdit de faire figurer son identité dans la lettre. Ces deux
                mots restent dans ce navigateur et ne sont envoyés nulle part.
              </p>
            </details>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------ avant de recopier */}
      <div className="lettre-fin">
        <h3 className="lettre-titre">Avant de recopier dans Parcoursup</h3>
        <ul className="lettre-relecture">
          {RELECTURE.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="note">{CALENDRIER}</p>

        {/* ----------------------------------- les aides du ministère */}
        <details
          className="lettre-aides"
          open={aides}
          onToggle={(ev) => setAides((ev.target as HTMLDetailsElement).open)}
        >
          <summary>Les aides à la formulation publiées par le ministère</summary>
          <p className="note">
            Ces listes viennent de la fiche. Elles servent à sortir d’une phrase qui
            coince, pas à composer la lettre : une expression est un point de départ, la
            suite est à toi.
          </p>
          <div className="lettre-aides-grille">
            {FORMULATIONS.map((f) => (
              <div key={f.titre} className="lettre-aide">
                <h4>{f.titre}</h4>
                <ul>
                  {f.expressions.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="lettre-aide">
              <h4>Éviter de répéter le même mot</h4>
              <ul>
                {Object.entries(SYNONYMES).map(([mot, syn]) => (
                  <li key={mot}>
                    <strong>{mot}</strong> — {syn.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>

        <p className="lettre-source">
          Tout le contenu de cette page vient de la {SOURCE_LETTRE.toLowerCase()},{' '}
          {MILLESIME_LETTRE}. Ton brouillon reste dans ce navigateur : il n’est envoyé
          nulle part, pas même avec tes vœux.
        </p>
      </div>
    </section>
  )
}
