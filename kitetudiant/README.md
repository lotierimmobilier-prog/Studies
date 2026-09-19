# KITETUDIANT

Plateforme d'aide au choix des vœux Parcoursup fondée sur le coût réel de la vie
étudiante. Le différenciant est le **RAV** — reste-à-vivre mensuel projeté —
affiché sur chaque vœu.

Nom de domaine prévu : **kitetudiant.fr**.

Les règles permanentes du projet sont dans [`CLAUDE.md`](CLAUDE.md). La première
d'entre elles : aucun montant affiché ne provient d'un LLM ; tout euro remonte à
une ligne de calcul déterministe avec sa source et son millésime.

## État d'avancement

| Étape | État |
| --- | --- |
| 1 — Exploration des données | fait — [`docs/inventaire-donnees.md`](docs/inventaire-donnees.md) |
| 2 — Test de jointure | fait — 99,11 % hors campus étrangers, `scripts/exploration/jointures.py` |
| 3 — Schéma PostgreSQL + PostGIS | proposé, non appliqué — [`docs/schema-donnees.md`](docs/schema-donnees.md) |
| 4 — `packages/budget-engine` | fait — [`docs/cas-types.md`](docs/cas-types.md), 37 tests |

Les arbitrages ouverts sont dans l'onglet Décisions du cahier des charges.

## Exploration des données

```bash
pip install -r scripts/exploration/requirements.txt
python3 scripts/exploration/telecharger.py       # data/brut/ + manifeste.json
python3 scripts/exploration/profiler.py          # data/profil.json
python3 scripts/exploration/jointures.py         # data/jointures.json
python3 scripts/exploration/annexe_colonnes.py   # docs/annexe-colonnes.md
```

Scripts d'exploration en Python, volontairement hors du périmètre applicatif :
ils servent à regarder les données, pas à les servir. Le code applicatif est en
TypeScript strict, comme l'impose `CLAUDE.md`.

## Barèmes et moteur budgétaire

```bash
pip install openfisca-france
python3 kitetudiant/packages/baremes/scripts/extraire_openfisca.py  # regénère les barèmes
npm test                          # 37 tests : barèmes et reste-à-vivre
npm run typecheck:kitetudiant     # TypeScript strict sur packages/
```

`packages/baremes` est le seul endroit d'où un euro a le droit de sortir.
Chaque valeur est datée et rattachée au texte officiel qui la fixe — extraite
mécaniquement des paramètres d'OpenFisca-France, ou saisie à la main depuis sa
source quand OpenFisca ne la couvre pas (CVEC). Un barème sans valeur rend une
indisponibilité motivée, jamais un montant de repli.

`packages/budget-engine` calcule le reste-à-vivre à partir de ces barèmes. Il
rend `null` dès qu'un poste manque : un RAV partiel serait un montant inventé.

## Voir le moteur tourner

```bash
python3 kitetudiant/scripts/exploration/telecharger.py --cle loyers_communes
npx tsx kitetudiant/scripts/demo/rav.ts
```

Calcule le reste-à-vivre d'un même profil à Limoges, Toulouse et Paris 13e sur
les loyers réels, affiche chaque ligne de budget avec sa source et son
millésime, puis montre ce que le moteur refuse de calculer quand l'APL n'est
pas simulée.

## L'interface (lot L3)

```bash
npm run start:server      # API : aide au logement via OpenFisca, port 8787
npm run dev:kitetudiant   # front sur http://localhost:5174
npm run build:kitetudiant # build de production -> dist-kitetudiant/
```

Sept questions — ton bac, tes notes, ce qui t'intéresse, ta motivation, où tu
peux aller, ta bourse, ton budget — puis la liste de vœux. Mobile d'abord, sans
compte, rien d'enregistré. Sur chaque carte, le reste-à-vivre est le plus gros
caractère de la page.

**Deux axes, jamais additionnés** (règle 5 de `CLAUDE.md`) : ce qui te
correspond d'un côté, ce qu'il te restera pour vivre de l'autre. Les formations
sont classées d'abord par affinité, puis, à affinité proche, par reste-à-vivre.

Les notes s'importent depuis un bulletin (PDF ou photo) ou se saisissent à la
main. De l'analyse du bulletin, seuls des nombres ressortent : les moyennes par
matière et trois signaux chiffrés. Le texte des appréciations ne quitte jamais
le serveur (règle 3).

L'estimation de chances lit les statistiques publiées — taux d'accès,
répartition des admis par bac, par mention, par académie, part de boursiers —
et rend **une fourchette, jamais un point**. Sous 30 admis connus, elle rend
« effectif insuffisant » plutôt qu'un chiffre. Ce n'est pas le modèle calibré du
lot L2 : le code et l'interface le disent.

Les données sont réelles : formations et statistiques d'admission en direct de
l'open data du ministère, loyers de l'indicateur communal, aide au logement
calculée par OpenFisca, barèmes officiels datés. Le budget se déplie poste par
poste, chaque ligne portant sa source et son millésime, et les postes manquants
s'affichent comme manquants.

`web/donnees/communes.json` est généré par
`scripts/exploration/generer_communes.py` : c'est la correspondance ville +
département → code INSEE, figée et versionnée, parce que Parcoursup ne porte
pas de code commune et que le front ne doit rien deviner à l'exécution.

## Retours des étudiants (M10)

Trois axes chiffrés seulement — coût réel constaté, facilité à trouver un
logement, ambiance — déposés par des étudiants déjà inscrits. **Aucun texte
libre n'est collecté, et aucune note d'établissement n'est calculée** : le
cahier des charges l'interdit pour éviter le procès en diffamation, et cela
supprime du même coup tout besoin de modération.

En dessous de **cinq retours** sur une année, rien n'est publié : trop peu
d'observations, et un risque réel de réidentification sur une petite formation.

**Archivage par année universitaire.** Un fichier par millésime, qui bascule le
1er septembre. Écrire ne touche jamais qu'au fichier de l'année en cours : les
années passées sont immuables par construction, pas par discipline. En base, un
déclencheur refuse toute insertion, modification ou suppression dans un
millésime déclaré clos.

```
POST /api/retours            dépose un retour
GET  /api/retours?formation= archive année par année
POST /api/retours/agregats   agrégats de l'année en cours, en lot
```

Le jeton qui limite à un retour par formation et par an n'identifie personne :
il est tiré au hasard dans le navigateur et **haché avant d'être stocké**.

## Base de données

```bash
PGURL=postgresql://… kitetudiant/db/valider_schema.sh
psql "$PGURL" -f kitetudiant/db/tests_contraintes.sql
```

Le schéma est une proposition, **non appliquée**. Les règles de `CLAUDE.md` y
sont écrites en contraintes SQL : un montant sans source est rejeté par la
base, pas seulement par le code.

Les CSV bruts (environ 185 Mo) ne sont pas versionnés. Ce qui l'est : le
manifeste de collecte (URL, horodatage, SHA-256), le profil colonne par colonne
et le rapport de jointure.
