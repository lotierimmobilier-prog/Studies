# Décisions

Journal des arbitrages. Une décision y entre avec sa date, ce qu'elle tranche,
ce qu'elle coûte, et ce qu'on perd en la prenant. Une décision sans coût écrit
est une décision qu'on n'a pas vraiment prise.

Les règles de [`CLAUDE.md`](CLAUDE.md) ne sont pas des décisions : elles sont
le cadre dans lequel les décisions se prennent. Aucune ligne de ce fichier ne
peut les contredire.

---

## D1 — Les vœux montent au serveur, les notes restent dans le navigateur

**Tranché le 20/09/2026.**

### L'état de départ

Le serveur ne savait d'un élève qu'une adresse e-mail chiffrée et trois dates.
Les réponses au parcours, les moyennes, les bulletins, les vœux et les cartes
vivaient **uniquement** dans son navigateur. La page d'accueil le promettait en
toutes lettres : « il n'enregistre aucune donnée scolaire ».

Cette garantie ne tenait pas à une politique d'accès, mais à une **impossibilité
d'accès** : la donnée n'existait nulle part sur le serveur. C'est une garantie
beaucoup plus forte, et beaucoup plus fragile — il suffit d'une table pour la
perdre.

### Ce qui est décidé

| Catégorie | Où elle vit | Pourquoi |
| --- | --- | --- |
| Liste de vœux, rang, classe de risque, signalement | **Serveur** | Un vœu qu'on perd en changeant de téléphone n'est pas un vœu, c'est un brouillon. C'est la raison d'être d'un compte. |
| Profil déclaratif : année de naissance, type de bac, commune, mobilité acceptée | **Serveur** | Nécessaire pour retrouver une liste de vœux cohérente d'un appareil à l'autre. Aucun de ces champs n'est une note. |
| Moyennes, appréciations, bulletins, spécialités, résultats du lycée | **Navigateur** | Ce sont les données scolaires. Elles ne montent pas. |
| Contribution familiale, bourse estimée, job étudiant, train de vie | **Navigateur** | La situation financière d'une famille est au moins aussi sensible qu'un bulletin. Rien ne l'oblige à quitter l'appareil : le RAV se calcule dans le navigateur. |
| Cartes de la collection | **Navigateur** | Inchangé. |

La règle qui départage, et qu'on doit pouvoir réciter : **le serveur garde ce
qui identifie un choix, jamais ce qui décrit une personne.**

### Ce que ça coûte

- La promesse d'accueil devient fausse telle qu'elle est écrite. Elle doit
  passer de « aucune donnée scolaire » à une formulation exacte — « tes notes
  et ton budget ne quittent pas ton navigateur ; ta liste de vœux, si tu es
  connecté, est enregistrée pour que tu la retrouves ». Une promesse qu'on
  rétrécit sans le dire est un mensonge ; une promesse qu'on précise en
  expliquant pourquoi est tenable.
- Le RAV restant calculé dans le navigateur, il **n'est pas stocké** à côté du
  vœu. La fiche d'un vœu enregistré affiche donc son RAV seulement quand le
  profil budgétaire est présent sur l'appareil, et **dit pourquoi** quand il
  ne l'est pas. Pas de montant recalculé côté serveur avec des hypothèses
  inventées : la règle 1 l'interdit.
- Les tables `eleve.bulletin_matiere`, `eleve.ligne_budget`,
  `eleve.simulation_voeu` et les colonnes financières de `eleve.profil_eleve`
  existent dans `db/schema.sql` mais **ne sont pas déployées** (voir D5).

### Écarté

- **Tout au serveur, chiffré.** Parité complète avec le concurrent, mais il
  faut réécrire la promesse d'accueil, refaire les statistiques d'administration
  — bâties pour n'avoir accès à rien —, et assumer de détenir les bulletins de
  mineurs. Le gain fonctionnel ne le paie pas.
- **Tout reste dans le navigateur.** Aucune régression, mais les vœux se
  perdent au premier vidage de cache, et l'espace étudiant reste un
  récapitulatif local qui ne justifie pas de créer un compte.

---

## D2 — On reste sur Vite + React

**Tranché le 20/09/2026.** Contredit la section « Stack » de `CLAUDE.md`, qui
décrit Next.js 15 App Router.

### Le constat

`CLAUDE.md` décrit une cible jamais atteinte. Le site en production est une
application Vite 5 + React 18 avec **trois dépendances** (`react`, `react-dom`,
`@anthropic-ai/sdk`), 2 283 lignes de CSS écrites à la main, un routeur maison,
un pré-rendu maison, et 669 tests verts.

### Ce qui est décidé

On garde Vite + React. On ajoute ce qui manque — des URL propres pour les
formations et les établissements, un routeur qui les connaît — sans changer de
socle.

### Ce que ça coûte

- Pas de rendu serveur. Le référencement repose sur `scripts/prerendre.ts`,
  qui fabrique une page statique par article et par route connue. **Une page
  de formation par formation n'est pas pré-rendable** : il y en a 14 252, et
  leur contenu vient d'une API tierce. Ces pages seront donc indexées comme des
  pages d'application, moins bien qu'un rendu serveur. C'est le prix, et il
  faudra le mesurer avant de décider s'il devient inacceptable.
- Pas de composants prêts à l'emploi : chaque écran de MVP1 est écrit.

### Ce que ça préserve

Trois gardes de tests qui protègent des choix de conception et qui
**ne survivraient pas à une migration vers Tailwind** :

- `styles.test.ts` interdit qu'une classe CSS serve à deux usages ;
- `images.test.ts` exige `width`, `height`, `alt` sur chaque image et interdit
  toute image servie par un tiers — « enverrait l'adresse IP de chaque élève à
  un service tiers » ;
- `collection.test.ts` interdit les mots `parrain*`, `filleul*`, `referral`,
  `utm_` dans le code : le parrainage est rendu **impossible**, pas seulement
  non implémenté.

### À revoir

Si le référencement des pages de formation s'avère insuffisant après mesure,
la question du rendu serveur se rouvre — et se posera alors sur un périmètre
stabilisé, ce qui est le bon moment.

---

## D3 — PostgreSQL 16 + PostGIS hébergé en France, pas Supabase

**Tranché le 20/09/2026.**

### Ce qui est décidé

Une instance PostgreSQL 16 avec PostGIS, hébergée en France. Migrations SQL
versionnées, appliquées dans l'ordre, jamais rejouées. Pas d'ORM pour l'instant
(voir D6).

### Pourquoi pas Supabase

- La règle 3 de `CLAUDE.md` impose l'hébergement France. Supabase ne le
  garantit pas : on choisit une **région**, européenne au mieux.
- Les garanties actuelles tiennent parce que **la donnée n'existe pas**. Sous
  Supabase, elles tiendraient parce qu'une politique RLS l'interdit. Passer de
  l'une à l'autre veut dire re-dériver chaque garantie, l'écrire en SQL, et la
  tester — un travail réel, sur des données de mineurs, pour retrouver ce qu'on
  avait déjà.

### Ce que ça coûte

- Sauvegardes, montée de version, surveillance : à notre charge.
- Pas d'auth ni de stockage fournis. L'authentification existante
  (`server/comptes.ts`) est reprise telle quelle, elle fonctionne.

---

## D4 — MapLibre sur l'explorateur, lecteur de tuiles maison sur la fiche

**Tranché le 20/09/2026.** Première dépendance front ajoutée depuis l'origine
du projet.

### Ce qui est décidé

| Écran | Rendu | Pourquoi |
| --- | --- | --- |
| Explorateur (milliers de points, regroupement, zoom continu) | **MapLibre GL**, chargé à la demande | Le regroupement de milliers de points avec un zoom fluide sur mobile n'est pas raisonnable à réécrire. |
| Fiche d'une formation (un point) | **`web/src/carte.tsx`**, sans dépendance | Environ 200 lignes contre 200 Ko compressés, pour afficher un seul marqueur. |

Les tuiles viennent de la **Géoplateforme IGN** dans les deux cas :
`data.geopf.fr`, couche `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`. Vérifié le
20/09/2026 : réponse 200, `image/png`, **sans clé d'API**, servi depuis la
France. Aucun fond de carte étranger : une tuile demandée à un tiers lui envoie
l'adresse IP de l'élève et la zone qu'il regarde.

### Ce que ça coûte

- MapLibre n'est chargé que sur l'écran explorateur, jamais sur l'accueil ni
  sur une fiche. Un `import()` dynamique, et un garde de test qui vérifie
  qu'aucun autre module ne l'importe statiquement.
- Une dépendance de plus à suivre : version, avis de sécurité, taille.

### Ce que la carte de fiche ne sait pas faire

Rotation, inclinaison, couches vectorielles, itinéraires. Rien de tout cela
n'est nécessaire pour montrer où se trouve une école.

---

## D5 — Les tables hors périmètre ne sont pas déployées

**Tranché le 20/09/2026.**

`db/schema.sql` décrit des tables que D1 met hors périmètre :
`eleve.bulletin_matiere`, `eleve.ligne_budget`, `eleve.simulation_voeu`, et
les colonnes financières de `eleve.profil_eleve`.

Elles **ne sont pas créées** sur l'instance. Elles ne sont pas non plus
supprimées du fichier : le schéma reste le document de conception complet, et
la migration effective ne prend que ce qui est déployé.

Une table vide est une invitation à la remplir. Une table absente est une
décision.

---

## D6 — Pas d'ORM pour l'instant

**Tranché le 20/09/2026.** Confirme ce que notait déjà `docs/schema-donnees.md`.

`CLAUDE.md` mentionne Drizzle. C'est une dépendance nouvelle, et `CLAUDE.md`
interdit d'en ajouter sans accord. Le DDL est écrit en SQL — ce que Drizzle
produit de toute façon.

**Un pilote PostgreSQL reste nécessaire** (`pg` ou `postgres`) : Node n'en a
pas. C'est une dépendance à valider avant le lot de MVP1 qui branche la base.
Voir les questions ouvertes.

---

## D7 — `cod_aff_form` est la clé pivot des formations

**Tranché le 19/09/2026**, confirmé le 20/09/2026 par l'inventaire.

`CLAUDE.md` annonce le code Onisep AF/FOR. L'inventaire a établi qu'il
**n'existe dans aucun jeu Parcoursup**. `cod_aff_form` a 14 252 valeurs sur la
session 2025, uniques et vérifiées.

L'Onisep reste un **enrichissement à la maille établissement**, isolé dans
`reference.formation_onisep` parce que sa licence ODbL est contaminante :
aucune vue exportée ne joint cette table sans arbitrage explicite.

UAI (établissement) et code INSEE (commune) sont confirmés.

---

## D8 — Aucun parrainage, jamais

**Tranché antérieurement, rappelé ici parce qu'un espace étudiant le fait
resurgir.**

Un mécanisme de parrainage adressé à des mineurs oblige à savoir qui a invité
qui, donc à bâtir un graphe social d'élèves. La règle 3 l'interdit.

La viralité passe par le partage d'une carte en image, qui ne collecte rien.
`collection.test.ts` interdit les mots correspondants dans tout le code : ce
n'est pas une intention, c'est un garde.

---

## D9 — Pas de synchronisation Pronote

**Tranché antérieurement.**

Elle exigerait les identifiants ENT d'un mineur. La règle 2 interdit déjà
l'accès au compte Parcoursup ; le même raisonnement vaut ici, en pire — un ENT
donne accès à bien plus qu'un dossier de candidature.

---

## D10 — Les statistiques d'administration ne voient personne

**Tranché le 20/09/2026.**

Compteurs et agrégats anonymes. Aucune adresse e-mail, aucun identifiant,
aucune note exacte (des tranches), aucun vœu, aucune heure, aucune adresse IP.

Vérifié en production : un relevé délibérément « sale » — e-mail, jeton, IP,
moyennes — a été déposé, et **rien n'en a survécu sur le disque**. Le serveur
reconstruit chaque champ plutôt que de filtrer ceux qu'il connaît ; un filtre
laisse passer ce qu'il n'a pas prévu.

D1 ne change rien ici : les vœux enregistrés n'entrent dans aucun agrégat
nominatif.

---

## D11 — Le pilote PostgreSQL est `postgres` (porsager)

**Tranché le 20/09/2026.** Clôt Q1. Première dépendance serveur ajoutée depuis
`@anthropic-ai/sdk`.

### Pourquoi celui-là

- **Aucune dépendance transitive.** Une de plus dans un projet qui en compte
  trois, et pas une arborescence.
- **Requêtes préparées par défaut.** Les valeurs interpolées dans un gabarit
  `sql\`…\`` deviennent des paramètres, jamais du texte concaténé. Écrire une
  injection SQL par accident y demande un effort ; avec une API qui prend une
  chaîne, c'est l'inverse. Sur un service qui stocke les vœux de mineurs, ce
  n'est pas un détail de confort.

### Écarté

`pg` (node-postgres) : le plus répandu et le mieux documenté, mais il tire des
dépendances transitives, et sa mise en forme des requêtes laisse plus de place
à une faute.

### Ce que ça n'autorise pas

Une dépendance validée pour la base ne vaut pas blanc-seing pour les
suivantes. La règle de `CLAUDE.md` reste entière.

---

## D12 — La collection a une adresse, et son entrée reste visible

**Tranché le 20/09/2026.**

### Deux défauts, dont un que je n'avais pas vu

**L'entrée « Mes cartes » n'apparaissait qu'une fois la première carte
gagnée.** Le raisonnement d'origine — « une entrée vide serait du bruit pour
un visiteur qui découvre le site » — a un défaut qui n'apparaît qu'à l'usage :
une entrée cachée derrière la chose qu'elle sert à découvrir ne se découvre
jamais. On ne tombait sur la collection que par accident.

**La collection n'avait aucune adresse.** Elle n'était qu'un état en mémoire :
impossible à partager, à mettre en favori, ou à retrouver avec le bouton
« précédent ». Exactement le défaut que les fiches de formation venaient de
perdre, et qui survivait ici sans que personne le remarque.

### Ce qui est décidé

`/mes-cartes`, et une entrée toujours présente dans la barre — avec le compte
entre parenthèses quand il y a quelque chose à compter. La page, elle,
montrait déjà toutes les récompenses possibles avec leur état : un visiteur
qui arrive à zéro carte voit donc ce qu'il y a à gagner et comment.

### Effet de bord

Toutes les entrées de la barre ont désormais une adresse. La branche qui
gérait les entrées sans adresse — un bouton plutôt qu'un lien — est supprimée :
du code mort qui aurait fini par resservir.

---

## D13 — L'Onisep est lié, jamais intégré

**Tranché le 20/09/2026.** Clôt Q2.

L'Onisep publie de vraies fiches de débouchés, ce que Parcoursup ne fait pas.
Son jeu est sous **ODbL**, qui impose le partage à l'identique : l'intégrer
engagerait tout ce qu'on en dérive, pour toujours, et pas seulement l'écran
qui l'affiche.

L'onglet « Après » propose donc une **recherche sur leur site**. Aucune de
leurs données n'est utilisée, aucune obligation n'est déclenchée, et l'élève a
l'information.

`reference.formation_onisep` reste dans le document de conception et n'est
créée par aucune migration.

### Ce qui n'a pas pu être vérifié

`onisep.fr` répond **403** à notre environnement de développement, comme
leboncoin. Le format des paramètres de recherche n'est donc pas confirmé sur
pièce. Le libellé du lien dit « **chercher** cette formation sur l'Onisep » et
non « la fiche de cette formation » : si le paramètre est ignoré, l'élève
arrive quand même là où l'information se trouve, et le lien n'aura rien promis
qu'il ne tient pas.

---

## Questions encore ouvertes

| # | Question | Ce qui bloque | Échéance |
| --- | --- | --- | --- |
| ~~Q1~~ | ~~Pilote PostgreSQL~~ | **Tranchée le 20/09/2026** — voir D11. | |
| ~~Q2~~ | ~~Licence ODbL de l'Onisep~~ | **Tranchée le 20/09/2026** — voir D13. | |
| Q3 | Communes sans loyer publié : Faaa, Mamoudzou, Papeete, Pirae, Dembeni… 98 formations en outre-mer. Que montre-t-on ? | Aujourd'hui : « donnée manquante », conformément à `CLAUDE.md`. Faut-il chercher une autre source ? | Avant MVP2 (logement). |
| Q4 | Données CROUS de 2017 : millésime très ancien. Les garde-t-on affichées ? | Elles portent leur millésime, donc la règle 6 est tenue. Reste qu'un chiffre de 2017 en 2026 informe mal. | Avant MVP2. |
| Q5 | Disponibilité réelle des logements : aucune source publique ne la publie. | Les « bons plans logement » ne peuvent pas promettre une disponibilité. | Avant MVP2. |
| Q6 | leboncoin répond 403 à nos requêtes, y compris depuis un vrai navigateur. Les paramètres de filtre n'ont pas pu être vérifiés. | Le lien est construit au mieux, et n'est pas garanti. | Avant MVP2. |
