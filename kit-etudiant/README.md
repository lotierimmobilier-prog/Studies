# Kit Etudiant

Plateforme d'aide au choix des vœux Parcoursup fondée sur le coût réel de la vie
étudiante. Le différenciant est le **RAV** — reste-à-vivre mensuel projeté —
affiché sur chaque vœu.

Les règles permanentes du projet sont dans [`CLAUDE.md`](CLAUDE.md). La première
d'entre elles : aucun montant affiché ne provient d'un LLM ; tout euro remonte à
une ligne de calcul déterministe avec sa source et son millésime.

## État d'avancement

| Étape | État |
| --- | --- |
| 1 — Exploration des données | fait — [`docs/inventaire-donnees.md`](docs/inventaire-donnees.md) |
| 2 — Test de jointure | mesuré à titre préliminaire par `scripts/exploration/jointures.py` |
| 3 — Schéma PostgreSQL + PostGIS | à faire |
| 4 — `packages/budget-engine` | à faire |

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

Les CSV bruts (environ 185 Mo) ne sont pas versionnés. Ce qui l'est : le
manifeste de collecte (URL, horodatage, SHA-256), le profil colonne par colonne
et le rapport de jointure.
