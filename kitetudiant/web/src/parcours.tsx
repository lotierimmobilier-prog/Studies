/**
 * Le parcours en sept questions.
 *
 * Chaque question sert au calcul : on ne demande rien qu'on n'utilise pas,
 * parce que le premier résultat doit arriver vite et parce que les données
 * concernent des mineurs.
 */

import { useState } from 'react'

import {
  DOMAINES,
  LIBELLES_DOMAINE,
  LIBELLES_MATIERE,
  MATIERES,
  moyenneGenerale,
  type Domaine,
  type Matiere,
} from '../../packages/profil-scolaire/src/index.ts'
import type { EchelonBourse } from '../../packages/budget-engine/src/types.ts'
import {
  AIDES_FAMILLE,
  JOBS_ETUDIANTS,
  TRAINS_DE_VIE,
  aideFamilleCourante,
  depensesDeclarees,
  jobCourant,
  trainDeVieCourant,
  valeursDe,
} from './budgetSimple.ts'
import type { Reponses } from './calcul.ts'
import { lireBulletin } from './donnees.ts'
import { moyennesCumulees, progressionConstatee, type BulletinDepose } from './calcul.ts'

export const REPONSES_PAR_DEFAUT: Reponses = {
  typeBac: 'general',
  notes: {},
  notesImportees: false,
  bulletins: [],
  matierePreferee: null,
  passions: [],
  motivation: 7,
  signaux: null,
  villeResidence: '',
  mobilite: 'france',
  filiere: '',
  academie: null,
  echelonBourse: null,
  echelonInconnu: false,
  anneeNaissance: new Date().getFullYear() - 18,
  // Ces valeurs correspondent exactement à « Un petit coup de main »,
  // « Pendant les vacances seulement » et « Comme la plupart » : le parcours
  // s'ouvre donc sur trois choix mis en évidence, jamais sur un état
  // « ajusté à la main » que personne n'a demandé.
  contributionFamiliale: 100,
  jobBas: 0,
  jobHaut: 150,
  repasCrousParMois: 15,
  coursesMensuelles: 150,
  fraisDiversMensuels: 90,
  surfaceM2: 25,
  transportMensuel: 30,
  fraisScolariteAnnuels: 175,
  fraisInstallation: 800,
}

export const ECHELONS: readonly EchelonBourse[] = ['0bis', '1', '2', '3', '4', '5', '6', '7']

export interface Etape {
  readonly titre: string
  readonly aide: string
}

export const ETAPES: readonly Etape[] = [
  { titre: 'Ton bac', aide: 'Il pèse sur tes chances : les formations ne recrutent pas partout pareil.' },
  { titre: 'Tes notes', aide: 'Importe un bulletin, ou saisis seulement les matières que tu veux.' },
  { titre: 'Ce qui t’intéresse', aide: 'C’est ce qui décide des formations qu’on te montre.' },
  { titre: 'Ta motivation', aide: 'Pour toi, pas pour l’algorithme : elle n’entre dans aucun calcul.' },
  { titre: 'Où tu peux aller', aide: 'Le coût de la vie change beaucoup d’une ville à l’autre.' },
  { titre: 'Ta bourse', aide: 'Si tu es boursier, ça change ton budget de plusieurs centaines d’euros.' },
  { titre: 'Ton budget', aide: 'Trois questions simples. Les montants de chaque réponse sont écrits, et tu peux les corriger.' },
]

interface Props {
  readonly etape: number
  readonly reponses: Reponses
  readonly academies: readonly string[]
  readonly onChange: (partiel: Partial<Reponses>) => void
}

function Champ({
  label,
  suffixe,
  valeur,
  min,
  max,
  onChange,
}: {
  label: string
  suffixe?: string
  valeur: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="champ">
      <span className="champ-label">{label}</span>
      <span className="champ-saisie">
        <input
          type="number"
          inputMode="numeric"
          value={String(valeur)}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffixe ? <span className="champ-suffixe">{suffixe}</span> : null}
      </span>
    </label>
  )
}

function SaisieNotes({
  reponses,
  onChange,
}: {
  reponses: Reponses
  onChange: (partiel: Partial<Reponses>) => void
}) {
  const majNote = (matiere: Matiere, valeur: string) => {
    const notes = { ...reponses.notes }
    if (valeur === '') delete notes[matiere]
    else notes[matiere] = Math.min(20, Math.max(0, Number(valeur)))
    onChange({ notes })
  }
  return (
    <div className="notes">
      {MATIERES.map((m) => (
        <label className="note-ligne" key={m}>
          <span>{LIBELLES_MATIERE[m]}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={20}
            placeholder="—"
            value={reponses.notes[m] === undefined ? '' : String(reponses.notes[m])}
            onChange={(e) => majNote(m, e.target.value)}
          />
        </label>
      ))}
    </div>
  )
}

/**
 * Les bulletins déposés, et ce que l'assistant en a lu.
 *
 * ── Deux choses que cet affichage ne doit jamais laisser croire ──────────
 *
 * 1. Que Jean-Paul est quelqu'un. Son nom est suivi de ce qu'il est, à
 *    chaque fois : une machine. Ce site parle à des mineurs, et laisser
 *    penser qu'un adulte a lu leur bulletin donnerait à ces phrases un poids
 *    qu'elles n'ont pas.
 * 2. Que cet avis est une note. Il n'est pas chiffré, il n'entre dans aucun
 *    calcul, il ne trie aucune formation — et c'est écrit.
 *
 * La progression affichée, elle, est une SOUSTRACTION entre le premier et le
 * dernier bulletin. Elle ne vient d'aucun modèle.
 */
function BulletinsDeposes({ bulletins }: { bulletins: readonly BulletinDepose[] }) {
  const progression = progressionConstatee(bulletins)
  return (
    <section className="bulletins" aria-label="Bulletins déposés">
      <ul className="bulletins-liste">
        {bulletins.map((b) => (
          <li className="bulletin-depose" key={b.libelle}>
            <span className="bulletin-nom">{b.libelle}</span>
            <span className="note">
              {b.matieresLues} matière{b.matieresLues > 1 ? 's' : ''} lue
              {b.matieresLues > 1 ? 's' : ''}
            </span>
          </li>
        ))}
      </ul>

      {progression !== null ? (
        <p className="bulletin-progression">
          Entre ton premier et ton dernier bulletin, ta moyenne générale{' '}
          {progression > 0.05 ? (
            <>
              a gagné <strong>{progression.toFixed(1)} point{progression >= 2 ? 's' : ''}</strong>.
              Une remontée est l’un des rares éléments qu’un dossier peut encore construire.
            </>
          ) : progression < -0.05 ? (
            <>
              a baissé de <strong>{Math.abs(progression).toFixed(1)} point
              {Math.abs(progression) >= 2 ? 's' : ''}</strong>. Les commissions lisent des
              trajectoires : les prochains trimestres comptent plus que celui-ci.
            </>
          ) : (
            <>est restée <strong>stable</strong>.</>
          )}
        </p>
      ) : null}

      {/* L'avis du dernier bulletin déposé : c'est le plus récent qui décrit
          où l'élève en est. Les précédents restent dans la liste ci-dessus. */}
      {(() => {
        const dernier = [...bulletins].reverse().find((b) => b.avis !== null)
        if (dernier?.avis == null) return null
        const avis = dernier.avis
        return (
          <article className="avis-jp">
            <h4 className="avis-jp-titre">Ce que Jean-Paul a lu dans les appréciations</h4>
            <p className="avis-jp-texte">{avis.texte}</p>
            {avis.pointsForts.length > 0 ? (
              <>
                <p className="avis-jp-sous">Ce qui ressort</p>
                <ul className="avis-jp-liste">
                  {avis.pointsForts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {avis.aTravailler.length > 0 ? (
              <>
                <p className="avis-jp-sous">Ce qui peut encore bouger</p>
                <ul className="avis-jp-liste">
                  {avis.aTravailler.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="avis-jp-auteur">{avis.auteur}. Cet avis n’entre dans aucun calcul et ne trie aucune formation.</p>
          </article>
        )
      })()}
    </section>
  )
}

/** Nombre de matières lues sur le dernier bulletin de la liste. */
function dernierLu(bulletins: Reponses['bulletins']): number {
  return bulletins[bulletins.length - 1]?.matieresLues ?? 0
}

export function Question({ etape, reponses, academies, onChange }: Props) {
  const [lecture, setLecture] = useState<'repos' | 'en_cours' | 'erreur'>('repos')
  const [messageLecture, setMessageLecture] = useState<string | null>(null)

  /** Un fichier lu et converti en bulletin déposé, ou une erreur. */
  async function lireUnBulletin(
    fichier: File,
    rang: number,
  ): Promise<Reponses['bulletins'][number]> {
    const tampon = await fichier.arrayBuffer()
    let binaire = ''
    const octets = new Uint8Array(tampon)
    for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i] as number)
    const extrait = await lireBulletin(btoa(binaire), fichier.type)
    const notes: Partial<Record<Matiere, number>> = {}
    for (const m of MATIERES) {
      const v = extrait.notes[m]
      if (typeof v === 'number') notes[m] = v
    }
    return {
      libelle: `Bulletin ${rang}`,
      notes,
      signaux: extrait.signaux,
      matieresLues: extrait.matieresLues,
      avis: extrait.avis ?? null,
    }
  }

  /**
   * Dépose un OU PLUSIEURS bulletins, en une fois.
   *
   * ── Le piège que cette fonction évite ────────────────────────────────
   *
   * `reponses` est une prop : elle ne change pas pendant que cette fonction
   * tourne, React ne la réémet qu'au rendu suivant. Une boucle qui repartirait
   * de `reponses.bulletins` à chaque tour construirait donc trois fois une
   * liste d'UN élément, et le dernier `onChange` écraserait les précédents :
   * sur trois fichiers déposés, un seul survivrait — sans erreur, sans
   * message, sans que rien ne le signale.
   *
   * L'accumulation est donc locale, et `onChange` n'est appelé qu'une fois,
   * à la fin.
   *
   * ── Un fichier illisible n'emporte pas les autres ────────────────────
   *
   * Chaque lecture est isolée. Une photo floue au milieu de trois bulletins
   * ne fait pas perdre les deux qui se lisaient : elle est nommée dans le
   * message, et les autres sont gardés.
   */
  async function importerBulletins(fichiers: readonly File[]): Promise<void> {
    if (fichiers.length === 0) return
    setLecture('en_cours')
    setMessageLecture(null)

    const avant = reponses.bulletins.length
    let bulletins = [...reponses.bulletins]
    const echecs: string[] = []

    for (const fichier of fichiers) {
      try {
        bulletins = [...bulletins, await lireUnBulletin(fichier, bulletins.length + 1)]
      } catch (e) {
        echecs.push(`${fichier.name} — ${(e as Error).message}`)
      }
    }

    const ajoutes = bulletins.length - avant
    if (ajoutes > 0) {
      const dernier = bulletins[bulletins.length - 1]!
      onChange({
        bulletins,
        // Les moyennes affichées sont celles de TOUS les bulletins, calculées
        // ici — jamais demandées au modèle (règle 1).
        notes: moyennesCumulees(bulletins),
        notesImportees: true,
        signaux: dernier.signaux,
      })
    }

    setLecture(ajoutes === 0 ? 'erreur' : 'repos')
    setMessageLecture(
      [
        ajoutes === 0
          ? null
          : bulletins.length === 1
            ? `${dernierLu(bulletins)} matières lues. Vérifie-les : elles sont modifiables.`
            : `${ajoutes} bulletin${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''}. ` +
              `Les moyennes affichées portent maintenant sur ${bulletins.length} bulletins.`,
        echecs.length === 0
          ? null
          : `Non lu${echecs.length > 1 ? 's' : ''} : ${echecs.join(' ; ')} ` +
            `Tu peux saisir ces moyennes à la main juste en dessous.`,
      ]
        .filter((t): t is string => t !== null)
        .join(' '),
    )
  }

  if (etape === 0) {
    const bacs: { cle: Reponses['typeBac']; texte: string }[] = [
      { cle: 'general', texte: 'Bac général' },
      { cle: 'technologique', texte: 'Bac technologique' },
      { cle: 'professionnel', texte: 'Bac professionnel' },
    ]
    return (
      <div className="choix">
        {bacs.map((b) => (
          <button
            key={b.cle}
            type="button"
            className={reponses.typeBac === b.cle ? 'choix-actif' : ''}
            onClick={() => onChange({ typeBac: b.cle })}
          >
            {b.texte}
          </button>
        ))}
        <Champ
          label="Ton année de naissance"
          valeur={reponses.anneeNaissance}
          min={1990}
          max={new Date().getFullYear()}
          onChange={(anneeNaissance) => onChange({ anneeNaissance })}
        />
        <p className="note">
          L’année seule suffit à calculer tes droits. On ne te demande ni ton nom,
          ni ta date de naissance complète.
        </p>
      </div>
    )
  }

  if (etape === 1) {
    const moyenne = moyenneGenerale(reponses.notes)
    return (
      <div className="choix">
        <label className="depot">
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            /* Plusieurs d'un coup : trois trimestres se sélectionnent
               ensemble dans le sélecteur de fichiers, plutôt qu'en trois
               allers-retours. */
            multiple
            onChange={(e) => {
              const fichiers = [...(e.target.files ?? [])]
              /* Le champ est vidé APRÈS lecture. Sans cela, redéposer le
                 MÊME fichier ne déclenche rien : la valeur du champ n'a pas
                 changé, donc « change » ne se produit pas. Le défaut est
                 invisible — on clique, on choisit, et il ne se passe rien. */
              e.target.value = ''
              void importerBulletins(fichiers)
            }}
          />
          <span>
            {lecture === 'en_cours'
              ? 'Lecture en cours…'
              : reponses.bulletins.length === 0
                ? 'Importer un ou plusieurs bulletins (PDF ou photo)'
                : 'Ajouter d’autres bulletins'}
          </span>
        </label>
        <p className="note">
          Tu peux en déposer plusieurs à la fois — un par trimestre. Les moyennes se
          cumulent, et ta progression devient visible. Seules les moyennes et trois
          indicateurs chiffrés sont extraits ; le texte des appréciations n’est jamais
          conservé.
        </p>
        {messageLecture ? (
          <p className={lecture === 'erreur' ? 'erreur' : 'note'}>{messageLecture}</p>
        ) : null}

        {reponses.bulletins.length > 0 ? (
          <BulletinsDeposes bulletins={reponses.bulletins} />
        ) : null}

        <SaisieNotes reponses={reponses} onChange={onChange} />
        {moyenne !== null ? (
          <p className="note">
            Moyenne des matières renseignées : <strong>{moyenne.toFixed(1)}/20</strong>.
          </p>
        ) : (
          <p className="note">
            Sans aucune note, on te montrera quand même les formations : ta chance
            d’admission sera simplement moins bien estimée, et on te le dira.
          </p>
        )}
      </div>
    )
  }

  if (etape === 2) {
    const basculer = (d: Domaine) => {
      const passions = reponses.passions.includes(d)
        ? reponses.passions.filter((x) => x !== d)
        : [...reponses.passions, d]
      onChange({ passions })
    }
    return (
      <div className="choix">
        <p className="champ-label">Les domaines qui t’intéressent</p>
        <div className="domaines">
          {DOMAINES.map((d) => (
            <button
              key={d}
              type="button"
              className={reponses.passions.includes(d) ? 'choix-actif' : ''}
              onClick={() => basculer(d)}
            >
              {LIBELLES_DOMAINE[d]}
            </button>
          ))}
        </div>
        <label className="champ">
          <span className="champ-label">Ta matière préférée</span>
          <span className="champ-saisie">
            <select
              value={reponses.matierePreferee ?? ''}
              onChange={(e) =>
                onChange({ matierePreferee: (e.target.value || null) as Matiere | null })
              }
            >
              <option value="">— aucune en particulier —</option>
              {MATIERES.map((m) => (
                <option key={m} value={m}>
                  {LIBELLES_MATIERE[m]}
                </option>
              ))}
            </select>
          </span>
        </label>
        {reponses.passions.length === 0 ? (
          <p className="note">
            Sans domaine choisi, on cherchera dans toutes les formations.
          </p>
        ) : null}
      </div>
    )
  }

  if (etape === 3) {
    return (
      <div className="choix">
        <label className="champ">
          <span className="champ-label">
            À quel point es-tu sûr de ton projet ? {reponses.motivation}/10
          </span>
          <input
            type="range"
            min={0}
            max={10}
            value={reponses.motivation}
            onChange={(e) => onChange({ motivation: Number(e.target.value) })}
          />
        </label>
        <p className="note">
          Cette réponse n’entre dans aucun calcul et ne change aucun classement.
          Elle sert à te situer, et à ce qu’on t’en reparle si tu hésites.
        </p>
        {reponses.signaux ? (
          <p className="note">
            Ton bulletin indique un sérieux de {reponses.signaux.serieux}/10, une
            participation de {reponses.signaux.participation}/10 et une progression
            de {reponses.signaux.progression}/10. Ces chiffres ne sont pas non plus
            utilisés pour classer les formations.
          </p>
        ) : null}
      </div>
    )
  }

  if (etape === 4) {
    const options = [
      { cle: 'meme_ville', texte: 'Rester dans ma ville' },
      { cle: 'meme_region', texte: 'Rester dans mon académie' },
      { cle: 'france', texte: 'Partout en France' },
    ] as const
    return (
      <div className="choix">
        <label className="champ">
          <span className="champ-label">Ta commune aujourd’hui</span>
          <span className="champ-saisie">
            <input
              type="text"
              value={reponses.villeResidence}
              placeholder="Limoges"
              onChange={(e) => onChange({ villeResidence: e.target.value })}
            />
          </span>
        </label>
        {options.map((o) => (
          <button
            key={o.cle}
            type="button"
            className={reponses.mobilite === o.cle ? 'choix-actif' : ''}
            onClick={() => onChange({ mobilite: o.cle })}
          >
            {o.texte}
          </button>
        ))}
        <label className="champ">
          <span className="champ-label">
            Ton académie {reponses.mobilite === 'france' ? '(pour l’effet géographique)' : ''}
          </span>
          <span className="champ-saisie">
            <select
              value={reponses.academie ?? ''}
              onChange={(e) => onChange({ academie: e.target.value || null })}
            >
              <option value="">— choisir —</option>
              {academies.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </span>
        </label>
        <p className="note">
          Les formations recrutent souvent davantage dans leur académie : le dire
          rend l’estimation plus juste.
        </p>
      </div>
    )
  }

  if (etape === 5) {
    // Les huit échelons ne s'affichent que si l'élève dit être boursier :
    // les dérouler d'emblée demandait à tout le monde de trancher une question
    // technique qui ne concerne qu'une partie des élèves.
    const boursier = reponses.echelonBourse !== null
    return (
      <div className="choix">
        <button
          type="button"
          className={
            reponses.echelonBourse === null && !reponses.echelonInconnu ? 'choix-actif' : ''
          }
          onClick={() => onChange({ echelonBourse: null, echelonInconnu: false })}
        >
          Non, je ne suis pas boursier
        </button>
        <button
          type="button"
          className={boursier ? 'choix-actif' : ''}
          onClick={() =>
            onChange({ echelonBourse: reponses.echelonBourse ?? '3', echelonInconnu: false })
          }
        >
          Oui, je suis boursier
        </button>
        <button
          type="button"
          className={reponses.echelonInconnu ? 'choix-actif' : ''}
          onClick={() => onChange({ echelonBourse: null, echelonInconnu: true })}
        >
          Je ne sais pas encore
        </button>

        {boursier ? (
          <div className="sous-question">
            <p className="champ-label">
              Ton échelon, s’il te plaît — il est écrit sur ta notification de bourse.
            </p>
            <div className="echelons">
              {ECHELONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={reponses.echelonBourse === e ? 'choix-actif' : ''}
                  onClick={() => onChange({ echelonBourse: e, echelonInconnu: false })}
                >
                  Échelon {e === '0bis' ? '0 bis' : e}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {reponses.echelonInconnu ? (
          <p className="note">
            On calculera sans bourse. Le reste-à-vivre sera donc plus bas que la
            réalité si tu en obtiens une : reviens le préciser quand tu le sauras.
          </p>
        ) : null}
      </div>
    )
  }

  // --- étape « Ton budget » --------------------------------------------------
  // Elle demandait dix montants mensuels. Un élève de terminale ne les connaît
  // pas, et les inventer sous la contrainte donne un reste-à-vivre faux. Trois
  // questions en langage courant les remplacent — chacune AFFICHANT les
  // montants qu'elle applique, pour que rien ne soit décidé en silence — et le
  // détail reste accessible pour qui veut corriger poste par poste.
  const trainCourant = trainDeVieCourant(reponses)
  const aideCourante = aideFamilleCourante(reponses.contributionFamiliale)
  const jobRetenu = jobCourant(reponses.jobBas, reponses.jobHaut)

  return (
    <div className="budget">
      <div className="budget-question">
        <p className="champ-label">Tes parents peuvent-ils t’aider financièrement ?</p>
        <div className="choix">
          {AIDES_FAMILLE.map((a) => (
            <button
              key={a.cle}
              type="button"
              className={aideCourante?.cle === a.cle ? 'choix-actif' : ''}
              onClick={() => onChange({ contributionFamiliale: a.montant })}
            >
              {a.titre}
              <span className="budget-montant">
                {a.montant === 0 ? '0 € par mois' : `environ ${a.montant} € par mois`}
              </span>
            </button>
          ))}
        </div>
        {aideCourante === null ? (
          <p className="note">
            Montant saisi à la main : {reponses.contributionFamiliale} € par mois.
          </p>
        ) : null}
      </div>

      <div className="budget-question">
        <p className="champ-label">Comptes-tu travailler à côté de tes études ?</p>
        <div className="choix">
          {JOBS_ETUDIANTS.map((j) => (
            <button
              key={j.cle}
              type="button"
              className={jobRetenu?.cle === j.cle ? 'choix-actif' : ''}
              onClick={() => onChange({ jobBas: j.bas, jobHaut: j.haut })}
            >
              {j.titre}
              <span className="budget-montant">
                {j.haut === 0 ? 'aucun revenu' : `entre ${j.bas} et ${j.haut} € par mois`}
              </span>
            </button>
          ))}
        </div>
        {jobRetenu === null ? (
          <p className="note">
            Fourchette saisie à la main : {reponses.jobBas} à {reponses.jobHaut} € par mois.
          </p>
        ) : null}
      </div>

      <div className="budget-question">
        <p className="champ-label">Comment vis-tu au quotidien ?</p>
        <div className="choix">
          {TRAINS_DE_VIE.map((t) => (
            <button
              key={t.cle}
              type="button"
              className={trainCourant?.cle === t.cle ? 'choix-actif' : ''}
              onClick={() => onChange(valeursDe(t))}
            >
              {t.titre}
              <span className="budget-resume">{t.resume}</span>
              <span className="budget-montant">
                {t.coursesMensuelles} € de courses · {t.fraisDiversMensuels} € divers ·{' '}
                {t.transportMensuel} € transport · {t.repasCrousParMois} repas au resto U
              </span>
            </button>
          ))}
        </div>
        {trainCourant === null ? (
          <p className="note">Montants ajustés à la main dans le détail ci-dessous.</p>
        ) : null}
        {trainCourant?.cle === 'pris-en-charge' ? (
          /* Dire ce que ce choix fait, et ce qu'il ne fait pas. Un élève dont
             la famille remplit le frigo n'a pas ces dépenses — mais le loyer
             et la scolarité, eux, restent dus et restent calculés. */
          <p className="note">
            Tes dépenses du quotidien sont donc à zéro. Le logement et les frais de
            scolarité restent comptés : ils dépendent de la formation et de la ville.
            Tu peux remettre un montant sur n’importe quelle ligne dans le détail
            ci-dessous.
          </p>
        ) : null}
      </div>

      {depensesDeclarees(reponses) === 0 ? (
        <p className="budget-total">
          Tu ne déclares <strong>aucune dépense du quotidien</strong>. Restent le
          logement et les frais de scolarité — ceux-là dépendent de la formation et de
          la ville, on les calcule pour toi.
        </p>
      ) : (
        <p className="budget-total">
          Tu déclares <strong>{depensesDeclarees(reponses)} € de dépenses par mois</strong>,
          hors logement et hors frais de scolarité — ceux-là dépendent de la formation et
          de la ville, on les calcule pour toi.
        </p>
      )}

      <details className="budget-detail">
        <summary>Ajuster poste par poste</summary>
        <div className="budget-champs">
        <Champ
          label="Ce que ta famille peut donner"
          suffixe="€ / mois"
          valeur={reponses.contributionFamiliale}
          min={0}
          onChange={(contributionFamiliale) => onChange({ contributionFamiliale })}
        />
        <div className="duo">
          <Champ
            label="Job étudiant, au minimum"
            suffixe="€ / mois"
            valeur={reponses.jobBas}
            min={0}
            onChange={(jobBas) => onChange({ jobBas })}
          />
          <Champ
            label="au maximum"
            suffixe="€ / mois"
            valeur={reponses.jobHaut}
            min={0}
            onChange={(jobHaut) => onChange({ jobHaut })}
          />
        </div>
        <div className="duo">
          <Champ
            label="Repas au resto U"
            suffixe="/ mois"
            valeur={reponses.repasCrousParMois}
            min={0}
            max={60}
            onChange={(repasCrousParMois) => onChange({ repasCrousParMois })}
          />
          <Champ
            label="Courses"
            suffixe="€ / mois"
            valeur={reponses.coursesMensuelles}
            min={0}
            onChange={(coursesMensuelles) => onChange({ coursesMensuelles })}
          />
        </div>
        <div className="duo">
          <Champ
            label="Téléphone, mutuelle, loisirs"
            suffixe="€ / mois"
            valeur={reponses.fraisDiversMensuels}
            min={0}
            onChange={(fraisDiversMensuels) => onChange({ fraisDiversMensuels })}
          />
          <Champ
            label="Transport"
            suffixe="€ / mois"
            valeur={reponses.transportMensuel}
            min={0}
            onChange={(transportMensuel) => onChange({ transportMensuel })}
          />
        </div>
        <div className="duo">
          <Champ
            label="Surface du logement"
            suffixe="m²"
            valeur={reponses.surfaceM2}
            min={9}
            max={60}
            onChange={(surfaceM2) => onChange({ surfaceM2 })}
          />
          <Champ
            label="Droits d’inscription"
            suffixe="€ / an"
            valeur={reponses.fraisScolariteAnnuels}
            min={0}
            onChange={(fraisScolariteAnnuels) => onChange({ fraisScolariteAnnuels })}
          />
        </div>
        <Champ
          label="Frais d’installation la première année"
          suffixe="€"
          valeur={reponses.fraisInstallation}
          min={0}
          onChange={(fraisInstallation) => onChange({ fraisInstallation })}
        />
        <p className="note">
          Logement : 25 m² par défaut, ajustable ici. Les droits d’inscription sont
          déclaratifs — aucune source ouverte ne les donne formation par formation de
          façon fiable.
        </p>
        </div>
      </details>
    </div>
  )
}
