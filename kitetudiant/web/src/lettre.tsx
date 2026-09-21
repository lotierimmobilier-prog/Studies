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

import { useCallback, useEffect, useMemo, useState } from 'react'

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
  assembler,
  chargerBrouillons,
  enregistrerBrouillons,
  longueur,
  poser,
  relire,
  type Brouillon,
  type Reponses,
} from './lettre.ts'
import { nombre } from './nombres.ts'
import {
  chercherVoeux,
  formationParCode,
  InscriptionRequise,
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

/** Les vœux enregistrés, avec leur intitulé résolu. Vide sans compte. */
function useVoeux(connecte: boolean): Voeu[] {
  const [voeux, setVoeux] = useState<Voeu[]>([])
  useEffect(() => {
    if (!connecte) return
    let vivant = true
    chercherVoeux()
      .then(async (liste: readonly VoeuEnregistre[]) => {
        const formations = await Promise.all(
          liste.map((v) => formationParCode(v.codeFormation).catch(() => null)),
        )
        if (!vivant) return
        setVoeux(
          liste.map((v, i) => {
            const f: Formation | null = formations[i] ?? null
            return {
              code: v.codeFormation,
              libelle: f?.libelle ?? `Formation ${v.codeFormation}`,
              etablissement: f?.etablissement ?? '',
            }
          }),
        )
      })
      .catch((e: unknown) => {
        // Pas de compte, ou le serveur ne sait pas encore enregistrer de vœux :
        // l'atelier marche quand même, sur un brouillon libre.
        if (!(e instanceof InscriptionRequise)) return
      })
    return () => {
      vivant = false
    }
  }, [connecte])
  return voeux
}

export function AtelierLettre({ connecte }: { readonly connecte: boolean }) {
  const voeux = useVoeux(connecte)
  const [brouillons, setBrouillons] = useState<Brouillon[]>([])
  const [courant, setCourant] = useState<string>(SANS_VOEU)
  const [ifsi, setIfsi] = useState(false)
  const [aides, setAides] = useState(false)
  const [nomSaisi, setNomSaisi] = useState('')

  useEffect(() => {
    setBrouillons(chargerBrouillons())
    setNomSaisi(lireIdentite())
  }, [])

  const identite = useMemo(
    () => nomSaisi.split(/\s+/).filter((m) => m.trim() !== ''),
    [nomSaisi],
  )

  const brouillon = useMemo(
    () => brouillons.find((b) => b.codeFormation === courant) ?? vide(courant),
    [brouillons, courant],
  )

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

  const repondre = useCallback(
    (cle: string, valeur: string) => {
      const reponses: Reponses = { ...brouillon.reponses, [cle]: valeur }
      enregistrer({
        ...brouillon,
        reponses,
        // Tant que l'élève n'a pas retouché le texte assemblé, il suit ses
        // réponses. Dès qu'il y touche, ses corrections ne sont plus écrasées.
        texte: brouillon.texte === assembler(brouillon.reponses) ? assembler(reponses) : brouillon.texte,
        modifieLe: new Date().toISOString(),
      })
    },
    [brouillon, enregistrer],
  )

  const l = longueur(brouillon.texte, ifsi)
  const remarques = relire(brouillon, { identite, ifsi, autres: brouillons })
  const assemble = assembler(brouillon.reponses)
  const desynchronise = brouillon.texte !== assemble && assemble !== ''


  return (
    <section className="lettre">
      <h2>Ta lettre de motivation</h2>
      <p className="lettre-chapeau">
        Sur Parcoursup, certaines formations demandent d’expliquer en quelques lignes ce
        qui te motive. Cet atelier te pose les questions de la fiche du ministère, et
        range tes réponses. <strong>Les phrases restent les tiennes</strong> : rien ici
        n’écrit à ta place.
      </p>

      {/* La phrase du ministère, citée sans retouche. C'est un avertissement
          que l'État adresse à l'élève ; l'adoucir serait le lui cacher. */}
      <blockquote className="lettre-avertissement">
        <p>{AVERTISSEMENT_IA}</p>
        <cite>
          {SOURCE_LETTRE} ({MILLESIME_LETTRE})
        </cite>
      </blockquote>

      {/* ------------------------------------------------ le choix du vœu */}
      <div className="lettre-voeu">
        <label className="champ-label" htmlFor="lettre-formation">
          Pour quelle formation ?
        </label>
        <select
          id="lettre-formation"
          className="recherche-champ"
          value={courant}
          onChange={(ev) => setCourant(ev.target.value)}
        >
          <option value={SANS_VOEU}>Un brouillon, sans vœu rattaché</option>
          {voeux.map((v) => (
            <option key={v.code} value={v.code}>
              {v.libelle}
              {v.etablissement === '' ? '' : ` — ${v.etablissement}`}
            </option>
          ))}
        </select>
        <p className="note">
          Un texte par formation. La fiche est nette : « Pas de copier/coller ! » — c’est
          ce qui se repère le plus vite à la lecture de deux dossiers.
        </p>
      </div>

      {/* Le prénom ne sert qu'à être cherché dans le texte : la fiche demande
          « d'éviter absolument de mentionner votre identité ». Il ne quitte
          pas ce navigateur, et l'atelier fonctionne sans. */}
      <div className="lettre-identite">
        <label className="champ-label" htmlFor="lettre-nom">
          Ton prénom et ton nom <span className="note">(facultatif)</span>
        </label>
        <input
          id="lettre-nom"
          type="text"
          className="recherche-champ"
          autoComplete="off"
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
          Uniquement pour vérifier qu’ils n’apparaissent pas dans ta lettre — la fiche
          l’interdit. Rien n’est envoyé : ces deux mots restent dans ce navigateur.
        </p>
      </div>

      <label className="lettre-ifsi">
        <input type="checkbox" checked={ifsi} onChange={(ev) => setIfsi(ev.target.checked)} />
        <span>
          C’est un IFSI (soins infirmiers) — la limite passe à{' '}
          {nombre(LONGUEUR.ifsi)} caractères
        </span>
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

      {/* ------------------------------------------------- les questions */}
      <h3 className="lettre-titre">Les questions de la fiche</h3>
      <ol className="lettre-questions">
        {QUESTIONS.map((q) => (
          <li key={q.cle} className="lettre-question">
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
            <p className="note">{q.pourquoi}</p>
            <details className="lettre-pistes">
              <summary>Des pistes, si tu sèches</summary>
              <ul>
                {q.pistes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="note">
                Ce sont des directions, pas des phrases à recopier : une formule reprise
                telle quelle par des milliers de candidats se repère autant qu’un texte
                de machine.
              </p>
            </details>
          </li>
        ))}
      </ol>

      {/* ---------------------------------------------------- le brouillon */}
      <h3 className="lettre-titre">Ton brouillon</h3>
      <p className="note">
        Le texte ci-dessous est fait de tes réponses, dans l’ordre du plan que la fiche
        recommande : une introduction d’une phrase, un développement, une phrase de
        conclusion. Tu peux le réécrire entièrement — c’est même le but.
      </p>
      {desynchronise ? (
        <p className="note lettre-desync">
          Tu as retouché le texte à la main : tes réponses ne l’écrasent plus.{' '}
          <button
            type="button"
            className="lien"
            onClick={() =>
              enregistrer({ ...brouillon, texte: assemble, modifieLe: new Date().toISOString() })
            }
          >
            Repartir de mes réponses
          </button>
        </p>
      ) : null}
      <textarea
        className="lettre-texte"
        rows={12}
        value={brouillon.texte}
        aria-describedby="lettre-compteur"
        onChange={(ev) =>
          enregistrer({ ...brouillon, texte: ev.target.value, modifieLe: new Date().toISOString() })
        }
      />
      <p id="lettre-compteur" className={`lettre-compteur${l.depasse ? ' depasse' : ''}`}>
        <strong>{nombre(l.caracteres)}</strong> caractères sur {nombre(l.limite)}
        {l.depasse ? ` — ${nombre(-l.restants)} de trop` : ` — il t’en reste ${nombre(l.restants)}`}
        <span className="note"> · {LONGUEUR.mots} environ</span>
      </p>

      {/* ------------------------------------------ la relecture de Jean-Paul */}
      <h3 className="lettre-titre">Ce que Jean-Paul a vérifié</h3>
      <p className="note">
        Jean-Paul est une machine, pas un professeur. Il compte, il compare, il cherche
        ton prénom — il ne juge pas ce que tu as écrit, et n’en tire aucune note.
      </p>
      {remarques.length === 0 ? (
        <p className="lettre-ok">
          {brouillon.texte.trim() === ''
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

      {/* ------------------------------------------------ avant de recopier */}
      <h3 className="lettre-titre">Avant de recopier dans Parcoursup</h3>
      <ul className="lettre-relecture">
        {RELECTURE.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="note">{CALENDRIER}</p>

      {/* ----------------------------------------- les aides du ministère */}
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
      </details>

      <p className="lettre-source">
        Tout le contenu de cette page vient de la {SOURCE_LETTRE.toLowerCase()},{' '}
        {MILLESIME_LETTRE}. Ton brouillon reste dans ce navigateur : il n’est envoyé
        nulle part, pas même avec tes vœux.
      </p>
    </section>
  )
}
