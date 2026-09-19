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
