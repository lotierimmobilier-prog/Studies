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
#   ADMIN_TOKEN=...              # ouvre la console /admin.html (≥ 24 caractères)
#   ADMIN_MASTER_KEY=...         # chiffre le coffre de clés (≥ 16 caractères)
#   COMPTES_MASTER_KEY=...       # chiffre les comptes élèves (≥ 16 caractères).
#                                #   Sans elle, l'inscription est impossible ET le
#                                #   détail du résultat reste ouvert à tous.
#   DATABASE_URL=postgres://...  # base PostgreSQL. SANS elle, rien ne change :
#                                #   comptes dans le fichier chiffré, formations
#                                #   chez le ministère. C'est le mode normal tant
#                                #   que la bascule n'est pas faite. Les migrations
#                                #   ne sont PAS appliquées par ce script : elles
#                                #   restent une opération délibérée
#                                #   (kitetudiant/db/migrations/appliquer.sh).
#   ADMIN_EMAILS=a@b.fr,c@d.fr   # comptes autorisés à ouvrir la console avec
#                                #   leur propre session, sans ressaisir le jeton.
#                                #   Plus commode et PLUS FAIBLE qu'ADMIN_TOKEN :
#                                #   la console vaut alors un mot de passe.
#
# La console d'administration reste FERMÉE tant qu'ADMIN_TOKEN n'est pas
# défini, et elle refuse de répondre hors HTTPS. Faire le certificat d'abord.
#   SERVER_NAME=76.13.37.163     # IP ou domaine servi par nginx
#                                #   (VPS KITETUDIANT : 76.13.37.193)
#   REDIRECT_ROOT=1              # « / » redirige vers /<SLUG>/ (défaut : 1)
#   RACINE=1                     # sert le projet SUR « / » au lieu de « /<SLUG>/ »
#   HSTS=1                       # en-tête Strict-Transport-Security (défaut : 1, exige TLS=1)
#   HSTS_AGE=31536000            # durée de l'engagement HSTS, en secondes (défaut : un an)
#   DOMAIN=kitetudiant.fr        # nom de domaine à servir, en plus de l'IP
#   TLS=1                        # obtient un certificat Let's Encrypt pour DOMAIN
#   TLS_EMAIL=vous@exemple.fr    # adresse de contact exigée par Let's Encrypt
#   TLS_FORCER=1                 # passe outre le pré-vol DNS (CDN, proxy amont)
#
# HTTPS (à faire une fois le DNS en place) :
#   1. Chez le registrar : UN SEUL enregistrement A « kitetudiant.fr » -> l'IP
#      du VPS, et le même pour « www ». Plusieurs A sur le même nom font
#      échouer la validation une fois sur deux. Attendre la propagation
#      (dig +short kitetudiant.fr).
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
RACINE="${RACINE:-0}"                         # 1 = servir ce projet SUR la racine du domaine
HSTS="${HSTS:-1}"                             # 1 = interdire au navigateur de retenter HTTP
HSTS_AGE="${HSTS_AGE:-31536000}"              # durée de l'engagement HSTS, en secondes
DOMAIN="${DOMAIN:-}"                          # nom de domaine (vide = IP seule)
TLS="${TLS:-0}"                               # 1 = certificat Let's Encrypt
TLS_EMAIL="${TLS_EMAIL:-}"                    # contact exigé par Let's Encrypt
# AUTO_MAJ n'a PAS de défaut fixe, et c'est délibéré.
#
# Il en avait un — zéro — et le bloc de fin s'en servait pour ARRÊTER le
# minuteur déjà installé. Conséquence : relancer ce script à la main pour
# pousser un correctif, sans repasser AUTO_MAJ=1, éteignait la mise en ligne
# automatique. Le déploiement réussissait, le message « désactivée » passait
# inaperçu dans la sortie, et plus rien ne repartait ensuite. C'est arrivé en
# production : quatre fusions restées hors ligne pendant neuf heures.
#
# Un paramètre non passé ne doit rien décider. La règle est celle qui vaut
# déjà pour les secrets repris du .env : une valeur passée en ligne de
# commande l'emporte toujours, une valeur absente reconduit l'existant.
# AUTO_MAJ=0 explicite désactive donc toujours — c'est la seule façon.
#
# L'état en place se lit sur systemd plutôt que dans un fichier : c'est la
# seule source qui ne puisse pas mentir sur ce qui tourne réellement.
#
# $1 : la valeur passée par l'opérateur, vide si le paramètre est absent
# $2 : le nom de l'unité minuteur
auto_maj_voulu() {
  if [ -n "$1" ]; then
    printf '%s' "$1"
    return
  fi
  if systemctl is-enabled "$2" >/dev/null 2>&1; then
    printf '1'
  else
    printf '0'
  fi
}
AUTO_MAJ="$(auto_maj_voulu "${AUTO_MAJ-}" "${SLUG}-maj.timer")"
MINUTES_MAJ="${MINUTES_MAJ:-5}"               # intervalle de vérification, en minutes

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
# La base conditionne TOUT ce que le front fabrique : chemins des assets,
# adresse de l'API, liens du blog, cartes de partage, plan du site. Elle n'est
# écrite nulle part en dur, précisément pour que ce basculement soit indolore.
if [ "${RACINE}" = "1" ]; then BASE_WEB="/"; else BASE_WEB="/${SLUG}/"; fi
VITE_BASE="${BASE_WEB}" npm run "${COMMANDE_BUILD}"   # assets et API préfixés par ${BASE_WEB}

log "Copie du front vers ${WEB_ROOT}…"
mkdir -p "${WEB_ROOT}"
rsync -a --delete "${SRC_DIR}/${DOSSIER_BUILD}/" "${WEB_ROOT}/"

# ------------------------------------------------------------------- serveur Node (API)
log "Installation du serveur Node (prix + IA) dans ${APP_DIR}…"
mkdir -p "${APP_DIR}"
rsync -a --delete "${SRC_DIR}/server/" "${APP_DIR}/server/"
# L'API n'est pas autonome : elle importe des modules de kitetudiant/packages
# (barèmes, agrégation des retours), qui chargent eux-mêmes leurs fichiers de
# données JSON. Sans eux, « npx tsx server/index.ts » meurt au démarrage sur un
# import introuvable, pm2 le relance en boucle, et nginx répond 502 — front
# affiché, API muette. Le test server/__tests__/deploiement.test.ts vérifie que
# cette copie couvre bien tout ce que le serveur importe.
mkdir -p "${APP_DIR}/kitetudiant"
rsync -a --delete "${SRC_DIR}/kitetudiant/packages/" "${APP_DIR}/kitetudiant/packages/"
for f in package.json package-lock.json tsconfig.server.json; do
  [ -f "${SRC_DIR}/${f}" ] && cp "${SRC_DIR}/${f}" "${APP_DIR}/"
done
cd "${APP_DIR}"
npm ci

# --- reprise des secrets déjà en place --------------------------------------
# Le fichier .env est réécrit INTÉGRALEMENT juste en dessous. Sans cette
# relecture, relancer le script sans repasser les secrets les effacerait :
# COMPTES_MASTER_KEY perdue, les comptes déjà créés deviennent illisibles et le
# détail chiffré s'ouvre à tout le monde ; ADMIN_TOKEN perdu, la console se
# referme ; ANTHROPIC_API_KEY perdue, l'analyse de bulletin retombe en panne.
#
# On reprend donc, pour chaque variable NON fournie à cet appel, la valeur déjà
# écrite. Une valeur passée en ligne de commande l'emporte toujours : c'est
# ainsi qu'on remplace une clé.
#
# Sans ce bloc, la mise à jour automatique (AUTO_MAJ) serait impossible : elle
# tourne sans personne pour retaper les clés.
if [ -f "${APP_DIR}/.env" ]; then
  HERITEES=""
  while IFS= read -r ligne || [ -n "${ligne}" ]; do
    case "${ligne}" in ''|'#'*) continue ;; esac
    cle="${ligne%%=*}"
    # Le fichier est écrit par ce script, mais on ne laisse pas un contenu
    # nommer ce qu'on exporte : seul un identifiant plausible est accepté.
    case "${cle}" in ''|*[!A-Za-z0-9_]*) continue ;; esac
    [ -n "${!cle:-}" ] && continue
    export "${cle}=${ligne#*=}"
    HERITEES="${HERITEES} ${cle}"
  done < "${APP_DIR}/.env"
  if [ -n "${HERITEES}" ]; then
    log "Secrets repris du .env existant :${HERITEES}"
  fi
fi

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
if [ -n "${ADMIN_EMAILS:-}" ]; then
  echo "ADMIN_EMAILS=${ADMIN_EMAILS}" >> "${APP_DIR}/.env"
  log "Comptes administrateurs : ${ADMIN_EMAILS}"
fi
if [ -n "${COMPTES_MASTER_KEY:-}" ]; then
  echo "COMPTES_MASTER_KEY=${COMPTES_MASTER_KEY}" >> "${APP_DIR}/.env"
  log "Comptes élèves activés : le détail du résultat demande une inscription."
else
  log "Pas de COMPTES_MASTER_KEY : inscription impossible, détail ouvert à tous."
fi
# La base. Le script ne l'installe pas et n'applique aucune migration : poser
# un schéma sur une base de production est une décision, pas un effet de bord
# d'un déploiement. Il se contente de transmettre l'adresse au serveur.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL=${DATABASE_URL}" >> "${APP_DIR}/.env"
  log "Base PostgreSQL configurée. Migrations à appliquer à part si besoin :"
  log "  PGURL=\"\$DATABASE_URL\" bash kitetudiant/db/migrations/appliquer.sh"
else
  log "Pas de DATABASE_URL : fichier chiffré et open data, comme avant."
fi
if [ -n "${ADMIN_TOKEN:-}" ] && [ -n "${ADMIN_MASTER_KEY:-}" ]; then
  echo "ADMIN_TOKEN=${ADMIN_TOKEN}" >> "${APP_DIR}/.env"
  echo "ADMIN_MASTER_KEY=${ADMIN_MASTER_KEY}" >> "${APP_DIR}/.env"
  if [ "${TLS}" = "1" ]; then
    log "Console d'administration ouverte sur https://${DOMAIN}/${SLUG}/admin.html"
  else
    log "ADMIN_TOKEN enregistré, mais la console refusera de répondre hors HTTPS."
  fi
elif [ -n "${ADMIN_TOKEN:-}" ] || [ -n "${ADMIN_MASTER_KEY:-}" ]; then
  log "ADMIN_TOKEN et ADMIN_MASTER_KEY vont par deux : console laissée fermée."
else
  log "Pas de console d'administration (ADMIN_TOKEN absent)."
fi
# Le fichier .env contient des secrets : il ne doit être lisible que par root.
chmod 600 "${APP_DIR}/.env"

log "(Re)démarrage de l'API « ${PM2_NAME} » (port ${API_PORT}) via pm2…"
ENV_VARS="PORT=${API_PORT} ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-} GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY:-} MODERATION_TOKEN=${MODERATION_TOKEN:-} ADMIN_TOKEN=${ADMIN_TOKEN:-} ADMIN_MASTER_KEY=${ADMIN_MASTER_KEY:-} COMPTES_MASTER_KEY=${COMPTES_MASTER_KEY:-} ADMIN_EMAILS=${ADMIN_EMAILS:-}"
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

# --- cohabitation avec un site déjà installé --------------------------------
# Cette machine héberge peut-être déjà autre chose (FamilyIA, un site vitrine…).
# Deux réflexes de ce script étaient dangereux dans ce cas : réclamer
# « default_server », qui fait échouer « nginx -t » si quelqu'un l'occupe déjà,
# et supprimer sites-enabled/default, qui peut être le site de l'autre projet.
# On ne prend donc le rôle par défaut que s'il est libre, et on ne retire
# jamais une config qu'on n'a pas posée soi-même.
# La page « Welcome to nginx » livrée avec le paquet porte elle aussi
# « default_server » : elle ne compte pas comme un site à préserver. On la
# reconnaît à sa racine /var/www/html et à l'absence de proxy ou de certificat.
DEFAUT_ORIGINE=""
if [ -e /etc/nginx/sites-enabled/default ] \
   && grep -qE '^[[:space:]]*root[[:space:]]+/var/www/html;' /etc/nginx/sites-enabled/default 2>/dev/null \
   && ! grep -qE 'proxy_pass|ssl_certificate' /etc/nginx/sites-enabled/default 2>/dev/null; then
  DEFAUT_ORIGINE="1"
fi

# Qui tient « default_server » ? On s'ignore soi-même et on ignore la page
# d'origine ; ce qui reste est un vrai site, qu'on ne dérange pas.
AUTRE_DEFAUT=""
for conf in $(grep -rlE 'listen[^;]*default_server' \
  /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null || true); do
  case "${conf}" in
    */vps-multi) continue ;;
    */default) [ -n "${DEFAUT_ORIGINE}" ] && continue ;;
  esac
  AUTRE_DEFAUT="${conf}"
  break
done

if [ -n "${AUTRE_DEFAUT}" ]; then
  DIRECTIVE_DEFAUT=""
  log "« default_server » est déjà tenu par ${AUTRE_DEFAUT} : on ne le lui prend pas."
else
  DIRECTIVE_DEFAUT=" default_server"
fi

# Le domaine, s'il est fourni, est servi en plus de l'IP. La config principale
# est réécrite à chaque passage pour que l'ajout d'un domaine soit pris en
# compte sans édition manuelle ; les snippets par projet, eux, sont préservés.
NOMS="${SERVER_NAME}"
if [ -n "${DOMAIN}" ]; then
  NOMS="${DOMAIN} www.${DOMAIN} ${SERVER_NAME}"
fi
if [ ! -f "${MAIN_CONF}" ] || [ -n "${DOMAIN}" ]; then
  # Sauvegarde : si nginx refuse la nouvelle config, on remet l'ancienne plutôt
  # que de laisser la machine dans un état où le prochain redémarrage échoue.
  SAUVEGARDE="$(mktemp -d)"
  [ -f "${MAIN_CONF}" ] && cp "${MAIN_CONF}" "${SAUVEGARDE}/vps-multi"

  cat > "${MAIN_CONF}" <<NGINX
# Serveur nginx partagé — chaque projet ajoute sa config dans ${INCLUDE_DIR}/*.conf
server {
    listen 80${DIRECTIVE_DEFAUT};
    listen [::]:80${DIRECTIVE_DEFAUT};
    server_name ${NOMS};

    # Chaque projet (studies, …) dépose ici ses « location » (sous-chemin + API).
    include ${INCLUDE_DIR}/*.conf;
}
NGINX
  ln -sf "${MAIN_CONF}" /etc/nginx/sites-enabled/vps-multi

  # sites-enabled/default n'est retiré que s'il s'agit bien de la page d'accueil
  # nginx d'origine — jamais s'il sert un vrai site (nom de domaine, proxy).
  if [ -n "${DEFAUT_ORIGINE}" ]; then
    rm -f /etc/nginx/sites-enabled/default      # la page « Welcome to nginx »
  elif [ -e /etc/nginx/sites-enabled/default ]; then
    log "sites-enabled/default sert un vrai site : laissé en place."
  fi
fi

# Redirection facultative de « / » vers ce projet (déposée à part, modifiable).
# En mode racine elle n'a plus lieu d'être : le projet EST la racine, et la
# laisser créerait une boucle de redirection sur elle-même.
if [ "${RACINE}" = "1" ]; then
  rm -f "${INCLUDE_DIR}/000-root-redirect.conf"
elif [ "${REDIRECT_ROOT}" = "1" ]; then
  cat > "${INCLUDE_DIR}/000-root-redirect.conf" <<NGINX
# « / » redirige vers /${SLUG}/ (supprime ce fichier pour une page d'accueil neutre)
location = / { return 302 /${SLUG}/; }
NGINX
fi

# ---------------------------------------------------------------- HSTS
# Strict-Transport-Security interdit au navigateur de retenter HTTP pendant la
# durée annoncée. Sans lui, un onglet ouvert un jour en clair y revient depuis
# son cache et affiche « Non sécurisé » alors que le serveur redirige
# correctement — observé sur kitetudiant.fr le 20/09/2026.
#
# L'en-tête ne DOIT être envoyé qu'en HTTPS (RFC 6797 §7.2). Comme le même
# fichier d'include sert les blocs 80 et 443, on passe par une table : nginx
# n'émet pas un en-tête dont la valeur est vide.
#
# Pas de « includeSubDomains » : ce serait un engagement d'un an sur TOUS les
# sous-domaines, y compris ceux qui n'existent pas encore. À ajouter à la main
# le jour où l'on est sûr de les vouloir tous en HTTPS.
EN_TETE_HSTS=""
if [ "${HSTS}" = "1" ] && [ "${TLS}" = "1" ]; then
  cat > /etc/nginx/conf.d/hsts.conf <<NGINX
# Écrit par deploy/vps-setup.sh. \$hsts vaut la politique en HTTPS, vide sinon.
map \$scheme \$hsts {
    default "";
    https   "max-age=${HSTS_AGE}";
}
NGINX
  EN_TETE_HSTS='    add_header Strict-Transport-Security $hsts always;'
fi

# Snippet propre à CE projet : front + API.
if [ "${RACINE}" = "1" ]; then
  # -------- mode racine : le projet EST le site --------
  # « location / » est le plus court des préfixes : nginx donne la priorité au
  # plus long, donc un autre projet déposé sous /autre/ continue d'être servi.
  # Et cet include ne vit que dans le bloc server de ce domaine : les autres
  # sites de la machine, qui ont leur propre bloc, ne voient rien de ceci.
  cat > "${INCLUDE_DIR}/${SLUG}.conf" <<NGINX
# Projet « ${SLUG} » — servi SUR LA RACINE du domaine + API Node (port ${API_PORT})
location / {
    root /var/www/${SLUG};
    # « /app.html » et NON « /index.html ».
    #
    # index.html est l'accueil pré-rendue : elle porte son propre
    # « <link rel=canonical href=/> ». Servie en repli, elle faisait
    # déclarer à chaque fiche — /formation/…, /etablissement/…,
    # /chercher-une-ecole — qu'elle est un doublon de l'accueil. Un
    # canonique est une déclaration, pas une suggestion.
    #
    # app.html est la même application sans canonique et sans og:url :
    # la page est alors prise pour elle-même, et React pose les bonnes
    # métadonnées au montage. Écrite par kitetudiant/scripts/prerendre.ts.
    try_files \$uri \$uri/ /app.html;
${EN_TETE_HSTS}
}

location /api/ {
    proxy_pass http://127.0.0.1:${API_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    # Sans ces deux en-têtes, l'API ne voit qu'une connexion HTTP venue de
    # 127.0.0.1, et deux choses cassent en silence :
    #
    #   - X-Forwarded-Proto : la console d'administration exige HTTPS. Elle ne
    #     peut pas le constater elle-même derrière nginx, qui termine le TLS.
    #     Sans cet en-tête elle répond 421 même sur un site en HTTPS valide.
    #   - X-Forwarded-For : le verrouillage après cinq échecs se compte par
    #     client. Sans cet en-tête, tous les visiteurs partagent l'adresse de
    #     nginx : les échecs d'un seul verrouilleraient tout le monde.
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
}

location /assets/ {
    root /var/www/${SLUG};
    expires 30d;
    add_header Cache-Control "public, immutable";
${EN_TETE_HSTS}
}
NGINX
else
  # -------- mode sous-chemin : le projet vit sous /<SLUG>/ --------
  cat > "${INCLUDE_DIR}/${SLUG}.conf" <<NGINX
# Projet « ${SLUG} » — front statique + API Node (port ${API_PORT})
location = /${SLUG} { return 301 /${SLUG}/; }

location /${SLUG}/ {
    root /var/www;                       # /${SLUG}/ -> /var/www/${SLUG}/
    # Voir le commentaire du mode racine : l'accueil pré-rendue porte son
    # propre canonique, donc le repli passe par app.html.
    try_files \$uri \$uri/ /${SLUG}/app.html;
${EN_TETE_HSTS}
}

location /${SLUG}/api/ {
    proxy_pass http://127.0.0.1:${API_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    # Sans ces deux en-têtes, l'API ne voit qu'une connexion HTTP venue de
    # 127.0.0.1, et deux choses cassent en silence :
    #
    #   - X-Forwarded-Proto : la console d'administration exige HTTPS. Elle ne
    #     peut pas le constater elle-même derrière nginx, qui termine le TLS.
    #     Sans cet en-tête elle répond 421 même sur un site en HTTPS valide —
    #     observé sur kitetudiant.fr le 20/09/2026, certificat en place.
    #   - X-Forwarded-For : le verrouillage après cinq échecs se compte par
    #     client. Sans cet en-tête, tous les visiteurs partagent l'adresse de
    #     nginx : les échecs d'un seul verrouilleraient tout le monde.
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
}

location /${SLUG}/assets/ {
    root /var/www;
    expires 30d;
    add_header Cache-Control "public, immutable";
${EN_TETE_HSTS}
}
NGINX
fi

# On teste AVANT de recharger. Si nginx refuse la config, on retire ce qu'on
# vient de poser et on remet l'ancienne version : sur une machine qui héberge
# d'autres sites, une config invalide laissée en place les emporterait au
# prochain redémarrage de nginx.
if ! nginx -t; then
  echo "" >&2
  echo "nginx a refusé la configuration : retour à l'état précédent." >&2
  rm -f "${INCLUDE_DIR}/${SLUG}.conf"
  [ "${REDIRECT_ROOT}" = "1" ] && rm -f "${INCLUDE_DIR}/000-root-redirect.conf"
  if [ -n "${SAUVEGARDE:-}" ] && [ -f "${SAUVEGARDE}/vps-multi" ]; then
    cp "${SAUVEGARDE}/vps-multi" "${MAIN_CONF}"
  else
    rm -f /etc/nginx/sites-enabled/vps-multi "${MAIN_CONF}"
  fi
  nginx -t && systemctl reload nginx
  echo "Les autres sites de cette machine sont intacts. Rien n'a été déployé." >&2
  exit 1
fi
systemctl reload nginx

# --------------------------------------------------------------------- HTTPS
# Le site collectera des données d'élèves mineurs : le chiffrement du transport
# n'est pas une option. certbot réécrit la config nginx pour ajouter le bloc 443
# et la redirection depuis le port 80, puis installe son timer de renouvellement.
URL_FINALE="http://${SERVER_NAME}${BASE_WEB}"
if [ "${TLS}" = "1" ]; then
  if [ -z "${DOMAIN}" ]; then
    echo "TLS=1 exige DOMAIN=<votre-domaine> : un certificat ne s'obtient pas pour une IP." >&2
    exit 1
  fi
  # --- pré-vol DNS -----------------------------------------------------------
  # Let's Encrypt valide par HTTP-01 : il appelle lui-même
  # http://<domaine>/.well-known/acme-challenge/… sur l'adresse publiée par le
  # DNS. Si cette adresse n'est pas celle de cette machine, la validation
  # échoue — et chaque échec consomme le quota : 5 par heure et par domaine.
  # On vérifie donc avant d'appeler certbot.
  #
  # Deux niveaux de contrôle, dans cet ordre de confiance :
  #
  #   1. LA SOURCE. On interroge un par un les serveurs de noms du domaine.
  #      C'est ce que fait Let's Encrypt, qui résout lui-même depuis la racine.
  #      Ce contrôle a le dernier mot quand il peut s'exécuter.
  #   2. LE RÉSOLVEUR LOCAL, en repli seulement, quand dig manque ou que les
  #      serveurs de noms sont introuvables. Sa vue peut être périmée de
  #      plusieurs heures et ne dit rien de ce que verra Let's Encrypt.
  #
  # Pourquoi cet ordre : le 19/09/2026 sur kitetudiant.fr, le résolveur local
  # servait encore l'ancienne adresse alors que la zone était corrigée, et un
  # des serveurs de noms du réseau anycast servait encore les anciennes valeurs
  # pendant qu'un autre servait les bonnes. Le contrôle local seul ne pouvait ni
  # voir ce désaccord, ni s'en remettre à la source.
  #
  # TLS_FORCER=1 passe outre n'importe lequel de ces refus, en connaissance de
  # cause : CDN ou reverse-proxy en amont, NAT, ou résolveur local en retard
  # alors que la source est bonne.

  # « || true » : getent sort en erreur quand le nom ne résout pas, et le script
  # tourne sous « set -e pipefail » — sans cela l'absence de DNS tuerait le
  # script sans un mot d'explication.
  adresses_de() { getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u || true; }
  ADRESSES_LOCALES="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+(\.[0-9]+){3}$' | sort -u)"

  est_une_adresse_locale() {
    for locale in ${ADRESSES_LOCALES}; do
      [ "$1" = "${locale}" ] && return 0
    done
    return 1
  }

  refuser() {
    echo "" >&2
    while [ "$#" -gt 0 ]; do echo "$1" >&2; shift; done
    echo "  (TLS_FORCER=1 passe outre si tu sais que la source est bonne.)" >&2
    [ "${TLS_FORCER:-0}" = "1" ] || exit 1
  }

  # ---- niveau 1 : la source --------------------------------------------------
  command -v dig >/dev/null 2>&1 || apt-get install -y dnsutils >/dev/null 2>&1 || true
  VERDICT_SOURCE="inconnu"
  if command -v dig >/dev/null 2>&1; then
    SERVEURS_NOMS="$(dig +short +time=5 +tries=2 NS "${DOMAIN}" 2>/dev/null | sed 's/\.$//' | sort -u || true)"
    if [ -n "${SERVEURS_NOMS}" ]; then
      log "Contrôle du DNS à la source, serveur de noms par serveur de noms…"
      REPONSE_COMMUNE=""
      PREMIER=1
      DESACCORD=0
      for ns in ${SERVEURS_NOMS}; do
        REPONSE="$(dig +short +time=5 +tries=2 A "${DOMAIN}" @"${ns}" 2>/dev/null \
          | grep -E '^[0-9]+(\.[0-9]+){3}$' | sort -u | tr '\n' ' ' | sed 's/ *$//' || true)"
        echo "    ${ns} → ${REPONSE:-rien}"
        if [ "${PREMIER}" = "1" ]; then
          REPONSE_COMMUNE="${REPONSE}"
          PREMIER=0
        elif [ "${REPONSE}" != "${REPONSE_COMMUNE}" ]; then
          DESACCORD=1
        fi
      done

      VERDICT_SOURCE="ko"
      if [ "${DESACCORD}" = "1" ]; then
        refuser "DNS : les serveurs de noms de « ${DOMAIN} » ne servent pas la même zone." \
                "  Let's Encrypt en interrogera un au hasard : tant qu'ils divergent," \
                "  la validation échoue une fois sur deux. Attends la fin de la" \
                "  propagation — ne relance pas en boucle, 5 échecs par heure suffisent" \
                "  à bloquer le domaine pour l'heure."
      elif [ -z "${REPONSE_COMMUNE}" ]; then
        refuser "DNS : aucun serveur de noms de « ${DOMAIN} » ne publie d'adresse IPv4." \
                "  Crée un enregistrement A, puis attends la propagation."
      elif [ "${REPONSE_COMMUNE}" != "${REPONSE_COMMUNE%% *}" ]; then
        refuser "DNS : « ${DOMAIN} » publie plusieurs adresses : ${REPONSE_COMMUNE}" \
                "  Let's Encrypt en tirera une au hasard. N'en garde qu'une, celle de" \
                "  cette machine."
      elif [ -n "${ADRESSES_LOCALES}" ] && ! est_une_adresse_locale "${REPONSE_COMMUNE}"; then
        refuser "DNS : à la source, « ${DOMAIN} » pointe sur ${REPONSE_COMMUNE}," \
                "  or cette machine porte $(echo ${ADRESSES_LOCALES} | tr '\n' ' ' | sed 's/ *$//')." \
                "  Corrige l'enregistrement A chez ton hébergeur DNS."
      else
        VERDICT_SOURCE="ok"
        log "Tous les serveurs de noms répondent ${REPONSE_COMMUNE} : le DNS est prêt."
      fi
    else
      log "Serveurs de noms de ${DOMAIN} introuvables : repli sur le résolveur local."
    fi
  else
    log "dig indisponible : repli sur le résolveur local."
  fi

  # ---- niveau 2 : le résolveur local, en repli seulement ---------------------
  # Si la source a tranché, sa réponse fait foi : le résolveur de cette machine
  # peut très bien être en retard de plusieurs heures sans que cela empêche
  # Let's Encrypt de réussir.
  if [ "${VERDICT_SOURCE}" = "inconnu" ]; then
    IP_DOMAINE="$(adresses_de "${DOMAIN}")"
    NB_A="$(printf '%s\n' "${IP_DOMAINE}" | grep -c . || true)"
    if [ -z "${IP_DOMAINE}" ]; then
      refuser "DNS : « ${DOMAIN} » ne résout sur aucune adresse IPv4." \
              "  Crée un enregistrement A chez ton hébergeur DNS, puis attends la propagation."
    elif [ "${NB_A}" -gt 1 ]; then
      refuser "DNS : « ${DOMAIN} » porte ${NB_A} adresses : $(echo ${IP_DOMAINE} | tr '\n' ' ')" \
              "  Let's Encrypt en tirera une au hasard : le certificat échouera une fois" \
              "  sur deux. N'en garde qu'une, celle de cette machine."
    elif [ -n "${ADRESSES_LOCALES}" ] && ! est_une_adresse_locale "${IP_DOMAINE}"; then
      refuser "DNS : « ${DOMAIN} » pointe sur ${IP_DOMAINE}," \
              "  or cette machine porte $(echo ${ADRESSES_LOCALES} | tr '\n' ' ')."
    fi
  fi

  # « www » n'est demandé que s'il résout : certbot échoue en entier si l'un des
  # noms demandés ne pointe nulle part.
  NOMS_CERT="-d ${DOMAIN}"
  if [ -n "$(adresses_de "www.${DOMAIN}")" ]; then
    NOMS_CERT="${NOMS_CERT} -d www.${DOMAIN}"
  else
    log "« www.${DOMAIN} » ne résout pas : certificat demandé pour ${DOMAIN} seul."
  fi
  # --- fin du pré-vol --------------------------------------------------------

  log "Obtention du certificat Let's Encrypt pour ${DOMAIN}…"
  command -v certbot >/dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx
  COURRIEL_ARGS="--register-unsafely-without-email"
  if [ -n "${TLS_EMAIL}" ]; then
    COURRIEL_ARGS="--email ${TLS_EMAIL}"
  fi
  certbot --nginx --non-interactive --agree-tos --redirect \
    ${COURRIEL_ARGS} ${NOMS_CERT}
  systemctl reload nginx
  URL_FINALE="https://${DOMAIN}${BASE_WEB}"
elif [ -n "${DOMAIN}" ]; then
  URL_FINALE="http://${DOMAIN}${BASE_WEB}"
  log "Domaine servi en HTTP simple. Ajoute TLS=1 TLS_EMAIL=… pour passer en HTTPS."
fi

# ------------------------------------------------- mise en ligne automatique
# Modèle « pull » : c'est le VPS qui va chercher les nouveautés, personne ne
# pousse vers lui. Aucune clé SSH à déposer chez GitHub, aucun accès entrant à
# ouvrir, et rien à révoquer si le dépôt change de mains. Le prix : la mise en
# ligne arrive avec un délai d'au plus MINUTES_MAJ minutes au lieu d'être
# instantanée. Pour un site d'orientation, c'est sans conséquence.
#
# Le minuteur ne relance le déploiement QUE si le commit distant a bougé :
# sans ce garde-fou, certbot et le pré-vol DNS tourneraient toutes les cinq
# minutes pour rien.
MAJ_BIN="/usr/local/bin/${SLUG}-maj"
MAJ_UNITE="${SLUG}-maj"
if [ "${AUTO_MAJ}" = "1" ]; then
  log "Installation de la mise en ligne automatique (toutes les ${MINUTES_MAJ} min)…"

  cat > "${MAJ_BIN}" <<MAJ
#!/usr/bin/env bash
# Déploie ${SLUG} si — et seulement si — la branche ${BRANCH} a bougé.
# Écrit par deploy/vps-setup.sh (AUTO_MAJ=1). Ne pas modifier à la main :
# le prochain déploiement le réécrira.
set -euo pipefail
SRC="${SRC_DIR}"
[ -d "\${SRC}/.git" ] || { echo "Dépôt absent : \${SRC}"; exit 1; }
git -C "\${SRC}" fetch --quiet --depth 1 origin "${BRANCH}"
ICI="\$(git -C "\${SRC}" rev-parse HEAD)"
LA="\$(git -C "\${SRC}" rev-parse "origin/${BRANCH}")"
if [ "\${ICI}" = "\${LA}" ]; then
  exit 0                       # rien de neuf : on ne touche à rien
fi
echo "Nouveau commit \${LA} — déploiement."
# Les secrets ne sont PAS répétés ici : le script les reprend dans
# ${APP_DIR}/.env. Ce fichier est en 0600, ce script en clair.
exec env \\
  PROJET="${PROJET}" SLUG="${SLUG}" API_PORT="${API_PORT}" \\
  SERVER_NAME="${SERVER_NAME}" DOMAIN="${DOMAIN}" \\
  TLS="${TLS}" TLS_EMAIL="${TLS_EMAIL}" \\
  REDIRECT_ROOT="${REDIRECT_ROOT}" RACINE="${RACINE}" \\
  HSTS="${HSTS}" HSTS_AGE="${HSTS_AGE}" AUTO_MAJ=1 MINUTES_MAJ="${MINUTES_MAJ}" \\
  bash "\${SRC}/deploy/vps-setup.sh"
MAJ
  chmod 755 "${MAJ_BIN}"

  cat > "/etc/systemd/system/${MAJ_UNITE}.service" <<UNITE
[Unit]
Description=Mise en ligne de ${SLUG} quand la branche ${BRANCH} bouge
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${MAJ_BIN}
# Un déploiement complet (npm ci + build) prend quelques minutes.
TimeoutStartSec=1800
UNITE

  cat > "/etc/systemd/system/${MAJ_UNITE}.timer" <<UNITE
[Unit]
Description=Vérifie toutes les ${MINUTES_MAJ} min si ${SLUG} doit être redéployé

[Timer]
OnBootSec=3min
OnUnitActiveSec=${MINUTES_MAJ}min
# Le service est « oneshot » : systemd ne le relance pas tant qu'il tourne,
# donc deux déploiements ne peuvent pas se chevaucher.
Unit=${MAJ_UNITE}.service

[Install]
WantedBy=timers.target
UNITE

  systemctl daemon-reload
  systemctl enable --now "${MAJ_UNITE}.timer" >/dev/null 2>&1 || \
    systemctl enable --now "${MAJ_UNITE}.timer"
  log "Mise en ligne automatique active. Journal : journalctl -u ${MAJ_UNITE} -f"
elif [ -f "/etc/systemd/system/${MAJ_UNITE}.timer" ]; then
  # AUTO_MAJ repassé à 0 : on arrête, sans supprimer, pour que ce soit
  # réversible et visible.
  systemctl disable --now "${MAJ_UNITE}.timer" >/dev/null 2>&1 || true
  log "Mise en ligne automatique désactivée (AUTO_MAJ=0)."
fi

log "Terminé ! Le site est en ligne : ${URL_FINALE}"
echo "   Vérifs utiles :"
echo "     pm2 status"
echo "     curl localhost:${API_PORT}/api/sante"
echo "     curl ${URL_FINALE}api/sante"
if [ "${AUTO_MAJ}" = "1" ]; then
  echo "   Mise à jour : automatique, au plus ${MINUTES_MAJ} min après chaque commit sur ${BRANCH}."
  echo "     systemctl list-timers ${MAJ_UNITE}.timer"
  echo "     journalctl -u ${MAJ_UNITE} -n 50"
  echo "     systemctl start ${MAJ_UNITE}.service   # forcer tout de suite"
else
  echo "   Mettre à jour ce projet : relance ce script."
  echo "   Automatiser : rajoute AUTO_MAJ=1 à cette commande, une fois."
fi
echo "   Ajouter un 2e projet : SLUG=monsite API_PORT=8788 bash deploy/vps-setup.sh"
