# Les 10 cas types du moteur budgétaire

Écrits avant le code, comme le demande le prompt d'amorçage, pour être
**vérifiables à la main**. Chaque montant attendu se recalcule avec une
calculatrice à partir des barèmes versionnés ; aucun n'est le produit du code.

Les tests correspondants sont dans
`packages/budget-engine/src/__tests__/rav.test.ts`. Si vous corrigez un cas
ici, le test doit échouer : c'est le but.

## Barèmes en vigueur au 19 septembre 2026

| Barème | Valeur | Millésime | Source |
| --- | --- | --- | --- |
| Bourse sur critères sociaux, échelon 5 | 521,20 €/mois | 2023-03-15 | Arrêté du 13 avril 2023 |
| Bourse sur critères sociaux, échelon 0 bis | 145,40 €/mois | 2023-03-15 | Arrêté du 13 avril 2023 |
| Mensualités de bourse par an | 10 | 2020-07-31 | JORFTEXT000042170743 |
| Aide au mérite | 900 €/an, soit 90 €/mois | 2020-07-31 | Arrêté du 20/07/2020, art. 4 |
| Aide à la mobilité Parcoursup | 500 € une fois, soit 50 €/mois | 2019-05-14 | BO ESRS1910244C |
| Repas au restaurant universitaire, boursier | 1,00 € | 2020-09-01 | CA du CNOUS du 23/07/2020 |
| Repas au restaurant universitaire, non boursier | 1,00 € | 2026-05-04 | CA du CNOUS |
| CVEC | 105 €/an, soit 10,50 €/mois | 2026-09-01 | etudiant.gouv.fr, FAQ CVEC |

## Profil de référence

Boursier échelon 5, éligible à l'aide au mérite et à l'aide à la mobilité
Parcoursup. Contribution familiale 150 €/mois. Job étudiant déclaré entre 200
et 300 €/mois. 15 repas au restaurant universitaire par mois, 120 € de courses,
80 € de frais divers. Logement type de 25 m².

## Les cas

| # | Cas | Attendu | Ce qu'il vérifie |
| --- | --- | --- | --- |
| 1 | Boursier échelon 5 à Limoges, 9 €/m², APL 180 € | RAV central **+691,20 €**, soutenable | Le calcul nominal bout en bout |
| 2 | Le même à Toulouse, 13,50 €/m² | RAV central **+578,70 €**, écart de **112,50 €** | L'écart entre deux villes, argument central du produit |
| 3 | Non boursier à Paris 13e, 28 €/m², APL 150 € | RAV central **−498,00 €**, non finançable | Le cas rouge, et la CVEC due |
| 4 | Le cas 3 avec 1 000 € de contribution familiale | RAV **+102,00 €**, tendu | La zone orange |
| 5 | Le cas 3 avec 1 048 € de contribution familiale | RAV **+150,00 €**, tendu | La borne : 150 € est tendu, pas soutenable |
| 6 | Formation à Mamoudzou, aucun indicateur de loyer | RAV **null**, indéterminable | Une donnée manquante n'est jamais remplacée |
| 7 | Loyer connu mais APL non simulée | RAV **null**, `loyer_net` manquant | Pas d'approximation d'APL |
| 8 | Droits d'inscription indisponibles | RAV **null**, `frais_scolarite` manquant | Le trou documenté de l'Onisep |
| 9 | Boursier contre non boursier, tout égal par ailleurs | Écart de **10,50 €/mois** exactement | L'exonération de CVEC, et rien d'autre |
| 10 | Les trois scénarios sur un loyer estimé à la maille, 7 / 9 / 11 €/m², APL 180 € | optimiste > central > prudent, écart optimiste−central de **95 €**, un avertissement | La fourchette, la qualité de l'estimation qui remonte, et le loyer net jamais négatif |

## Vérification du cas 1, à la main

Dépenses mensuelles :

- loyer net : 9,00 × 25 = 225,00 €, moins 180 € d'APL = **45,00 €**
- transport : **30,00 €**
- alimentation : 15 repas × 1,00 € + 120 € de courses = **135,00 €**
- frais divers : **80,00 €**
- frais de scolarité : 0 € de droits, CVEC nulle (boursier) = **0,00 €**
- frais d'installation : 800 € ÷ 10 = **80,00 €**

Total : **370,00 €**

Ressources mensuelles :

- contribution familiale : **150,00 €**
- job étudiant, scénario central, moyenne de 200 et 300 : **250,00 €**
- bourse échelon 5 : **521,20 €**
- aide au mérite : 900 ÷ 10 = **90,00 €**
- aide à la mobilité Parcoursup : 500 ÷ 10 = **50,00 €**

Total : **1 061,20 €**

RAV = 1 061,20 − 370,00 = **691,20 €**, au-dessus de 150 € donc soutenable.

## Le cas 10, et pourquoi l'écart vaut 95 € et non 100 €

À 7 €/m² sur 25 m², le loyer brut est de 175 €, soit moins que les 180 € d'APL.
Le poste loyer net est alors ramené à **0 €**, pas à −5 € : une APL ne se
transforme pas en revenu. L'écart de loyer entre le scénario optimiste et le
scénario central vaut donc 45 € et non 50 €, auxquels s'ajoutent les 50 € de
job étudiant, soit **95 €**. L'hypothèse de la ligne le dit en toutes lettres.

## Une divergence à arbitrer

La formule du cahier des charges divise par 10 la totalité des ressources,
contribution familiale et job étudiant compris, alors que le même document les
définit comme **mensuels**. Appliquée telle quelle, elle retirerait 90 % de ces
deux ressources au RAV : dans le cas 1, le RAV tomberait de 691,20 € à
−158,32 €, et un vœu parfaitement finançable s'afficherait en rouge.

Le moteur amortit donc sur 10 mensualités les seuls montants annuels — bourse,
mérite, mobilité, aides régionales, frais de scolarité, frais d'installation —
et laisse les montants mensuels tels quels. La formule appliquée est :

```latex
RAV_{mensuel} = R_{famille} + R_{job} + \frac{A_{annuelles}}{10} - \left( L_{net} + T + Alim + S + \frac{F_{scol} + F_{install}}{10} \right)
```

À confirmer, et à répercuter dans le cahier des charges.
