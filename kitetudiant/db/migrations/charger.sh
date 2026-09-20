#!/usr/bin/env bash
# Charge data/import/*.csv dans les tables de référence.
#
#   PGURL=postgres://… bash kitetudiant/db/migrations/charger.sh
#
# À lancer APRÈS appliquer.sh (les tables doivent exister) et APRÈS
# scripts/import/preparer.py (les fichiers doivent être là).
#
# ── Pourquoi \copy et pas un pilote ─────────────────────────────────────────
#
# \copy est exécuté par psql, côté client, sans superutilisateur et sans
# dépendance nouvelle — ni Node ni Python n'ont besoin d'un pilote pour
# charger. C'est ce qui permet d'importer sans attendre l'arbitrage Q1.
#
# ── Pourquoi des tables d'attente ───────────────────────────────────────────
#
# Un \copy direct dans reference.formation échouerait à la première ligne dont
# l'établissement manque, et laisserait la table à moitié pleine. On charge
# donc dans une table d'attente, puis on insère ce qui est joignable, et on
# COMPTE ce qui ne l'est pas. Un import silencieux est un import qu'on ne
# relit jamais.
#
# ── Ce que ce script ne fait jamais ─────────────────────────────────────────
#
# Écraser un millésime déjà chargé. ON CONFLICT DO NOTHING : relancer le
# script est sans effet, et corriger une année publiée demande une décision
# explicite, pas une relance.
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
# IMPORT_DIR sert aux essais : verifier-chargement.sh y pointe des extraits.
IMPORT="${IMPORT_DIR:-$(cd "$ICI/../.." && pwd)/data/import}"
PSQL=(psql -v ON_ERROR_STOP=1 -q "${PGURL:?PGURL doit être défini}")

for f in commune etablissement formation stat_admission indicateur_logement; do
  [ -f "$IMPORT/$f.csv" ] || { echo "$IMPORT/$f.csv absent : lance preparer.py" >&2; exit 1; }
done

echo "Chargement depuis $IMPORT"

"${PSQL[@]}" <<SQL
BEGIN;

CREATE TEMP TABLE a_commune            (LIKE reference.commune            INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TEMP TABLE a_etablissement      (LIKE reference.etablissement      INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TEMP TABLE a_formation          (LIKE reference.formation          INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TEMP TABLE a_stat_admission     (LIKE reference.stat_admission     INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TEMP TABLE a_indicateur_logement(LIKE reference.indicateur_logement INCLUDING DEFAULTS) ON COMMIT DROP;

\copy a_commune            FROM '$IMPORT/commune.csv'             WITH (FORMAT csv, HEADER true, NULL '')
\copy a_etablissement      FROM '$IMPORT/etablissement.csv'       WITH (FORMAT csv, HEADER true, NULL '')
\copy a_formation          FROM '$IMPORT/formation.csv'           WITH (FORMAT csv, HEADER true, NULL '')
\copy a_stat_admission     FROM '$IMPORT/stat_admission.csv'      WITH (FORMAT csv, HEADER true, NULL '')
\copy a_indicateur_logement FROM '$IMPORT/indicateur_logement.csv' WITH (FORMAT csv, HEADER true, NULL '')

-- L'ordre suit les clés étrangères : commune, puis établissement, puis
-- formation, puis ses statistiques.
INSERT INTO reference.commune             SELECT * FROM a_commune             ON CONFLICT DO NOTHING;
INSERT INTO reference.etablissement       SELECT * FROM a_etablissement       ON CONFLICT DO NOTHING;
INSERT INTO reference.formation           SELECT * FROM a_formation           ON CONFLICT DO NOTHING;
INSERT INTO reference.stat_admission      SELECT * FROM a_stat_admission      ON CONFLICT DO NOTHING;
INSERT INTO reference.indicateur_logement SELECT * FROM a_indicateur_logement ON CONFLICT DO NOTHING;

-- Le rapport. Il est imprimé, pas stocké : on le lit à chaque campagne.
\echo ''
\echo 'Chargé :'
SELECT 'commune'             AS table, count(*) FROM reference.commune
UNION ALL SELECT 'etablissement',       count(*) FROM reference.etablissement
UNION ALL SELECT 'formation',           count(*) FROM reference.formation
UNION ALL SELECT 'stat_admission',      count(*) FROM reference.stat_admission
UNION ALL SELECT 'indicateur_logement', count(*) FROM reference.indicateur_logement;

\echo ''
\echo 'Formations sans loyer disponible (elles resteront affichées, sans montant) :'
SELECT count(*) AS formations,
       count(DISTINCT f.code_insee) AS communes
FROM reference.formation f
LEFT JOIN reference.indicateur_logement l ON l.code_insee = f.code_insee
WHERE l.code_insee IS NULL;

COMMIT;
SQL

echo ""
echo "Chargement terminé. Aucun millésime déjà présent n'a été modifié."
