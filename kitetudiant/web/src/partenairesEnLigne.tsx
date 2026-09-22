/**
 * Les partenaires, avec l'adresse réglée en console si elle l'a été.
 *
 * ── Pourquoi un appel réseau pour un lien ───────────────────────────────
 *
 * Parce qu'une adresse d'affiliation change plus souvent qu'un déploiement :
 * une campagne, un compte, un identifiant de suivi. Sans ce chemin, chaque
 * changement d'adresse demanderait un commit, une relecture et un déploiement
 * — et finirait par ne pas être fait.
 *
 * Ce qui NE passe PAS par là : le nom, le logo, la description et la mention
 * de rémunération. Ils restent dans `partenaires.ts`, versionnés. Le lien
 * voyage donc avec une mention qu'aucune console ne peut lui retirer.
 *
 * ── Ce qu'on affiche en attendant la réponse ────────────────────────────
 *
 * L'adresse du dépôt, tout de suite. Ce n'est pas un repli inventé : c'est
 * une valeur déclarée dans le code, lisible, et qui fonctionne. Un écran qui
 * attendrait le réseau pour afficher un bouton rendrait le site dépendant
 * d'un appel dont il peut très bien se passer.
 *
 * ── Et si la réponse dit n'importe quoi ─────────────────────────────────
 *
 * `avecLien` revalide chaque adresse reçue avant de la poser. Le serveur
 * valide déjà — mais c'est ce fichier qui met l'adresse SOUS le logo du
 * partenaire, et sur ce point précis il n'a aucune raison de faire confiance
 * à une réponse. Une adresse refusée laisse celle du dépôt.
 */

import { useEffect, useMemo, useState } from 'react'

import { BASE_API } from './donnees.ts'
import { LEBONCOIN, PAPERNEST, avecLien, type Partenaire } from './partenaires.ts'

export interface Partenaires {
  readonly papernest: Partenaire
  readonly leboncoin: Partenaire
}

/** Ceux du dépôt, sans aucun réglage. Ce que voit un visiteur hors ligne. */
export const PARTENAIRES_DU_DEPOT: Partenaires = {
  papernest: PAPERNEST,
  leboncoin: LEBONCOIN,
}

/** Applique les adresses reçues, en refusant celles qui ne passent pas. */
export function appliquer(liens: Readonly<Record<string, string>>): Partenaires {
  return {
    papernest: avecLien(PAPERNEST, liens[PAPERNEST.nom]),
    leboncoin: avecLien(LEBONCOIN, liens[LEBONCOIN.nom]),
  }
}

/** Les adresses d'une réponse, ou `{}` si elle n'a pas la forme attendue. */
export function liensDeLaReponse(corps: unknown): Record<string, string> {
  if (typeof corps !== 'object' || corps === null) return {}
  const liens = (corps as { liens?: unknown }).liens
  if (typeof liens !== 'object' || liens === null) return {}
  const propres: Record<string, string> = {}
  for (const [nom, lien] of Object.entries(liens)) {
    if (typeof lien === 'string') propres[nom] = lien
  }
  return propres
}

export function usePartenaires(base = BASE_API): Partenaires {
  const [liens, setLiens] = useState<Readonly<Record<string, string>>>({})

  useEffect(() => {
    let vivant = true
    fetch(`${base}/partenaires`)
      .then((r) => (r.ok ? r.json() : null))
      .then((corps: unknown) => {
        if (vivant) setLiens(liensDeLaReponse(corps))
      })
      .catch(() => {
        /* Pas de réseau, ou pas de serveur : les adresses du dépôt restent
           affichées. Elles fonctionnent — c'est tout l'intérêt qu'elles
           soient dans le code. */
      })
    return () => {
      vivant = false
    }
  }, [base])

  return useMemo(() => appliquer(liens), [liens])
}
