#!/usr/bin/env bash
#
# Déploiement DIRECT sur le VPS — sans GitHub Actions ni clé SSH.
# Récupère le dépôt (public), build le front, sert via nginx et démarre l'API.
#
# Multi-projets : ce projet est servi sous un SOUS-CHEMIN (par défaut « /studies »).
# Tu peux héberger d'autres projets sur le même VPS sous /autre-projet : chacun
# dépose sa propre config nginx dans /etc/nginx/projets.d/ (via « include »),
# donc les projets ne se marchent pas dessus.
#
# À lancer EN ROOT sur le VPS. Deux façons :
#
#   # 1) En une commande :
#   curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/main/deploy/vps-setup.sh | bash
#
#   # 2) Depuis un clone du dépôt :
#   bash deploy/vps-setup.sh
#
# Options (variables d'environnement) :
#   PROJET=simulateur            # « simulateur » (historique) ou « kitetudiant »
#   SLUG=studies                 # sous-chemin + nom du projet (URL : /studies)
#   API_PORT=8787                # port local de l'API Node (unique par projet !)
#   ANTHROPIC_API_KEY=sk-ant-... # active l'IA (conseils + analyse de bulletin +
#                                #   modération fine des avis étudiants)
#   GOOGLE_MAPS_API_KEY=...      # active les avis Google (note ⭐ des écoles)
#   MODERATION_TOKEN=...         # jeton pour l'endpoint de modération des avis
#   SERVER_NAME=76.13.37.163     # IP ou domaine servi par nginx
#   REDIRECT_ROOT=1              # « / » redirige vers /<SLUG>/ (défaut : 1)
#   DOMAIN=kitetudiant.fr        # nom de domaine à servir, en plus de l'IP
#   TLS=1                        # obtient un certificat Let's Encrypt pour DOMAIN
#   TLS_EMAIL=vous@exemple.fr    # adresse de contact exigée par Let's Encrypt
#
# HTTPS (à faire une fois le DNS en place) :
#   1. Chez le registrar : un enregistrement A « kitetudiant.fr » -> l'IP du VPS,
#      et le même pour « www ». Attendre la propagation (dig kitetudiant.fr).
#   2. DOMAIN=kitetudiant.fr TLS=1 TLS_EMAIL=vous@exemple.fr bash deploy/vps-setup.sh
#   Le certificat se renouvelle tout seul (timer systemd installé par certbot).
#
# Exemple : KITETUDIANT servi à la racine de son domaine, en HTTPS.
#   PROJET=kitetudiant SLUG=kitetudiant API_PORT=8788 \
#     DOMAIN=kitetudiant.fr TLS=1 TLS_EMAIL=vous@exemple.fr \
#     bash deploy/vps-setup.sh
#
# Exemple pour un 2e projet plus tard :
#   SLUG=monsite API_PORT=8788 bash deploy/vps-setup.sh
#
# Le script est idempotent : relance-le pour mettre à jour le site.

set -euo pipefail

# ------------------------------------------------------------------ paramètres
REPO_URL="${REPO_URL:-https://github.com/lotierimmobilier-prog/Studies.git}"
BRANCH="${BRANCH:-main}"
PROJET="${PROJET:-simulateur}"                # « simulateur » ou « kitetudiant »
SLUG="${SLUG:-studies}"                       # sous-chemin d'URL et nom du projet
SERVER_NAME="${SERVER_NAME:-76.13.37.163}"    # IP ou nom de domaine
API_PORT="${API_PORT:-8787}"                  # port local de l'API (unique/projet)
REDIRECT_ROOT="${REDIRECT_ROOT:-1}"           # « / » -> « /<SLUG>/ »
DOMAIN="${DOMAIN:-}"                          # nom de domaine (vide = IP seule)
TLS="${TLS:-0}"                               # 1 = certificat Let's Encrypt
TLS_EMAIL="${TLS_EMAIL:-}"                    # contact exigé par Let's Encrypt

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
# Deux applications cohabitent dans le dépôt : le simulateur historique et
# KITETUDIANT. PROJET choisit laquelle est servie sous ce SLUG.
case "${PROJET}" in
  kitetudiant) COMMANDE_BUILD="build:kitetudiant"; DOSSIER_BUILD="dist-kitetudiant" ;;
  simulateur)  COMMANDE_BUILD="build";             DOSSIER_BUILD="dist" ;;
  *) echo "PROJET doit valoir « simulateur » ou « kitetudiant » (reçu : ${PROJET})." >&2; exit 1 ;;
esac

log "Build du front « ${PROJET} » (base « /${SLUG}/ »)…"
cd "${SRC_DIR}"
npm ci
VITE_BASE="/${SLUG}/" npm run "${COMMANDE_BUILD}"   # assets et API préfixés par /<SLUG>/

log "Copie du front vers ${WEB_ROOT}…"
mkdir -p "${WEB_ROOT}"
rsync -a --delete "${SRC_DIR}/${DOSSIER_BUILD}/" "${WEB_ROOT}/"

# ------------------------------------------------------------------- serveur Node (API)
log "Installation du serveur Node (prix + IA) dans ${APP_DIR}…"
mkdir -p "${APP_DIR}"
rsync -a --delete "${SRC_DIR}/server/" "${APP_DIR}/server/"
for f in package.json package-lock.json tsconfig.server.json; do
  [ -f "${SRC_DIR}/${f}" ] && cp "${SRC_DIR}/${f}" "${APP_DIR}/"
done
cd "${APP_DIR}"
npm ci

# Clés API (facultatives), tracées dans .env pour référence. Elles sont surtout
# transmises au process via l'environnement (pm2 les capte au démarrage).
: > "${APP_DIR}/.env"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" >> "${APP_DIR}/.env"
  log "Clé ANTHROPIC_API_KEY enregistrée (IA activée)."
else
  log "Pas de clé ANTHROPIC_API_KEY : prix en estimation, conseil en mode règles."
fi
if [ -n "${GOOGLE_MAPS_API_KEY:-}" ]; then
  echo "GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" >> "${APP_DIR}/.env"
  log "Clé GOOGLE_MAPS_API_KEY enregistrée (avis Google activés)."
else
  log "Pas de clé GOOGLE_MAPS_API_KEY : les notes Google ne s'affichent pas."
fi
if [ -n "${MODERATION_TOKEN:-}" ]; then
  echo "MODERATION_TOKEN=${MODERATION_TOKEN}" >> "${APP_DIR}/.env"
  log "Jeton MODERATION_TOKEN enregistré (endpoint de modération protégé)."
fi

log "(Re)démarrage de l'API « ${PM2_NAME} » (port ${API_PORT}) via pm2…"
ENV_VARS="PORT=${API_PORT} ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-} GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY:-} MODERATION_TOKEN=${MODERATION_TOKEN:-}"
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
# Le domaine, s'il est fourni, est servi en plus de l'IP. La config principale
# est réécrite à chaque passage pour que l'ajout d'un domaine soit pris en
# compte sans édition manuelle ; les snippets par projet, eux, sont préservés.
NOMS="${SERVER_NAME}"
if [ -n "${DOMAIN}" ]; then
  NOMS="${DOMAIN} www.${DOMAIN} ${SERVER_NAME}"
fi
if [ ! -f "${MAIN_CONF}" ] || [ -n "${DOMAIN}" ]; then
  cat > "${MAIN_CONF}" <<NGINX
# Serveur nginx partagé — chaque projet ajoute sa config dans ${INCLUDE_DIR}/*.conf
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${NOMS};

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

# --------------------------------------------------------------------- HTTPS
# Le site collectera des données d'élèves mineurs : le chiffrement du transport
# n'est pas une option. certbot réécrit la config nginx pour ajouter le bloc 443
# et la redirection depuis le port 80, puis installe son timer de renouvellement.
URL_FINALE="http://${SERVER_NAME}/${SLUG}/"
if [ "${TLS}" = "1" ]; then
  if [ -z "${DOMAIN}" ]; then
    echo "TLS=1 exige DOMAIN=<votre-domaine> : un certificat ne s'obtient pas pour une IP." >&2
    exit 1
  fi
  log "Obtention du certificat Let's Encrypt pour ${DOMAIN}…"
  command -v certbot >/dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx
  COURRIEL_ARGS="--register-unsafely-without-email"
  if [ -n "${TLS_EMAIL}" ]; then
    COURRIEL_ARGS="--email ${TLS_EMAIL}"
  fi
  certbot --nginx --non-interactive --agree-tos --redirect \
    ${COURRIEL_ARGS} -d "${DOMAIN}" -d "www.${DOMAIN}"
  systemctl reload nginx
  URL_FINALE="https://${DOMAIN}/${SLUG}/"
elif [ -n "${DOMAIN}" ]; then
  URL_FINALE="http://${DOMAIN}/${SLUG}/"
  log "Domaine servi en HTTP simple. Ajoute TLS=1 TLS_EMAIL=… pour passer en HTTPS."
fi

log "Terminé ! Le site est en ligne : ${URL_FINALE}"
echo "   Vérifs utiles :"
echo "     pm2 status"
echo "     curl localhost:${API_PORT}/api/sante"
echo "     curl ${URL_FINALE}api/sante"
echo "   Mettre à jour ce projet : relance ce script."
echo "   Ajouter un 2e projet : SLUG=monsite API_PORT=8788 bash deploy/vps-setup.sh"
