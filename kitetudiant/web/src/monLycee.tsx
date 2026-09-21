/**
 * La question « quel est ton lycée ? », et les résultats publiés qui suivent.
 *
 * ── À quoi ça sert, et à quoi ça ne sert pas ─────────────────────────────
 *
 * À SE SITUER. Un élève ne sait pas si sa moyenne de 13 le place au-dessus
 * ou en dessous de sa promotion, et personne ne le lui dit. Les résultats
 * publiés de son lycée répondent à cette question-là.
 *
 * Ils n'entrent dans AUCUN calcul du site. Ils ne modifient ni les chances
 * d'admission, ni l'adéquation, ni le reste-à-vivre : ils ne figurent même
 * pas dans les structures que ces calculs reçoivent. Cette garantie n'est
 * pas une promesse de bonne conduite, c'est une impossibilité d'accès.
 *
 * ── Ce que l'écran dit, et qu'il faut dire ───────────────────────────────
 *
 * Que ces chiffres décrivent une PROMOTION, pas un élève. Un lycée où la
 * moitié sort sans mention n'empêche personne d'avoir une mention très bien.
 * Sans cette phrase, un élève d'un lycée à faibles résultats lit ces barres
 * comme un pronostic sur lui — ce qu'elles ne sont pas, et ce que le site
 * s'interdit d'écrire.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  SOURCE_LYCEES,
  chercherLycees,
  mentionsDuLycee,
  repartition,
  type Lycee,
  type MentionsLycee,
} from './lycees.ts'
import { nombre } from './nombres.ts'

export function MonLycee({
  uai,
  nom,
  onChoisir,
}: {
  readonly uai: string | null
  readonly nom: string | null
  readonly onChoisir: (choix: { uai: string; nom: string } | null) => void
}) {
  const [saisie, setSaisie] = useState('')
  const [propositions, setPropositions] = useState<Lycee[]>([])
  const [mentions, setMentions] = useState<MentionsLycee | null>(null)
  const [cherche, setCherche] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const chercher = useCallback(async (texte: string) => {
    setErreur(null)
    if (texte.trim().length < 3) {
      setPropositions([])
      return
    }
    setCherche(true)
    try {
      setPropositions(await chercherLycees(texte))
    } catch (e) {
      setErreur((e as Error).message)
      setPropositions([])
    } finally {
      setCherche(false)
    }
  }, [])

  // Les résultats se chargent quand un lycée est retenu, pas avant : chaque
  // frappe déclencherait sinon une requête pour rien.
  useEffect(() => {
    if (uai === null) {
      setMentions(null)
      return
    }
    let vivant = true
    void mentionsDuLycee(uai).then((m) => {
      if (vivant) setMentions(m)
    })
    return () => {
      vivant = false
    }
  }, [uai])

  const parts = mentions === null ? [] : repartition(mentions)

  return (
    <div className="lycee">
      {uai === null ? (
        <>
          <label className="champ-label" htmlFor="lycee-recherche">
            Ton lycée <span className="note">(facultatif)</span>
          </label>
          <div className="recherche-ligne">
            <input
              id="lycee-recherche"
              type="search"
              className="recherche-champ"
              placeholder="Commence à taper son nom…"
              value={saisie}
              onChange={(ev) => {
                setSaisie(ev.target.value)
                void chercher(ev.target.value)
              }}
              autoComplete="off"
            />
          </div>
          <p className="note">
            Sert uniquement à te situer par rapport à ta promotion. Ton lycée n’entre dans
            aucun calcul du site, et rien n’est enregistré : tout reste dans ton navigateur.
          </p>

          {erreur !== null ? <p className="erreur">{erreur}</p> : null}
          {cherche ? <p className="note">Recherche…</p> : null}

          {propositions.length > 0 ? (
            <ul className="lycee-propositions">
              {propositions.slice(0, 8).map((l) => (
                <li key={l.uai}>
                  <button
                    type="button"
                    className="lycee-proposition"
                    onClick={() => {
                      onChoisir({ uai: l.uai, nom: l.nom })
                      setPropositions([])
                      setSaisie('')
                    }}
                  >
                    {/* La ville d'abord : « Lycée Jean-Moulin » existe dans
                        onze communes, et c'est la sienne que l'élève
                        reconnaît. L'UAI reste, en dernier — c'est la clé
                        pivot, et elle départage deux homonymes d'une même
                        ville. */}
                    {l.nom}
                    <span className="note">
                      {l.ville !== '' ? (
                        <>
                          {' '}
                          · {l.ville}
                          {l.departement !== '' ? ` (${l.departement})` : ''}
                        </>
                      ) : null}{' '}
                      · UAI {l.uai}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="lycee-choisi">
          <p className="lycee-nom">
            {nom ?? uai}
            <button type="button" className="lycee-changer" onClick={() => onChoisir(null)}>
              Changer
            </button>
          </p>

          {mentions === null ? (
            <p className="note">Chargement des résultats publiés…</p>
          ) : parts.length === 0 ? (
            /* Une absence s'affiche comme une absence : ce lycée n'a pas de
               ligne exploitable, et on ne fabrique pas de barres à zéro. */
            <p className="note">
              Aucun résultat publié pour cet établissement dans le jeu du ministère.
            </p>
          ) : (
            <>
              <h4 className="lycee-titre">Les mentions obtenues dans ton lycée</h4>
              <ul className="lycee-mentions">
                {parts.map((p) => (
                  <li key={p.libelle}>
                    <span className="lycee-mention-libelle">{p.libelle}</span>
                    <span className="lycee-barre">
                      <span style={{ width: `${p.pourcentage}%` }} />
                    </span>
                    <span className="lycee-mention-part">{p.pourcentage} %</span>
                  </li>
                ))}
              </ul>
              <p className="note">
                Sur {nombre(mentions.presents)} candidats présents, {mentions.tauxReussite} %
                ont eu le bac. Ces chiffres décrivent une <strong>promotion</strong>, pas un
                élève : un lycée où beaucoup sortent sans mention n’empêche personne d’en
                avoir une.
              </p>
              <p className="note">
                {SOURCE_LYCEES}, session {mentions.annee}. UAI {mentions.uai}.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
