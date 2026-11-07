# Import — correspondance colonne à colonne

Écrit le 20/09/2026. Ce que font `scripts/import/preparer.py` et
`db/migrations/charger.sh`, champ par champ.

La chaîne complète :

```
scripts/exploration/telecharger.py   →  data/brut/*.csv + manifeste.json
scripts/import/preparer.py           →  data/import/*.csv + rapport.json
db/migrations/appliquer.sh           →  les tables
db/migrations/charger.sh             →  les lignes
```

Deux étapes de transformation plutôt qu'une, parce qu'un import qui transforme
et écrit en même temps ne se relit pas. Le fichier intermédiaire est
inspectable, diffusable, et comparable d'une campagne à l'autre.

`\copy` plutôt qu'un pilote : psql charge côté client, sans superutilisateur et
**sans dépendance nouvelle**. C'est ce qui permet d'importer sans attendre
l'arbitrage Q1 sur le pilote PostgreSQL.

---

## 1. `reference.commune` ← `georef_communes`

34 888 lignes, licence Open License v2.0, millésime 2025.

| Colonne cible | Source | Transformation |
| --- | --- | --- |
| `code_insee` | `com_code` | Doit faire 5 caractères, sinon la ligne sort |
| `millesime` | `year` | Les 4 premiers caractères |
| `nom` | `com_name` | Tel quel |
| `code_departement` | `dep_code` | `1` → `01`, `971` reste `971`, `2a` → `2A` |
| `code_region` | `reg_code` | Tel quel |
| `code_epci` | `epci_code` | **9 chiffres exactement**, sinon vide et compté |
| `est_arrondissement` | `com_type` | Vrai si le libellé publié contient « arrondissement » |
| `contour` | — | **Toujours vide.** L'export collecté ne porte pas les polygones, et aucune jointure ne s'en sert (migration 003) |
| `centroide` | `geo_point_2d` | `« lat, lon »` → `SRID=4326;POINT(lon lat)` |
| `collecte_le`, `source` | `manifeste.json` | Date de collecte et mention de provenance |

**Ce qui sort, et pourquoi :** une commune sans centroïde (`centroide` est
`NOT NULL` — une commune qu'on ne sait pas placer n'a rien à faire dans une
table de référence géographique). Un code EPCI illisible ne fait pas sortir la
ligne : il devient vide. Sans cela, **une seule cellule malformée fait échouer
le `COPY` des 34 888 lignes** — c'est arrivé au premier essai.

### L'index qui porte tout le reste

Ce jeu produit aussi l'index `(nom normalisé, département) → code INSEE`, dont
dépend le rattachement de chaque formation à un loyer.

Deux communes d'un même département dont les noms se normalisent pareil —
« Sainte-Marie » et « Ste Marie » à La Réunion — **retirent la clé de
l'index** et comptent au rapport. On ne tranche pas au hasard : ce serait
afficher un loyer faux sans que rien ne le signale.

---

## 2. `reference.etablissement` ← `parcoursup_2025`

| Colonne cible | Source | Transformation |
| --- | --- | --- |
| `uai` | `cod_uai` | 8 caractères, sinon la ligne sort |
| `millesime` | — | `2025`, la session importée |
| `nom` | `g_ea_lib_vx` | À défaut, l'UAI lui-même |
| `statut` | `contrat_etab` | **Recopié tel quel** |
| `code_insee` | `ville_etab` + `dep` | Voir la résolution ci-dessous |
| `code_insee_methode` | — | `arrondissement` ou `nom_departement` |
| `position` | `g_olocalisation_des_formations` | `« lat, lon »` → point, longitude d'abord |

Les quatre statuts publiés, relevés sur le jeu réel : **Public** (11 108),
**Privé sous contrat d'association** (1 938), **Privé enseignement supérieur**
(1 101), **Privé hors contrat** (105). On recopie le libellé publié ; on ne le
range pas dans une catégorie de notre invention.

`code_insee_methode` porte une contrainte : une commune rattachée doit dire
**comment** elle l'a été. Une jointure sur libellé qui ne s'avoue pas est une
dette silencieuse ; celle-ci est déclarée dans la donnée.

Un UAI présent dans deux communes (établissement multi-sites) garde la
première et **compte au rapport**. C'est à la formation de porter sa commune,
pas à l'établissement.

### La résolution du code INSEE

Parcoursup ne publie pas de code INSEE : il y a un nom de ville et un
département. Deux méthodes, dans cet ordre :

1. **Arrondissement municipal.** « Paris 13e Arrondissement » → `75113`.
   Paris, Lyon et Marseille ont un seul code de commune (75056, 69123, 13055)
   que l'indicateur de loyers **ne connaît pas**. Sans cette méthode,
   **1 666 formations perdent leur loyer**.
2. **Nom + département**, après normalisation (accents, ligatures, casse,
   `St`→`Saint`) : 12 487 formations.

Le reste — 98 formations, en outre-mer pour l'essentiel — **sort sans code
INSEE**. Elles restent affichées, sans montant. Elles ne reçoivent pas le code
du chef-lieu « pour que ça passe ».

Taux mesuré : **99,31 %**. `preparer.py` **échoue** sous 99,0 % : un import qui
perd plus d'une formation sur cent n'est pas un import, c'est un échantillon.

---

## 3. `reference.formation` ← `parcoursup_2025`

| Colonne cible | Source | Transformation |
| --- | --- | --- |
| `cod_aff_form` | `cod_aff_form` | **Clé pivot** — 14 252 valeurs uniques (D7) |
| `session` | — | `2025` |
| `uai` | `cod_uai` | |
| `g_ta_cod` | `lien_form_psup` | Chiffres après `g_ta_cod=` dans l'URL — pont vers la cartographie |
| `filiere` | `fili` | **Le TYPE de formation** (BTS, Licence, CPGE), pas la discipline |
| `libelle` | `lib_for_voe_ins` | |
| `libelle_detaille` | `lib_comp_voe_ins` | Vide si absent |
| `selective` | `select_form` | Faux si « formation non sélective », vrai sinon |
| `apprentissage`, `internat` | — | **Faux par défaut, à remplir depuis la cartographie** |
| `position`, `code_insee` | comme l'établissement | |
| `lien_fiche` | `lien_form_psup` | |

**`fili` n'est pas la discipline.** Ses 11 valeurs sont BTS (5 351), Licence
(3 052), Autre formation (1 815), CPGE (986), BUT (820), École d'Ingénieur
(585), Licence_Las (513), IFSI (344), PASS (287), École de Commerce (256),
EFTS (243). « Droit », « sport », « langues » **ne sont publiés nulle part** :
d'où les 16 thèmes maison de `web/src/themes.ts`, construits et vérifiés un
par un contre le jeu réel.

**`apprentissage` et `internat` ne se déduisent pas de ce jeu.**
`nb_voe_pp_internat` manque à 93 % et ne dit rien de l'offre — il dit combien
de vœux ont été formulés avec internat, ce qui n'est pas la même chose. La
cartographie les publie (`app`, `int`) : c'est de là qu'ils viendront. En
attendant, les deux colonnes sont fausses par défaut et **on le sait**.

---

## 4. `reference.stat_admission` ← `parcoursup_2025`

| Colonne cible | Source | | Colonne cible | Source |
| --- | --- | --- | --- | --- |
| `capacite` | `capa_fin` | | `admis_bac_general` | `acc_bg` |
| `voeux_total` | `voe_tot` | | `admis_bac_techno` | `acc_bt` |
| `voeux_phase_principale` | `nb_voe_pp` | | `admis_bac_pro` | `acc_bp` |
| `propositions_total` | `prop_tot` | | `taux_acces` | `taux_acces_ens` |
| `admis_total` | `acc_tot` | | `part_acces_general` | `part_acces_gen` |
| `admis_boursiers` | `acc_brs` | | `part_acces_techno` | `part_acces_tec` |
| `pct_boursiers_arrondi` | `pct_bours` | | `part_acces_pro` | `part_acces_pro` |

**Une cellule vide ne devient jamais zéro.** « Zéro admis » et « on ne sait pas
combien » sont deux informations différentes, et la seconde ne doit jamais se
faire passer pour la première. Vérifié sur instance réelle : une capacité
absente reste `NULL`, un `acc_tot` à `0` reste `0`.

**Les colonnes `pct_*` sont arrondies au multiple de 5** par le ministère. On
les garde pour les afficher, **jamais pour reconstruire un effectif** : 10 %
de 37 admis ne fait pas un nombre d'élèves.

---

## 5. `reference.indicateur_logement` ← `loyers_communes`

139 600 lignes, millésime 2025, publié **à titre expérimental**.

| Colonne cible | Source | Transformation |
| --- | --- | --- |
| `code_insee` | `insee_c` | 5 caractères |
| `millesime` | `year` | |
| `type_logement` | `type_logement` | **Les 4 typologies sont conservées** |
| `loyer_m2` | `loypredm2` | Arrondi à 3 décimales |
| `loyer_m2_borne_basse` | `lwr_ipm2` | |
| `loyer_m2_borne_haute` | `upr_ipm2` | |
| `maille` | `typpred` | `commune` / `maille` / `epci` → l'énumération |
| `observations_commune` | `nbobs_com` | |
| `r2_ajuste` | `r2_adj` | 4 décimales |
| `experimental` | — | Toujours vrai : c'est ce que le producteur écrit |

**Toutes les typologies sont gardées.** Le choix de celle qui sert au RAV
appartient au calcul, pas à l'import. Un import qui filtre décide à la place du
moteur, et on ne s'en aperçoit que des mois plus tard.

**Deux rejets, tous deux comptés :** une ligne dont les bornes ne sont pas
ordonnées (`lwr > loypredm2`), que la contrainte
`indicateur_logement_bornes_ordonnees` refuserait de toute façon ; et une
maille hors énumération, qu'on ne range pas au hasard.

---

## 6. Ce qui reste interrogé en direct, et pourquoi

| Jeu | Décision |
| --- | --- |
| Indicateurs de résultat des lycées | **Non importé.** 27 808 lignes pour un seul écran, dernier millésime publié **2023** |
| Doublettes de spécialités | **Non importé.** 17 420 lignes, un seul écran |
| Cartographie des formations | **À importer**, pour `apprentissage` et `internat` |
| Onisep | **Bloqué par Q2** — licence ODbL contaminante |
| CROUS logement / restauration | **À importer** en MVP2 — données de **2017** (Q4) |

---

## 7. Vérification

`python3 kitetudiant/scripts/import/verifier.py` — **32 vérifications** sur des
extraits miniatures reprenant les valeurs réelles de
[`annexe-colonnes.md`](annexe-colonnes.md). Pas de réseau, pas de base.

Ce qu'il attrape, et qui casserait silencieusement une campagne :

- l'ordre longitude/latitude inversé — qui place toutes les écoles françaises
  en Somalie sans qu'aucune contrainte ne proteste ;
- une cellule vide devenue zéro ;
- un arrondissement résolu en `75056` au lieu de `75113` ;
- une commune introuvable ayant reçu un code de repli ;
- un nom ambigu tranché au hasard ;
- une borne de loyer incohérente corrigée au lieu d'être écartée ;
- un code EPCI illisible faisant échouer tout le `COPY`.

La chaîne entière a été exercée sur une instance **PostgreSQL 16 réelle** le
20/09/2026 : trois migrations appliquées, rejouées sans effet, chargement
effectué puis relancé sans créer de doublon.

Les contraintes ont été exercées une à une sur cette instance, et **chaque
écriture interdite a bien été refusée** :

| Écriture tentée | Résultat |
| --- | --- |
| Un profil mineur sans consentement parental | refusée (`profil_consentement_si_mineur`) |
| Un onzième vœu dans un panier | refusée (`panier_voeu_rang_parcoursup`) |
| Un nonce qui ne fait pas 12 octets | refusée (`compte_nonce_gcm`) |
| Un retour sur un millésime clos | refusée (déclencheur `refuser_millesime_clos`) |
| Un vœu signalé | **conservé dans le panier** — règle 4 |

PostGIS n'étant pas installable dans cet environnement, `appliquer.sh` est
passé en mode dégradé : **les types géographiques n'ont pas été vérifiés**, et
le script le dit à chaque exécution.
