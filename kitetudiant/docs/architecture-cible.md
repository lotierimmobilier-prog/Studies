# Architecture cible

Écrit le 20/09/2026, après l'audit du dépôt et les quatre arbitrages consignés
dans [`DECISIONS.md`](../DECISIONS.md) (D1 à D4).

Ce document dit **où va le produit**. Le découpage en lots est dans
[`jalons.md`](jalons.md).

---

## 1. Le socle, et pourquoi il ne bouge pas

```
navigateur                     serveur Node (VPS France)        PostgreSQL 16
──────────                     ─────────────────────────        ─────────────
Vite 5 + React 18              30 endpoints /api                schéma reference
routeur maison                 pas de framework HTTP              (public, millésimé)
styles.css écrit main          AES-256-GCM au repos             schéma eleve
                               nginx + pm2                        (comptes, vœux)
packages/ (calcul pur) ◄───────┘                                schéma communaute
  RAV · barèmes · admissibilité · affinité                         (retours)
```

Trois choses ne changent pas, parce qu'elles marchent et qu'elles portent les
garanties du projet :

**Les `packages/` restent purs.** Aucun ne connaît React, aucun ne fait de
requête réseau. Le RAV, les barèmes sourcés, l'admissibilité et l'affinité sont
des fonctions. C'est ce qui permet de refaire entièrement l'interface sans
toucher une ligne de calcul — et c'est ce qui rend la règle 1 vérifiable :
chaque fonction rend le montant **et** sa provenance.

**Le calcul du RAV reste dans le navigateur.** Décision D1. Il ne remonte pas,
donc il n'est pas stocké, donc il ne peut pas être affiché à partir
d'hypothèses inventées.

**Les gardes de tests restent applicables.** Décision D2 : pas de Tailwind,
donc `styles.test.ts` et `images.test.ts` continuent de protéger ce qu'ils
protègent.

---

## 2. Ce qui s'ajoute

### 2.1 Une base PostgreSQL, pour trois choses seulement

| Schéma | Ce qu'il contient | Qui l'écrit |
| --- | --- | --- |
| `reference` | Formations, établissements, communes, statistiques d'admission, loyers, CROUS, barèmes. **Millésimé, public, aucune personne physique.** | Les scripts d'import, jamais l'application |
| `eleve` | Comptes (adresse chiffrée), sessions, profil déclaratif, listes de vœux. **Rien de scolaire, rien de financier.** | L'application |
| `communaute` | Retours d'étudiants : trois axes chiffrés, aucun texte libre. | L'application |

L'application a un rôle **en lecture seule** sur `reference`. Un bug ne peut
pas corrompre une donnée publique millésimée.

### 2.2 Pourquoi une base alors que ça marchait en fichiers

Trois besoins que les fichiers JSON ne couvrent pas :

1. **L'explorateur à facettes.** « Combien de BTS à Limoges ? » avec les
   compteurs par filière, par thème et par statut, mis à jour à chaque clic.
   Aujourd'hui chaque recherche part vers l'API du ministère, limitée à 100
   résultats, sans agrégat. Un `GROUP BY` local répond en millisecondes sur
   les 14 252 formations.
2. **La carte.** Afficher les formations d'une zone au fur et à mesure du zoom
   demande une requête géographique. C'est exactement ce que fait PostGIS, et
   ce qu'aucune API tierce ne nous rendra.
3. **Les vœux persistés.** Décision D1.

Ce qui **n'est pas** une raison : les comptes. Le fichier chiffré fonctionne.
On l'y migre parce qu'il faut joindre un compte à ses vœux, pas parce qu'il
faiblissait.

### 2.3 Les URL qui manquent

C'est le manque le plus structurant relevé par l'audit : **une formation n'a
aucune adresse aujourd'hui.** Elle n'existe que comme carte dans une liste.
Sans URL, pas de page détaillée, pas de partage, pas de favori, pas
d'indexation, pas de vœu qu'on retrouve.

```
/                             accueil
/explorer                     explorateur à facettes + carte
/formation/:codAffForm        fiche, trois onglets
/etablissement/:uai           l'établissement et ses formations
/mes-voeux                    la liste de vœux
/mon-profil                   le profil déclaratif
/logement/:codeInsee          se loger dans cette ville          (MVP2)
/bons-plans                   les bons plans                     (MVP2)
/comparer?v=…&v=…             comparaison de vœux                (MVP3)
```

`routes.ts` est un type somme exhaustif : ajouter une route oblige le
compilateur à traiter le cas partout. C'est la propriété qu'on veut garder en
grossissant, et c'est pourquoi on n'ajoute pas de routeur tiers.

`cod_aff_form` dans l'URL, pas un slug : c'est la clé pivot (D7), et un slug
fabriqué depuis un libellé se réécrit d'une session à l'autre.

### 2.4 La carte

Décision D4. MapLibre GL **uniquement** sur `/explorer`, chargé par `import()`
dynamique. Le lecteur de tuiles maison (`web/src/carte.tsx`) sur les fiches.
Tuiles Géoplateforme IGN dans les deux cas — France, sans clé d'API.

Un garde de test vérifiera qu'aucun module hors explorateur n'importe MapLibre
statiquement : sans lui, un `import` distrait le ferait revenir sur l'accueil.

---

## 3. Les flux de données

### 3.1 Ce qui monte, ce qui ne monte pas

```
         navigateur                              serveur
         ──────────                              ───────
notes, appréciations, bulletins   ✗  ─────╳       (aucune table)
bourse, contribution, train de vie ✗ ─────╳       (aucune table)
RAV calculé                        ✗  ─────╳       (aucune colonne)
spécialités, options               ✗  ─────╳       (aucune table)
cartes de la collection            ✗  ─────╳       (aucune table)

année de naissance, bac, commune   ✓  ────────►   eleve.profil_eleve
liste de vœux, rang, signalement   ✓  ────────►   eleve.panier_voeu
adresse e-mail                     ✓  ────────►   eleve.compte (chiffrée)
```

La règle à réciter : **le serveur garde ce qui identifie un choix, jamais ce
qui décrit une personne.**

### 3.2 Conséquence assumée sur le RAV

Un vœu enregistré n'a pas son RAV en base. Sur un appareil qui a le profil
budgétaire, la fiche l'affiche ; sur un autre, elle dit **pourquoi** elle ne
l'affiche pas et propose de renseigner le budget.

C'est moins commode qu'un chiffre toujours là. C'est la seule version
compatible avec la règle 1 : un RAV recalculé côté serveur à partir
d'hypothèses qu'on n'a pas serait un montant inventé.

### 3.3 Les données de référence

Trois régimes, et il faut les distinguer :

| Donnée | Régime | Fraîcheur |
| --- | --- | --- |
| Formations, statistiques d'admission, communes, loyers | **Importée** en base, millésimée | Une campagne d'import par session |
| Résultats des lycées, doublettes de spécialités | **Interrogée en direct** depuis le navigateur | Temps réel |
| Barèmes (CVEC, bourse, droits, repas) | **Versionnée dans le dépôt**, avec ses références | Revue manuelle, alerte à péremption |

Les résultats de lycée et les doublettes restent en direct parce qu'ils ne
servent qu'à un écran, qu'ils sont volumineux, et que les importer nous
obligerait à les maintenir. Ils portent leur millésime à l'écran — le dernier
publié pour les lycées est **2023**, pas l'année en cours.

---

## 4. Plan de migration

Aucune étape ne casse la production. Chacune est réversible tant que la
suivante n'a pas commencé.

### Étape A — L'instance (aucun effet visible)

Installer PostgreSQL 16 + PostGIS sur le VPS, créer les rôles, appliquer
`001-socle.sql`. Le site continue de tourner tel quel.

**Rôles :** `kitetudiant_app` en lecture seule sur `reference`, lecture-écriture
sur `eleve` et `communaute`. `kitetudiant_import` en écriture sur `reference`
uniquement. Deux rôles, parce qu'un seul finirait par tout pouvoir.

### Étape B — L'import (aucun effet visible)

Remplir `reference` avec Parcoursup 2025 et les loyers 2025. Le site continue
d'interroger l'API du ministère. On compare les deux, et on ne bascule pas
avant que les chiffres coïncident.

### Étape C — La lecture bascule

Les écrans de recherche passent de l'API tierce à la base. **Garde-fou :** si
la base ne répond pas, on retombe sur l'API du ministère — le site ne tombe
pas parce qu'une base est indisponible.

### Étape D — Les comptes

`002-comptes-profils-voeux.sql`, puis migration du fichier chiffré vers
`eleve.compte`. Le fichier est **conservé en lecture** pendant une campagne :
un compte absent de la base y est cherché, puis recopié. Aucune connexion ne
casse.

Un renforcement au passage : les jetons de session, aujourd'hui stockés en
clair dans le fichier, ne sont plus stockés qu'en empreinte SHA-256.

### Étape E — Les vœux

La liste de vœux devient persistable. Un élève déjà connecté se voit proposer
**une fois** d'enregistrer la liste qu'il a dans son navigateur. Pas de
remontée silencieuse : on ne fait pas monter des données d'un mineur sans le
lui dire.

### Étape F — Le fichier de comptes disparaît

Une fois la campagne close et vérifiée, et pas avant.

---

## 5. Ce que l'architecture refuse

| Refus | Pourquoi |
| --- | --- |
| Une note globale par formation | Règle 5. Les trois scores restent séparés, et aucune colonne ne permet d'en calculer une quatrième. |
| Supprimer un vœu par calcul | Règle 4. `panier_voeu.signalement` signale ; aucune colonne ne retire. |
| Un montant sans source ni millésime | Règle 1. La contrainte `ligne_budget_montant_source` l'exprime déjà dans le schéma de conception. |
| Une jointure sur libellé | Les trois clés pivots : UAI, INSEE, `cod_aff_form`. `etablissement.code_insee_methode` oblige une commune rattachée à dire **comment** elle l'a été. |
| Modifier un millésime publié | `communaute.millesime_clos` et son déclencheur le refusent en base, pas seulement dans l'application. |
| Une image ou une tuile servie par un tiers | Elle enverrait l'adresse IP de l'élève. `images.test.ts` l'interdit déjà. |
| Un parrainage | D8. Il faudrait un graphe social de mineurs. |
