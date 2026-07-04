# Déploiement sur le VPS

Deux méthodes. **La méthode A (directe) est la plus simple** et n'a besoin
d'aucune clé SSH ni secret GitHub — c'est celle à privilégier.

---

## Méthode A — déploiement direct sur le VPS (recommandée, sans clé SSH)

Le script `deploy/vps-setup.sh` fait **tout** depuis le VPS : il récupère le
dépôt (public), installe Node/nginx/pm2 au besoin, build le front, le sert sous
un **sous-chemin** (`/studies`) et démarre l'API. Idempotent : relance-le pour
mettre à jour.

Connecté en **root** sur le VPS (`ssh root@76.13.37.163`), une seule commande :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/parcoursup-admission-simulator-2jy76p/deploy/vps-setup.sh | bash
```

Pour activer l'IA (conseils + analyse de bulletin), passe ta clé API :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/parcoursup-admission-simulator-2jy76p/deploy/vps-setup.sh \
  | ANTHROPIC_API_KEY="sk-ant-..." bash
```

Le site est alors en ligne sur **http://76.13.37.163/studies/**.

### Héberger plusieurs projets sur le même VPS

Chaque projet est servi sous **son propre sous-chemin** et dépose sa config
nginx dans `/etc/nginx/projets.d/` (inclus par le serveur principal), donc les
projets ne se marchent pas dessus. Pour ce projet, le sous-chemin est `/studies`.
Pour en ajouter un autre plus tard, choisis un `SLUG` et un **port d'API unique** :

```bash
SLUG=monsite API_PORT=8788 bash deploy/vps-setup.sh
# -> servi sur http://76.13.37.163/monsite/
```

Variables disponibles : `SLUG` (sous-chemin), `API_PORT` (port local unique par
projet), `ANTHROPIC_API_KEY`, `SERVER_NAME` (IP ou domaine), `REDIRECT_ROOT`
(`1` = « / » redirige vers `/studies/`).

### Vérifier / dépanner

```bash
pm2 status                          # « studies-api » doit être online
curl localhost:8787/api/sante       # doit répondre {"ok":true}
curl http://76.13.37.163/studies/api/sante
sudo tail -f /var/log/nginx/error.log
```

---

## Méthode B — déploiement automatique via GitHub Actions (clé SSH requise)

Le workflow `.github/workflows/deploy-vps.yml` synchronise le site **à chaque
push** vers le VPS : il envoie le front (statique) et le serveur Node (prix +
IA), installe les dépendances et redémarre l'API. Voici la configuration à faire
**une seule fois**.

> Cette méthode sert le site **à la racine** (`/`). Elle dépend d'une clé SSH
> bien formée dans le secret `VPS_SSH_KEY` (cause fréquente d'échec :
> `error in libcrypto` = clé incomplète ou sans retour à la ligne final).
> Si tu bloques dessus, utilise plutôt la **méthode A**.

## 1. Préparer le VPS (une fois)

Connecté en SSH sur le VPS (`ssh utilisateur@76.13.37.163`) :

```bash
# Node 22 + nginx + pm2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2

# Dossiers cibles
sudo mkdir -p /var/www/parcoursup /opt/parcoursup
sudo chown -R "$USER" /var/www/parcoursup /opt/parcoursup

# nginx : copier l'exemple fourni puis l'activer
sudo cp /chemin/vers/deploy/nginx.conf.example /etc/nginx/sites-available/parcoursup
sudo ln -sf /etc/nginx/sites-available/parcoursup /etc/nginx/sites-enabled/parcoursup
sudo nginx -t && sudo systemctl reload nginx

# Démarrer pm2 au boot
pm2 startup   # exécuter la commande affichée
```

## 2. Créer une clé SSH de déploiement (une fois)

Sur ta machine (ou le VPS), génère une paire de clés **sans passphrase** dédiée
au déploiement, puis autorise la clé publique sur le VPS :

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
ssh-copy-id -i deploy_key.pub utilisateur@76.13.37.163
# (ou ajoute deploy_key.pub à ~/.ssh/authorized_keys sur le VPS)
```

## 3. Renseigner les secrets GitHub (une fois)

Dépôt → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Valeur |
| --- | --- |
| `VPS_HOST` | `76.13.37.163` |
| `VPS_USER` | ton utilisateur SSH sur le VPS |
| `VPS_SSH_KEY` | le contenu de la **clé privée** `deploy_key` (tout le fichier) |
| `ANTHROPIC_API_KEY` | *(facultatif)* ta clé API pour activer le conseiller IA et l'analyse de bulletin en ligne |

## 4. C'est tout : ça se synchronise tout seul

À chaque `git push` sur la branche, GitHub Actions :

1. build le front,
2. envoie `dist/` dans `/var/www/parcoursup` (servi par nginx),
3. envoie `server/` dans `/opt/parcoursup`, installe les dépendances,
4. (re)démarre l'API `parcoursup-api` via pm2.

Le site est alors accessible sur **http://76.13.37.163**. Tu peux aussi lancer
le déploiement à la main depuis l'onglet **Actions → Déployer sur le VPS → Run
workflow**.

## Vérifier / dépanner sur le VPS

```bash
pm2 status                 # l'API doit être "online"
pm2 logs parcoursup-api    # logs de l'API
curl localhost:8787/api/sante   # doit répondre {"ok":true}
sudo tail -f /var/log/nginx/error.log
```

> Sans clé `ANTHROPIC_API_KEY`, le site fonctionne : les prix passent en
> estimation et le conseil en mode règles. Avec la clé, l'IA (conseils +
> analyse de bulletin) est active en ligne.
