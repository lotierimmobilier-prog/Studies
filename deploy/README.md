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
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/main/deploy/vps-setup.sh | bash
```

Pour activer l'IA (conseils + analyse de bulletin) et les **avis Google** (note
⭐ des écoles), passe les clés API :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/main/deploy/vps-setup.sh \
  | ANTHROPIC_API_KEY="sk-ant-..." GOOGLE_MAPS_API_KEY="AIza..." bash
```

### Deux applications dans le même dépôt

Le dépôt sert deux fronts : le **simulateur** historique et **KITETUDIANT**. La
variable `PROJET` choisit lequel est déployé sous un `SLUG` donné. Ils peuvent
cohabiter sur le même VPS, chacun avec son port d'API.

```bash
# KITETUDIANT sur son domaine, en HTTPS
PROJET=kitetudiant SLUG=kitetudiant API_PORT=8788 \
  DOMAIN=kitetudiant.fr TLS=1 TLS_EMAIL=vous@exemple.fr \
  bash deploy/vps-setup.sh
```

KITETUDIANT a besoin de l'API pour l'aide au logement : c'est elle qui
interroge OpenFisca, jamais le navigateur de l'élève. Sans API, chaque vœu
s'affiche « reste-à-vivre non calculable » plutôt qu'avec une aide approchée.

### Nom de domaine et HTTPS

Le site sert aujourd'hui en **HTTP simple** sur l'IP. Pour un produit qui
recueillera des données d'élèves mineurs, le chiffrement du transport n'est pas
une option : il faut un domaine et un certificat.

1. Chez le registrar du domaine, créer deux enregistrements **A** pointant sur
   l'IP du VPS : `kitetudiant.fr` et `www.kitetudiant.fr`. Vérifier la
   propagation avec `dig +short kitetudiant.fr`.
2. Sur le VPS, relancer le script avec le domaine :

```bash
DOMAIN=kitetudiant.fr TLS=1 TLS_EMAIL=vous@exemple.fr bash deploy/vps-setup.sh
```

Le script ajoute le domaine au `server_name` de nginx, installe certbot,
obtient le certificat Let's Encrypt pour `kitetudiant.fr` et `www`, et met en
place la redirection HTTP vers HTTPS. Le renouvellement est automatique.

Sans `TLS=1`, le domaine est servi en HTTP : utile pour vérifier le DNS avant
de demander un certificat, à ne pas laisser en l'état.

> **Clé Google** : dans [Google Cloud Console](https://console.cloud.google.com/),
> active l'API **Places API**, crée une clé API et restreins-la à cette API. Un
> quota gratuit mensuel est inclus. Sans clé, l'app fonctionne : les notes ⭐ ne
> s'affichent simplement pas.

> **Avis étudiants (modération)** : les étudiants peuvent laisser une note ⭐ et
> un commentaire (année d'études en option). Chaque avis est **modéré** avant
> publication : règles automatiques (anti-insultes, anti-spam/coordonnées) +
> modération fine par l'IA si `ANTHROPIC_API_KEY` est présente. Les avis stockés
> sont dans `/opt/studies/.data/temoignages.json` sur le VPS. Pour l'endpoint de
> modération manuelle (lister/valider/masquer), définis un jeton
> `MODERATION_TOKEN` :
>
> ```bash
> # lister les avis en attente
> curl -H "x-moderation-token: $MODERATION_TOKEN" \
>   "http://76.13.37.163/studies/api/temoignages/moderation?statut=en_attente"
> # approuver (ou 'rejete') un avis
> curl -X POST -H "x-moderation-token: $MODERATION_TOKEN" \
>   -H 'Content-Type: application/json' \
>   -d '{"id":"<id>","statut":"approuve"}' \
>   http://76.13.37.163/studies/api/temoignages/moderation
> ```

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

---

## GitHub Pages : pourquoi ça ne marche pas, et pourquoi je ne le réparerais pas

Les quatre exécutions du workflow `deploy-pages` ont échoué, toujours à la même
étape et avec le même message :

```
Error: Failed to create deployment (status: 404).
Ensure GitHub Pages has been enabled:
https://github.com/lotierimmobilier-prog/Studies/settings/pages
```

Le build passe ; c'est la publication qui échoue, parce que Pages n'est pas
activé sur le dépôt. Un seul réglage manque, et il n'est accessible qu'au
propriétaire : **Settings → Pages → Source = GitHub Actions**. Aucun changement
de code ne peut le remplacer.

Cela dit, Pages n'apporte pas grand-chose ici : il sert du **statique**, donc
sans l'API Node (prix réels, conseil, avis), et sous une URL en
`github.io/Studies/`. Le VPS sert déjà le front **et** l'API, sous un vrai
domaine. Mon conseil : laisser Pages désactivé, et retirer le workflow le jour
où il est clair que personne ne s'en servira.
