-- 002 — comptes, profils déclaratifs, listes de vœux
--
-- Applique la décision D1 : le serveur garde ce qui identifie un CHOIX,
-- jamais ce qui décrit une PERSONNE.
--
-- Ce qui entre ici :        compte, session, profil déclaratif, panier de vœux.
-- Ce qui n'y entre jamais : moyennes, appréciations, bulletins, spécialités,
--                           bourse, contribution familiale, train de vie, RAV.
--
-- Ces derniers restent dans le navigateur de l'élève et n'ont pas de table.
-- Leur conception figure dans db/hors-perimetre.sql, non appliquée.

BEGIN;

-- ═══════════════════════════════════════════════════════════════ les comptes
--
-- Reprend exactement le modèle de chiffrement de server/comptes.ts, qui
-- fonctionne en production depuis l'origine. Rien n'y est affaibli par le
-- passage en base ; une chose y est renforcée (voir session_compte).
--
-- L'adresse e-mail n'est jamais en clair. Deux colonnes, deux rôles :
--
--   * email_chiffre / email_nonce : AES-256-GCM, clé dérivée par scrypt de
--     COMPTES_MASTER_KEY. C'est ce qui permet de RÉÉCRIRE l'adresse (envoyer
--     un message, répondre à une demande d'accès RGPD).
--   * email_empreinte : empreinte scrypt séparée, avec un autre sel dérivé.
--     C'est ce qui permet de RETROUVER un compte à la connexion sans
--     déchiffrer la table entière.
--
-- Une copie de cette table sans la clé maîtresse ne révèle aucune adresse, et
-- ne permet même pas de tester si une adresse donnée s'y trouve : l'empreinte
-- est clavetée, pas un simple hachage.

CREATE TYPE eleve.fournisseur_identite AS ENUM ('local', 'google');

CREATE TABLE eleve.compte (
  id                     uuid        PRIMARY KEY,
  -- Clavetée par COMPTES_MASTER_KEY : sans la clé, on ne peut pas la calculer.
  email_empreinte        text        NOT NULL UNIQUE,
  email_chiffre          bytea       NOT NULL,
  email_nonce            bytea       NOT NULL,
  fournisseur            eleve.fournisseur_identite NOT NULL DEFAULT 'local',
  sel_mot_de_passe       text,
  empreinte_mot_de_passe text,
  cree_le                timestamptz NOT NULL DEFAULT now(),
  vu_le                  timestamptz NOT NULL DEFAULT now(),
  -- Purge à trois ans d'inactivité, comme aujourd'hui. La date est STOCKÉE
  -- et non recalculée : un changement de règle ne doit pas effacer
  -- rétroactivement des comptes que l'ancienne règle conservait.
  purge_prevue_le        date        NOT NULL,
  -- Un compte local sans mot de passe serait un compte sur lequel personne ne
  -- peut se connecter, ou pire, sur lequel tout le monde le peut.
  CONSTRAINT compte_local_a_un_mot_de_passe CHECK (
    fournisseur <> 'local'
    OR (sel_mot_de_passe IS NOT NULL AND empreinte_mot_de_passe IS NOT NULL)
  ),
  CONSTRAINT compte_nonce_gcm CHECK (octet_length(email_nonce) = 12)
);

COMMENT ON TABLE eleve.compte IS
  'Une adresse chiffrée et des dates. Ni nom, ni adresse postale, ni téléphone, ni date de naissance complète.';
COMMENT ON COLUMN eleve.compte.email_empreinte IS
  'Empreinte scrypt clavetée par COMPTES_MASTER_KEY. Permet de retrouver un compte sans déchiffrer la table.';

CREATE INDEX compte_purge_idx ON eleve.compte (purge_prevue_le);

-- Le jeton de session n'est PAS stocké : seule son empreinte SHA-256 l'est.
-- C'est un renforcement par rapport au fichier actuel, qui garde le jeton en
-- clair. Une copie de cette table ne permet donc d'usurper aucune session.
CREATE TABLE eleve.session_compte (
  empreinte_jeton        text        PRIMARY KEY,
  compte_id              uuid        NOT NULL REFERENCES eleve.compte (id) ON DELETE CASCADE,
  cree_le                timestamptz NOT NULL DEFAULT now(),
  expire_le              timestamptz NOT NULL,
  CONSTRAINT session_expire_apres_creation CHECK (expire_le > cree_le)
);
CREATE INDEX session_compte_idx ON eleve.session_compte (compte_id);
CREATE INDEX session_expire_idx ON eleve.session_compte (expire_le);

COMMENT ON COLUMN eleve.session_compte.empreinte_jeton IS
  'SHA-256 du jeton. Le jeton lui-même ne quitte jamais le navigateur de l''élève.';

-- ══════════════════════════════════════════════════ le profil DÉCLARATIF
--
-- Sous-ensemble de eleve.profil_eleve tel que db/schema.sql le conçoit. Les
-- colonnes financières — contribution familiale, bourse estimée, job étudiant,
-- courses, frais divers — ne sont PAS créées : décision D1. La situation
-- financière d'une famille est au moins aussi sensible qu'un bulletin, et rien
-- ne l'oblige à quitter l'appareil puisque le RAV se calcule dans le
-- navigateur.

CREATE TYPE eleve.type_bac AS ENUM ('general', 'technologique', 'professionnel', 'autre');

CREATE TABLE eleve.profil_eleve (
  id                       uuid        PRIMARY KEY,
  -- Un compte, un profil. La contrainte d'unicité l'impose plutôt que de s'en
  -- remettre à l'application.
  compte_id                uuid        NOT NULL UNIQUE REFERENCES eleve.compte (id) ON DELETE CASCADE,
  -- L'année seule : suffisante pour établir la minorité, insuffisante pour
  -- identifier quelqu'un.
  annee_naissance          smallint,
  mineur                   boolean     NOT NULL,
  consentement_parental_le timestamptz,
  code_insee_domicile      char(5),
  type_bac                 eleve.type_bac,
  -- Distance maximale acceptée, en kilomètres. NULL veut dire « pas de
  -- limite déclarée », et surtout pas « zéro ».
  mobilite_km_max          smallint,
  cree_le                  timestamptz NOT NULL DEFAULT now(),
  maj_le                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profil_consentement_si_mineur CHECK (
    NOT mineur OR consentement_parental_le IS NOT NULL
  ),
  CONSTRAINT profil_annee_naissance_plausible CHECK (
    annee_naissance IS NULL OR annee_naissance BETWEEN 1990 AND 2030
  ),
  CONSTRAINT profil_mobilite_positive CHECK (
    mobilite_km_max IS NULL OR mobilite_km_max > 0
  )
);

COMMENT ON TABLE eleve.profil_eleve IS
  'Profil DÉCLARATIF seulement. Aucune note, aucun montant, aucune appréciation : décision D1.';

-- ═══════════════════════════════════════════════════════ les listes de vœux

CREATE TABLE eleve.panier (
  id                    uuid         PRIMARY KEY,
  profil_id             uuid         NOT NULL REFERENCES eleve.profil_eleve (id) ON DELETE CASCADE,
  nom                   text,
  cree_le               timestamptz  NOT NULL DEFAULT now(),
  maj_le                timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX panier_profil_idx ON eleve.panier (profil_id);

-- budget_familial_mensuel, présent dans db/schema.sql, n'est pas repris :
-- c'est un montant qui décrit une famille. Décision D1.

CREATE TYPE eleve.classe_risque AS ENUM ('ambitieux', 'median', 'sur', 'filet');

CREATE TABLE eleve.panier_voeu (
  panier_id             uuid         NOT NULL REFERENCES eleve.panier (id) ON DELETE CASCADE,
  rang                  smallint     NOT NULL,
  cod_aff_form          text         NOT NULL,
  session               smallint     NOT NULL,
  classe_risque         eleve.classe_risque,
  -- Un vœu peut être signalé, jamais retiré : cette colonne dit POURQUOI il
  -- est signalé, elle ne le sort pas du panier (règle 4 de CLAUDE.md). Aucune
  -- colonne de ce schéma ne permet à un calcul de supprimer un vœu.
  signalement           text,
  ajoute_le             timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (panier_id, rang),
  UNIQUE (panier_id, cod_aff_form, session),
  FOREIGN KEY (cod_aff_form, session) REFERENCES reference.formation (cod_aff_form, session),
  CONSTRAINT panier_voeu_rang_parcoursup CHECK (rang BETWEEN 1 AND 10)
);
CREATE INDEX panier_voeu_formation_idx ON eleve.panier_voeu (cod_aff_form, session);

COMMENT ON COLUMN eleve.panier_voeu.signalement IS
  'Signale un vœu, ne le supprime pas. Règle 4 de CLAUDE.md, tenue par le schéma.';

-- Le RAV n'est PAS stocké à côté du vœu : il se calcule dans le navigateur à
-- partir de données qui ne montent pas. La fiche d'un vœu enregistré affiche
-- donc son RAV quand le profil budgétaire est présent sur l'appareil, et dit
-- pourquoi quand il ne l'est pas. Recalculer un montant côté serveur avec des
-- hypothèses inventées est interdit par la règle 1.

COMMIT;
