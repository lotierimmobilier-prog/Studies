#!/usr/bin/env python3
"""Vérifie preparer.py sur des jeux miniatures, sans réseau ni base.

    python3 kitetudiant/scripts/import/verifier.py

Les vrais CSV pèsent des dizaines de mégaoctets et ne sont pas versionnés.
Ce script fabrique des extraits de quelques lignes, reprenant les valeurs
RÉELLES relevées dans docs/annexe-colonnes.md, et vérifie ce qui casserait
silencieusement un import :

  * l'ordre longitude/latitude — l'inverser place les écoles en Somalie sans
    qu'aucune contrainte ne proteste ;
  * « vide » qui deviendrait « zéro » ;
  * les arrondissements de Paris, Lyon et Marseille, sans lesquels 1 666
    formations perdent leur loyer ;
  * une borne de loyer incohérente, que la base refuserait ;
  * un nom de commune ambigu dans son département, qu'il ne faut pas trancher.
"""

from __future__ import annotations

import csv
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import preparer  # noqa: E402

GEOREF = [
    # code, nom, dep, reg, epci, type, point (lat, lon), année
    ("87085", "Limoges", "87", "75", "200066371", "commune", "45.83362, 1.26121", "2025"),
    ("75113", "Paris 13e Arrondissement", "75", "11", "200054781",
     "arrondissement municipal", "48.83151, 2.35528", "2025"),
    # Code EPCI illisible : il ferait échouer le COPY de la table entière.
    ("12202", "Rodez", "12", "76", "200043present", "commune", "44.35624, 2.56417", "2025"),
    # Deux « Sainte-Marie » dans le même département : la clé devient
    # inutilisable, et c'est le comportement voulu.
    ("97418", "Sainte-Marie", "974", "04", "249740093", "commune", "-20.89, 55.54", "2025"),
    ("97419", "Ste Marie", "974", "04", "249740093", "commune", "-20.90, 55.55", "2025"),
    # Sans centroïde : la colonne est NOT NULL, la ligne doit sortir.
    ("99999", "Sans Position", "99", "99", "", "commune", "", "2025"),
]

PARCOURSUP = [
    # cod_uai, nom, dep, ville, libellé, fili, sélection, cod_aff_form, gps, stats
    dict(cod_uai="0871234A", g_ea_lib_vx="Université de Limoges", dep="87",
         ville_etab="Limoges", lib_for_voe_ins="Licence - Droit",
         lib_comp_voe_ins="Faculté de droit", fili="Licence",
         select_form="formation non sélective", contrat_etab="Public",
         cod_aff_form="1001", g_olocalisation_des_formations="45.83362, 1.26121",
         lien_form_psup="https://dossierappel.parcoursup.fr/Candidats/public/fiches/afficherFicheFormation?g_ta_cod=4242",
         capa_fin="180", voe_tot="1065", nb_voe_pp="1065", prop_tot="620",
         acc_tot="180", acc_brs="42", acc_bg="150", acc_bt="20", acc_bp="10",
         taux_acces_ens="58", part_acces_gen="83", part_acces_tec="11",
         part_acces_pro="6", pct_bours="25.0"),
    # Même UAI, autre commune : établissement multi-sites, à compter.
    dict(cod_uai="0871234A", g_ea_lib_vx="Université de Limoges", dep="12",
         ville_etab="Rodez", lib_for_voe_ins="Licence - Lettres",
         lib_comp_voe_ins="", fili="Licence", select_form="formation sélective",
         contrat_etab="Public", cod_aff_form="1002",
         g_olocalisation_des_formations="44.35624, 2.56417", lien_form_psup="",
         # Capacité absente : ne doit PAS devenir zéro.
         capa_fin="", voe_tot="300", nb_voe_pp="300", prop_tot="",
         acc_tot="0", acc_brs="", acc_bg="", acc_bt="", acc_bp="",
         taux_acces_ens="", part_acces_gen="", part_acces_tec="",
         part_acces_pro="", pct_bours=""),
    # Arrondissement : le loyer n'existe que sous 75113, jamais sous 75056.
    dict(cod_uai="0751234B", g_ea_lib_vx="Sorbonne", dep="75",
         ville_etab="Paris 13e Arrondissement", lib_for_voe_ins="CPGE - MPSI",
         lib_comp_voe_ins="", fili="CPGE", select_form="formation sélective",
         contrat_etab="Privé sous contrat d'association", cod_aff_form="1003",
         g_olocalisation_des_formations="48.83151, 2.35528", lien_form_psup="",
         capa_fin="48", voe_tot="900", nb_voe_pp="900", prop_tot="120",
         acc_tot="48", acc_brs="5", acc_bg="48", acc_bt="0", acc_bp="0",
         taux_acces_ens="7", part_acces_gen="100", part_acces_tec="0",
         part_acces_pro="0", pct_bours="10.0"),
    # Commune introuvable : doit sortir sans code INSEE, pas avec un code faux.
    dict(cod_uai="0991234C", g_ea_lib_vx="Lycée d'ailleurs", dep="99",
         ville_etab="Ville Inconnue", lib_for_voe_ins="BTS - Commerce",
         lib_comp_voe_ins="", fili="BTS", select_form="formation sélective",
         contrat_etab="Privé hors contrat", cod_aff_form="1004",
         g_olocalisation_des_formations="", lien_form_psup="",
         capa_fin="30", voe_tot="90", nb_voe_pp="90", prop_tot="45",
         acc_tot="30", acc_brs="3", acc_bg="10", acc_bt="15", acc_bp="5",
         taux_acces_ens="33", part_acces_gen="33", part_acces_tec="50",
         part_acces_pro="17", pct_bours="10.0"),
]

LOYERS = [
    ("2025", "appartement T2", "87085", "Limoges", "commune", "8.5", "7.1", "10.2", "412", "0.59"),
    ("2025", "appartement T1", "87085", "Limoges", "commune", "11.2", "9.4", "13.0", "180", "0.61"),
    ("2025", "appartement T2", "75113", "Paris 13e", "commune", "28.4", "24.1", "33.6", "3200", "0.72"),
    # Bornes incohérentes : la base refuserait, l'import doit écarter et compter.
    ("2025", "maison", "12202", "Rodez", "maille", "7.0", "9.0", "8.0", "3", "0.31"),
    # Maille inconnue : on ne la range pas au hasard dans l'énumération.
    ("2025", "appartement T2", "12202", "Rodez", "quartier", "7.9", "6.4", "9.8", "12", "0.5"),
]


def _ecrire_csv(chemin: Path, entetes: list[str], lignes: list[dict]) -> None:
    with chemin.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=entetes, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for l in lignes:
            w.writerow(l)


def _lire_sortie(nom: str) -> list[dict]:
    with (preparer.SORTIE / f"{nom}.csv").open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        preparer.BRUT = base / "brut"
        preparer.SORTIE = base / "import"
        preparer.RACINE = base
        preparer.BRUT.mkdir()

        _ecrire_csv(
            preparer.BRUT / "georef_communes.csv",
            ["com_code", "com_name", "dep_code", "reg_code", "epci_code",
             "com_type", "geo_point_2d", "year"],
            [dict(zip(["com_code", "com_name", "dep_code", "reg_code", "epci_code",
                       "com_type", "geo_point_2d", "year"], g)) for g in GEOREF],
        )
        _ecrire_csv(
            preparer.BRUT / f"{preparer.CLE_PARCOURSUP}.csv",
            list(PARCOURSUP[0].keys()), PARCOURSUP,
        )
        _ecrire_csv(
            preparer.BRUT / "loyers_communes.csv",
            ["year", "type_logement", "insee_c", "libgeo", "typpred",
             "loypredm2", "lwr_ipm2", "upr_ipm2", "nbobs_com", "r2_adj"],
            [dict(zip(["year", "type_logement", "insee_c", "libgeo", "typpred",
                       "loypredm2", "lwr_ipm2", "upr_ipm2", "nbobs_com", "r2_adj"], l))
             for l in LOYERS],
        )

        manifeste = {
            cle: {"titre": f"jeu {cle}", "portail": "test", "dataset_id": cle,
                  "collecte_utc": "2026-09-20T06:00:00+00:00"}
            for cle in ("georef_communes", preparer.CLE_PARCOURSUP, "loyers_communes")
        }
        (preparer.BRUT / "manifeste.json").write_text(json.dumps(manifeste))

        rapport: dict = {}
        index = preparer.preparer_communes(manifeste, rapport)
        preparer.preparer_parcoursup(manifeste, index, rapport)
        preparer.preparer_loyers(manifeste, rapport)

        echecs: list[str] = []
        faites = 0

        def verifier(condition: bool, message: str) -> None:
            nonlocal faites
            faites += 1
            if not condition:
                echecs.append(message)

        # ── communes ────────────────────────────────────────────────────
        communes = _lire_sortie("commune")
        verifier(len(communes) == 5,
                 f"5 communes attendues (la sixième n'a pas de centroïde), {len(communes)} trouvées")
        limoges = next(c for c in communes if c["code_insee"] == "87085")
        verifier(limoges["centroide"] == "SRID=4326;POINT(1.26121 45.83362)",
                 f"longitude d'abord attendue, trouvé {limoges['centroide']}")
        paris = next(c for c in communes if c["code_insee"] == "75113")
        verifier(paris["est_arrondissement"] == "true",
                 "Paris 13e doit être marqué arrondissement")
        verifier(limoges["est_arrondissement"] == "false",
                 "Limoges ne doit pas être marqué arrondissement")
        verifier(limoges["contour"] == "",
                 "le contour n'est pas collecté : il doit rester vide, pas inventé")
        rodez = next(c for c in communes if c["code_insee"] == "12202")
        verifier(rodez["code_epci"] == "",
                 "un code EPCI illisible doit sortir vide, pas faire échouer le COPY")
        verifier(rapport["commune"]["codes_epci_illisibles"] == 1,
                 "un code EPCI illisible doit être compté au rapport")
        verifier(rapport["commune"]["ecartees_sans_centroide"] == 1,
                 "la commune sans centroïde doit être comptée")
        verifier(rapport["commune"]["noms_ambigus_dans_leur_departement"] == 1,
                 "« Sainte-Marie » / « Ste Marie » doivent être détectés ambigus")
        verifier(("sainte marie", "974") not in index,
                 "un nom ambigu ne doit PAS rester dans l'index")

        # ── Parcoursup ──────────────────────────────────────────────────
        formations = _lire_sortie("formation")
        verifier(len(formations) == 4, f"4 formations attendues, {len(formations)}")
        par_code = {f["cod_aff_form"]: f for f in formations}

        verifier(par_code["1001"]["code_insee"] == "87085",
                 "Limoges doit se résoudre par nom + département")
        verifier(par_code["1003"]["code_insee"] == "75113",
                 "Paris 13e doit se résoudre en arrondissement, pas en 75056")
        verifier(par_code["1004"]["code_insee"] == "",
                 "une commune introuvable doit sortir sans code, jamais avec un code de repli")
        verifier(par_code["1001"]["g_ta_cod"] == "4242",
                 f"g_ta_cod mal extrait : {par_code['1001']['g_ta_cod']}")
        verifier(par_code["1002"]["g_ta_cod"] == "",
                 "sans lien de fiche, g_ta_cod doit rester vide")
        verifier(par_code["1001"]["selective"] == "false",
                 "« formation non sélective » doit donner selective=false")
        verifier(par_code["1002"]["selective"] == "true",
                 "« formation sélective » doit donner selective=true")
        verifier(par_code["1004"]["position"] == "",
                 "sans coordonnées, la position doit rester vide")

        etablissements = _lire_sortie("etablissement")
        verifier(len(etablissements) == 3,
                 f"3 établissements attendus (un UAI apparaît deux fois), {len(etablissements)}")
        u = next(e for e in etablissements if e["uai"] == "0871234A")
        verifier(u["code_insee_methode"] == "nom_departement",
                 "la méthode de rattachement fait partie de la donnée")
        verifier(rapport["parcoursup"]["etablissements_multi_communes"] == 1,
                 "l'UAI présent dans deux communes doit être compté")
        verifier(sorted(s["statut"] for s in etablissements) == sorted(
            ["Public", "Privé sous contrat d'association", "Privé hors contrat"]),
            "le statut publié doit être recopié tel quel")

        stats = {s["cod_aff_form"]: s for s in _lire_sortie("stat_admission")}
        verifier(stats["1002"]["capacite"] == "",
                 "une capacité absente doit rester vide, JAMAIS devenir zéro")
        verifier(stats["1002"]["admis_total"] == "0",
                 "un zéro publié doit rester un zéro")
        verifier(stats["1001"]["pct_boursiers_arrondi"] == "25",
                 f"pct_bours mal lu : {stats['1001']['pct_boursiers_arrondi']}")

        verifier(rapport["parcoursup"]["insee_resolu"] == 3,
                 f"3 formations rattachées attendues, {rapport['parcoursup']['insee_resolu']}")
        verifier(rapport["parcoursup"]["methodes"].get("arrondissement") == 1,
                 "la méthode « arrondissement » doit apparaître au rapport")

        # ── loyers ──────────────────────────────────────────────────────
        loyers = _lire_sortie("indicateur_logement")
        verifier(len(loyers) == 3, f"3 lignes de loyer attendues, {len(loyers)}")
        verifier(rapport["loyers"]["bornes_incoherentes_ecartees"] == 1,
                 "une borne basse supérieure au loyer doit être écartée, pas corrigée")
        verifier(rapport["loyers"]["mailles_inconnues"] == {"quartier": 1},
                 "une maille hors énumération doit être signalée, pas rangée au hasard")
        verifier(sorted(rapport["loyers"]["typologies"]) ==
                 ["appartement T1", "appartement T2"],
                 "les typologies publiées doivent être conservées toutes")

        if echecs:
            print("ÉCHECS :", file=sys.stderr)
            for e in echecs:
                print(f"  - {e}", file=sys.stderr)
            return 1

        print(f"verifier.py : {faites} vérifications passées.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
