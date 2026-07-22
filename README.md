# Espace voyageur — portail Airbnb 🏖️

Un site **simple, moderne et épuré** pour accueillir vos voyageurs Airbnb.
Chaque réservation reçoit un **code d'accès** qui ouvre son espace personnel :

- 🎬 **Tutoriels vidéo** — une capsule par équipement (Wi-Fi, climatisation,
  lave-vaisselle, TV, piscine…) avec explications pas à pas ;
- 🔑 **Accès à la maison** — adresse, code de la boîte à clés, Wi-Fi,
  stationnement, instructions d'arrivée et de départ, règlement ;
- 🧭 **Tourisme & bonnes adresses** — restaurants, activités, services, avec
  téléphone, itinéraire et vos conseils personnels ;
- 📞 **Contact & urgences** — coordonnées de l'hôte (appel, WhatsApp, e-mail) et
  numéros utiles ;
- 🗓️ **Rappel du séjour** — dates d'arrivée et de départ + compte à rebours, et
  un petit mot de bienvenue personnalisé.

**Une administration intégrée** (`/#admin`) permet à l'hôte de tout saisir depuis
le navigateur, sans toucher à aucun fichier.

Ambiance vacances (palette sable / corail / océan), responsive (barre de
navigation en bas sur mobile).

## Démarrer en local

```bash
npm install
ADMIN_PASSWORD=secret npm run server   # API Node sur http://localhost:8788
npm run dev                            # front (Vite) sur http://localhost:5173
npm run build                          # build de production du front
```

- Portail voyageur : <http://localhost:5173> — code de démo : **`SOLEIL`**
- Administration : <http://localhost:5173/#admin> — mot de passe : celui d'`ADMIN_PASSWORD`

## L'administration

Rendez-vous sur **`/#admin`**, connectez-vous avec le mot de passe admin
(variable `ADMIN_PASSWORD`), puis gérez tout en quelques clics :

| Onglet | Ce que vous saisissez |
| --- | --- |
| **Séjours** | Un *code* d'accès + un *prénom* d'accueil, les dates d'arrivée/départ, le nombre de voyageurs, un message de bienvenue. **Synchronisation du planning** : collez le lien iCal (Airbnb, Booking…) pour créer automatiquement les séjours aux bonnes dates |
| **La maison** | **Photo de la façade** (bannière d'accueil, uploadée depuis l'appareil), adresse, Wi-Fi, code boîte à clés, instructions d'arrivée/départ, règlement, hôte, numéros utiles |
| **Galerie** | Plusieurs photos de la maison (upload multiple, légendes, réordonnancement) — visibles dans un onglet « Photos » avec agrandissement au clic |
| **Tutoriels** | Titre, catégorie, icône, vidéo (YouTube / Vimeo / fichier `.mp4`), étapes |
| **Tourisme** | Bonnes adresses avec contacts et vos conseils |

Cliquez sur **Enregistrer** : tout est sauvegardé côté serveur (dans
`.data/config.json`) et immédiatement visible par les voyageurs.

> Astuce vidéo : mettez vos vidéos sur YouTube en **« Non répertoriée »** et
> collez leur identifiant (ce qui suit `v=` ou `youtu.be/`).

### Synchroniser le planning (Airbnb, Booking…)

Dans l'onglet **Séjours**, collez le **lien iCal** d'export de votre calendrier
(Airbnb : *Calendrier → Disponibilités → Synchroniser les calendriers →
Exporter le calendrier*) puis cliquez sur **Synchroniser maintenant**. Le portail
crée un séjour aux bonnes dates pour chaque réservation, avec un **code généré
automatiquement** ; il ne reste qu'à ajouter le prénom du voyageur.

> Pour des raisons de confidentialité, l'iCal des plateformes fournit les
> **dates** mais **pas le nom du voyageur** — d'où la saisie du prénom à la main.
> La synchronisation est **sans doublon** (réservations suivies par leur
> identifiant) et met à jour les dates si une réservation est modifiée. Le
> serveur doit pouvoir joindre la plateforme en HTTPS sortant.

## Fonctionnement de la connexion

- **Voyageur** : saisit son **code** (fourni par l'hôte). Le serveur renvoie un
  **jeton signé** (HMAC) + tout le contenu de son séjour. La session est
  restaurée automatiquement au rechargement.
- **Admin** : se connecte avec `ADMIN_PASSWORD`, obtient un jeton admin qui
  autorise la lecture et l'écriture de la configuration.
- Les informations sensibles (codes, Wi-Fi, adresse) ne sont renvoyées
  qu'**après connexion**.

En production, définissez `SESSION_SECRET` (signature des jetons) et
`ADMIN_PASSWORD` (accès admin).

## Architecture

```
index.html                 Page hôte (polices, favicon, méta)
src/
  main.tsx                 Point d'entrée React
  App.tsx                  Aiguillage portail voyageur ↔ administration (#admin)
  api.ts                   Appels API (voyageur + admin) et jetons
  types.ts                 Types partagés (Maison, Sejour, Tutoriel, ...)
  dates.ts                 Formatage FR + compte à rebours du séjour
  styles.css               Thème « vacances » + styles de l'admin
  components/              Portail voyageur (Connexion par code, Séjour, Accès,
                           Tutoriels, Tourisme, Contact, VideoCapsule)
  admin/                   Administration (AdminApp, AdminLogin, AdminPanel,
                           Editeur{Sejours,Maison,Tutoriels,Tourisme}, champs)

server/                    API Node minimale (sans dépendance)
  index.ts                 Serveur HTTP (voyageur + admin)
  auth.ts                  Jetons de session signés (HMAC), rôles voyageur/admin
  config.ts                Lecture/écriture de la config, vérif code & admin
  types.ts                 Types serveur
  data/config.json         Exemple de configuration (maison, séjours, tutos, tourisme)
```

## Déploiement

Voir [`deploy/README.md`](deploy/README.md). En résumé, sur le VPS en root :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/airbnb-guest-portal-8o2bq8/deploy/vps-setup.sh \
  | ADMIN_PASSWORD="votre-mot-de-passe" bash
# Site :  http://76.13.37.163/maisoncapendu/
# Admin : http://76.13.37.163/maisoncapendu/#admin
```
