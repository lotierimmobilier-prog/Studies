-- 003 — le contour des communes devient facultatif
--
-- reference.commune.contour est NOT NULL dans le document de conception. Or
-- l'export que nous collectons réellement — georef-france-commune, avec la
-- sélection de colonnes de scripts/exploration/sources.py — ne contient PAS
-- les polygones : seulement le centroïde.
--
-- Deux façons de régler ça, et une seule est honnête :
--
--   * collecter les 34 888 polygones pour remplir une colonne dont rien ne se
--     sert. Le rapport de jointure le montre : sur 14 252 formations, aucune
--     n'est rattachée par la méthode « polygone ». 12 487 le sont par nom +
--     département, 1 666 par arrondissement municipal.
--   * rendre la colonne facultative et le dire.
--
-- La colonne n'est pas supprimée : la méthode « polygone » reste prévue par
-- la contrainte etablissement_methode_connue, et le jour où elle servira, le
-- polygone se chargera sans changer le schéma.
--
-- Le centroïde, lui, reste NOT NULL : une commune qu'on ne sait pas placer sur
-- une carte n'a pas sa place dans une table de référence géographique.

BEGIN;

ALTER TABLE reference.commune ALTER COLUMN contour DROP NOT NULL;

COMMENT ON COLUMN reference.commune.contour IS
  'Facultatif : l''export collecté ne porte que le centroïde, et aucune jointure n''utilise le polygone (migration 003).';

COMMIT;
