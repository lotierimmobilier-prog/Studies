# Jalons

Découpage du chantier ouvert le 20/09/2026. L'architecture est dans
[`architecture-cible.md`](architecture-cible.md), les arbitrages dans
[`DECISIONS.md`](../DECISIONS.md).

Un lot est fini quand il est **en production et vérifié au navigateur**, pas
quand le code compile. Chaque lot se termine par : `npm test` vert,
`typecheck:kitetudiant` et `typecheck:server` sans erreur, `build` + prérendu
sans erreur, parcours exercé contre les données réelles, déploiement.

---

## MVP1 — Le produit devient explorable

**Ce qui doit être vrai à la fin :** un lycéen arrive, cherche « Limoges »,
voit ce qui s'y trouve sur une carte et dans une liste, ouvre une formation,
lit ses statistiques d'admission sourcées, l'ajoute à ses vœux, et la retrouve
le lendemain sur le téléphone de sa mère.

### MVP1-A · La barre latérale et la navigation — **fait**

Remplace l'en-tête à boutons par une barre latérale persistante : explorer,
mes vœux, mon profil, le blog, mon espace. Repliée en bas d'écran sur mobile —
une barre latérale sur un téléphone mange la moitié de l'écran.

Le fil d'Ariane existant est conservé : il dit où l'on est, la barre dit où
l'on peut aller.

**Dépend de :** rien. **Ne dépend pas de la base.**

### MVP1-B · Les URL de formation et d'établissement — **fait**

`/formation/:codAffForm` et `/etablissement/:uai` dans `routes.ts`, plus le
pré-rendu de ce qui est pré-rendable. C'est le déblocage structurel : sans ces
routes, ni fiche, ni partage, ni vœu qu'on retrouve.

**Dépend de :** rien.

### MVP1-C · La fiche formation, trois onglets — **fait**

| Onglet | Contenu | Source |
| --- | --- | --- |
| **Admission** | Capacité, vœux, propositions, admis, taux d'accès, part des boursiers, répartition par type de bac et par mention | Parcoursup, millésime affiché |
| **Vivre ici** | Loyer médian de la commune, CROUS, restauration, ce qu'un étudiant dépense — et le RAV **si** le profil budgétaire est présent sur l'appareil | Loyers DGALN/ANIL T3 2025, barèmes versionnés |
| **Après** | Ce que le jeu public dit de la suite, et ce qu'il ne dit pas | Parcoursup, Onisep sous réserve de Q2 |

La carte de localisation est ici, **affichée au clic** : rien n'est demandé à
l'IGN avant, et le bouton le dit avant, pas après.

Chaque chiffre porte son millésime. Un chiffre absent s'affiche absent.

**Dépend de :** MVP1-B.

### MVP1-D · La base de données

Étapes A à C du plan de migration : instance, rôles, `001-socle.sql`, import,
bascule de lecture avec repli sur l'API du ministère.

**Bloqué par Q1** — le pilote PostgreSQL est une dépendance à valider.

### MVP1-E · L'explorateur

`/explorer` : facettes avec compteurs (ville, thème, filière, statut public /
privé sous contrat / privé), carte MapLibre avec regroupement, liste
synchronisée avec la carte.

**Une part est déjà livrée sans la base** : la page de recherche porte une
carte des résultats, avec regroupement à l'écran et navigation au clic sur un
repère. Elle tient jusqu'à la centaine de points que rend l'API du ministère.
Ce qui manque et qui exige la base : les compteurs de facettes, et le
chargement des formations d'une zone au fil du zoom — c'est là que MapLibre
devient nécessaire (décision D4).

Les 16 thèmes existants (droit, sport, langues…) sont réutilisés : ils ont été
construits et vérifiés un par un contre le jeu réel, parce que la discipline
n'est **pas** publiée — le champ `fili` de Parcoursup est le TYPE de formation
(BTS, Licence, CPGE), pas la matière.

**Dépend de :** MVP1-D.

### MVP1-F · Comptes en base et profil déclaratif

Étape D : migration du fichier chiffré, jetons de session en empreinte.
`/mon-profil` : année de naissance, bac, commune, mobilité. Et la liste, à
l'écran, de **tout** ce que le serveur sait — qui doit tenir en quelques
lignes, sinon c'est que quelque chose a dérivé.

**Dépend de :** MVP1-D.

### MVP1-G · Les vœux persistés

Étape E : `/mes-voeux`, ajout depuis une fiche ou l'explorateur, réordonnancement,
signalement. Proposition **explicite et unique** d'enregistrer la liste locale.

Et la réécriture de la promesse d'accueil : de « aucune donnée scolaire » à
« tes notes et ton budget ne quittent pas ton navigateur ; ta liste de vœux,
si tu es connecté, est enregistrée pour que tu la retrouves ». Cette
réécriture fait partie du lot — la livrer après serait livrer une promesse
fausse.

**Dépend de :** MVP1-F.

---

## MVP2 — Les deux différenciateurs

Ce que le concurrent n'a pas. C'est là que le produit cesse d'être une
reproduction.

### MVP2-A · Se loger

`/logement/:codeInsee` : loyer médian sourcé et daté, résidences CROUS,
estimation de ce que coûte un T1 ou un studio, liens vers le CROUS puis vers
les annonces, et le calcul de ce que ça laisse pour vivre.

**Trois limites à écrire à l'écran, pas à cacher :**

- aucune source publique ne publie la **disponibilité** réelle (Q5) : on ne
  promet donc jamais qu'un logement est trouvable ;
- les données CROUS datent de **2017** (Q4) ;
- leboncoin répond 403 à nos requêtes (Q6) : le lien est construit au mieux et
  n'est pas garanti.

**Bloqué par Q3, Q4, Q5, Q6.**

### MVP2-B · Les bons plans

Aides régionales, tarifs de transport étudiant, aide à la mobilité Parcoursup,
repas CROUS, exonérations. Chacun avec son montant, sa source, son millésime,
et **qui y a droit**.

Un bon plan dont on ne sait pas dire qui y a droit n'est pas un bon plan,
c'est une publicité.

**Dépend de :** MVP1-D.

---

## MVP3 — Décider, pas seulement explorer

### MVP3-A · Comparer

`/comparer` : deux à quatre vœux côte à côte, les trois scores **séparés**
(règle 5), les mêmes lignes en face. Jamais de note globale, jamais de
classement.

### MVP3-B · Idées de vœux

Des suggestions à partir du profil déclaratif et des vœux déjà là. Elles
**ajoutent**, elles ne retirent rien (règle 4), et elles disent sur quoi elles
reposent.

### MVP3-C · Débouchés

**Bloqué par Q2** — licence ODbL de l'Onisep.

### MVP3-D · Espaces partenaires

Lycées et établissements. À spécifier : ce qu'un partenaire voit d'un élève
est un arbitrage de confidentialité à part entière, et la réponse par défaut
est « rien de nominatif ».

---

## Ordre d'exécution

```
MVP1-A ─┐
MVP1-B ─┴─► MVP1-C ─────────────────────────────┐
MVP1-D (Q1) ─┬─► MVP1-E ────────────────────────┤
             ├─► MVP1-F ──► MVP1-G ─────────────┴─► MVP1 livré
             └─► MVP2-B
MVP2-A (Q3-Q6)
MVP3-A ──► MVP3-B    MVP3-C (Q2)    MVP3-D
```

A, B et C ne dépendent d'aucune base : ils commencent tout de suite, pendant
que Q1 est tranchée.

---

## Dette connue, à traiter en chemin

| Sujet | État |
| --- | --- |
| ~~`carte.tsx` écrit, non branché~~ | Fait : branché sur la fiche et sur la recherche |
| `familyia` sur le VPS | `next-server` pid 130309 tient le port 3000 ; certificat et fichiers non retirés |
| Badge HTTPS « non sécurisé » | Serveur vérifié propre (HSTS, 301, certificat valide, zéro requête en clair). Reste à confirmer en navigation privée. |
| `CLAUDE.md` décrit une stack jamais atteinte | À reprendre une fois MVP1 livré, pour qu'il décrive ce qui existe |
