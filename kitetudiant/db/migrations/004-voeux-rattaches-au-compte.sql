-- 004 — une liste de vœux appartient à un COMPTE, pas à un profil
--
-- ── Ce que 002 supposait, et pourquoi c'était faux ──────────────────────────
--
-- 002 rattachait le panier à `eleve.profil_eleve`, lui-même porteur d'un
-- `mineur boolean NOT NULL` et d'une contrainte exigeant un consentement
-- parental horodaté dès que `mineur` vaut vrai.
--
-- Conséquence non voulue : impossible d'enregistrer le moindre vœu sans avoir
-- d'abord déclaré son âge ET, pour un mineur, produit un consentement
-- parental. Or presque tous nos utilisateurs sont mineurs, et la quasi-
-- totalité d'entre eux voudra enregistrer une liste avant d'avoir rempli quoi
-- que ce soit.
--
-- Le raisonnement juste : un compte existe déjà, une liste de vœux lui
-- appartient. Le profil déclaratif — année de naissance, bac, commune,
-- mobilité — est un enrichissement facultatif, et c'est LUI qui porte la
-- question du consentement, parce que c'est lui qui décrit une personne.
--
-- ── Ce que ça ne change pas ────────────────────────────────────────────────
--
-- Les vœux restent des données personnelles de mineurs. Ils sont purgés avec
-- le compte (ON DELETE CASCADE, et le compte a sa date de purge), et ils ne
-- contiennent toujours ni note, ni montant, ni appréciation.

BEGIN;

-- Garde-fou : cette migration ajoute une colonne NOT NULL sans valeur par
-- défaut, ce qui n'est possible que sur une table vide. Elle ne l'a jamais
-- été ailleurs qu'en intégration continue, mais on vérifie plutôt que de le
-- supposer — un échec ici est infiniment préférable à une base à moitié
-- migrée.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM eleve.panier) THEN
    RAISE EXCEPTION
      'eleve.panier n''est pas vide : cette migration suppose une table vierge. '
      'Écrire d''abord le remplissage de compte_id depuis profil_id.';
  END IF;
END
$$;

ALTER TABLE eleve.panier
  ADD COLUMN compte_id uuid NOT NULL REFERENCES eleve.compte (id) ON DELETE CASCADE;

-- Le profil devient facultatif sur un panier : on peut enregistrer des vœux
-- sans avoir rien déclaré de soi.
ALTER TABLE eleve.panier ALTER COLUMN profil_id DROP NOT NULL;

CREATE INDEX panier_compte_idx ON eleve.panier (compte_id);

-- Un compte, une liste. Plusieurs listes seraient un comparateur de
-- scénarios : une fonctionnalité à part, qui n'existe pas et qu'on
-- n'annoncera pas par une contrainte manquante.
CREATE UNIQUE INDEX panier_un_par_compte ON eleve.panier (compte_id);

COMMENT ON COLUMN eleve.panier.compte_id IS
  'Le propriétaire de la liste. Le profil déclaratif reste facultatif : on enregistre des vœux sans avoir rien dit de soi (migration 004).';

-- ══════════════════════════════════════════════ le profil peut être inconnu
--
-- `mineur NOT NULL` obligeait à trancher avant même d'avoir demandé. Répondre
-- « faux » par défaut serait inventer une réponse sur l'âge d'un enfant ;
-- répondre « vrai » exigerait un consentement qu'on n'a pas. « Pas encore
-- déclaré » est un troisième état, et c'est le vrai.
ALTER TABLE eleve.profil_eleve ALTER COLUMN mineur DROP NOT NULL;

-- La contrainte de consentement se réécrit en conséquence : elle ne s'applique
-- qu'à un mineur DÉCLARÉ. Un profil qui ne dit pas l'âge n'a rien à
-- consentir, puisqu'il ne dit rien.
ALTER TABLE eleve.profil_eleve DROP CONSTRAINT profil_consentement_si_mineur;
ALTER TABLE eleve.profil_eleve ADD CONSTRAINT profil_consentement_si_mineur CHECK (
  mineur IS NOT TRUE OR consentement_parental_le IS NOT NULL
);

COMMIT;
