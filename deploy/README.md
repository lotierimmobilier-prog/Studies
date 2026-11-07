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
  ADMIN_TOKEN="…" ADMIN_MASTER_KEY="…" COMPTES_MASTER_KEY="…" \
  ADMIN_EMAILS="vous@exemple.fr" \
  AUTO_MAJ=1 \
  bash deploy/vps-setup.sh
```

### `AUTO_MAJ=1` — la mise en ligne devient automatique

`AUTO_MAJ` **n'a pas de valeur par défaut**, et c'est voulu. Un paramètre qu'on
ne passe pas ne décide rien : le script reconduit l'état déjà en place, lu sur
systemd. Relancer la commande à la main pour pousser un correctif ne coupe donc
pas la mise en ligne automatique.

Pour l'arrêter, il faut le dire : `AUTO_MAJ=0`. Le minuteur est alors désactivé
sans être supprimé, ce qui reste réversible et visible.

> Ce n'était pas le cas jusqu'au 21/09/2026 : `AUTO_MAJ` valait zéro par défaut
> et coupait le minuteur au passage. Une mise en ligne manuelle a ainsi laissé
> quatre fusions hors ligne pendant neuf heures, sur un site qui répondait
> normalement. Des tests exécutent désormais la décision, faux `systemctl` à
> l'appui, au lieu de relire le script.

Avec ce drapeau, le script installe un minuteur systemd sur le VPS. Toutes les
cinq minutes, le VPS regarde si `main` a bougé ; si oui, il se redéploie tout
seul. **Vous ne relancez plus jamais la commande à la main.**

C'est un modèle « pull » : c'est la machine qui va chercher, personne ne pousse
vers elle.

|  | Ce modèle (`AUTO_MAJ=1`) | GitHub Actions (méthode B) |
| --- | --- | --- |
| Clé SSH à déposer chez GitHub | **aucune** | oui, avec accès root au VPS |
| Accès entrant à ouvrir | **aucun** | SSH depuis les runners GitHub |
| À révoquer si le dépôt change de mains | **rien** | la clé, vite |
| Délai de mise en ligne | jusqu'à 5 min | quelques secondes |

Pour un site d'orientation, cinq minutes ne se voient pas. C'est donc la
méthode à préférer.

Réglages et commandes utiles :

```bash
MINUTES_MAJ=15     # intervalle de vérification (5 par défaut)
AUTO_MAJ=0         # désactive le minuteur sans rien supprimer

systemctl list-timers kitetudiant-maj.timer   # prochain passage
journalctl -u kitetudiant-maj -n 50           # ce qu'il a fait
systemctl start kitetudiant-maj.service       # déployer tout de suite
```

Le minuteur ne relance un déploiement **que si le commit distant a changé** :
sans ce garde-fou, certbot et le pré-vol DNS tourneraient toutes les cinq
minutes pour rien, et le quota Let's Encrypt est de cinq demandes par heure.

### Les secrets ne se perdent plus entre deux relances

Le script réécrit `/opt/<slug>/.env` de zéro à chaque passage. Avant de le
faire, il **relit celui qui est en place** et reprend toute variable que vous
ne lui repassez pas. Sans cela, une relance sans les clés effacerait
`COMPTES_MASTER_KEY` — les comptes déjà créés deviendraient illisibles et le
détail chiffré s'ouvrirait à tout le monde —, `ADMIN_TOKEN` et
`ANTHROPIC_API_KEY`.

Une valeur passée à l'appel **l'emporte toujours** sur celle du fichier : c'est
ainsi qu'on remplace une clé.

Le fichier est lu ligne à ligne, jamais exécuté, et seuls des noms de variables
plausibles sont repris — une ligne trafiquée ne devient pas une commande.


`ADMIN_TOKEN` (≥ 24 caractères) ouvre la console `/kitetudiant/admin.html` ;
`ADMIN_MASTER_KEY` (≥ 16) chiffre le coffre où les clés API sont rangées. Les
deux se tirent au hasard une fois pour toutes :

```bash
openssl rand -base64 32   # à faire deux fois, un secret par variable
```

`ADMIN_EMAILS` (facultatif) liste les adresses autorisées à ouvrir la console
avec **leur propre compte**, sans ressaisir le jeton — pratique quand on
administre depuis le site où l'on est déjà connecté. C'est plus commode et
**plus faible** : la console vaut alors un mot de passe de dix caractères là où
le jeton en compte quarante. `ADMIN_TOKEN` continue de fonctionner en parallèle,
ce qui reste la voie de secours si un compte administrateur est compromis.
Laissée vide — le défaut — seul le jeton ouvre la porte.

Une adresse listée ici voit en plus, dans son espace personnel, une section
« Administration » avec un lien vers la console. Ce lien ne donne aucun droit :
il évite seulement de retenir l'adresse `…/admin.html`. Un visiteur ordinaire
ne le voit pas, mais la console reste gardée côté serveur pour tout le monde.

## Charger les données de référence

`vps-setup.sh` déploie le code ; il ne charge aucune donnée. Tant que
`reference.formation` est vide, **aucun élève ne peut enregistrer un vœu** :
le serveur refuse le vœu avec un message qui le dit, mais la fonctionnalité est
hors service.

Une seule commande, en root sur le VPS :

```bash
bash /opt/kitetudiant-src/deploy/charger-donnees.sh
```

Elle enchaîne les trois étapes — téléchargement des jeux publics (~185 Mo),
préparation des CSV, chargement en base — puis **compte les lignes chargées**.
Elle vérifie ses prérequis (python3, curl, psql, 1,5 Go libres, migrations
appliquées, `DATABASE_URL` lisible dans `/opt/kitetudiant/.env`) **avant** de
télécharger quoi que ce soit : découvrir qu'il manque `psql` après dix minutes
d'attente est une perte de temps évitable.

Elle est idempotente. Le chargement insère en `ON CONFLICT DO NOTHING` : la
relancer ne modifie aucun millésime déjà présent. Pour rejouer la préparation
sans retélécharger :

```bash
SANS_TELECHARGEMENT=1 bash /opt/kitetudiant-src/deploy/charger-donnees.sh
```

À faire après `postgres-setup.sh`, et à refaire à chaque nouvelle campagne
Parcoursup, quand un millésime est publié.

## La base de données

`vps-setup.sh` n'installe pas PostgreSQL, et n'applique aucune migration.
C'est délibéré : le script tourne toutes les cinq minutes derrière le minuteur
de mise en ligne, et une migration lancée par un minuteur sur une base de
production est une migration que personne n'a décidé de lancer.

Sans `DATABASE_URL`, l'API fonctionne — comptes dans le fichier chiffré,
formations chez le ministère. Seuls **les vœux** exigent la base : sans elle,
« Enregistrer dans mes vœux » répond « pas encore activé sur ce serveur ».

Pour la poser, une fois, en root :

```bash
bash /opt/kitetudiant-src/deploy/postgres-setup.sh
```

Le script installe PostgreSQL et PostGIS, crée le rôle et la base, tire un mot
de passe, applique les cinq migrations, écrit `DATABASE_URL` dans le `.env` et
relance l'API. Il est **idempotent** : relancé, il ne refait que ce qui manque,
et un mot de passe déjà posé n'est jamais régénéré — une rotation silencieuse
casserait l'API sans rien dire.

La base est **locale** et n'écoute que la machine : aucun port de base de
données n'est exposé au réseau. Le script ne se contente pas de le vérifier —
il **s'arrête** si `listen_addresses` a été desserré, avant d'avoir rien créé.
Un avertissement défile et « Terminé. » s'affiche quelques lignes plus bas ;
une base de comptes de mineurs ne doit pas se créer sur un serveur qui écoute
l'Internet parce que personne n'a lu la ligne du milieu.

Il s'arrête de même si **PostGIS** n'a pas pu s'installer, plutôt que de migrer
en mode dégradé. Ce mode remplace les colonnes géographiques par du texte, et
`appliquer.sh` ne rejoue jamais une migration déjà enregistrée — il compare les
noms, pas ce mode. Une panne passagère d'`apt-get` figerait donc le schéma en
texte pour toujours, carte et recherches par distance mortes sans message.

Les deux blocages s'assument explicitement, s'il le faut :
`ECOUTE_LARGE_ASSUMEE=1` et `SANS_POSTGIS=1`.

Le disque n'est pas chiffré. Ce sont les données **identifiantes** qui le
sont, par l'application, avant d'arriver en base — c'est ce qu'exige la règle 3
de `CLAUDE.md` pour des comptes de mineurs. Le reste est de la donnée
publique : formations, établissements, communes, loyers.

Charger ensuite les données de référence (facultatif, et distinct) :

```bash
PGURL="$(sed -n 's/^DATABASE_URL=//p' /opt/kitetudiant/.env)" \
  bash /opt/kitetudiant-src/kitetudiant/db/migrations/charger.sh
```

`COMPTES_MASTER_KEY` (≥ 16) chiffre les comptes élèves : c'est elle qui active
l'inscription. **Sans elle, personne ne peut s'inscrire et le détail du résultat
reste ouvert à tous** — la console d'administration l'affiche en clair, section
« Comptes élèves ».

Ils atterrissent dans `/opt/kitetudiant/.env`, en mode 600. **Changer
`ADMIN_MASTER_KEY` rend illisibles les clés déjà rangées dans le coffre**, et
**changer `COMPTES_MASTER_KEY` rend tous les comptes inaccessibles** : les
adresses chiffrées ne se déchiffrent plus et les élèves ne peuvent plus se
connecter. Ces deux secrets se tirent une fois et ne se changent plus.

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

Le script refuse d'appeler certbot si le DNS n'est pas en ordre, plutôt que de
brûler un essai du quota. Il contrôle à deux niveaux, dans cet ordre de
confiance :

1. **À la source.** Il interroge un par un les serveurs de noms du domaine —
   c'est ce que fait Let's Encrypt, qui résout lui-même depuis la racine. Il
   exige qu'ils répondent **tous la même chose**, une seule adresse, celle de
   la machine. Ce contrôle a le dernier mot.
2. **Le résolveur local**, en repli seulement, quand `dig` manque ou que les
   serveurs de noms sont introuvables. Sa vue peut être périmée de plusieurs
   heures et ne dit rien de ce que verra Let's Encrypt.

Pourquoi cet ordre, appris à nos dépens le 19/09/2026 : `kitetudiant.fr` était
servi par deux serveurs de noms d'un même réseau anycast, dont **un seul avait
la zone corrigée**. Le résolveur local, lui, était encore sur l'ancienne
adresse. Interroger la source à un seul endroit donnait une réponse rassurante
et fausse ; Let's Encrypt est tombé sur l'autre nœud, et l'essai a été perdu.

`TLS_FORCER=1` passe outre n'importe lequel de ces refus : CDN ou reverse-proxy
en amont, NAT, ou résolveur local en retard alors que la source est bonne.

Si `www` ne résout pas, le certificat est demandé pour le nom nu seulement, au
lieu d'échouer en entier.

Pour regarder soi-même avant de lancer :

```bash
for ns in $(dig +short NS kitetudiant.fr); do
  printf '%-28s ' "$ns"; dig +short kitetudiant.fr @"$ns"
done
```

Tous doivent répondre la même unique adresse. **Cinq échecs par heure et par
domaine suffisent à bloquer le domaine pour l'heure** : ne relance pas en
boucle, attends que les serveurs de noms soient d'accord.

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
