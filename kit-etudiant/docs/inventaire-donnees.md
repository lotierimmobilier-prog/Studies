# Inventaire des données — étape 1

Collecte du 19 septembre 2026. Neuf fichiers téléchargés, profilés colonne par
colonne, puis testés en jointure. Aucun nom de colonne n'est supposé : tous
proviennent de la lecture des CSV réels, et les taux de valeurs manquantes sont
calculés sur l'intégralité des lignes, pas sur un échantillon.

Reproduire :

```bash
pip install -r scripts/exploration/requirements.txt
python3 scripts/exploration/telecharger.py   # -> data/brut/ + manifeste.json (URL, date, SHA-256)
python3 scripts/exploration/profiler.py      # -> data/profil.json
python3 scripts/exploration/jointures.py     # -> data/jointures.json
```

```bash
python3 scripts/exploration/annexe_colonnes.py   # -> docs/annexe-colonnes.md
```

Les CSV bruts ne sont pas versionnés (`.gitignore`) ; le manifeste, le profil et
le rapport de jointure le sont.

La **liste exacte et complète des colonnes** des neuf jeux, avec leur type
déclaré, leur taux de valeurs manquantes, leur cardinalité et un exemple réel,
est en [annexe](annexe-colonnes.md) — générée, jamais saisie à la main. Le
présent document ne reprend que les colonnes critiques et les pièges.

## Ce qu'il faut retenir

1. **La chaîne de jointure du RAV tient.** 99,11 % des formations Parcoursup 2025
   situées en France obtiennent un loyer de référence. Le seuil de 95 % fixé à
   l'étape 2 est franchi sans stratégie de réconciliation lourde.
2. **Mais Parcoursup ne porte aucun code INSEE.** Il n'y a que `ville_etab`
   (libellé) et un point GPS. Le code commune doit être reconstruit, ce qui
   contredit la règle « aucune jointure sur libellé texte » de CLAUDE.md. C'est
   la première décision à trancher (voir « Points à arbitrer »).
3. **Le code Onisep AF/FOR, troisième clé pivot, n'existe dans aucun jeu
   Parcoursup.** Le pont Parcoursup ↔ Onisep ne peut se faire qu'à la maille
   établissement, par UAI, et couvre 93,20 % des UAI. Aucun appariement
   formation à formation n'est possible avec ces seules sources.
4. **Le loyer CROUS n'est pas dans l'open data.** Le jeu « logements CROUS » ne
   contient ni tarif, ni capacité, ni nombre de places : aucune colonne de prix
   ou de capacité n'existe. C'est une entrée centrale du RAV qui manque.
5. **Le prix du repas CROUS non plus.** Même constat sur le jeu restauration.
   Le tarif du ticket RU est réglementaire et national : il devra venir du module
   de barèmes (lot L1 bis), pas de ce fichier.
6. **Les frais de scolarité Onisep sont inexploitables tels quels** : renseignés
   sur 36,40 % des actions de formation, et en texte libre
   (« de 10410 euros jusqu'à 19800 euros en 2023-2024 »). Les parser avec un LLM
   violerait la règle 1. À traiter comme donnée manquante ou à saisir à la main.
7. **L'indicateur de loyers est un loyer d'annonce estimé, pas un loyer payé** :
   charges comprises, bien loué vide, publié à titre expérimental pour le
   3ᵉ trimestre 2025. 88,77 % de ses lignes sont extrapolées depuis une maille
   plus large (`typpred = maille`) ; sur les seules communes réellement jointes à
   une formation, la proportion s'inverse : 97,81 % sont estimées au niveau
   communal.
8. **Mayotte, la Polynésie française, la Nouvelle-Calédonie et Saint-Martin sont
   hors du référentiel de loyers.** 126 formations sont concernées. Elles
   s'afficheront sans RAV, jamais avec un RAV inventé.
9. Le schéma Parcoursup est **strictement identique sur 2023, 2024 et 2025** —
   118 colonnes, mêmes noms. La calibration sur trois millésimes du lot L2 ne
   demandera aucune réconciliation de schéma.

## Les jeux de données

### 1. Parcoursup 2025 — vœux et réponses des établissements

| | |
| --- | --- |
| Identifiant | `fr-esr-parcoursup` (data.enseignementsup-recherche.gouv.fr) |
| Volume | 14 252 lignes × 118 colonnes |
| Millésime | session 2025, valeur unique dans le fichier |
| Dernière mise à jour du portail | 2026-03-09 |
| Producteur | MESR — SIES, Département des études statistiques sur l'enseignement supérieur |
| Licence | Licence Ouverte v2.0 (Etalab) |
| Clé primaire | `cod_aff_form` — 14 252 valeurs, unique, vérifié |
| Clés de jointure | `cod_uai` (4 058 établissements), `g_ta_cod` extrait de `lien_form_psup` |

Millésimes antérieurs téléchargés pour le lot L2 : `fr-esr-parcoursup_2024`
(14 079 lignes) et `fr-esr-parcoursup_2023` (13 869 lignes), même schéma.

**Colonnes critiques**

| Colonne | Type | Manquant | Remarque |
| --- | --- | --- | --- |
| `cod_aff_form` | text | 0,00 % | clé primaire de la formation |
| `cod_uai` | text | 0,00 % | clé pivot établissement |
| `ville_etab` | text | 0,00 % | libellé seul, pas de code INSEE |
| `dep` | text | 0,00 % | `99` pour l'étranger, `20` pour la Corse |
| `g_olocalisation_des_formations` | geo_point_2d | 0,27 % | repli géographique |
| `capa_fin` | int | 0,00 % | capacité d'accueil |
| `voe_tot` | int | 0,00 % | vœux reçus |
| `acc_tot` | int | 0,00 % | admis |
| `taux_acces_ens` | int | 0,11 % | 0,65 % en 2024, 0,92 % en 2023 |
| `acc_brs` | int | 0,00 % | admis boursiers, pour l'effet boursier du lot L2 |
| `pct_bours` | double | 0,00 % | part de boursiers |
| `acad_mies` | text | 0,00 % | 33 académies, pour l'effet académie |

**Pièges**

- `etablissement_id_paysage` et `composante_id_paysage` sont **vides à 100 %**
  sur le millésime 2025. Ne pas bâtir de jointure dessus.
- Les colonnes d'internat (`nb_voe_pp_internat`, `nb_cla_pp_internat`,
  `acc_internat`…) sont manquantes à 93,08 % : elles ne concernent que les
  formations avec internat. Un `NULL` y signifie « sans internat », pas
  « inconnu ». Ce sont deux choses différentes en base.
- `acc_term` / `acc_term_f` manquent à 55,54 %.
- Les groupes de classement sont dégressifs : `lib_grp1` manque à 8,69 %,
  `lib_grp2` à 58,01 %, `lib_grp3` à 75,70 %. Normal, mais à modéliser comme
  une table fille, pas comme trois colonnes.
- `detail_forma` manque à 70,11 %, `detail_forma2` à 94,16 %.
- Les colonnes `pct_*` sont **arrondies au multiple de 5** (`pct_acc_debutpp`
  ne prend que 101 valeurs distinctes, `pct_bours` 92). Ne jamais recalculer un
  effectif à partir d'un pourcentage : les effectifs bruts sont à côté.
- 22 formations ont `dep = 99` (campus à l'étranger : Rabat, Casablanca, Londres,
  Dublin, Madrid, Singapour, Hanoï, Douala, Yaoundé, Budapest, Monaco…). Elles
  n'auront jamais de loyer INSEE.

### 2. Cartographie des formations Parcoursup

| | |
| --- | --- |
| Identifiant | `fr-esr-cartographie_formations_parcoursup` |
| Volume | 157 514 lignes × 25 colonnes |
| Millésimes | 2020 à 2026 **empilés dans le même fichier** ; 25 810 lignes pour 2026 |
| Dernière mise à jour du portail | 2025-12-17 |
| Licence | Licence Ouverte v2.0 (Etalab) |
| Clés de jointure | `etab_uai`, `gta` (= `g_ta_cod`), `gti`, `rnd`, `code_formation` |

**Colonnes critiques**

| Colonne | Type | Manquant | Remarque |
| --- | --- | --- | --- |
| `annee` | text | 0,00 % | 7 millésimes — **filtrer systématiquement** |
| `etab_uai` | text | 0,00 % | 7 686 UAI |
| `gta` | text | 0,00 % | 34 607 valeurs, correspond au `g_ta_cod` Parcoursup |
| `etab_gps` | geo_point_2d | 0,00 % | |
| `commune` | text | 0,49 % | libellé seul, **pas de code INSEE** |
| `rnd` / `code_formation` | text | 10,79 % | |
| `app` | text | 61,55 % | une seule valeur : indicateur binaire déguisé |
| `int` | text | 96,69 % | idem, internat |
| `aut` | text | 83,18 % | idem, épreuves de sélection |

**Pièges**

- `app`, `int` et `aut` ne sont pas des champs textuels mais des **drapeaux** :
  une valeur unique quand la propriété est vraie, `NULL` sinon. Les importer
  comme booléens, jamais comme libellés.
- `etablissement_id_paysage` manque à 68,34 %, `composante_id_paysage` à 98,83 %.
- Le fichier n'apporte **aucun code INSEE**, seulement `commune` en clair et un
  point GPS : il n'aide pas à résoudre le problème de localisation.

### 3. Indicateur des loyers par commune, millésimé

| | |
| --- | --- |
| Identifiant | `indicateur-loyers-communes-millesime` (public.opendatasoft.com) |
| Volume | 139 600 lignes × 17 colonnes, 34 900 communes |
| Millésime | **2025 uniquement** dans l'export, malgré le nom « millésimé » ; 3ᵉ trimestre 2025 |
| Dernière mise à jour du portail | 2026-09-08 |
| Producteur | Ministère de la Transition écologique (travaux ANIL / CEREMA) |
| Licence | Open License v2.0 |
| Clé de jointure | `insee_c` (code commune INSEE) |

Quatre typologies par commune : `appartement`, `appartement 1 ou 2 pièces`,
`appartement +3 pièces`, `maison`. Pour un étudiant, la ligne pertinente est
`appartement 1 ou 2 pièces`.

Le producteur décrit lui-même l'indicateur : loyer mensuel d'annonce au m²,
charges comprises, pour des biens loués vides, estimé à partir de plus de
9 millions d'annonces SeLoger et leboncoin, **hors Mayotte**, et publié « à
titre expérimental pour le 3ᵉ trimestre 2025 ». Il recommande la prudence là où
le volume d'observations est faible ou l'intervalle de prédiction large — ce que
`nbobs_com` et l'écart `lwr_ipm2` / `upr_ipm2` permettent de mesurer ligne
par ligne.

**Colonnes critiques** — toutes renseignées à 100 % sauf `dep_name` / `reg_name`
(0,13 %).

| Colonne | Type | Remarque |
| --- | --- | --- |
| `insee_c` | text | clé de jointure |
| `year` | int | 2025 |
| `type_logement` | text | 4 modalités |
| `loypredm2` | double | loyer mensuel **d'annonce** estimé, €/m², **charges comprises**, bien loué vide |
| `lwr_ipm2` / `upr_ipm2` | double | bornes de l'intervalle de prédiction |
| `typpred` | text | `maille` 88,77 %, `commune` 10,75 %, `EPCI` 0,48 % |
| `nbobs_com` | int | nombre d'annonces observées ; **vaut 0 sur 27,35 % des lignes** |
| `r2_adj` | double | qualité de l'ajustement local |

**Pièges**

- `loypredm2` est un **loyer d'annonce prédit**, pas un loyer quittancé, et il
  porte sur des biens loués **vides** — un meublé étudiant se loue plus cher.
  Toute ligne de budget qui s'en sert doit porter ces deux hypothèses en clair
  (`hypothese` dans la signature imposée par CLAUDE.md).
- Les charges sont **déjà comprises** dans l'indicateur. Ne pas les rajouter en
  poste séparé : ce serait un double comptage direct sur le RAV.
- `typpred` est la vraie mesure de confiance, pas `r2_adj`. Une valeur `maille`
  signifie que le loyer vient d'un territoire plus large que la commune. Elle
  doit remonter jusqu'à l'affichage.
- Les bornes `lwr_ipm2` / `upr_ipm2` existent : le RAV a de quoi être une
  fourchette, ce que demande le cahier des charges. Ne pas les jeter.
- Paris, Lyon et Marseille sont découpés **par arrondissement** (`75101`…`75120`,
  `69381`…`69389`, `13201`…`13216`). Les codes communes `75056`, `69123` et
  `13055` sont **absents**. Sans table d'arrondissements, 1 666 formations
  perdent leur loyer — c'est le piège le plus coûteux du lot.
- Pas de couverture Mayotte (976) — exclusion documentée par le producteur —,
  ni Polynésie (987), Nouvelle-Calédonie (988), Saint-Martin (978).
- Indicateur publié « à titre expérimental » : la mention doit accompagner
  l'affichage, au même titre que le millésime.

### 4. Logements CROUS — France entière

| | |
| --- | --- |
| Identifiant | `fr_crous_logement_france_entiere` |
| Volume | 828 lignes × 23 colonnes |
| Producteur | CNOUS, republié par le portail ESR depuis data.gouv.fr |
| Licence | Licence Ouverte (Etalab) |
| Fraîcheur | `issued` 2017-05-12, fréquence de mise à jour déclarée « Ponctuel » |
| Clé de jointure | **aucune** — ni UAI, ni INSEE, ni code postal isolé |

**Colonnes critiques**

| Colonne | Type | Manquant | Remarque |
| --- | --- | --- | --- |
| `id` | int | 0,00 % | 828 valeurs, unique |
| `title` | text | 0,00 % | 800 valeurs distinctes — **28 homonymes** |
| `zone` | text | 0,00 % | 203 libellés d'agglomération, non normalisés |
| `geocalisation` | geo_point_2d | 0,00 % | seul rattachement géographique fiable |
| `address` | text | 2,29 % | adresse en un seul bloc, non découpée |
| `infos` | text | 3,86 % | texte libre |
| `house_services` | text | 3,02 % | JSON encapsulé dans une colonne texte |

**Pièges**

- **Aucune colonne de tarif, de loyer, de capacité ou de nombre de places.**
  Vérifié sur l'ensemble des 23 noms de colonnes. Le loyer CROUS devra venir
  d'ailleurs : barème réglementaire saisi dans le module L1 bis, ou données à
  collecter à la main.
- Le nombre de chambres n'apparaît que dans le texte libre de `infos`
  (« 329 chambres avec wc, douche, lavabo »). L'extraire par LLM violerait la
  règle 1. Si ce chiffre est nécessaire, il faut un parseur déterministe testé,
  ou une saisie manuelle.
- 828 résidences pour l'ensemble du réseau : c'est un inventaire de
  **résidences**, pas de logements. Ne pas confondre les deux en base.
- Le rattachement à une commune ne peut se faire que par le point GPS. Mesuré :
  100 % des points sont exploitables, 265 communes atteintes, distance médiane
  au centroïde communal 1,72 km, p90 3,07 km, maximum 26,03 km. Ce maximum
  impose une validation par polygone (PostGIS) plutôt qu'un plus-proche-voisin.
- `openinghours` manque à 90,22 %, `crousandgourl` à 99,40 %, `albumurl` à
  98,19 % : colonnes à ne pas importer.

### 5. Lieux de restauration CROUS — France entière

| | |
| --- | --- |
| Identifiant | `fr_crous_restauration_france_entiere` |
| Volume | 987 lignes × 14 colonnes |
| Producteur | CNOUS |
| Licence | Licence Ouverte v2.0 (Etalab) |
| Fraîcheur | `issued` 2017-05-12, « Ponctuel » |
| Clé de jointure | **aucune**, hors point GPS |

**Colonnes critiques** — `type` (16 modalités), `zone` (224 libellés), `id`
(987, unique), `geolocalisation` et `lat` sont renseignés à 100 %.

**Pièges**

- **Aucun tarif.** Le prix du ticket RU est national et réglementaire : il
  appartient au module de barèmes versionnés (L1 bis), avec son texte de
  référence et sa date.
- Une géolocalisation aberrante : la distance maximale au centroïde communal le
  plus proche atteint **4 723 km**. Au moins un point est faux ou hors métropole
  mal projeté. Un contrôle de cohérence est obligatoire à l'import.
- `zone2` manque à 90,37 %, `album` à 99,29 %.
- `crousandgo` contient `{"@src": ""}` : une valeur non nulle qui ne porte
  aucune information. Ne pas la traiter comme « renseignée ».

### 6. Onisep — Idéo, actions de formation initiale, univers enseignement supérieur

| | |
| --- | --- |
| Identifiant | `605344579a7d7` (api.opendata.onisep.fr) |
| Volume | 28 580 lignes × 32 colonnes |
| Dernière mise à jour | 2026-07-06 |
| Licence | **ODbL** — la seule du lot qui ne soit pas Licence Ouverte |
| Clés | `Action de Formation (AF) identifiant Onisep`, `ENS code UAI` |

**Colonnes critiques**

| Colonne | Manquant | Remarque |
| --- | --- | --- |
| `Action de Formation (AF) identifiant Onisep` | 0,00 % | 28 444 valeurs pour 28 580 lignes : **136 identifiants en double** |
| `FOR URL et ID Onisep` | 0,00 % | 3 980 formations de référence |
| `ENS code UAI` | 1,10 % | 6 070 UAI distincts — seul pont vers Parcoursup |
| `FOR niveau de sortie` | 0,00 % | 9 modalités, exploitable |
| `AF coût scolarité` | 63,60 % | texte libre, inexploitable déterministiquement |
| `AF éléments d'enseignement` | 75,10 % | |
| `AF modalités accueil` | 99,61 % | à ne pas importer |
| `ENS accessibilité` | 48,10 % | |

**Pièges**

- **La licence ODbL est contaminante** : elle impose le partage à l'identique de
  toute base dérivée qui l'incorpore. Mélangée aux jeux en Licence Ouverte, elle
  contraint la redistribution. À isoler dans une table à part, avec la mention
  de paternité exigée par le lot L5, et à arbitrer avant le lot L4.
- 136 identifiants AF apparaissent plusieurs fois : la clé n'est pas primaire
  telle quelle. Vérifier avant de la poser en `PRIMARY KEY`.
- Les noms de colonnes contiennent des espaces, des apostrophes et des accents
  (`Lieu d'enseignement (ENS) libellé`). Prévoir un mapping explicite vers les
  noms de colonnes SQL, sans translittération automatique.

### 7. Référentiel des communes (ajout)

Le cahier des charges ne le cite pas, mais sans lui aucune formation Parcoursup
n'obtient de code INSEE.

| | |
| --- | --- |
| Identifiant | `georef-france-commune` (public.opendatasoft.com) |
| Volume | 34 888 lignes × 12 colonnes (export restreint) |
| Millésime | 2025 |
| Licence | Open License v2.0 |
| Clé | `com_code` (INSEE), `com_current_code` pour les fusions |

**Piège** : les arrondissements municipaux y figurent comme `com_type`
distinct ; l'indicateur de loyers, lui, n'expose **que** les arrondissements
pour Paris, Lyon et Marseille. Les deux référentiels ne se recouvrent donc pas
sur ces trois villes.

## La chaîne de jointure, mesurée

Résultats de `scripts/exploration/jointures.py` sur Parcoursup 2025.

| Étape | Résultat |
| --- | --- |
| Formations | 14 252, dont 22 à l'étranger (`dep = 99`) |
| Code INSEE résolu | 99,31 % au total, **99,47 % hors étranger** |
| dont par nom + département | 12 487 |
| dont par arrondissement municipal | 1 666 |
| dont par correction Corse (`20` → `2A`/`2B`) | 1 |
| Non résolues | 98 (Polynésie, Nouvelle-Calédonie, campus étrangers) |
| Loyer T1/T2 disponible | 98,95 % au total, **99,11 % hors étranger** |
| dont loyer estimé au niveau commune | 97,81 % |
| dont loyer extrapolé (`maille`) | 2,19 % |

Jointures par UAI et par code formation :

| Jointure | Taux |
| --- | --- |
| UAI Parcoursup présents dans la cartographie, millésime 2026 | 98,47 % |
| UAI Parcoursup présents dans la cartographie, tous millésimes | 100,00 % |
| `g_ta_cod` extrait de `lien_form_psup` | 99,73 % |
| `g_ta_cod` retrouvé dans `carto.gta`, millésime 2026 | 95,19 % |
| `g_ta_cod` retrouvé dans `carto.gta`, tous millésimes | 100,00 % |
| UAI Parcoursup présents chez l'Onisep | 93,20 % |

Les 126 formations de France qui restent sans loyer se concentrent sur Mayotte
(15 à Mamoudzou, 12 à Dembeni, …), la Polynésie française (26 à Faaa, 14 à
Papeete, …), Saint-Martin et la Nouvelle-Calédonie, plus 5 lignes « Lyon » sans
numéro d'arrondissement.

**Conclusion sur le seuil de l'étape 2** : 99,11 % de jointure réussie hors
campus étrangers, au-dessus des 95 % requis. Aucune stratégie de réconciliation
lourde n'est nécessaire ; il reste à décider du traitement des DROM-COM non
couverts et à figer la méthode de résolution INSEE.

## Ce qui manque pour calculer un RAV

Les six postes de dépenses et les six ressources du cahier des charges, confrontés
aux données réellement disponibles :

| Poste | Source disponible | État |
| --- | --- | --- |
| Loyer parc privé | `loypredm2` × surface hypothèse | disponible, avec fourchette |
| Loyer CROUS | — | **absent de l'open data** |
| APL | OpenFisca France | à brancher, non testé à ce stade |
| Alimentation | tarif RU réglementaire | **à saisir dans le module de barèmes** |
| Transport | GTFS transport.data.gouv.fr | hors périmètre de l'étape 1 (lot L7) |
| Frais de scolarité | Onisep, 36,40 %, texte libre | **inexploitable en l'état** |
| CVEC | montant réglementaire | **à saisir dans le module de barèmes** |
| Bourse CROUS, mérite, mobilité | barèmes réglementaires | **à saisir dans le module de barèmes** |
| Frais d'installation | — | hypothèse à poser et à documenter |

Autrement dit : l'open data donne la géographie et le loyer du parc privé. Tout
le reste des euros vient du module de barèmes versionnés du lot L1 bis. Celui-ci
n'est pas un complément, c'est un préalable au moteur budgétaire.

## Points à arbitrer avant l'étape 2

1. **Jointure sur libellé.** CLAUDE.md l'interdit, et c'est pourtant le seul
   moyen de donner un code INSEE à une formation Parcoursup. Trois options :
   assumer la résolution par nom + département avec une table de correspondance
   figée, versionnée et testée ; ou passer par le point GPS et PostGIS ; ou
   croiser les deux et ne garder que les accords. Ma recommandation : GPS +
   polygone comme source de vérité, nom + département en contrôle, désaccord =
   donnée signalée.
2. **Clé formation.** Le cahier des charges cite le code Onisep AF/FOR comme clé
   pivot des formations. Il n'existe pas côté Parcoursup. Proposition :
   `cod_aff_form` comme clé pivot réelle des formations, `g_ta_cod` comme pont
   vers la cartographie, et l'UAI Onisep comme enrichissement facultatif à la
   maille établissement.
3. **Licence ODbL de l'Onisep.** À trancher avant d'écrire la moindre migration
   qui mélange les sources.
4. **DROM-COM sans loyer.** 126 formations. Afficher « loyer non disponible »
   plutôt qu'un RAV partiel, conformément à la règle « une donnée manquante
   s'affiche comme manquante ».
5. **Fraîcheur CROUS.** Jeux émis en 2017, fréquence « Ponctuel ». Décider si
   l'on s'en sert pour localiser les résidences, ou pas du tout.
