#!/usr/bin/env bash
#
# Déploiement DIRECT sur le VPS — sans GitHub Actions ni clé SSH.
# Récupère le dépôt (public), build le front, sert via nginx et démarre l'API.
#
# Multi-projets : ce projet (portail voyageurs) est servi sous un SOUS-CHEMIN
# (par défaut « /maisoncapendu »). Tu peux héberger d'autres projets sur le même VPS
# sous /autre-projet : chacun dépose sa propre config nginx dans
# /etc/nginx/projets.d/ (via « include »), donc les projets ne se marchent pas
# dessus.
#
# À lancer EN ROOT sur le VPS. Deux façons :
#
#   # 1) En une commande :
#   curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/airbnb-guest-portal-8o2bq8/deploy/vps-setup.sh | bash
#
#   # 2) Depuis un clone du dépôt :
#   bash deploy/vps-setup.sh
#
# Options (variables d'environnement) :
#   SLUG=maisoncapendu                # sous-chemin + nom du projet (URL : /maisoncapendu)
#   API_PORT=8788                # port local de l'API Node (unique par projet !)
#   SESSION_SECRET=...           # clé secrète de signature des jetons de session
#                                #   (fortement recommandé en production)
#   SERVER_NAME=76.13.37.163     # IP ou domaine servi par nginx
#   REDIRECT_ROOT=1              # « / » redirige vers /<SLUG>/ (défaut : 1)
#
# Exemple pour un 2e projet plus tard :
#   SLUG=monsite API_PORT=8789 bash deploy/vps-setup.sh
#
# Le script est idempotent : relance-le pour mettre à jour le site.
#
# IMPORTANT — configuration des séjours :
#   Le portail lit les identifiants et infos de la maison dans, par ordre de
#   priorité, ${APP_DIR}/.data/sejours.json puis server/data/sejours.json
#   (exemple versionné). Pour la mise en service, crée ta config réelle :
#     mkdir -p /opt/maisoncapendu/.data
#     cp /opt/maisoncapendu/server/data/sejours.json /opt/maisoncapendu/.data/sejours.json
#     nano /opt/maisoncapendu/.data/sejours.json   # remplis tes vrais codes/séjours
#     pm2 restart maisoncapendu-api
#   Ce fichier .data/ n'est pas écrasé par les mises à jour (relances du script).

set -euo pipefail

# ------------------------------------------------------------------ paramètres
REPO_URL="${REPO_URL:-https://github.com/lotierimmobilier-prog/Studies.git}"
BRANCH="${BRANCH:-claude/airbnb-guest-portal-8o2bq8}"
SLUG="${SLUG:-maisoncapendu}"                       # sous-chemin d'URL et nom du projet
SERVER_NAME="${SERVER_NAME:-76.13.37.163}"    # IP ou nom de domaine
API_PORT="${API_PORT:-8788}"                  # port local de l'API (unique/projet)
REDIRECT_ROOT="${REDIRECT_ROOT:-1}"           # « / » -> « /<SLUG>/ »

SRC_DIR="/opt/${SLUG}-src"                    # copie de travail du dépôt
WEB_ROOT="/var/www/${SLUG}"                   # front statique servi par nginx
APP_DIR="/opt/${SLUG}"                        # serveur Node (prix + IA)
PM2_NAME="${SLUG}-api"                        # nom du process pm2
INCLUDE_DIR="/etc/nginx/projets.d"            # snippets nginx par projet

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Ce script doit être lancé en root (essaie : sudo bash deploy/vps-setup.sh)." >&2
  exit 1
fi

# ------------------------------------------------------------- dépendances système
log "Installation des dépendances système (Node 22, nginx, git, pm2)…"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v 2>/dev/null | cut -c2-3)" -lt 20 ] 2>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v git    >/dev/null 2>&1 || apt-get install -y git
command -v nginx  >/dev/null 2>&1 || apt-get install -y nginx
command -v rsync  >/dev/null 2>&1 || apt-get install -y rsync
command -v pm2    >/dev/null 2>&1 || npm install -g pm2

# --------------------------------------------------------------- récupération du code
log "Récupération du code (branche ${BRANCH})…"
if [ -d "${SRC_DIR}/.git" ]; then
  git -C "${SRC_DIR}" fetch --depth 1 origin "${BRANCH}"
  git -C "${SRC_DIR}" checkout -B "${BRANCH}" "origin/${BRANCH}"
  git -C "${SRC_DIR}" reset --hard "origin/${BRANCH}"
else
  rm -rf "${SRC_DIR}"
  git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${SRC_DIR}"
fi

# ------------------------------------------------------------------- build du front
log "Build du front (base « /${SLUG}/ »)…"
cd "${SRC_DIR}"
npm ci
VITE_BASE="/${SLUG}/" npm run build     # les assets et l'API sont préfixés par /<SLUG>/

log "Copie du front vers ${WEB_ROOT}…"
mkdir -p "${WEB_ROOT}"
rsync -a --delete "${SRC_DIR}/dist/" "${WEB_ROOT}/"

# ------------------------------------------------------------------- serveur Node (API)
log "Installation du serveur Node (authentification + séjours) dans ${APP_DIR}…"
mkdir -p "${APP_DIR}"
rsync -a --delete "${SRC_DIR}/server/" "${APP_DIR}/server/"
for f in package.json package-lock.json tsconfig.server.json; do
  [ -f "${SRC_DIR}/${f}" ] && cp "${SRC_DIR}/${f}" "${APP_DIR}/"
done
cd "${APP_DIR}"
npm ci

# Secret de signature des jetons de session. S'il n'est pas fourni, on en génère
# un (persisté dans .env) pour ne pas invalider les sessions à chaque mise à jour.
: > "${APP_DIR}/.env"
if [ -z "${SESSION_SECRET:-}" ] && [ -f "${APP_DIR}/.session_secret" ]; then
  SESSION_SECRET="$(cat "${APP_DIR}/.session_secret")"
fi
if [ -z "${SESSION_SECRET:-}" ]; then
  SESSION_SECRET="$(head -c 32 /dev/urandom | base64)"
  log "SESSION_SECRET généré automatiquement."
fi
printf '%s' "${SESSION_SECRET}" > "${APP_DIR}/.session_secret"
chmod 600 "${APP_DIR}/.session_secret"
echo "SESSION_SECRET=${SESSION_SECRET}" >> "${APP_DIR}/.env"

log "(Re)démarrage de l'API « ${PM2_NAME} » (port ${API_PORT}) via pm2…"
ENV_VARS="PORT=${API_PORT} SESSION_SECRET=${SESSION_SECRET}"
if pm2 describe "${PM2_NAME}" >/dev/null 2>&1; then
  env ${ENV_VARS} pm2 restart "${PM2_NAME}" --update-env
else
  env ${ENV_VARS} pm2 start "npx tsx server/index.ts" --name "${PM2_NAME}" --update-env
fi
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ------------------------------------------------------------------------ nginx
# Serveur principal (créé une seule fois) : il inclut les snippets par projet.
log "Configuration de nginx (multi-projets sous /etc/nginx/projets.d)…"
mkdir -p "${INCLUDE_DIR}"

MAIN_CONF="/etc/nginx/sites-available/vps-multi"
if [ ! -f "${MAIN_CONF}" ]; then
  cat > "${MAIN_CONF}" <<NGINX
# Serveur nginx partagé — chaque projet ajoute sa config dans ${INCLUDE_DIR}/*.conf
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SERVER_NAME};

    # Chaque projet (studies, …) dépose ici ses « location » (sous-chemin + API).
    include ${INCLUDE_DIR}/*.conf;
}
NGINX
  ln -sf "${MAIN_CONF}" /etc/nginx/sites-enabled/vps-multi
  rm -f /etc/nginx/sites-enabled/default
fi

# Redirection facultative de « / » vers ce projet (déposée à part, modifiable).
if [ "${REDIRECT_ROOT}" = "1" ]; then
  cat > "${INCLUDE_DIR}/000-root-redirect.conf" <<NGINX
# « / » redirige vers /${SLUG}/ (supprime ce fichier pour une page d'accueil neutre)
location = / { return 302 /${SLUG}/; }
NGINX
fi

# Snippet propre à CE projet : front sous /<SLUG>/ + API sous /<SLUG>/api/.
cat > "${INCLUDE_DIR}/${SLUG}.conf" <<NGINX
# Projet « ${SLUG} » — front statique + API Node (port ${API_PORT})
location = /${SLUG} { return 301 /${SLUG}/; }

location /${SLUG}/ {
    root /var/www;                       # /${SLUG}/ -> /var/www/${SLUG}/
    try_files \$uri \$uri/ /${SLUG}/index.html;
}

location /${SLUG}/api/ {
    proxy_pass http://127.0.0.1:${API_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_read_timeout 30s;
}

location /${SLUG}/assets/ {
    root /var/www;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
NGINX

nginx -t
systemctl reload nginx

log "Terminé ! Le site est en ligne : http://${SERVER_NAME}/${SLUG}/"
echo "   Vérifs utiles :"
echo "     pm2 status"
echo "     curl localhost:${API_PORT}/api/sante"
echo "     curl http://${SERVER_NAME}/${SLUG}/api/sante"
echo "   Mettre à jour ce projet : relance ce script."
echo "   Ajouter un 2e projet : SLUG=monsite API_PORT=8788 bash deploy/vps-setup.sh"
