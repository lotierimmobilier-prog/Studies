/**
 * Les partenariats rémunérés, vus depuis l'application web.
 *
 * ── Pourquoi ce fichier ne contient plus rien ───────────────────────────
 *
 * Ils vivaient ici. L'API a désormais besoin des mêmes définitions : c'est
 * elle qui valide l'adresse réglée en console, et elle doit la valider avec
 * EXACTEMENT la règle qu'applique le navigateur — sans quoi les deux
 * finiraient par diverger, et la divergence porterait sur le domaine vers
 * lequel pointe un lien payé.
 *
 * Or le VPS ne reçoit pas `kitetudiant/web` : le script de déploiement n'y
 * recopie que `server/` et `kitetudiant/packages/`. Un import de l'API vers
 * ce dossier ne casse ni au build ni aux tests — il casse au démarrage, sur
 * la machine, et nginx répond 502 pendant que le front s'affiche
 * parfaitement. C'est `server/__tests__/deploiement.test.ts` qui l'a
 * attrapé, comme le 19/09/2026 pour les barèmes.
 *
 * Les définitions sont donc dans `packages/partenaires`, avec les autres
 * choses que les deux côtés partagent. Ce fichier reste pour que les écrans
 * gardent leur import court — et pour que les tests qui interdisent de
 * recopier l'adresse en dur continuent de désigner un endroit précis.
 */

export {
  LEBONCOIN,
  PAPERNEST,
  PARTENAIRES_GERES,
  REL_PARTENAIRE,
  avecLien,
  lienAutorise,
  partenaireGere,
  relDe,
  type Partenaire,
  type Verdict,
} from '../../packages/partenaires/src/index.ts'
