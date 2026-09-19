/**
 * Affichage des retours d'étudiants et dépôt d'un retour.
 *
 * Trois axes chiffrés, archivés année par année. Aucune note d'établissement
 * n'est affichée ni calculable : le module M10 l'interdit, et c'est autant une
 * protection juridique qu'un choix éditorial.
 */

import { useEffect, useState } from 'react'

import { evolutionDuCout, RETOURS_MINIMUM } from '../../packages/retours/src/index.ts'
import {
  chercherArchiveRetours,
  deposerRetour,
  type AgregatRetours,
} from './donnees.ts'

function euros(v: number): string {
  return `${Math.round(v).toLocaleString('fr-FR')} €`
}

/** Résumé d'une ligne, sur la carte. */
export function ResumeRetours({ agregat }: { agregat: AgregatRetours | undefined }) {
  if (!agregat) return null
  if (agregat.statut === 'trop_peu_de_retours') {
    return (
      <p className="retours-resume">
        {agregat.nombreRetours === 0
          ? 'Aucun retour d’étudiant pour l’instant.'
          : `${agregat.nombreRetours} retour${agregat.nombreRetours > 1 ? 's' : ''} d’étudiants : pas encore assez pour publier une moyenne.`}
      </p>
    )
  }
  return (
    <p className="retours-resume">
      <strong>{euros(agregat.coutReelMensuel.median)} par mois</strong> déclarés par{' '}
      {agregat.nombreRetours} étudiants sur place ({agregat.millesime}).
    </p>
  )
}

function Barre({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="barre">
      <span className="barre-libelle">{libelle}</span>
      <span className="barre-piste" aria-hidden="true">
        <span className="barre-remplie" style={{ width: `${(valeur / 5) * 100}%` }} />
      </span>
      <span className="barre-valeur">{valeur.toFixed(1)}/5</span>
    </div>
  )
}

function Annee({ agregat }: { agregat: AgregatRetours }) {
  if (agregat.statut === 'trop_peu_de_retours') {
    return (
      <li className="annee vide">
        <strong>{agregat.millesime}</strong> — {agregat.raison}
      </li>
    )
  }
  return (
    <li className="annee">
      <strong>{agregat.millesime}</strong> — {agregat.nombreRetours} retours
      <div className="annee-detail">
        <p>
          Coût réel constaté : médiane {euros(agregat.coutReelMensuel.median)}, moitié des
          retours entre {euros(agregat.coutReelMensuel.premierQuartile)} et{' '}
          {euros(agregat.coutReelMensuel.troisiemeQuartile)}.
        </p>
        <Barre libelle="Trouver un logement" valeur={agregat.faciliteLogement.median} />
        <Barre libelle="Ambiance" valeur={agregat.ambiance.median} />
      </div>
    </li>
  )
}

function Formulaire({ codFormation }: { codFormation: string }) {
  const [cout, setCout] = useState(600)
  const [logement, setLogement] = useState(3)
  const [ambiance, setAmbiance] = useState(4)
  const [annee, setAnnee] = useState(1)
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'merci' | 'erreur'>('repos')
  const [message, setMessage] = useState<string | null>(null)

  async function envoyer() {
    setEtat('envoi')
    try {
      await deposerRetour({
        codFormation,
        coutReelMensuel: cout,
        faciliteLogement: logement,
        ambiance,
        anneeEtudes: annee,
      })
      setEtat('merci')
    } catch (e) {
      setEtat('erreur')
      setMessage((e as Error).message)
    }
  }

  if (etat === 'merci') {
    return (
      <p className="note">
        Merci. Ton retour comptera dès que cette formation en aura au moins{' '}
        {RETOURS_MINIMUM} cette année.
      </p>
    )
  }

  return (
    <div className="formulaire-retour">
      <p className="note">
        Tu es déjà inscrit dans cette formation ? Trois chiffres, rien d’autre. Pas de
        commentaire, pas de note sur l’établissement.
      </p>
      <label className="champ">
        <span className="champ-label">Ce que ça te coûte vraiment, par mois : {cout} €</span>
        <input
          type="range"
          min={0}
          max={2000}
          step={10}
          value={cout}
          onChange={(e) => setCout(Number(e.target.value))}
        />
      </label>
      <label className="champ">
        <span className="champ-label">Trouver un logement : {logement}/5</span>
        <input
          type="range"
          min={1}
          max={5}
          value={logement}
          onChange={(e) => setLogement(Number(e.target.value))}
        />
      </label>
      <label className="champ">
        <span className="champ-label">Ambiance : {ambiance}/5</span>
        <input
          type="range"
          min={1}
          max={5}
          value={ambiance}
          onChange={(e) => setAmbiance(Number(e.target.value))}
        />
      </label>
      <label className="champ">
        <span className="champ-label">Ton année d’études : {annee}</span>
        <input
          type="range"
          min={1}
          max={8}
          value={annee}
          onChange={(e) => setAnnee(Number(e.target.value))}
        />
      </label>
      <button type="button" className="secondaire" onClick={envoyer} disabled={etat === 'envoi'}>
        {etat === 'envoi' ? 'Envoi…' : 'Déposer mon retour'}
      </button>
      {etat === 'erreur' && message ? <p className="erreur">{message}</p> : null}
    </div>
  )
}

/** Panneau complet, dans le détail d'une carte : archive par année + dépôt. */
export function PanneauRetours({ codFormation }: { codFormation: string }) {
  const [archives, setArchives] = useState<AgregatRetours[] | null>(null)

  useEffect(() => {
    let vivant = true
    void chercherArchiveRetours(codFormation).then((a) => {
      if (vivant) setArchives(a)
    })
    return () => {
      vivant = false
    }
  }, [codFormation])

  const evolution = archives ? evolutionDuCout(archives) : null

  return (
    <div className="retours">
      <h4>Ce qu’en disent les étudiants sur place</h4>
      {archives === null ? (
        <p className="note">Chargement des retours…</p>
      ) : archives.length === 0 ? (
        <p className="note">Aucun retour déposé pour cette formation, aucune année.</p>
      ) : (
        <>
          {evolution ? (
            <p className="note">
              Coût médian déclaré : {evolution.ecartEuros >= 0 ? '+' : '−'}
              {euros(Math.abs(evolution.ecartEuros))} par mois entre {evolution.de} et{' '}
              {evolution.vers}.
            </p>
          ) : null}
          <ul className="annees">
            {archives.map((a) => (
              <Annee key={a.millesime} agregat={a} />
            ))}
          </ul>
        </>
      )}
      <Formulaire codFormation={codFormation} />
    </div>
  )
}
