# Déploiement sur le VPS

Deux méthodes. **La méthode A (directe) est la plus simple** et n'a besoin
d'aucune clé SSH ni secret GitHub — c'est celle à privilégier.

## Les machines

Deux serveurs, à ne pas confondre — les commandes ci-dessous ne s'appliquent
pas à la même :

| Adresse | Rôle | Ce qu'elle sert aujourd'hui |
| --- | --- | --- |
| `76.13.37.193` | **VPS KITETUDIANT** | nginx neuf, rien de ce dépôt encore |
| `76.13.37.163` | VPS historique | le simulateur et `/maisoncapendu/` |

Les deux sont chez Hostinger, en France. `SERVER_NAME` vaut `76.13.37.163` par
défaut dans le script : **pour KITETUDIANT, passer `SERVER_NAME=76.13.37.193`.**

---

## Méthode A — déploiement direct sur le VPS (recommandée, sans clé SSH)

Le script `deploy/vps-setup.sh` fait **tout** depuis le VPS : il récupère le
dépôt (public), installe Node/nginx/pm2 au besoin, build le front, le sert sous
un **sous-chemin** (`/studies`) et démarre l'API. Idempotent : relance-le pour
mettre à jour.

Connecté en **root** sur le VPS visé — `ssh root@76.13.37.163` pour le
simulateur, `ssh root@76.13.37.193` pour KITETUDIANT — une seule commande :

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

La commande réelle, à lancer en root sur `76.13.37.193` une fois le DNS en
ordre (voir plus bas), avec vos propres secrets à la place des points :

```bash
PROJET=kitetudiant SLUG=kitetudiant API_PORT=8788 \
  SERVER_NAME=76.13.37.193 \
  DOMAIN=kitetudiant.fr TLS=1 TLS_EMAIL=lotierimmobilier@gmail.com \
  ADMIN_TOKEN="…" ADMIN_MASTER_KEY="…" \
  bash deploy/vps-setup.sh
```

`ADMIN_TOKEN` (≥ 24 caractères) ouvre la console `/kitetudiant/admin.html` ;
`ADMIN_MASTER_KEY` (≥ 16) chiffre le coffre où les clés API sont rangées. Les
deux se tirent au hasard une fois pour toutes :

```bash
openssl rand -base64 32   # à faire deux fois, un secret par variable
```

Ils atterrissent dans `/opt/kitetudiant/.env`, en mode 600. **Changer
`ADMIN_MASTER_KEY` rend illisibles les clés déjà rangées dans le coffre** : il
faudra les reposer depuis la console.

Les clés API (`ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`) n'ont pas besoin de
figurer ici : une fois le HTTPS en place, elles se posent depuis la console
d'administration, chiffrées au repos et jamais réaffichées en clair.

KITETUDIANT a besoin de l'API pour l'aide au logement : c'est elle qui
interroge OpenFisca, jamais le navigateur de l'élève. Sans API, chaque vœu
s'affiche « reste-à-vivre non calculable » plutôt qu'avec une aide approchée.

### Nom de domaine et HTTPS

Le site sert aujourd'hui en **HTTP simple** sur l'IP. Pour un produit qui
recueillera des données d'élèves mineurs, le chiffrement du transport n'est pas
une option : il faut un domaine et un certificat.

**État du DNS de `kitetudiant.fr`** (relevé le 19/09/2026) : le domaine est
géré chez Hostinger (`atlas.dns-parking.com`, `hyperion.dns-parking.com`) et
porte **deux** enregistrements A — `2.57.91.91` et `76.13.37.163` — dont aucun
n'est le VPS KITETUDIANT. Il faut donc corriger le DNS avant tout.

1. Dans le hPanel Hostinger, section **DNS / Name servers**, pour
   `kitetudiant.fr` :
   - **supprimer** les enregistrements A `2.57.91.91` et `76.13.37.163` ;
   - **créer un seul** A, nommé `@`, vers `76.13.37.193` ;
   - **ne rien créer pour `www`** : la zone porte déjà un CNAME
     `www` → `kitetudiant.fr`, qui suivra l'apex tout seul.

   Deux pièges du panneau Hostinger :

   - `@` et `kitetudiant.fr` désignent **le même nom**. En saisir un de chaque
     crée un doublon. Deux A sur le même nom ne sont pas inoffensifs :
     Let's Encrypt en tire un au hasard pour sa validation HTTP-01, et le
     certificat échoue une fois sur deux — en consommant le quota d'essais
     (5 échecs par heure et par domaine).
   - Un nom qui porte un **CNAME ne peut porter aucun autre enregistrement**.
     Ajouter un A sur `www` est donc refusé, à juste titre, tant que le CNAME
     est là. Le CNAME suffit : Let's Encrypt le suit sans difficulté.

2. Attendre la propagation, puis vérifier — la réponse doit tenir sur une
   seule ligne :

```bash
dig +short kitetudiant.fr        # -> 76.13.37.193, et rien d'autre
dig +short www.kitetudiant.fr    # -> kitetudiant.fr. puis 76.13.37.193
```

3. Sur le VPS, lancer le script avec le domaine :

```bash
DOMAIN=kitetudiant.fr TLS=1 TLS_EMAIL=vous@exemple.fr bash deploy/vps-setup.sh
```

Le script refuse d'appeler certbot si le DNS n'est pas en ordre : nom qui ne
résout pas, plusieurs A, ou A pointant sur une autre machine. Il le dit et
s'arrête, plutôt que de brûler un essai du quota. `TLS_FORCER=1` passe outre
si un CDN ou un reverse-proxy se trouve devant le serveur. Si `www` ne résout
pas, le certificat est demandé pour le nom nu seulement, au lieu d'échouer en
entier.

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

### Cohabiter avec un site déjà installé sur la machine

`76.13.37.193` héberge déjà **FamilyIA**. Le script est fait pour cohabiter, et
il ne touche à rien de ce qu'il n'a pas posé lui-même :

- il ne réclame `default_server` que si **personne ne le tient**. Si un autre
  site l'occupe, il s'en passe : son propre bloc est atteint par `server_name`,
  ce qui suffit pour un domaine ;
- il ne supprime `sites-enabled/default` que s'il s'agit bien de la page
  « Welcome to nginx » d'origine (racine `/var/www/html`, ni proxy ni
  certificat). Un vrai site rangé sous ce nom est laissé en place ;
- il **teste la configuration avant de recharger**. Si nginx la refuse, il
  retire ce qu'il vient d'écrire et remet l'état précédent, plutôt que de
  laisser une config invalide qui emporterait les autres sites au prochain
  redémarrage.

Les deux sites vivent alors dans des blocs `server` distincts, séparés par leur
`server_name` : FamilyIA sur son domaine, KITETUDIANT sur `kitetudiant.fr`.
Rien à déplacer.

Avant de lancer quoi que ce soit sur une machine occupée, un état des lieux :

```bash
nginx -T | grep -E 'server_name|listen|root ' | head -40
ls -l /etc/nginx/sites-enabled/
certbot certificates          # quels domaines ont déjà un certificat
```

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
