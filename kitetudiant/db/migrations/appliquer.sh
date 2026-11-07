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

# Une migration dégradée n'est JAMAIS rejouée : la boucle ci-dessus compare les
# noms, pas la colonne « degrade ». Le schéma reste donc en texte même une fois
# PostGIS installé — et plus rien ne le signale, puisque le passage suivant
# annonce « Migrations à jour ».
#
# Ce rappel referme ce silence. Il ne répare pas : rejouer une migration sur
# une base qui porte déjà des données demande une décision, pas un script.
DEGRADEES="$("${PSQL[@]}" -tAc 'select count(*) from public.migration where degrade')"
if [ "$DEGRADEES" != "0" ] && [ "$DEGRADE" = false ]; then
  echo
  echo "/!\ PostGIS est là, mais ${DEGRADEES} migration(s) ont été appliquées SANS."
  "${PSQL[@]}" -tAc \
    "select '      - ' || nom || ' (le ' || to_char(applique_le, 'DD/MM/YYYY') || ')'
       from public.migration where degrade order by nom"
  echo
  echo "    Leurs colonnes géographiques sont du TEXTE et leurs index des B-tree."
  echo "    La carte et les recherches par distance ne fonctionneront pas."
  echo "    Elles ne seront pas rejouées : ce script compare les noms, pas ce mode."
  echo
  echo "    Sur une base encore vide, le plus sûr est de la recréer."
  echo "    Sur une base qui porte des données, c'est une migration à écrire."
fi
exit 0
