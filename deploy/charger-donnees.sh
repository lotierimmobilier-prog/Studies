#!/usr/bin/env bash
#
# Charge les données de référence de KITETUDIANT dans la base du VPS.
#
# À lancer EN ROOT sur le VPS, en une seule commande :
#
#   bash /opt/kitetudiant-src/deploy/charger-donnees.sh
#
# ── Pourquoi ce script existe ───────────────────────────────────────────────
#
# La chaîne compte trois étapes, dans trois dossiers différents, et il faut
# les lancer depuis la racine du dépôt avec la bonne URL de base. Le 21/09/2026
# une seule des trois a été donnée, avec un chemin faux : la commande a échoué,
# et il a fallu un aller-retour pour comprendre qu'il en manquait deux.
#
# Une chaîne qu'on ne peut pas lancer en une ligne finit toujours par être
# lancée à moitié. Celui-ci fait les trois, vérifie ses prérequis AVANT de
# télécharger 185 Mo, et compte les lignes à la fin — parce qu'un import qui
# se termine sans rien dire est un import qu'on croit réussi.
#
# ── Ce qu'il ne fait pas ────────────────────────────────────────────────────
#
# Il n'installe pas PostgreSQL et n'applique aucune migration : c'est
# postgres-setup.sh, et c'est délibérément séparé. Il n'écrase jamais un
# millésime déjà chargé (charger.sh insère en ON CONFLICT DO NOTHING) : le
# relancer est sans effet sur ce qui est déjà là.
#
# Options :
#   SANS_TELECHARGEMENT=1   réutilise data/brut/ au lieu de retélécharger
#   SLUG=kitetudiant        sous-chemin du projet (défaut : kitetudiant)

set -euo pipefail

SLUG="${SLUG:-kitetudiant}"
APP_DIR="/opt/${SLUG}"
SRC_DIR="${SRC_DIR:-/opt/${SLUG}-src}"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
mal()  { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; }

[ "$(id -u)" = "0" ] || { mal "À lancer en root."; exit 1; }

# ------------------------------------------------------------- le dépôt
# Le script accepte d'être lancé depuis n'importe où, tant qu'il retrouve la
# racine du dépôt : c'est de là que les trois étapes doivent partir, parce
# qu'elles calculent leurs chemins relativement à elle.
ICI="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${ICI}/../kitetudiant/scripts/import/preparer.py" ]; then
  RACINE="$(cd "${ICI}/.." && pwd)"
elif [ -f "${SRC_DIR}/kitetudiant/scripts/import/preparer.py" ]; then
  RACINE="${SRC_DIR}"
else
  mal "Dépôt introuvable. Attendu ${SRC_DIR}/kitetudiant/scripts/, ou lancez ce script depuis deploy/ du dépôt."
  exit 1
fi
# Les données vivent sous kitetudiant/, comme les scripts qui les écrivent :
# telecharger.py et preparer.py calculent tous deux leur racine à partir de
# leur propre emplacement, pas du répertoire courant.
DONNEES="${RACINE}/kitetudiant/data"
ok "Dépôt : ${RACINE}"

# ------------------------------------------------------- les prérequis
# Tous vérifiés AVANT le téléchargement : découvrir qu'il manque psql après
# 185 Mo et dix minutes d'attente est une perte de temps évitable.
log "Vérification des prérequis"
manque=0
for outil in python3 curl psql; do
  if command -v "$outil" > /dev/null 2>&1; then
    ok "$outil : $(command -v "$outil")"
  else
    mal "$outil est absent."
    manque=1
  fi
done
[ "$manque" = "0" ] || {
  mal "Installez ce qui manque : apt-get install -y python3 curl postgresql-client"
  exit 1
}

# La chaîne n'utilise que la bibliothèque standard de Python — aucun paquet à
# installer. On le vérifie plutôt que de le supposer.
python3 - <<'PY' || { mal "Python 3 trop ancien : 3.9 minimum."; exit 1; }
import sys
sys.exit(0 if sys.version_info >= (3, 9) else 1)
PY
ok "python3 $(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"

# Le téléchargement pèse environ 185 Mo, les CSV préparés environ 50 Mo, et
# PostgreSQL a besoin de place pour les tables d'attente. Sous 1,5 Go de libre
# l'import s'arrête au milieu, ce qui est le pire moment.
LIBRE_KO="$(df -Pk "${RACINE}" | awk 'NR==2 {print $4}')"
if [ "${LIBRE_KO}" -lt 1572864 ]; then
  mal "Espace disque insuffisant : $((LIBRE_KO / 1024)) Mo libres, 1500 Mo nécessaires."
  exit 1
fi
ok "Espace disque : $((LIBRE_KO / 1024)) Mo libres"

# --------------------------------------------------------- l'URL de base
# Elle est écrite par postgres-setup.sh. La lire ici évite de la retaper — et
# de se tromper de base, ce qui chargerait des formations dans le vide.
if [ -n "${PGURL:-}" ]; then
  ok "PGURL fournie à l'appel"
elif [ -f "${APP_DIR}/.env" ]; then
  PGURL="$(sed -n 's/^DATABASE_URL=//p' "${APP_DIR}/.env" | tail -n 1)"
  [ -n "${PGURL}" ] || {
    mal "DATABASE_URL absente de ${APP_DIR}/.env. Lancez d'abord deploy/postgres-setup.sh."
    exit 1
  }
  ok "DATABASE_URL lue dans ${APP_DIR}/.env"
else
  mal "${APP_DIR}/.env introuvable. Lancez d'abord deploy/postgres-setup.sh."
  exit 1
fi

# Les tables doivent exister : charger.sh échouerait ligne à ligne sinon.
if ! psql -v ON_ERROR_STOP=1 -qtAc "select to_regclass('reference.formation')" "${PGURL}" \
     | grep -q 'reference.formation'; then
  mal "La table reference.formation n'existe pas : les migrations n'ont pas été appliquées."
  mal "Lancez d'abord : bash ${RACINE}/deploy/postgres-setup.sh"
  exit 1
fi
ok "Base joignable, tables de référence en place"

cd "${RACINE}"

# ------------------------------------------------------------- étape 1/3
#
# Le manifeste vit sous kitetudiant/data/, là où telecharger.py l'écrit — et
# non à la racine du dépôt. Le chercher au mauvais endroit faisait tomber ce
# test dans le `else` : SANS_TELECHARGEMENT=1 retéléchargeait alors 185 Mo EN
# SILENCE au lieu de sauter l'étape. Un repli silencieux, exactement ce que
# CLAUDE.md interdit. Constaté le 21/09/2026 sur ce script même, d'où le
# refus explicite plutôt qu'un `&&` qui retombe sur autre chose.
if [ "${SANS_TELECHARGEMENT:-0}" = "1" ]; then
  [ -f "${DONNEES}/brut/manifeste.json" ] || {
    mal "SANS_TELECHARGEMENT=1 demandé, mais ${DONNEES}/brut/manifeste.json est absent."
    mal "Il n'y a rien à réutiliser : relancez sans cette option."
    exit 1
  }
  log "Étape 1/3 — téléchargement SAUTÉ (SANS_TELECHARGEMENT=1)"
  COLLECTE="$(python3 "${RACINE}/deploy/collecte.py" "${DONNEES}/brut/manifeste.json" 2>/dev/null || echo '?')"
  ok "Réutilisation de ${DONNEES}/brut/, collecté le ${COLLECTE}"
else
  log "Étape 1/3 — téléchargement des jeux publics (environ 185 Mo, quelques minutes)"
  python3 kitetudiant/scripts/exploration/telecharger.py
  ok "${DONNEES}/brut/ et son manifeste de provenance sont en place"
fi

# ------------------------------------------------------------- étape 2/3
log "Étape 2/3 — préparation des CSV, colonne par colonne"
python3 kitetudiant/scripts/import/preparer.py
ok "data/import/ prêt"

# ------------------------------------------------------------- étape 3/3
log "Étape 3/3 — chargement en base"
PGURL="${PGURL}" bash kitetudiant/db/migrations/charger.sh

# ---------------------------------------------------------- le décompte
# Un import qui se termine sans rien dire est un import qu'on croit réussi.
# Ces quatre nombres sont ce qui décide si un élève peut enregistrer un vœu.
log "Ce qui est maintenant en base"
# Les milliers separes par une ESPACE, pas par la virgule que la locale du
# serveur met par defaut : « 14,252 » se lit comme un nombre a decimales.
psql -v ON_ERROR_STOP=1 -qtA -F' | ' "${PGURL}" <<'SQL'
select 'communes',            trim(to_char(count(*), 'FM999 999 999')) from reference.commune
union all
select 'établissements',      trim(to_char(count(*), 'FM999 999 999')) from reference.etablissement
union all
select 'formations',          trim(to_char(count(*), 'FM999 999 999')) from reference.formation
union all
select 'taux d''admission',   trim(to_char(count(*), 'FM999 999 999')) from reference.stat_admission
union all
select 'indicateurs de loyer', trim(to_char(count(*), 'FM999 999 999')) from reference.indicateur_logement;
SQL

FORMATIONS="$(psql -qtAc 'select count(*) from reference.formation' "${PGURL}")"
LISIBLE="$(psql -qtAc "select trim(to_char(${FORMATIONS}, 'FM999 999 999'))" "${PGURL}")"
if [ "${FORMATIONS}" -gt 0 ]; then
  printf '\n\033[1;32m==>\033[0m %s\n\n' \
    "Terminé : ${LISIBLE} formations chargées. Les vœux sont enregistrables."
else
  printf '\n\033[1;31m==>\033[0m %s\n\n' \
    "La table des formations est restée VIDE. Relisez les messages ci-dessus : rien n'a été chargé."
  exit 1
fi
