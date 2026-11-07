/**
 * Les adresses d'affiliation, réglables sans déploiement.
 *
 * ── Ce que cet écran règle, et ce qu'il ne règle pas ────────────────────
 *
 * UNIQUEMENT l'adresse. Le nom, le logo, la description et la mention de
 * rémunération restent dans le dépôt de code.
 *
 * Ce partage est le point, pas un raccourci. Une adresse d'affiliation change
 * souvent — une campagne, un compte, un identifiant de suivi — et redéployer
 * le site pour ça finit par vouloir dire ne pas le faire. La mention de
 * rémunération, elle, ne doit jamais pouvoir être modifiée à côté du lien
 * qu'elle accompagne : les rendre réglables toutes les deux, ce serait rendre
 * possible un lien payé dont la phrase a été effacée depuis cet écran, sans
 * relecture et sans trace dans le dépôt.
 *
 * Elle est donc AFFICHÉE ici, en lecture seule. La voir sans pouvoir la
 * toucher dit mieux que n'importe quel commentaire ce qui se passe à l'écran
 * du visiteur.
 *
 * ── Pourquoi le domaine est verrouillé ──────────────────────────────────
 *
 * Le logo affiché à côté du bouton est celui du dépôt. Une adresse reréglée
 * vers un autre domaine mettrait le logo de papernest au-dessus d'un bouton
 * menant ailleurs. Le serveur refuse, et le navigateur revérifie.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  enregistrerLienPartenaire,
  listerPartenaires,
  retablirLienPartenaire,
  type EtatPartenaire,
} from './api.ts'

function Partenaire({
  etat,
  onChange,
}: {
  etat: EtatPartenaire
  onChange: (etat: EtatPartenaire) => void
}) {
  const [saisie, setSaisie] = useState(etat.lien)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  /* La saisie suit l'état tant que l'exploitant n'a rien tapé d'autre : après
     un enregistrement, le champ doit montrer ce qui est en ligne, pas ce qui
     y était. */
  useEffect(() => {
    setSaisie(etat.lien)
  }, [etat.lien])

  async function agir(action: () => Promise<EtatPartenaire>) {
    setOccupe(true)
    setErreur(null)
    try {
      onChange(await action())
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  const modifie = saisie.trim() !== etat.lien

  return (
    <article className="secret">
      <h3>{etat.nom}</h3>
      <p className="note">
        L’adresse doit rester sur <code>{etat.domaine}</code> : le logo affiché à côté
        du bouton est celui de {etat.nom}.
      </p>

      <p className={etat.personnalise ? 'etat-ok' : 'note'}>
        {etat.personnalise
          ? `Adresse réglée depuis cette console${
              etat.modifieLe
                ? ` le ${new Date(etat.modifieLe).toLocaleDateString('fr-FR')}`
                : ''
            }.`
          : 'Adresse du dépôt, jamais modifiée ici.'}
      </p>

      <label>
        <span>Adresse d’affiliation</span>
        <input
          type="url"
          value={saisie}
          spellCheck={false}
          disabled={occupe}
          onChange={(e) => setSaisie(e.target.value)}
        />
      </label>

      <div className="navigation">
        <button
          type="button"
          className="principal"
          disabled={occupe || !modifie}
          onClick={() => void agir(() => enregistrerLienPartenaire(etat.nom, saisie))}
        >
          Enregistrer
        </button>
        {etat.personnalise ? (
          <button
            type="button"
            className="secondaire"
            disabled={occupe}
            onClick={() => void agir(() => retablirLienPartenaire(etat.nom))}
          >
            Rétablir celle du dépôt
          </button>
        ) : null}
      </div>

      {erreur ? <p className="erreur">{erreur}</p> : null}

      {/* En lecture seule, et c'est volontaire : voir la phrase sans pouvoir
          la toucher dit ce qui s'affichera sous le bouton. */}
      {etat.remuneration === null ? (
        <p className="note">
          Ce lien ne nous rapporte rien. L’écran le dit au visiteur, et le lien ne
          porte pas <code>sponsored</code>.
        </p>
      ) : (
        <p className="note">
          Mention affichée avec ce lien, non modifiable ici : « {etat.remuneration} »
        </p>
      )}
    </article>
  )
}

export function Partenaires() {
  const [etats, setEtats] = useState<readonly EtatPartenaire[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const rafraichir = useCallback(async () => {
    try {
      setEtats(await listerPartenaires())
    } catch (e) {
      setErreur((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void rafraichir()
  }, [rafraichir])

  return (
    <section className="bloc">
      <h2>Liens d’affiliation</h2>
      <p className="bloc-intro">
        Seule l’adresse se règle ici. Le nom, le logo et la mention de rémunération
        restent dans le code : un lien payé ne doit jamais pouvoir perdre sa mention
        depuis un écran d’administration.
      </p>
      <p className="note">
        Le lien rémunéré ne s’affiche pas aux visiteurs qui se sont déclarés mineurs :
        un contrat signé avant dix-huit ans est annulable.
      </p>

      {erreur ? <p className="erreur">{erreur}</p> : null}
      {etats === null ? (
        <p className="note">Chargement…</p>
      ) : (
        etats.map((etat) => (
          <Partenaire
            key={etat.nom}
            etat={etat}
            onChange={(neuf) =>
              setEtats((liste) =>
                (liste ?? []).map((e) => (e.nom === neuf.nom ? neuf : e)),
              )
            }
          />
        ))
      )}
    </section>
  )
}
