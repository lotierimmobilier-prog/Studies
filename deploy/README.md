# Déploiement automatique sur le VPS

Le workflow `.github/workflows/deploy-vps.yml` synchronise le site **à chaque
push** vers le VPS : il envoie le front (statique) et le serveur Node (prix +
IA), installe les dépendances et redémarre l'API. Voici la configuration à faire
**une seule fois**.

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
