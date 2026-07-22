# Déploiement du portail voyageurs sur le VPS

La méthode recommandée est **directe** : aucun secret GitHub ni clé SSH.

---

## Mise en ligne (méthode directe)

Le script `deploy/vps-setup.sh` fait tout depuis le VPS : il récupère le dépôt,
installe Node/nginx/pm2 au besoin, build le front, le sert sous un **sous-chemin**
(`/maisoncapendu` par défaut) et démarre l'API. Idempotent : relance-le pour mettre à
jour.

Connecté en **root** sur le VPS (`ssh root@76.13.37.163`), une seule commande —
en choisissant votre **mot de passe d'administration** :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/airbnb-guest-portal-8o2bq8/deploy/vps-setup.sh \
  | ADMIN_PASSWORD="votre-mot-de-passe-admin" bash
```

- Le site voyageur : **http://76.13.37.163/maisoncapendu/**
- L'administration : **http://76.13.37.163/maisoncapendu/#admin**

> Sans `ADMIN_PASSWORD`, le mot de passe admin par défaut est **`admin`**
> (à changer !). `SESSION_SECRET` (signature des jetons) est généré et conservé
> automatiquement s'il n'est pas fourni.

## ⚙️ Tout se configure depuis l'administration

Plus besoin d'éditer de fichier : ouvrez **`/maisoncapendu/#admin`**, connectez-vous
avec votre mot de passe admin, et saisissez directement :

- **Séjours** — un *code* d'accès + un *prénom* d'accueil, les dates et un message
  de bienvenue, pour chaque réservation ;
- **La maison** — adresse, Wi-Fi, code boîte à clés, instructions d'arrivée/départ,
  règlement, coordonnées de l'hôte, numéros utiles ;
- **Tutoriels vidéo** — titre, catégorie, vidéo (YouTube/Vimeo/fichier), étapes ;
- **Tourisme** — bonnes adresses avec contacts et vos conseils.

Tout est enregistré dans `/opt/maisoncapendu/.data/config.json`, **jamais écrasé**
par les mises à jour. L'exemple versionné de départ est `server/data/config.json`.
Les photos uploadées (façade…) sont conservées dans `/opt/maisoncapendu/.data/uploads/`.

## Héberger plusieurs projets sur le même VPS

Chaque projet est servi sous **son propre sous-chemin** avec un **port d'API
unique**. Pour ce portail, le sous-chemin est `/maisoncapendu` et le port `8788`.
Pour en ajouter un autre :

```bash
SLUG=monsite API_PORT=8789 bash deploy/vps-setup.sh
# -> servi sur http://76.13.37.163/monsite/
```

Variables disponibles : `SLUG` (sous-chemin), `API_PORT` (port local unique),
`ADMIN_PASSWORD`, `SESSION_SECRET`, `SERVER_NAME` (IP ou domaine),
`REDIRECT_ROOT` (`1` = « / » redirige vers `/maisoncapendu/`).

## Vérifier / dépanner

```bash
pm2 status                          # « maisoncapendu-api » doit être online
curl localhost:8788/api/sante       # doit répondre {"ok":true}
curl http://76.13.37.163/maisoncapendu/api/sante
sudo tail -f /var/log/nginx/error.log
```
