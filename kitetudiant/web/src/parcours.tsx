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
import type { Reponses } from './calcul.ts'
import { lireBulletin } from './donnees.ts'

export const REPONSES_PAR_DEFAUT: Reponses = {
  typeBac: 'general',
  notes: {},
  notesImportees: false,
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
  contributionFamiliale: 150,
  jobBas: 0,
  jobHaut: 200,
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
  { titre: 'Ta bourse', aide: 'L’échelon change le reste-à-vivre de plusieurs centaines d’euros.' },
  { titre: 'Ton budget', aide: 'Des ordres de grandeur suffisent, tu pourras les ajuster ensuite.' },
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

export function Question({ etape, reponses, academies, onChange }: Props) {
  const [lecture, setLecture] = useState<'repos' | 'en_cours' | 'erreur'>('repos')
  const [messageLecture, setMessageLecture] = useState<string | null>(null)

  async function importerBulletin(fichier: File) {
    setLecture('en_cours')
    setMessageLecture(null)
    try {
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
      onChange({ notes, notesImportees: true, signaux: extrait.signaux })
      setLecture('repos')
      setMessageLecture(
        `${extrait.matieresLues} matières lues. Vérifie-les : elles sont modifiables.`,
      )
    } catch (e) {
      setLecture('erreur')
      setMessageLecture(
        `${(e as Error).message} Tu peux saisir tes moyennes à la main juste en dessous.`,
      )
    }
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
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importerBulletin(f)
            }}
          />
          <span>
            {lecture === 'en_cours' ? 'Lecture du bulletin…' : 'Importer un bulletin (PDF ou photo)'}
          </span>
        </label>
        <p className="note">
          Seules les moyennes et trois indicateurs chiffrés sont extraits. Le texte
          des appréciations n’est jamais conservé.
        </p>
        {messageLecture ? (
          <p className={lecture === 'erreur' ? 'erreur' : 'note'}>{messageLecture}</p>
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
    return (
      <div className="choix">
        <button
          type="button"
          className={reponses.echelonBourse === null && !reponses.echelonInconnu ? 'choix-actif' : ''}
          onClick={() => onChange({ echelonBourse: null, echelonInconnu: false })}
        >
          Je ne suis pas boursier
        </button>
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
        <button
          type="button"
          className={reponses.echelonInconnu ? 'choix-actif' : ''}
          onClick={() => onChange({ echelonBourse: null, echelonInconnu: true })}
        >
          Je ne sais pas encore
        </button>
        {reponses.echelonInconnu ? (
          <p className="note">
            On calculera sans bourse. Le reste-à-vivre sera donc plus bas que la
            réalité si tu en obtiens une : reviens le préciser quand tu le sauras.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="choix">
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
        Les droits d’inscription sont déclaratifs : aucune source ouverte ne les
        donne formation par formation de façon fiable.
      </p>
    </div>
  )
}
