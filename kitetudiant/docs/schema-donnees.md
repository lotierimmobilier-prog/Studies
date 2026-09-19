# Schéma de données — étape 3

Proposition, **non appliquée**. Le prompt d'amorçage demande de montrer le
schéma avant de l'exécuter.

- DDL : [`db/schema.sql`](../db/schema.sql)
- Tests de contraintes : [`db/tests_contraintes.sql`](../db/tests_contraintes.sql)
- Validation : `PGURL=… db/valider_schema.sh`

## Deux schémas, deux régimes

| Schéma | Contenu | Régime |
| --- | --- | --- |
| `reference` | Données publiques millésimées : communes, établissements, formations, statistiques d'admission, loyers, CROUS, transport, barèmes | Aucune personne physique. Un millésime publié ne se modifie jamais. |
| `eleve` | Profils, bulletins, simulations, paniers | Données de mineurs. Minimisation, chiffrement au repos, purge datée. |

La séparation n'est pas cosmétique : elle permet de donner à l'application un
rôle en lecture seule sur `reference` et d'isoler `eleve` derrière ses propres
droits, son chiffrement et sa purge.

## Les clés pivots, corrigées par l'inventaire

| Entité | Clé retenue | Pourquoi |
| --- | --- | --- |
| Établissement | `uai` | Présent partout, 4 058 valeurs sur Parcoursup 2025 |
| Commune | `code_insee` | Absent de Parcoursup : reconstruit, la méthode est stockée dans `etablissement.code_insee_methode` |
| Formation | `cod_aff_form` | 14 252 valeurs, unique, vérifié. Le code Onisep AF/FOR **n'existe dans aucun jeu Parcoursup** |
| Pont cartographie | `g_ta_cod` | Extrait de l'URL de fiche, retrouvé à 100 % dans `carto.gta` |

`code_insee_methode` porte une contrainte : une commune rattachée doit dire
comment elle l'a été (`polygone`, `nom_departement`, `arrondissement`,
`accord_des_deux`). Une jointure sur libellé qui ne s'avoue pas est une dette
silencieuse ; celle-ci est déclarée dans la donnée.

## Ce que les contraintes empêchent

Les règles de `CLAUDE.md` ne sont pas seulement dans le code : elles sont dans
le schéma, donc vraies même pour un script d'import écrit plus tard.

| Contrainte | Règle appliquée |
| --- | --- |
| `ligne_budget_montant_source` | Un montant calculé sans source, millésime et hypothèse est **rejeté** (règle 1) |
| `ligne_budget_absence_motivee` | Une ligne manquante sans raison est rejetée (« une donnée manquante s'affiche comme manquante ») |
| `simulation_rav_absent_si_indeterminable` | Un RAV chiffré ne peut pas coexister avec un verdict indéterminable |
| `simulation_postes_manquants_coherents` | Un poste manquant interdit de conclure |
| `bareme_aide_texte_non_vide` | Un barème sans texte officiel est rejeté |
| `profil_consentement_si_mineur` | Pas de profil mineur sans consentement parental horodaté (règle 3) |
| `indicateur_logement_bornes_ordonnees` | Une fourchette de loyer incohérente est rejetée |
| `panier_voeu_rang_parcoursup` | Dix vœux au plus, comme Parcoursup |

Et ce que le schéma **ne fait pas** : `panier_voeu.signalement` signale un vœu,
il ne le supprime pas. Aucune colonne ne permet de retirer un vœu du panier
par calcul (règle 4).

Les neuf contraintes ci-dessus sont exercées une à une par
`db/tests_contraintes.sql`, sur une vraie instance PostgreSQL 16 : chaque
insertion interdite est rejetée, et le vœu signalé reste bien dans le panier.

## Ce que le schéma refuse de stocker

- **Pas de tarif ni de capacité CROUS.** Les colonnes n'existent pas, plutôt
  que d'exister vides et d'inviter à les remplir au jugé : l'open data ne les
  contient pas.
- **Pas de date de naissance.** `profil_eleve.annee_naissance` suffit à établir
  la minorité et ne suffit pas à identifier quelqu'un.
- **Pas de texte brut d'appréciation.** `bulletin_matiere` stocke des signaux
  extraits et la date à laquelle le texte source a été purgé.

## Millésimage

Chaque table de référence porte un `millesime` dans sa clé primaire, plus
`collecte_le` et `source`. Charger une nouvelle année est une insertion, pas
une mise à jour : l'historique reste consultable et une simulation ancienne
reste reproductible. `reference.formation` utilise `session` comme millésime,
au nom que Parcoursup lui donne.

## La table qui porte la licence

`reference.formation_onisep` est isolée, et son commentaire SQL rappelle que
l'ODbL impose le partage à l'identique. Tant que le point 3 des décisions
n'est pas tranché, aucune vue exportée ne doit la joindre.

## Drizzle

Le prompt demande des migrations Drizzle. `drizzle-orm` est une dépendance
nouvelle, et `CLAUDE.md` interdit d'en ajouter sans accord. Le DDL est donc
livré en SQL, qui est de toute façon ce que Drizzle produit, et la traduction
en `drizzle-kit` suivra une fois la dépendance validée — le schéma, lui, est
déjà arrêté et vérifié.
