#!/usr/bin/env bash
# Valide db/schema.sql sur une vraie instance PostgreSQL 16.
#
# PostGIS n'étant pas toujours installable, le script rejoue le schéma deux
# fois : tel quel si l'extension est disponible, sinon avec les colonnes
# géographiques remplacées par du texte et les index GiST par des index B-tree.
# Dans ce second mode, tout est vérifié sauf les types PostGIS eux-mêmes — et
# le script le dit.
set -euo pipefail

SCHEMA="$(cd "$(dirname "$0")" && pwd)/schema.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -q "${PGURL:-}")

if "${PSQL[@]}" -tAc "select 1 from pg_available_extensions where name = 'postgis'" | grep -q 1; then
  echo "PostGIS disponible : validation du schéma tel quel."
  "${PSQL[@]}" -f "$SCHEMA"
else
  echo "PostGIS absent : validation en mode dégradé (types géographiques remplacés)."
  sed -e 's/^CREATE EXTENSION IF NOT EXISTS postgis;/-- postgis indisponible dans cet environnement/' \
      -e 's/geography(MultiPolygon, 4326)/text/g' \
      -e 's/geography(Point, 4326)/text/g' \
      -e 's/USING gist (/USING btree (/g' \
      "$SCHEMA" | "${PSQL[@]}" -f -
  echo "Mode dégradé : les types et index PostGIS n'ont PAS été vérifiés."
fi
echo "Schéma appliqué sans erreur."
