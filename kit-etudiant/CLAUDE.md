# Kit Etudiant — contexte projet permanent

## Ce que nous construisons
Une plateforme web qui aide les lycéens à choisir leurs vœux Parcoursup en croisant
trois dimensions : probabilité d'admission, coût réel de la vie sur place, et
compatibilité avec leurs contraintes de vie. Le différenciant est le RAV
(Reste-À-Vivre mensuel projeté) affiché sur chaque vœu.

## Règles absolues, jamais négociables
1. AUCUN montant affiché à l'utilisateur ne peut provenir d'un LLM. Tout euro remonte
   à une ligne de calcul déterministe avec sa source et son millésime.
2. AUCUN accès au compte Parcoursup d'un candidat. Pas de scraping de
   dossier.parcoursup.fr. Uniquement l'open data publié et la saisie volontaire.
3. Les données personnelles concernent des MINEURS. Minimisation, chiffrement au repos,
   hébergement France, purge des textes bruts d'appréciations après extraction.
4. Aucun vœu n'est jamais masqué ou retiré par l'algorithme. Il peut être signalé,
   jamais supprimé de la vue.
5. Les trois scores restent séparés. Jamais de note globale unique.
6. Toute donnée affichée porte son millésime et sa date de collecte.

## Stack
Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, PostgreSQL 16 + PostGIS,
Drizzle ORM, Redis, MapLibre GL, OpenFisca France conteneurisé, hébergement Scaleway
région France.

## Clés pivots des données
- Établissement : code UAI
- Commune : code INSEE
- Formation : code Onisep AF/FOR
Toute jointure passe par l'une des trois. Aucune jointure sur libellé texte.

## Conventions de code
- TypeScript strict, pas de `any`.
- Le moteur de calcul budgétaire vit dans `packages/budget-engine`, sans dépendance
  au framework web, testé unitairement avant tout branchement UI.
- Chaque fonction de calcul renvoie le montant ET sa provenance :
  `{ montant: number, source: string, millesime: string, hypothese: string }`.
- Migrations versionnées, jamais de modification destructive d'un millésime existant.
- Messages de commit en français, format conventionnel.

## Ce qu'il ne faut pas faire
- Ne pas commencer par l'interface. Le moteur de calcul d'abord.
- Ne pas inventer de valeurs de repli silencieuses : une donnée manquante s'affiche
  comme manquante.
- Ne pas ajouter de dépendance sans me demander.
- Ne pas écrire de texte d'interface anxiogène. Jamais « aucune chance ».
