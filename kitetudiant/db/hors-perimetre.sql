-- HORS PÉRIMÈTRE — conception conservée, NON APPLIQUÉE
--
-- Ce fichier n'est pas une migration et ne doit jamais être exécuté sur
-- l'instance. Il garde la conception des tables que la décision D1 laisse
-- dans le navigateur de l'élève :
--
--   * eleve.bulletin_matiere    — moyennes et signaux extraits des bulletins
--   * eleve.simulation_voeu     — RAV et soutenabilité calculés
--   * eleve.ligne_budget        — le détail chiffré d'un budget
--   * les colonnes financières de eleve.profil_eleve
--
-- Pourquoi les garder écrites plutôt que les supprimer : la conception a été
-- faite, vérifiée, et ses contraintes portent des règles de CLAUDE.md qu'il
-- serait coûteux de re-dériver si la décision D1 était un jour rouverte.
--
-- Pourquoi ne pas les créer vides sur l'instance : une table vide est une
-- invitation à la remplir. Une table absente est une décision.
--
-- Voir DECISIONS.md — D1, D5.

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

