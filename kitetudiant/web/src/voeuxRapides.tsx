/**
 * Le bouton « Garder », posé sur chaque carte de résultat.
 *
 * La liste entière partage UN état, tenu par `useVoeuxRapides` et monté une
 * fois : quarante cartes qui interrogeraient l'API chacune de leur côté
 * feraient quarante requêtes au chargement, et afficheraient quarante états
 * qui divergeraient au premier ajout.
 *
 * L'affichage est OPTIMISTE — le marque-page se remplit avant la réponse du
 * serveur — et revient en arrière si l'appel échoue, en disant pourquoi. Sur
 * un téléphone en 4G, attendre la réponse avant de réagir donne l'impression
 * que le bouton n'a pas pris le clic, et on clique deux fois.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  ajouterVoeu,
  chercherVoeux,
  InscriptionRequise,
  retirerVoeu,
  VoeuxIndisponibles,
  type Voeu,
} from './donnees.ts'
import { MarquePage } from './illustrations.tsx'
import {
  codesEnregistres,
  gesteDuClic,
  libelleDuBouton,
  nomAccessible,
  rappelDuPlafond,
} from './voeuxRapides.ts'

export interface VoeuxRapides {
  readonly estGarde: (code: string) => boolean
  readonly basculer: (code: string, session: number) => void
  readonly occupe: string | null
  readonly message: string | null
  readonly rappel: string | null
  readonly connecte: boolean
  readonly onInscrire: () => void
}

/**
 * L'état des vœux pour toute la liste.
 *
 * `occupe` porte le CODE en cours, pas un booléen : sinon un clic sur une
 * carte désactiverait les trente-neuf autres.
 */
export function useVoeuxRapides(connecte: boolean, onInscrire: () => void): VoeuxRapides {
  const [voeux, setVoeux] = useState<readonly Voeu[]>([])
  const [occupe, setOccupe] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!connecte) {
      setVoeux([])
      return
    }
    let vivant = true
    chercherVoeux()
      .then((liste) => {
        if (vivant) setVoeux(liste)
      })
      .catch(() => {
        // Sans liste, les boutons s'affichent simplement « à garder ». Le vrai
        // état reviendra au premier clic, avec le message du serveur s'il y a
        // un problème — plutôt qu'une alerte sur une page qu'on vient d'ouvrir.
      })
    return () => {
      vivant = false
    }
  }, [connecte])

  const gardes = codesEnregistres(voeux)

  const basculer = useCallback(
    (code: string, session: number) => {
      const geste = gesteDuClic(voeux, code, session, connecte)
      if (geste.quoi === 'inscrire') {
        onInscrire()
        return
      }
      setOccupe(code)
      setMessage(null)
      const appel =
        geste.quoi === 'ajouter'
          ? ajouterVoeu(geste.code, geste.session)
          : retirerVoeu(geste.rang)
      appel
        .then((liste) => setVoeux(liste))
        .catch((e: unknown) => {
          // Le serveur dit POURQUOI — le onzième vœu, une session finie, une
          // base absente. On le répète tel quel : reformuler un refus qu'on
          // n'a pas décidé, c'est le déformer.
          if (e instanceof InscriptionRequise || e instanceof VoeuxIndisponibles) {
            setMessage((e as Error).message)
          } else {
            setMessage(`Ce vœu n’a pas pu être enregistré : ${(e as Error).message}`)
          }
        })
        .finally(() => setOccupe(null))
    },
    [voeux, connecte, onInscrire],
  )

  return {
    estGarde: (code) => gardes.has(code),
    basculer,
    occupe,
    message,
    rappel: connecte ? rappelDuPlafond(voeux.length) : null,
    connecte,
    onInscrire,
  }
}

/** Le bouton d'une carte. Compact : il est répété quarante fois. */
export function BoutonGarder({
  code,
  session,
  libelleFormation,
  etat,
}: {
  readonly code: string
  readonly session: number
  /** Sert au nom accessible : quarante boutons « Garder » ne se distinguent pas. */
  readonly libelleFormation: string
  readonly etat: VoeuxRapides
}) {
  const garde = etat.estGarde(code)
  const enCours = etat.occupe === code
  return (
    <button
      type="button"
      className={`garder${garde ? ' est-garde' : ''}`}
      onClick={() => etat.basculer(code, session)}
      disabled={enCours}
      aria-pressed={garde}
      aria-label={nomAccessible(garde, libelleFormation)}
      title={nomAccessible(garde, libelleFormation)}
    >
      <MarquePage plein={garde} />
      <span>{enCours ? '…' : libelleDuBouton(garde)}</span>
    </button>
  )
}
