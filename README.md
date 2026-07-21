# Espace voyageur — portail Airbnb 🏖️

Un site **simple, moderne et épuré** pour accueillir vos voyageurs Airbnb.
Chaque réservation dispose d'un **identifiant de connexion** qui donne accès à :

- 🎬 **Tutoriels vidéo** — une capsule par équipement (Wi-Fi, climatisation,
  lave-vaisselle, TV, piscine…) avec explications pas à pas ;
- 🔑 **Accès à la maison** — adresse, code de la boîte à clés, Wi-Fi,
  stationnement, instructions d'arrivée et de départ, règlement ;
- 🧭 **Tourisme & bonnes adresses** — restaurants, plages, activités, services,
  avec téléphone, itinéraire et vos conseils personnels ;
- 📞 **Contact & urgences** — coordonnées de l'hôte (appel, WhatsApp, e-mail) et
  numéros utiles ;
- 🗓️ **Rappel du séjour** — dates d'arrivée et de départ + compte à rebours, et
  un petit mot de bienvenue personnalisé.

Ambiance vacances (palette sable / corail / océan), responsive (barre de
navigation en bas sur mobile).

## Démarrer en local

```bash
npm install
npm run server    # API Node (connexion + séjours) sur http://localhost:8788
npm run dev       # front (Vite) sur http://localhost:5173, proxy /api -> :8788
npm run build     # build de production du front
```

Identifiants de démonstration : **`demo` / `vacances`** (ou `dupont` /
`soleil2026`).

## Personnaliser le contenu

Tout se configure dans quelques fichiers, sans connaissance technique poussée.

| Ce que vous voulez changer | Fichier |
| --- | --- |
| Séjours (login/mot de passe, dates, message) + infos maison (codes, Wi-Fi, adresse, règlement, contacts) | `server/data/sejours.json` (ou `.data/sejours.json` en production) |
| Tutoriels vidéo (titre, vidéo YouTube/Vimeo, étapes) | `src/data/tutoriels.ts` |
| Tourisme & bonnes adresses (avec contacts) | `src/data/tourisme.ts` |

### Ajouter une capsule vidéo

Dans `src/data/tutoriels.ts`, la vidéo accepte trois sources :

```ts
video: { type: 'youtube', id: 'dQw4w9WgXcQ' }      // ID après « v= » / youtu.be/
video: { type: 'vimeo', id: '76979871' }
video: { type: 'fichier', src: '/videos/clim.mp4' } // fichier dans public/videos/
```

> Astuce : sur YouTube, réglez la vidéo en **« Non répertoriée »** pour qu'elle
> ne soit visible que via ce portail.

## Architecture

```
index.html                 Page hôte (polices, favicon, méta)
src/
  main.tsx                 Point d'entrée React
  App.tsx                  Connexion ↔ portail (restauration de session)
  api.ts                   Appels à l'API (connexion, restauration) + jeton
  types.ts                 Types partagés (Maison, Sejour, Tutoriel, ...)
  dates.ts                 Formatage FR + compte à rebours du séjour
  styles.css               Thème « vacances », responsive (nav mobile en bas)
  data/
    tutoriels.ts           Capsules vidéo (éditable)
    tourisme.ts            Bonnes adresses & contacts (éditable)
  components/
    Connexion.tsx          Écran de connexion (login + mot de passe)
    Portail.tsx            Coque + navigation par onglets
    Sejour.tsx             Accueil : compte à rebours, dates, mot de l'hôte
    Acces.tsx              Accès maison (Wi-Fi, codes, arrivée/départ, règlement)
    Tutoriels.tsx          Grille des capsules vidéo + filtres
    Tourisme.tsx           Bonnes adresses + contacts + filtres
    Contact.tsx            Hôte + numéros utiles
    VideoCapsule.tsx       Lecteur (YouTube / Vimeo / fichier)

server/                    API Node minimale (sans dépendance)
  index.ts                 Serveur HTTP (/api/connexion, /api/sejour, /api/sante)
  auth.ts                  Jetons de session signés (HMAC-SHA256)
  sejours.ts               Chargement config + vérification des identifiants
  types.ts                 Types serveur
  data/sejours.json        Exemple de configuration (séjours + maison)
```

## Fonctionnement de la connexion

1. Le voyageur saisit son **login + mot de passe** (fournis par l'hôte).
2. Le serveur vérifie les identifiants et renvoie un **jeton signé** (HMAC),
   les infos de son séjour et les informations de la maison.
3. Le jeton est conservé dans le navigateur : la session est **restaurée
   automatiquement** au rechargement, sans redemander le mot de passe.
4. Les informations sensibles (codes, Wi-Fi, adresse) ne sont renvoyées
   qu'**après authentification**.

En production, définissez `SESSION_SECRET` (clé de signature des jetons).

## Déploiement

Voir [`deploy/README.md`](deploy/README.md). En résumé, sur le VPS en root :

```bash
curl -fsSL https://raw.githubusercontent.com/lotierimmobilier-prog/Studies/claude/airbnb-guest-portal-8o2bq8/deploy/vps-setup.sh | bash
# -> http://76.13.37.163/vacances/
```

Puis créez `/opt/vacances/.data/sejours.json` avec vos vraies informations
(voir `deploy/README.md`).
