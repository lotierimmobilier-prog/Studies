-- 005 — le code région tient sur trois caractères
--
-- ── Ce que le chargement réel a révélé ─────────────────────────────────────
--
-- `reference.commune.code_region` était déclaré `varchar(2)`. C'est vrai des
-- treize régions métropolitaines et des cinq DROM, dont les codes vont de 01
-- à 94. Ce n'est PAS vrai des collectivités : Saint-Pierre-et-Miquelon porte
-- 975, Saint-Barthélemy 977, Saint-Martin 978, la Nouvelle-Calédonie 988 et
-- ses subdivisions 984, 986, 989.
--
-- Treize communes sur 34 888 sont concernées. Le COPY échouait à la 679e
-- ligne et n'en chargeait aucune : une colonne trop étroite ne perd pas les
-- treize lignes fautives, elle perd tout.
--
-- ── Pourquoi les tests ne l'avaient pas vu ─────────────────────────────────
--
-- Les extraits de `verifier.py` reprennent des valeurs réelles, mais
-- métropolitaines et réunionnaises — toutes à deux chiffres. Un jeu d'essai
-- ne contient que ce qu'on a pensé à y mettre ; seules les vraies données
-- contiennent ce qu'on n'avait pas prévu.
--
-- C'est la deuxième fois que l'outre-mer trouve une limite de ce schéma : les
-- 99 formations sans code INSEE y sont aussi, pour l'essentiel.

BEGIN;

ALTER TABLE reference.commune ALTER COLUMN code_region TYPE varchar(3);

COMMENT ON COLUMN reference.commune.code_region IS
  'Trois caractères : les collectivités d''outre-mer ont des codes à trois chiffres (975, 977, 978, 984, 986, 989). Migration 005.';

COMMIT;
