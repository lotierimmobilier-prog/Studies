# Déploiement du portail voyageurs sur le VPS

La méthode recommandée est **directe** : aucun secret GitHub ni clé SSH.

---

## Mise en ligne (méthode directe)

Le script `deploy/vps-setup.sh` fait tout depuis le VPS : il récupère le dépôt,
installe Node/nginx/pm2 au besoin, build le front, le sert sous un **sous-chemin**
(`/maisoncapendu` par défaut) et démarre l'API. Idempotent : relance-le pour mettre à
jour.

Connecté en **root** sur le VPS (`ssh root@76.13.37.163`), une seule commande :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/airbnb-guest-portal-8o2bq8/deploy/vps-setup.sh | bash
```

Le site est alors en ligne sur **http://76.13.37.163/maisoncapendu/**.

Pour fixer votre propre secret de session (recommandé en production) :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/airbnb-guest-portal-8o2bq8/deploy/vps-setup.sh \
  | SESSION_SECRET="une-longue-phrase-secrete" bash
```

> Sans `SESSION_SECRET`, le script en génère un automatiquement et le conserve
> (`/opt/maisoncapendu/.session_secret`), pour ne pas déconnecter les voyageurs à
> chaque mise à jour.

## ⚙️ Configurer vos séjours et les infos de la maison

Le portail lit **login/mot de passe**, dates de séjour et informations de la
maison (codes, Wi-Fi, adresse…) dans un fichier JSON. Deux emplacements, par
ordre de priorité :

1. `/opt/maisoncapendu/.data/sejours.json` → **votre configuration réelle** (non
   versionnée, jamais écrasée par les mises à jour) ;
2. `server/data/sejours.json` → l'exemple fourni (versionné).

Pour la mise en service, copiez l'exemple puis remplissez-le :

```bash
mkdir -p /opt/maisoncapendu/.data
cp /opt/maisoncapendu/server/data/sejours.json /opt/maisoncapendu/.data/sejours.json
nano /opt/maisoncapendu/.data/sejours.json   # vos vrais codes, Wi-Fi, séjours…
pm2 restart maisoncapendu-api
```

Chaque séjour se déclare ainsi :

```json
{
  "login": "dupont",
  "motDePasse": "soleil2026",
  "nom": "Famille Dupont",
  "arrivee": "2026-08-03T16:00",
  "depart": "2026-08-10T10:00",
  "voyageurs": 5,
  "messageHote": "Bienvenue !"
}
```

## 🎬 Ajouter vos tutoriels vidéo et bonnes adresses

- **Tutoriels vidéo** : éditez `src/data/tutoriels.ts`. Mettez vos vidéos en
  ligne sur YouTube (réglage « Non répertoriée » conseillé) et collez leur ID.
- **Tourisme / contacts** : éditez `src/data/tourisme.ts`.

Après modification, relancez le script de déploiement pour rebuild le front.

## Héberger plusieurs projets sur le même VPS

Chaque projet est servi sous **son propre sous-chemin** avec un **port d'API
unique**. Pour ce portail, le sous-chemin est `/maisoncapendu` et le port `8788`.
Pour en ajouter un autre :

```bash
SLUG=monsite API_PORT=8789 bash deploy/vps-setup.sh
# -> servi sur http://76.13.37.163/monsite/
```

Variables disponibles : `SLUG` (sous-chemin), `API_PORT` (port local unique),
`SESSION_SECRET`, `SERVER_NAME` (IP ou domaine), `REDIRECT_ROOT` (`1` = « / »
redirige vers `/maisoncapendu/`).

## Vérifier / dépanner

```bash
pm2 status                          # « maisoncapendu-api » doit être online
curl localhost:8788/api/sante       # doit répondre {"ok":true}
curl http://76.13.37.163/maisoncapendu/api/sante
sudo tail -f /var/log/nginx/error.log
```
