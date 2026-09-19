# Simulateur d'admission Parcoursup

Application web qui aide les étudiants à **choisir et simuler leurs chances
d'admission** dans les formations de l'enseignement supérieur (Parcoursup),
à partir de quatre critères :

1. **Résultats scolaires** (notes par matière)
2. **Géolocalisation** (secteur géographique / mobilité)
3. **Passions** (domaines d'intérêt)
4. **Motivation** (motivation et cohérence du projet)

Le simulateur classe les formations par probabilité d'admission estimée et
explique les facteurs clés de chaque estimation.

## Démarrer

```bash
npm install
npm run dev       # front (Vite) sur http://localhost:5173, proxy /api -> :8787
npm run server    # service de prix (scraping) sur http://localhost:8787
npm run build     # build de production du front
npm test          # tests unitaires (Vitest) — moteur, données, serveur
```

Le front fonctionne seul (repli sur prix indicatif) ; lancer aussi `npm run
server` pour obtenir les frais de scolarité réels.

## Architecture

```
src/
  types.ts                 Types partagés (Formation, ProfilEtudiant, ...)
  data/
    formations.ts          Échantillon de formations (données d'exemple)
    labels.ts              Libellés d'affichage (domaines, matières, régions)
  engine/
    simulate.ts            Moteur de scoring et d'estimation du taux d'admission
    __tests__/             Tests unitaires du moteur
    coutVie.ts             Coût de la vie par ville (loyer, budget mensuel)
    prix.ts                Client du service de prix (backend)
  components/
    Stepper.tsx            Barre de progression du formulaire
    Resultats.tsx          Affichage des résultats classés
  App.tsx                  Formulaire multi-étapes + orchestration

server/                    Service de prix (scraping des frais de scolarité)
  scraper.ts               Extraction du prix depuis le HTML d'un site d'école
  registre.ts              Base curée de prix + estimation par catégorie
  service.ts               Orchestration cache -> curé -> scraping -> estimation
  cache.ts                 Cache disque avec TTL
  index.ts                 Serveur HTTP (GET/POST /api/prix, /api/sante)
```

### Service de prix (le « vrai plus » : frais de scolarité réels)

L'open data Parcoursup ne contient pas les prix. Le navigateur ne pouvant pas
lire les sites d'écoles (CORS), un **service backend** (`server/`) s'en charge :

1. **cache** (30 jours) →
2. **base curée** de prix connus (`registre.ts`) ; si une URL d'école est
   connue, tentative de **scraping** pour un montant à jour →
3. **estimation par catégorie** (public ~175 €/an, privé selon le type) en repli.

API : `GET /api/prix?etablissement=&statut=&fili=` et `POST /api/prix` (lot).
Le front interroge ce service et retombe silencieusement sur un prix indicatif
si le service est indisponible.

### Modèle de simulation

Chaque formation reçoit quatre sous-scores (0-100) — académique, passion,
motivation, géographie — combinés en un **score d'adéquation** pondéré, qui
module le **taux d'accès historique** de la formation pour produire une
probabilité. Voir `src/engine/simulate.ts` pour le détail commenté.

> ⚠️ Outil **pédagogique**. Les probabilités reposent sur un modèle simplifié
> et des données d'exemple ; elles ne préjugent pas des décisions réelles.

## Sources de données à intégrer (feuille de route)

Les données actuelles sont des **exemples**. Pour une version réaliste, on
s'appuiera sur les jeux de données ouverts officiels :

| Besoin | Source | Détail |
| --- | --- | --- |
| Carte officielle des formations, critères, lieux, attendus | **[dossier.parcoursup.fr/Candidat/carte](https://dossier.parcoursup.fr/Candidat/carte)** | Source principale : chaque fiche formation (critères d'analyse des vœux, lieu, capacité) |
| Site de dépôt des vœux | **[parcoursup.gouv.fr](https://www.parcoursup.gouv.fr/)** | Référence du fonctionnement des vœux |
| Taux d'accès, vœux et propositions (open data officiel) | **[data.enseignementsup-recherche.gouv.fr — fr-esr-parcoursup](https://data.enseignementsup-recherche.gouv.fr/explore/assets/fr-esr-parcoursup/)** ([portail](https://data.enseignementsup-recherche.gouv.fr/pages/parcoursupdata/)) | Jeu annuel du ministère : taux d'accès, capacités, effectifs, filière, par formation — API Opendatasoft |
| Lieux / géolocalisation | carte Parcoursup + base des établissements | Ville, adresse, coordonnées GPS |
| Coût / prix des formations | ONISEP + fiches établissements | Frais de scolarité (public/privé) |
| Débouchés, contenu | **ONISEP** | Descriptions, poursuites d'études, métiers |

### Fait

- [x] **Chargement des données officielles en direct** via l'API Opendatasoft
      (`fr-esr-parcoursup`) : taux d'accès réels, établissement, ville, région,
      capacité, statut, lien Parcoursup (`src/data/opendata.ts`), avec repli sur
      l'échantillon local si l'API est indisponible.
- [x] **Proposer plusieurs choix** : liste de vœux équilibrée
      (ambitieux / réalistes / valeurs sûres, `src/engine/strategie.ts`).
- [x] **Coût de la vie par ville** : loyer moyen studio/T1 + budget mensuel
      indicatif (`src/data/coutVie.ts`).
- [x] **Vrais prix / frais de scolarité** via un **service backend de scraping**
      (`server/`) : base curée + scraping des sites d'écoles + estimation par
      catégorie, avec cache. C'est le « vrai plus » du projet.

### Prochaines étapes

- [ ] Enrichir la base curée de prix (plus d'écoles) et ajouter des connecteurs
      de scraping par école (chaque site a sa mise en page).
- [ ] **Annonces immobilières** liées à la ville de la formation (logement
      étudiant), en complément du coût de la vie.
- [ ] Filtrer/rechercher par domaine, ville, coût, sélectivité.
- [ ] Affiner le modèle de scoring avec les taux d'accès réels par profil de bac.
- [ ] Fiches formation détaillées (attendus, débouchés, prix, carte).
- [ ] Améliorer le coût de la vie (données par agglomération, transport, énergie).
