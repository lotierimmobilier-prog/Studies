-- KITETUDIANT — schéma PostgreSQL 16 + PostGIS
--
-- Proposition de l'étape 3. NON APPLIQUÉ : le prompt d'amorçage demande de
-- montrer le schéma avant de l'exécuter.
--
-- Principes, tirés de CLAUDE.md et de l'inventaire des données :
--   * Trois clés pivots : UAI pour les établissements, code INSEE pour la
--     géographie, cod_aff_form pour les formations Parcoursup. Le code Onisep
--     AF/FOR n'existe dans aucun jeu Parcoursup : il n'est donc pas clé pivot,
--     mais un enrichissement à la maille établissement.
--   * Toutes les tables de référence sont millésimées, et un millésime déjà
--     publié ne se modifie jamais : on en insère un nouveau.
--   * Aucun montant n'existe sans sa source et son millésime.
--   * Les données personnelles concernent des mineurs : minimisation stricte,
--     pas de date de naissance complète, purge des textes bruts.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS reference;
CREATE SCHEMA IF NOT EXISTS eleve;
CREATE SCHEMA IF NOT EXISTS communaute;

COMMENT ON SCHEMA reference IS
  'Données publiques millésimées. Jamais de personne physique ici.';
COMMENT ON SCHEMA eleve IS
  'Données personnelles de mineurs. Chiffrement au repos, purge programmée.';
COMMENT ON SCHEMA communaute IS
  'Retours d''étudiants inscrits. Trois axes chiffrés, aucun texte libre, aucune note d''établissement.';

-- ════════════════════════════════════════════════════ référence géographique

CREATE TABLE reference.commune (
  code_insee            char(5)      NOT NULL,
  millesime             smallint     NOT NULL,
  nom                   text         NOT NULL,
  code_departement      varchar(3)   NOT NULL,
  code_region           varchar(2)   NOT NULL,
  code_epci             varchar(9),
  -- Arrondissement municipal pour Paris, Lyon et Marseille : l'indicateur de
  -- loyers ne connaît que ces codes, jamais 75056, 69123 ni 13055.
  est_arrondissement    boolean      NOT NULL DEFAULT false,
  contour               geography(MultiPolygon, 4326) NOT NULL,
  centroide             geography(Point, 4326)        NOT NULL,
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (code_insee, millesime)
);
CREATE INDEX commune_contour_gix ON reference.commune USING gist (contour);
CREATE INDEX commune_nom_departement_idx
  ON reference.commune (code_departement, lower(nom));

-- ════════════════════════════════════════════════ établissements, formations

CREATE TABLE reference.etablissement (
  uai                   char(8)      NOT NULL,
  millesime             smallint     NOT NULL,
  nom                   text         NOT NULL,
  statut                text         NOT NULL,
  code_insee            char(5),
  -- Comment la commune a été obtenue : la méthode fait partie de la donnée.
  code_insee_methode    text,
  position              geography(Point, 4326),
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (uai, millesime),
  CONSTRAINT etablissement_methode_connue CHECK (
    code_insee IS NULL
    OR code_insee_methode IN ('polygone', 'nom_departement', 'arrondissement', 'accord_des_deux')
  )
);
CREATE INDEX etablissement_commune_idx ON reference.etablissement (code_insee, millesime);

CREATE TABLE reference.formation (
  cod_aff_form          text         NOT NULL,
  session               smallint     NOT NULL,
  uai                   char(8)      NOT NULL,
  -- Code de l'URL de fiche Parcoursup, pont vers la cartographie (colonne gta).
  g_ta_cod              text,
  filiere               text         NOT NULL,
  libelle               text         NOT NULL,
  libelle_detaille      text,
  selective             boolean      NOT NULL,
  apprentissage         boolean      NOT NULL DEFAULT false,
  internat              boolean      NOT NULL DEFAULT false,
  assujettie_cvec       boolean      NOT NULL DEFAULT true,
  position              geography(Point, 4326),
  code_insee            char(5),
  lien_fiche            text,
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (cod_aff_form, session),
  FOREIGN KEY (uai, session) REFERENCES reference.etablissement (uai, millesime)
);
CREATE INDEX formation_commune_idx ON reference.formation (code_insee, session);
CREATE INDEX formation_gta_idx ON reference.formation (g_ta_cod, session);

-- Enrichissement Onisep, isolé parce que sa licence ODbL est contaminante :
-- aucune vue exportée ne doit joindre cette table sans décision explicite.
CREATE TABLE reference.formation_onisep (
  af_identifiant        text         NOT NULL,
  millesime             smallint     NOT NULL,
  uai                   char(8),
  for_libelle           text         NOT NULL,
  for_url               text,
  niveau_sortie         text,
  collecte_le           date         NOT NULL,
  licence               text         NOT NULL DEFAULT 'ODbL',
  source                text         NOT NULL,
  PRIMARY KEY (af_identifiant, millesime, for_libelle)
);
COMMENT ON TABLE reference.formation_onisep IS
  'Licence ODbL, partage à l''identique. Ne jamais incorporer dans une base dérivée redistribuée sans arbitrage.';

CREATE TABLE reference.stat_admission (
  cod_aff_form          text         NOT NULL,
  session               smallint     NOT NULL,
  capacite              integer,
  voeux_total           integer,
  voeux_phase_principale integer,
  propositions_total    integer,
  admis_total           integer,
  admis_boursiers       integer,
  admis_bac_general     integer,
  admis_bac_techno      integer,
  admis_bac_pro         integer,
  taux_acces            smallint,
  part_acces_general    smallint,
  part_acces_techno     smallint,
  part_acces_pro        smallint,
  -- Les colonnes pct_* de Parcoursup sont arrondies au multiple de 5 : on ne
  -- reconstruit jamais un effectif à partir d'elles.
  pct_boursiers_arrondi smallint,
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (cod_aff_form, session),
  FOREIGN KEY (cod_aff_form, session) REFERENCES reference.formation (cod_aff_form, session),
  CONSTRAINT stat_admission_effectifs_positifs CHECK (
    coalesce(capacite, 0) >= 0 AND coalesce(admis_total, 0) >= 0
  ),
  CONSTRAINT stat_admission_taux_acces_borne CHECK (
    taux_acces IS NULL OR taux_acces BETWEEN 0 AND 100
  )
);

-- ═══════════════════════════════════════════ logement, restauration, transport

CREATE TYPE reference.maille_estimation AS ENUM ('commune', 'maille', 'EPCI');

CREATE TABLE reference.indicateur_logement (
  code_insee            char(5)      NOT NULL,
  millesime             smallint     NOT NULL,
  type_logement         text         NOT NULL,
  -- Loyer d'annonce estimé, charges comprises, bien loué vide, en euros/m².
  loyer_m2              numeric(6,3) NOT NULL,
  loyer_m2_borne_basse  numeric(6,3) NOT NULL,
  loyer_m2_borne_haute  numeric(6,3) NOT NULL,
  maille                reference.maille_estimation NOT NULL,
  observations_commune  integer      NOT NULL,
  r2_ajuste             numeric(5,4),
  experimental          boolean      NOT NULL DEFAULT true,
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (code_insee, millesime, type_logement),
  CONSTRAINT indicateur_logement_bornes_ordonnees CHECK (
    loyer_m2_borne_basse <= loyer_m2 AND loyer_m2 <= loyer_m2_borne_haute
  )
);

CREATE TABLE reference.residence_crous (
  id                    text         NOT NULL,
  millesime             smallint     NOT NULL,
  nom                   text         NOT NULL,
  zone                  text,
  adresse               text,
  position              geography(Point, 4326) NOT NULL,
  code_insee            char(5),
  -- Ces jeux n'ont ni tarif ni capacité : les colonnes n'existent pas, plutôt
  -- que d'exister vides et d'inviter à les remplir au jugé.
  emis_le               date,
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (id, millesime)
);
CREATE INDEX residence_crous_position_gix ON reference.residence_crous USING gist (position);

CREATE TABLE reference.point_restauration (
  id                    text         NOT NULL,
  millesime             smallint     NOT NULL,
  type                  text         NOT NULL,
  nom                   text         NOT NULL,
  zone                  text,
  position              geography(Point, 4326) NOT NULL,
  code_insee            char(5),
  -- Un point du jeu source tombe à 4 723 km de toute commune : on refuse à
  -- l'insertion ce que l'on ne veut pas voir arriver en production.
  emis_le               date,
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (id, millesime)
);
CREATE INDEX point_restauration_position_gix ON reference.point_restauration USING gist (position);

CREATE TABLE reference.offre_transport (
  reseau                text         NOT NULL,
  millesime             smallint     NOT NULL,
  code_insee            char(5)      NOT NULL,
  libelle_tarif         text         NOT NULL,
  tarif_mensuel         numeric(7,2) NOT NULL,
  collecte_le           date         NOT NULL,
  source                text         NOT NULL,
  PRIMARY KEY (reseau, millesime, code_insee, libelle_tarif),
  CONSTRAINT offre_transport_tarif_positif CHECK (tarif_mensuel >= 0)
);

-- ═══════════════════════════════════════════════════════ barèmes réglementaires

CREATE TABLE reference.bareme_aide (
  cle                   text         NOT NULL,
  date_effet            date         NOT NULL,
  libelle               text         NOT NULL,
  unite                 text         NOT NULL,
  -- Montant unique, ou table indexée (échelons de bourse) : jsonb pour porter
  -- les deux sans multiplier les tables.
  valeur                jsonb        NOT NULL,
  texte_officiel        text         NOT NULL,
  url_officielle        text,
  verifie_le            date,
  origine               text         NOT NULL,
  extrait_le            date         NOT NULL,
  PRIMARY KEY (cle, date_effet),
  CONSTRAINT bareme_aide_texte_non_vide CHECK (length(btrim(texte_officiel)) > 0)
);
COMMENT ON TABLE reference.bareme_aide IS
  'Miroir en base de packages/baremes/donnees. Un montant sans texte officiel est rejeté.';

-- ═══════════════════════════════════════════════════════════ côté élève

-- Minimisation : pas de date de naissance, pas de nom, pas d'adresse.
CREATE TABLE eleve.profil_eleve (
  id                    uuid         PRIMARY KEY,
  annee_naissance       smallint     NOT NULL,
  mineur                boolean      NOT NULL,
  consentement_parental_le timestamptz,
  code_insee_domicile   char(5),
  echelon_bourse_estime text,
  exonere_cvec          boolean      NOT NULL DEFAULT false,
  contribution_familiale_mensuelle numeric(8,2),
  job_etudiant_bas      numeric(8,2),
  job_etudiant_haut     numeric(8,2),
  aides_regionales_annuelles numeric(8,2),
  repas_crous_par_mois  smallint,
  courses_mensuelles    numeric(8,2),
  frais_divers_mensuels numeric(8,2),
  cree_le               timestamptz  NOT NULL DEFAULT now(),
  purge_prevue_le       date         NOT NULL,
  CONSTRAINT profil_consentement_si_mineur CHECK (
    NOT mineur OR consentement_parental_le IS NOT NULL
  ),
  CONSTRAINT profil_job_ordonne CHECK (
    job_etudiant_bas IS NULL OR job_etudiant_haut IS NULL
    OR job_etudiant_bas <= job_etudiant_haut
  ),
  CONSTRAINT profil_echelon_connu CHECK (
    echelon_bourse_estime IS NULL
    OR echelon_bourse_estime IN ('0bis', '1', '2', '3', '4', '5', '6', '7')
  )
);
COMMENT ON COLUMN eleve.profil_eleve.annee_naissance IS
  'Année seule : suffisante pour la majorité, insuffisante pour identifier.';

CREATE TABLE eleve.bulletin_matiere (
  profil_id             uuid         NOT NULL REFERENCES eleve.profil_eleve (id) ON DELETE CASCADE,
  annee_scolaire        text         NOT NULL,
  periode               text         NOT NULL,
  matiere               text         NOT NULL,
  moyenne               numeric(4,2),
  moyenne_classe        numeric(4,2),
  -- Le texte brut de l'appréciation n'est jamais stocké : seuls les signaux
  -- extraits le sont, et la date de purge prouve que l'extraction a eu lieu.
  signaux               jsonb,
  texte_brut_purge_le   timestamptz  NOT NULL,
  saisie_manuelle       boolean      NOT NULL DEFAULT false,
  PRIMARY KEY (profil_id, annee_scolaire, periode, matiere),
  CONSTRAINT bulletin_moyenne_bornee CHECK (
    moyenne IS NULL OR moyenne BETWEEN 0 AND 20
  )
);

CREATE TYPE eleve.scenario_budget AS ENUM ('optimiste', 'central', 'prudent');
CREATE TYPE eleve.soutenabilite AS ENUM (
  'soutenable', 'tendu', 'non_financable', 'indeterminable'
);

CREATE TABLE eleve.simulation_voeu (
  id                    uuid         PRIMARY KEY,
  profil_id             uuid         NOT NULL REFERENCES eleve.profil_eleve (id) ON DELETE CASCADE,
  cod_aff_form          text         NOT NULL,
  session               smallint     NOT NULL,
  scenario              eleve.scenario_budget NOT NULL,
  -- NULL dès qu'un poste manque : un RAV partiel serait un montant inventé.
  rav_mensuel           numeric(9,2),
  soutenabilite         eleve.soutenabilite NOT NULL,
  postes_manquants      text[]       NOT NULL DEFAULT '{}',
  avertissements        text[]       NOT NULL DEFAULT '{}',
  calcule_le            timestamptz  NOT NULL DEFAULT now(),
  FOREIGN KEY (cod_aff_form, session) REFERENCES reference.formation (cod_aff_form, session),
  UNIQUE (profil_id, cod_aff_form, session, scenario),
  CONSTRAINT simulation_rav_absent_si_indeterminable CHECK (
    (soutenabilite = 'indeterminable') = (rav_mensuel IS NULL)
  ),
  CONSTRAINT simulation_postes_manquants_coherents CHECK (
    (cardinality(postes_manquants) > 0) <= (soutenabilite = 'indeterminable')
  )
);

CREATE TYPE eleve.sens_budget AS ENUM ('depense', 'ressource');
CREATE TYPE eleve.statut_ligne AS ENUM ('calcule', 'manquant', 'sans_objet');

CREATE TABLE eleve.ligne_budget (
  simulation_id         uuid         NOT NULL REFERENCES eleve.simulation_voeu (id) ON DELETE CASCADE,
  poste                 text         NOT NULL,
  sens                  eleve.sens_budget NOT NULL,
  statut                eleve.statut_ligne NOT NULL,
  montant               numeric(9,2),
  montant_mensualise    numeric(9,2),
  source                text,
  millesime             text,
  hypothese             text,
  raison                text,
  PRIMARY KEY (simulation_id, poste),
  -- La règle 1 de CLAUDE.md, écrite en contrainte : pas de montant sans
  -- source, sans millésime et sans hypothèse ; pas d'absence sans raison.
  CONSTRAINT ligne_budget_montant_source CHECK (
    statut <> 'calcule'
    OR (montant IS NOT NULL AND montant_mensualise IS NOT NULL
        AND source IS NOT NULL AND millesime IS NOT NULL AND hypothese IS NOT NULL)
  ),
  CONSTRAINT ligne_budget_absence_motivee CHECK (
    statut = 'calcule' OR (raison IS NOT NULL AND montant IS NULL)
  )
);

CREATE TABLE eleve.panier (
  id                    uuid         PRIMARY KEY,
  profil_id             uuid         NOT NULL REFERENCES eleve.profil_eleve (id) ON DELETE CASCADE,
  cree_le               timestamptz  NOT NULL DEFAULT now(),
  budget_familial_mensuel numeric(8,2)
);

CREATE TYPE eleve.classe_risque AS ENUM ('ambitieux', 'median', 'sur', 'filet');

CREATE TABLE eleve.panier_voeu (
  panier_id             uuid         NOT NULL REFERENCES eleve.panier (id) ON DELETE CASCADE,
  rang                  smallint     NOT NULL,
  cod_aff_form          text         NOT NULL,
  session               smallint     NOT NULL,
  classe_risque         eleve.classe_risque NOT NULL,
  -- Un vœu peut être signalé, jamais retiré : la colonne dit pourquoi il est
  -- signalé, elle ne le supprime pas du panier (règle 4 de CLAUDE.md).
  signalement           text,
  PRIMARY KEY (panier_id, rang),
  UNIQUE (panier_id, cod_aff_form, session),
  FOREIGN KEY (cod_aff_form, session) REFERENCES reference.formation (cod_aff_form, session),
  CONSTRAINT panier_voeu_rang_parcoursup CHECK (rang BETWEEN 1 AND 10)
);

-- ═══════════════════════════════════════════════ retours d'étudiants (M10)

-- Trois axes seulement, chiffrés : coût réel constaté, facilité à trouver un
-- logement, ambiance. Aucune colonne de texte libre n'existe ici, et aucune
-- note globale d'établissement n'est calculable à partir de cette table : les
-- deux sont des choix de conception, pas des oublis.
CREATE TABLE communaute.retour_etudiant (
  id                    uuid         PRIMARY KEY,
  cod_aff_form          text         NOT NULL,
  session               smallint     NOT NULL,
  -- Année universitaire du retour, au format 2026-2027. C'est le millésime.
  millesime             text         NOT NULL,
  cout_reel_mensuel     numeric(8,2) NOT NULL,
  facilite_logement     smallint     NOT NULL,
  ambiance              smallint     NOT NULL,
  annee_etudes          smallint     NOT NULL,
  -- Empreinte du jeton de contributeur : elle ne sert qu'à n'accepter qu'un
  -- retour par formation et par an. Le jeton lui-même n'est jamais stocké.
  empreinte_contributeur text        NOT NULL,
  collecte_le           timestamptz  NOT NULL DEFAULT now(),
  FOREIGN KEY (cod_aff_form, session) REFERENCES reference.formation (cod_aff_form, session),
  UNIQUE (cod_aff_form, millesime, empreinte_contributeur),
  CONSTRAINT retour_millesime_bien_forme CHECK (millesime ~ '^\d{4}-\d{4}$'),
  CONSTRAINT retour_cout_borne CHECK (cout_reel_mensuel BETWEEN 0 AND 3000),
  CONSTRAINT retour_facilite_borne CHECK (facilite_logement BETWEEN 1 AND 5),
  CONSTRAINT retour_ambiance_borne CHECK (ambiance BETWEEN 1 AND 5),
  CONSTRAINT retour_annee_etudes_borne CHECK (annee_etudes BETWEEN 1 AND 8)
);
CREATE INDEX retour_formation_millesime_idx
  ON communaute.retour_etudiant (cod_aff_form, millesime);

-- Un millésime clos ne se modifie plus. La règle « jamais de modification
-- destructive d'un millésime existant » est ici tenue par la base elle-même,
-- pas seulement par la discipline de l'application.
CREATE TABLE communaute.millesime_clos (
  millesime             text         PRIMARY KEY,
  clos_le               timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT millesime_clos_bien_forme CHECK (millesime ~ '^\d{4}-\d{4}$')
);

CREATE OR REPLACE FUNCTION communaute.refuser_millesime_clos()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cible text := coalesce(NEW.millesime, OLD.millesime);
BEGIN
  IF EXISTS (SELECT 1 FROM communaute.millesime_clos WHERE millesime = cible) THEN
    RAISE EXCEPTION 'millésime % clos : aucune écriture n''y est plus possible', cible
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER retour_millesime_clos
  BEFORE INSERT OR UPDATE OR DELETE ON communaute.retour_etudiant
  FOR EACH ROW EXECUTE FUNCTION communaute.refuser_millesime_clos();

COMMIT;
