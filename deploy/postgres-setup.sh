#!/usr/bin/env bash
#
# Installe PostgreSQL + PostGIS sur le VPS, crée la base de KITETUDIANT,
# applique les migrations et branche l'API dessus.
#
# À lancer EN ROOT, UNE FOIS. Depuis la copie de travail du dépôt :
#
#   bash /opt/kitetudiant-src/deploy/postgres-setup.sh
#
# ou, si le dépôt n'est pas encore là, avec le sous-chemin du projet :
#
#   SLUG=kitetudiant bash deploy/postgres-setup.sh
#
# ── Pourquoi un script à part de vps-setup.sh ───────────────────────────────
#
# vps-setup.sh tourne toutes les cinq minutes derrière le minuteur de mise en
# ligne. Installer un serveur de base de données à chaque déploiement serait
# absurde, et surtout : appliquer des migrations est une opération DÉLIBÉRÉE.
# Une migration lancée par un minuteur, sur une base de production, est une
# migration que personne n'a décidé de lancer.
#
# Ce script-ci se lance donc à la main, et il est idempotent : relancé, il ne
# refait que ce qui manque.
#
# ── Ce qu'il fait, et ce qu'il ne fait pas ──────────────────────────────────
#
# Il pose une base LOCALE, qui n'écoute que la machine elle-même. Elle n'est
# donc joignable que par l'API qui tourne à côté : aucun port de base de
# données n'est exposé au réseau. C'est le réglage par défaut de PostgreSQL
# sur Debian et Ubuntu, et ce script vérifie qu'il n'a pas été desserré plutôt
# que de le supposer.
#
# Il ne chiffre PAS le disque. Les données identifiantes — l'adresse e-mail
# des élèves — sont chiffrées par l'APPLICATION avant d'arriver en base
# (COMPTES_MASTER_KEY), ce qui est ce qu'exige la règle 3 de CLAUDE.md pour
# des comptes de mineurs. Le reste de la base est de la donnée publique :
# formations, établissements, communes, loyers.
#
# Il ne charge PAS les données de référence. C'est charger.sh, et il lui faut
# les CSV produits par scripts/import/preparer.py.

set -euo pipefail

SLUG="${SLUG:-kitetudiant}"
BASE="${BASE:-${SLUG}}"                       # nom de la base et du rôle
APP_DIR="/opt/${SLUG}"                        # là où vit .env
SRC_DIR="${SRC_DIR:-/opt/${SLUG}-src}"        # copie de travail du dépôt
PM2_NAME="${SLUG}-api"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
avert() { printf '\033[1;33m /!\\\033[0m %s\n' "$*"; }

[ "$(id -u)" = "0" ] || { echo "À lancer en root."; exit 1; }

# --------------------------------------------------------------- le dépôt
# Le script a besoin des migrations, qui vivent dans le dépôt. Il accepte
# d'être lancé depuis n'importe où tant qu'il peut les trouver.
ICI="$(cd "$(dirname "$0")" && pwd)"
if [ -d "${ICI}/../kitetudiant/db/migrations" ]; then
  MIGRATIONS="$(cd "${ICI}/.." && pwd)/kitetudiant/db/migrations"
elif [ -d "${SRC_DIR}/kitetudiant/db/migrations" ]; then
  MIGRATIONS="${SRC_DIR}/kitetudiant/db/migrations"
else
  echo "Migrations introuvables. Attendu dans ${SRC_DIR}/kitetudiant/db/migrations."
  echo "Lance d'abord deploy/vps-setup.sh, qui dépose le dépôt."
  exit 1
fi
log "Migrations : ${MIGRATIONS}"

# ------------------------------------------------------- PostgreSQL + PostGIS
if ! command -v psql >/dev/null 2>&1; then
  log "Installation de PostgreSQL…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y postgresql postgresql-contrib
else
  log "PostgreSQL déjà installé."
fi

# Démarré AVANT la première requête : tout ce qui suit — version, PostGIS,
# listen_addresses — passe par psql. L'installation par apt démarre le service
# d'elle-même, mais on ne le suppose pas : le script doit aussi se relancer sur
# une machine où quelqu'un l'a arrêté.
systemctl enable --now postgresql >/dev/null 2>&1 || systemctl enable --now postgresql

# La version est LUE, jamais supposée : le nom du paquet PostGIS la porte
# (postgresql-16-postgis-3), et une version écrite en dur ici cesserait de
# s'installer à la prochaine version de la distribution — sans autre symptôme
# qu'une migration qui bascule en mode dégradé.
VERSION="$(psql --version | awk '{print $3}' | cut -d. -f1)"
log "PostgreSQL ${VERSION}."

if ! sudo -u postgres psql -tAc \
  "select 1 from pg_available_extensions where name = 'postgis'" | grep -q 1; then
  log "Installation de PostGIS…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y "postgresql-${VERSION}-postgis-3" || true
else
  log "PostGIS déjà disponible."
fi

# PostGIS absent = on NE MIGRE PAS. Le mode dégradé d'appliquer.sh remplace
# les colonnes géographiques par du texte et les index GiST par des B-tree ; il
# existe pour les postes de développement où PostGIS ne s'installe pas.
#
# Sur une base de production, il est un piège à sens unique : appliquer.sh
# enregistre la migration dans public.migration et, au passage suivant, la
# SAUTE — il compare les noms, jamais la colonne « degrade ». Une panne
# passagère d'apt-get au premier lancement fige donc le schéma en texte pour
# toujours, et la carte comme les recherches par distance restent mortes sans
# qu'aucun message ne le rappelle.
#
# Mieux vaut ne rien migrer et le dire.
if ! sudo -u postgres psql -tAc \
  "select 1 from pg_available_extensions where name = 'postgis'" | grep -q 1; then
  avert "PostGIS n'est pas disponible."
  echo
  echo "  Rien n'a été migré, et c'est volontaire : migrer sans PostGIS fige le"
  echo "  schéma en mode dégradé — colonnes géographiques en texte — et les"
  echo "  migrations déjà enregistrées ne seront pas rejouées une fois PostGIS"
  echo "  installé. La carte et les recherches par distance resteraient mortes."
  echo
  echo "  Réessaie l'installation :"
  echo "    apt-get update && apt-get install -y postgresql-${VERSION}-postgis-3"
  echo
  echo "  Si ce serveur doit se passer de carte et de recherche par distance,"
  echo "  dis-le explicitement — c'est un choix définitif pour cette base :"
  echo "    SANS_POSTGIS=1 bash \$0"
  [ "${SANS_POSTGIS:-0}" = "1" ] || exit 1
  avert "SANS_POSTGIS=1 : migration en mode dégradé, définitivement."
fi

# ------------------------------------------------- la base n'écoute que nous
# Vérifié plutôt que supposé : quelqu'un a pu desserrer listen_addresses pour
# se connecter depuis son poste, et l'oublier. Une base de comptes de mineurs
# ouverte sur l'Internet ne doit pas dépendre d'un souvenir.
ECOUTE="$(sudo -u postgres psql -tAc 'show listen_addresses' | tr -d '[:space:]')"
case "${ECOUTE}" in
  localhost|127.0.0.1|::1|'')
    log "La base n'écoute que la machine (listen_addresses = ${ECOUTE:-vide})."
    ;;
  *)
    # On S'ARRÊTE, on n'avertit pas. Un avertissement défile, « Terminé. »
    # s'affiche trois lignes plus bas, et la base de comptes de mineurs vient
    # d'être créée sur un serveur qui écoute l'Internet. Le contrôle est posé
    # AVANT la création du rôle et de la base : rien n'existe encore.
    avert "listen_addresses vaut « ${ECOUTE} » : la base écoute au-delà de cette"
    avert "machine. L'API tourne sur le même serveur et n'en a pas besoin."
    echo
    echo "  Rien n'a été créé. Pour corriger :"
    echo "    sed -i \"s/^listen_addresses.*/listen_addresses = 'localhost'/\" \\"
    echo "      /etc/postgresql/${VERSION}/main/postgresql.conf"
    echo "    systemctl restart postgresql"
    echo
    echo "  Si cette écoute est voulue — une autre machine se connecte à ce"
    echo "  serveur — c'est à toi de garantir pg_hba.conf et le pare-feu, et"
    echo "  il faut le dire explicitement :"
    echo "    ECOUTE_LARGE_ASSUMEE=1 bash \$0"
    [ "${ECOUTE_LARGE_ASSUMEE:-0}" = "1" ] || exit 1
    avert "ECOUTE_LARGE_ASSUMEE=1 : on continue, sous ta responsabilité."
    ;;
esac

# ------------------------------------------------------------ rôle et base
# Un mot de passe DÉJÀ posé n'est jamais régénéré : le rôle est peut-être
# utilisé par autre chose, et surtout une rotation silencieuse casserait
# l'API jusqu'au prochain redémarrage sans que rien ne le dise. Même règle
# que pour les secrets repris du .env par vps-setup.sh.
URL_EXISTANTE=""
if [ -f "${APP_DIR}/.env" ]; then
  URL_EXISTANTE="$(sed -n 's/^DATABASE_URL=//p' "${APP_DIR}/.env" | tail -n 1)"
fi

if [ -n "${URL_EXISTANTE}" ]; then
  log "DATABASE_URL déjà dans ${APP_DIR}/.env : mot de passe conservé."
  URL="${URL_EXISTANTE}"
  MDP=""
else
  # Hexadécimal : [0-9a-f] uniquement. Aucun caractère à échapper, ni dans le
  # SQL ci-dessous, ni dans l'URL de connexion — ce qui écarte d'un coup
  # l'injection et les mots de passe qui « marchent en local » puis cassent
  # une fois encodés dans une URL.
  MDP="$(openssl rand -hex 24)"
  URL="postgres://${BASE}:${MDP}@127.0.0.1:5432/${BASE}"
fi

if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname = '${BASE}'" | grep -q 1; then
  log "Création du rôle ${BASE}…"
  [ -n "${MDP}" ] || { echo "Rôle absent mais mot de passe inconnu : retire DATABASE_URL du .env et relance."; exit 1; }
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ${BASE} LOGIN PASSWORD '${MDP}'"
else
  log "Rôle ${BASE} déjà là."
  [ -n "${MDP}" ] && sudo -u postgres psql -v ON_ERROR_STOP=1 \
    -c "ALTER ROLE ${BASE} PASSWORD '${MDP}'"
fi

if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname = '${BASE}'" | grep -q 1; then
  log "Création de la base ${BASE}…"
  sudo -u postgres createdb -O "${BASE}" "${BASE}"
else
  log "Base ${BASE} déjà là."
fi

# PostGIS s'installe en superutilisateur, une fois, dans la base cible. Posée
# ici, la ligne « CREATE EXTENSION IF NOT EXISTS postgis » de la migration 001
# devient un non-événement et n'exige plus aucun privilège.
if [ "${SANS_POSTGIS:-0}" != "1" ]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${BASE}" \
    -c "CREATE EXTENSION IF NOT EXISTS postgis" >/dev/null
  log "Extension PostGIS active dans ${BASE}."
fi

# --------------------------------------------------------------- migrations
log "Application des migrations…"
PGURL="${URL}" bash "${MIGRATIONS}/appliquer.sh"

# ------------------------------------------------------------- brancher l'API
if [ -n "${URL_EXISTANTE}" ]; then
  log "DATABASE_URL déjà posée dans ${APP_DIR}/.env."
else
  log "Écriture de DATABASE_URL dans ${APP_DIR}/.env…"
  mkdir -p "${APP_DIR}"
  # Retirer une ligne vide éventuelle avant d'ajouter, pour ne pas laisser
  # deux DATABASE_URL dans le fichier si ce script est relancé après un
  # effacement partiel.
  if [ -f "${APP_DIR}/.env" ]; then
    grep -v '^DATABASE_URL=' "${APP_DIR}/.env" > "${APP_DIR}/.env.tmp" || true
    mv "${APP_DIR}/.env.tmp" "${APP_DIR}/.env"
  fi
  echo "DATABASE_URL=${URL}" >> "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
fi

# Relance de l'API avec TOUT l'environnement du .env, pas seulement la
# nouvelle variable : « pm2 --update-env » remplace l'environnement du
# processus par celui du shell courant. Ne lui passer que DATABASE_URL
# effacerait les clés d'API et la clé de chiffrement des comptes.
#
# La lecture ligne à ligne, et non « source », parce qu'une valeur contenant
# une espace — ADMIN_EMAILS="a@b.fr, c@d.fr" — casse un « source » et pas une
# affectation.
if command -v pm2 >/dev/null 2>&1 && pm2 describe "${PM2_NAME}" >/dev/null 2>&1; then
  log "Redémarrage de ${PM2_NAME} avec la base branchée…"
  while IFS= read -r ligne || [ -n "${ligne}" ]; do
    case "${ligne}" in ''|'#'*) continue ;; esac
    cle="${ligne%%=*}"
    case "${cle}" in ''|*[!A-Za-z0-9_]*) continue ;; esac
    export "${cle}=${ligne#*=}"
  done < "${APP_DIR}/.env"
  pm2 restart "${PM2_NAME}" --update-env
  pm2 save >/dev/null 2>&1 || true
else
  avert "pm2 ou le process ${PM2_NAME} est introuvable : relance l'API toi-même."
fi

log "Terminé."
echo "   Vérifs :"
echo "     sudo -u postgres psql -d ${BASE} -c '\\dn'        # les schémas créés"
echo "     curl -s localhost/api/voeux                      # ne doit plus rendre 503"
echo
echo "   Le .env est en 0600 : le mot de passe de la base n'y est lisible que par root."
echo
# Ces trois lignes ne sont pas décoratives : tant qu'elles n'ont pas tourné,
# `reference.formation` est vide et AUCUN élève ne peut enregistrer un vœu.
# La base répond, les migrations sont appliquées, la console est verte — et
# le site est cassé. Ce message ne nommait que la troisième commande, ce qui
# a coûté une panne en production le 21/09/2026 : on cherchait pourquoi une
# formation précise manquait, alors qu'il n'y en avait aucune.
echo "   ⚠  LES DONNÉES DE RÉFÉRENCE NE SONT PAS ENCORE CHARGÉES."
echo "      Sans elles, aucun vœu n'est enregistrable. Trois étapes, dans cet ordre :"
echo
echo "        cd ${SRC_DIR}"
echo "        python3 kitetudiant/scripts/exploration/telecharger.py   # ~185 Mo"
echo "        python3 kitetudiant/scripts/import/preparer.py"
echo "        PGURL=\"\$(sed -n 's/^DATABASE_URL=//p' ${APP_DIR}/.env)\" \\"
echo "          bash ${MIGRATIONS}/charger.sh"
echo
echo "      Puis vérifier dans la console d'administration : les compteurs de"
echo "      reference.formation, etablissement et commune doivent être non nuls."
