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
npm run dev      # serveur de développement (Vite)
npm run build    # build de production
npm test         # tests unitaires du moteur de simulation (Vitest)
```

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
  components/
    Stepper.tsx            Barre de progression du formulaire
    Resultats.tsx          Affichage des résultats classés
  App.tsx                  Formulaire multi-étapes + orchestration
```

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
- [x] Prix **indicatif** dérivé du statut (public/privé).

### Prochaines étapes

- [ ] **Vrais prix / frais de scolarité par école** (le vrai plus du projet) :
      l'open data ne contient pas les prix. Constituer une base de frais réels
      par établissement (récupérés sur les sites des écoles / ONISEP). ⚠️ La
      récupération automatique depuis les sites d'écoles nécessite un service
      côté serveur (le navigateur est bloqué par CORS) — voir la décision
      d'architecture à trancher.
- [ ] **Annonces immobilières** liées à la ville de la formation (logement
      étudiant), en complément du coût de la vie.
- [ ] Filtrer/rechercher par domaine, ville, coût, sélectivité.
- [ ] Affiner le modèle de scoring avec les taux d'accès réels par profil de bac.
- [ ] Fiches formation détaillées (attendus, débouchés, prix, carte).
- [ ] Améliorer le coût de la vie (données par agglomération, transport, énergie).
