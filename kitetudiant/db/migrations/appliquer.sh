#!/usr/bin/env bash
# Applique les migrations dans l'ordre, une seule fois chacune.
#
#   PGURL=postgres://… bash kitetudiant/db/migrations/appliquer.sh
#
# Une migration déjà appliquée est sautée, pas rejouée : c'est ce qui permet
# de lancer ce script sur une instance neuve comme sur celle de production
# sans se demander où elle en est.
#
# PostGIS n'est pas toujours installable en environnement de développement. Le
# script bascule alors en mode dégradé — types géographiques remplacés par du
# texte, index GiST par des B-tree — et le DIT. Dans ce mode, tout est vérifié
# sauf les types PostGIS eux-mêmes.
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -q "${PGURL:?PGURL doit être défini}")

"${PSQL[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS public.migration (
  nom          text        PRIMARY KEY,
  applique_le  timestamptz NOT NULL DEFAULT now(),
  degrade      boolean     NOT NULL DEFAULT false
);
SQL

if "${PSQL[@]}" -tAc "select 1 from pg_available_extensions where name = 'postgis'" | grep -q 1; then
  DEGRADE=false
  echo "PostGIS disponible."
else
  DEGRADE=true
  echo "PostGIS absent : mode dégradé, les types géographiques ne seront PAS vérifiés."
fi

for fichier in "$ICI"/[0-9][0-9][0-9]-*.sql; do
  nom="$(basename "$fichier")"
  if [ "$("${PSQL[@]}" -tAc "select count(*) from public.migration where nom = '$nom'")" != "0" ]; then
    echo "  = $nom — déjà appliquée"
    continue
  fi
  echo "  + $nom"
  if [ "$DEGRADE" = true ]; then
    sed -e 's/^CREATE EXTENSION IF NOT EXISTS postgis;/-- postgis indisponible dans cet environnement/' \
        -e 's/geography(MultiPolygon, 4326)/text/g' \
        -e 's/geography(Point, 4326)/text/g' \
        -e 's/USING gist (/USING btree (/g' \
        "$fichier" | "${PSQL[@]}" -f -
  else
    "${PSQL[@]}" -f "$fichier"
  fi
  "${PSQL[@]}" -c "insert into public.migration (nom, degrade) values ('$nom', $DEGRADE)"
done

echo "Migrations à jour."
[ "$DEGRADE" = true ] && echo "Rappel : mode dégradé, les types PostGIS n'ont pas été vérifiés."
exit 0
