/**
 * Le parcours en sept questions.
 *
 * Chaque question sert au calcul : on ne demande rien qu'on n'utilise pas,
 * parce que le premier résultat doit arriver en moins de 90 secondes et parce
 * que les données concernent des mineurs.
 */

import { useState } from 'react'

import type { EchelonBourse } from '../../packages/budget-engine/src/types.ts'
import type { Reponses } from './calcul.ts'

export const REPONSES_PAR_DEFAUT: Reponses = {
  typeBac: 'Général',
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
  { titre: 'Ton bac', aide: 'Pour situer les formations qui te correspondent.' },
  { titre: 'Où tu habites', aide: 'Le coût de la vie change beaucoup d’une ville à l’autre.' },
  { titre: 'Jusqu’où tu peux aller', aide: 'Tu peux changer d’avis à tout moment.' },
  { titre: 'Ce que tu veux étudier', aide: 'Les filières viennent de l’open data Parcoursup.' },
  { titre: 'Ta bourse', aide: 'L’échelon change le reste-à-vivre de plusieurs centaines d’euros.' },
  { titre: 'Ce sur quoi tu peux compter', aide: 'Une fourchette suffit, on affichera les trois scénarios.' },
  { titre: 'Ton train de vie', aide: 'Des ordres de grandeur, ajustables après coup.' },
]

interface Props {
  readonly etape: number
  readonly reponses: Reponses
  readonly filieres: readonly { libelle: string; nombre: number }[]
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

export function Question({ etape, reponses, filieres, academies, onChange }: Props) {
  const [rechercheFiliere, setRechercheFiliere] = useState('')

  if (etape === 0) {
    return (
      <div className="choix">
        {['Général', 'Technologique', 'Professionnel'].map((bac) => (
          <button
            key={bac}
            type="button"
            className={reponses.typeBac === bac ? 'choix-actif' : ''}
            onClick={() => onChange({ typeBac: bac })}
          >
            Bac {bac.toLowerCase()}
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
        <p className="note">
          Sert à te montrer les écarts avec les villes où tu pourrais étudier.
        </p>
      </div>
    )
  }

  if (etape === 2) {
    const options = [
      { cle: 'meme_ville', texte: 'Rester dans ma ville' },
      { cle: 'meme_region', texte: 'Rester dans mon académie' },
      { cle: 'france', texte: 'Partout en France' },
    ] as const
    return (
      <div className="choix">
        {options.map((o) => (
          <button
            key={o.cle}
            type="button"
            className={reponses.mobilite === o.cle ? 'choix-actif' : ''}
            onClick={() =>
              onChange({
                mobilite: o.cle,
                academie: o.cle === 'france' ? null : reponses.academie,
              })
            }
          >
            {o.texte}
          </button>
        ))}
        {reponses.mobilite !== 'france' ? (
          <label className="champ">
            <span className="champ-label">Ton académie</span>
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
        ) : null}
      </div>
    )
  }

  if (etape === 3) {
    const visibles = filieres.filter((f) =>
      f.libelle.toLowerCase().includes(rechercheFiliere.toLowerCase()),
    )
    return (
      <div className="choix">
        <label className="champ">
          <span className="champ-label">Chercher une filière</span>
          <span className="champ-saisie">
            <input
              type="text"
              value={rechercheFiliere}
              placeholder="BTS, Licence, BUT…"
              onChange={(e) => setRechercheFiliere(e.target.value)}
            />
          </span>
        </label>
        <div className="filieres">
          {visibles.map((f) => (
            <button
              key={f.libelle}
              type="button"
              className={reponses.filiere === f.libelle ? 'choix-actif' : ''}
              onClick={() => onChange({ filiere: f.libelle })}
            >
              {f.libelle}
              <span className="filiere-nombre">{f.nombre.toLocaleString('fr-FR')} formations</span>
            </button>
          ))}
          {visibles.length === 0 && filieres.length > 0 ? (
            <p className="note">Aucune filière ne correspond.</p>
          ) : null}
        </div>
        {filieres.length === 0 ? (
          <p className="note">
            La liste des filières n’a pas pu être chargée. Tu peux continuer sans
            en choisir une : on cherchera dans toutes les formations.
          </p>
        ) : null}
      </div>
    )
  }

  if (etape === 4) {
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

  if (etape === 5) {
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
        <p className="note">
          Si tu ne comptes pas travailler, laisse les deux à zéro.
        </p>
      </div>
    )
  }

  return (
    <div className="choix">
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
