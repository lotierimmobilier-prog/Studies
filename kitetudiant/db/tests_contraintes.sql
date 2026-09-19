-- Vérifie que les contraintes du schéma font ce que les commentaires promettent.
-- Chaque bloc doit ÉCHOUER : le test réussit quand l'insertion est rejetée.
\set ON_ERROR_STOP off

-- Jeu d'essai minimal.
INSERT INTO reference.commune
  (code_insee, millesime, nom, code_departement, code_region, contour, centroide, collecte_le, source)
VALUES ('87085', 2025, 'Limoges', '87', '75',
        'MULTIPOLYGON(((1.20 45.80, 1.20 45.87, 1.32 45.87, 1.32 45.80, 1.20 45.80)))',
        'POINT(1.2611 45.8336)', '2026-09-19', 'test');
INSERT INTO reference.etablissement (uai, millesime, nom, statut, collecte_le, source)
VALUES ('0870001A', 2025, 'Université de Limoges', 'Public', '2026-09-19', 'test');
INSERT INTO reference.formation
  (cod_aff_form, session, uai, filiere, libelle, selective, collecte_le, source)
VALUES ('2519', 2025, '0870001A', 'Licence', 'Licence STAPS', false, '2026-09-19', 'test');
INSERT INTO eleve.profil_eleve (id, annee_naissance, mineur, purge_prevue_le)
VALUES ('11111111-1111-1111-1111-111111111111', 2008, false, '2027-09-19');
INSERT INTO eleve.simulation_voeu
  (id, profil_id, cod_aff_form, session, scenario, rav_mensuel, soutenabilite)
VALUES ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', '2519', 2025, 'central', 691.20, 'soutenable');

\echo '--- 1. un profil mineur sans consentement parental doit être refusé'
INSERT INTO eleve.profil_eleve (id, annee_naissance, mineur, purge_prevue_le)
VALUES ('33333333-3333-3333-3333-333333333333', 2010, true, '2027-09-19');

\echo '--- 2. un montant calculé sans source doit être refusé'
INSERT INTO eleve.ligne_budget (simulation_id, poste, sens, statut, montant, montant_mensualise)
VALUES ('22222222-2222-2222-2222-222222222222', 'loyer_net', 'depense', 'calcule', 45.00, 45.00);

\echo '--- 3. une ligne manquante sans raison doit être refusée'
INSERT INTO eleve.ligne_budget (simulation_id, poste, sens, statut)
VALUES ('22222222-2222-2222-2222-222222222222', 'transport', 'depense', 'manquant');

\echo '--- 4. un RAV chiffré sur une simulation indéterminable doit être refusé'
INSERT INTO eleve.simulation_voeu
  (id, profil_id, cod_aff_form, session, scenario, rav_mensuel, soutenabilite)
VALUES ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111', '2519', 2025, 'prudent', 100.00, 'indeterminable');

\echo '--- 5. des postes manquants sur une simulation chiffrée doivent être refusés'
INSERT INTO eleve.simulation_voeu
  (id, profil_id, cod_aff_form, session, scenario, rav_mensuel, soutenabilite, postes_manquants)
VALUES ('55555555-5555-5555-5555-555555555555',
        '11111111-1111-1111-1111-111111111111', '2519', 2025, 'optimiste', 100.00, 'soutenable',
        ARRAY['loyer_net']);

\echo '--- 6. des bornes de loyer désordonnées doivent être refusées'
INSERT INTO reference.indicateur_logement
  (code_insee, millesime, type_logement, loyer_m2, loyer_m2_borne_basse, loyer_m2_borne_haute,
   maille, observations_commune, collecte_le, source)
VALUES ('87085', 2025, 'appartement 1 ou 2 pièces', 9.0, 12.0, 11.0, 'commune', 42, '2026-09-19', 'test');

\echo '--- 7. un barème sans texte officiel doit être refusé'
INSERT INTO reference.bareme_aide
  (cle, date_effet, libelle, unite, valeur, texte_officiel, origine, extrait_le)
VALUES ('cvec', '2026-09-01', 'CVEC', 'euros_par_an', '105'::jsonb, '   ', 'test', '2026-09-19');

\echo '--- 8. un onzième vœu dans un panier doit être refusé'
INSERT INTO eleve.panier (id, profil_id)
VALUES ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111');
INSERT INTO eleve.panier_voeu (panier_id, rang, cod_aff_form, session, classe_risque)
VALUES ('66666666-6666-6666-6666-666666666666', 11, '2519', 2025, 'sur');

\echo '--- 9. un échelon de bourse inconnu doit être refusé'
INSERT INTO eleve.profil_eleve (id, annee_naissance, mineur, purge_prevue_le, echelon_bourse_estime)
VALUES ('77777777-7777-7777-7777-777777777777', 2008, false, '2027-09-19', '8');

\echo '--- ce qui DOIT passer : un vœu signalé reste dans le panier'
INSERT INTO eleve.panier_voeu (panier_id, rang, cod_aff_form, session, classe_risque, signalement)
VALUES ('66666666-6666-6666-6666-666666666666', 1, '2519', 2025, 'sur',
        'Reste-à-vivre négatif dans le scénario prudent');
SELECT count(*) AS voeux_dans_le_panier FROM eleve.panier_voeu;
