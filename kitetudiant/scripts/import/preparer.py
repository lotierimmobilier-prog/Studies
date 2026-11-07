#!/usr/bin/env python3
"""Prépare les CSV bruts pour le chargement en base.

    python3 kitetudiant/scripts/import/preparer.py

Lit `data/brut/*.csv` (posés par scripts/exploration/telecharger.py) et écrit
`data/import/*.csv`, un fichier par table cible, colonnes dans l'ordre exact
du DDL. Le chargement lui-même est fait par `charger.sh`, en `\\copy`.

── Pourquoi deux étapes plutôt qu'un script qui écrit en base ───────────────

Parce qu'un import qui transforme et écrit en même temps ne se relit pas. Ici
le fichier intermédiaire est inspectable : on peut le diffuser, le comparer
d'une campagne à l'autre, et voir ce qui a changé avant de toucher la base.

Et parce que `\\copy` n'exige aucun pilote : ni Python ni Node n'ont besoin
d'une dépendance nouvelle pour charger. C'est ce qui permet d'importer sans
attendre l'arbitrage Q1.

── Ce que ce script refuse de faire ────────────────────────────────────────

Inventer. Une commune qu'il n'arrive pas à rattacher sort avec un code INSEE
vide et compte dans le rapport ; elle ne reçoit pas le code du chef-lieu
« pour que ça passe ». Un entier absent reste vide et ne devient pas zéro :
« zéro admis » et « on ne sait pas combien » sont deux informations
différentes, et la seconde ne doit jamais se faire passer pour la première.

Voir docs/import-correspondances.md pour la table colonne à colonne.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from normalisation import (  # noqa: E402
    code_arrondissement,
    decimal,
    departement,
    entier,
    normaliser,
    point,
)

RACINE = Path(__file__).resolve().parents[2]
BRUT = RACINE / "data" / "brut"
SORTIE = RACINE / "data" / "import"

# Session Parcoursup importée. Une campagne = un millésime ; on n'écrase jamais
# un millésime publié, on en insère un nouveau.
SESSION = 2025
CLE_PARCOURSUP = f"parcoursup_{SESSION}"

csv.field_size_limit(1 << 24)


def _manifeste() -> dict:
    fichier = BRUT / "manifeste.json"
    if not fichier.exists():
        raise SystemExit(
            "data/brut/manifeste.json est absent : lance d'abord "
            "scripts/exploration/telecharger.py"
        )
    return json.loads(fichier.read_text(encoding="utf-8"))


def _lire(cle: str):
    """Itère les lignes d'un CSV brut en dictionnaires."""
    fichier = BRUT / f"{cle}.csv"
    if not fichier.exists():
        raise SystemExit(f"{fichier} est absent : lance d'abord telecharger.py --cle {cle}")
    with fichier.open(encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f, delimiter=";")


def _ecrire(nom: str, colonnes: list[str], lignes: list[dict]) -> Path:
    """Écrit un CSV prêt pour \\copy : en-tête, virgule, guillemets minimaux.

    `None` devient une chaîne vide, que `\\copy … (FORMAT csv, NULL '')`
    relira comme NULL. C'est ce qui permet de distinguer « vide » de « zéro »
    jusque dans la base.
    """
    SORTIE.mkdir(parents=True, exist_ok=True)
    chemin = SORTIE / f"{nom}.csv"
    with chemin.open("w", encoding="utf-8", newline="") as f:
        ecrivain = csv.DictWriter(f, fieldnames=colonnes, extrasaction="raise")
        ecrivain.writeheader()
        for ligne in lignes:
            ecrivain.writerow({c: "" if ligne.get(c) is None else ligne[c] for c in colonnes})
    return chemin


def _wkt(coordonnees: tuple[float, float] | None) -> str | None:
    """POINT en WKT, longitude d'abord comme PostGIS l'attend."""
    if coordonnees is None:
        return None
    return f"SRID=4326;POINT({coordonnees[0]} {coordonnees[1]})"


# ══════════════════════════════════════════════════════════════════ communes


def preparer_communes(manifeste: dict, rapport: dict) -> dict[tuple[str, str], str]:
    """`reference.commune` ← georef_communes.

    Rend aussi l'index (nom normalisé, département) → code INSEE, dont tout le
    reste de l'import dépend pour rattacher une formation à un loyer.
    """
    source = manifeste["georef_communes"]
    collecte = source["collecte_utc"][:10]
    mention = f"{source['titre']} ({source['portail']}, {source['dataset_id']})"
    millesime = None

    lignes: list[dict] = []
    index: dict[tuple[str, str], str] = {}
    ambigus: dict[tuple[str, str], int] = defaultdict(int)
    sans_position = 0
    epci_illisibles = 0

    for ligne in _lire("georef_communes"):
        code = (ligne.get("com_code") or "").strip()
        nom = (ligne.get("com_name") or "").strip()
        dep = departement(ligne.get("dep_code"))
        if len(code) != 5 or nom == "" or dep is None:
            continue
        if millesime is None:
            millesime = entier((ligne.get("year") or "")[:4])
        # Le code EPCI tient sur neuf caractères. Une valeur plus longue ferait
        # échouer le COPY de la table ENTIÈRE sur une seule cellule : on la
        # traite comme manquante — ce qu'elle est — et on la compte.
        epci = (ligne.get("epci_code") or "").strip()
        if len(epci) > 9 or not epci.isdigit():
            if epci != "":
                epci_illisibles += 1
            epci = ""

        centroide = point(ligne.get("geo_point_2d"))
        if centroide is None:
            # Le centroïde est NOT NULL : une commune sans position ne peut pas
            # entrer. Elle est comptée, pas inventée.
            sans_position += 1
            continue
        lignes.append(
            {
                "code_insee": code,
                "millesime": millesime,
                "nom": nom,
                "code_departement": dep,
                "code_region": (ligne.get("reg_code") or "").strip() or None,
                "code_epci": epci or None,
                # Le référentiel distingue « commune » d'« arrondissement
                # municipal » : on garde sa réponse plutôt que de la déduire
                # du code, qui se devine mal pour Lyon.
                "est_arrondissement": "true"
                if "arrondissement" in (ligne.get("com_type") or "").lower()
                else "false",
                "contour": None,
                "centroide": _wkt(centroide),
                "collecte_le": collecte,
                "source": mention,
            }
        )
        cle = (normaliser(nom), dep)
        if cle[0] is None:
            continue
        if cle in index and index[cle] != code:
            # Deux communes du même département portent le même nom normalisé.
            # On ne tranche pas : la clé devient inutilisable, et le rapport
            # le dit. Choisir au hasard fabriquerait un loyer faux.
            ambigus[cle] += 1
            index.pop(cle, None)
        elif cle not in ambigus:
            index[cle] = code

    chemin = _ecrire(
        "commune",
        [
            "code_insee",
            "millesime",
            "nom",
            "code_departement",
            "code_region",
            "code_epci",
            "est_arrondissement",
            "contour",
            "centroide",
            "collecte_le",
            "source",
        ],
        lignes,
    )
    rapport["commune"] = {
        "lignes": len(lignes),
        "millesime": millesime,
        "index_utilisable": len(index),
        "noms_ambigus_dans_leur_departement": len(ambigus),
        "ecartees_sans_centroide": sans_position,
        "codes_epci_illisibles": epci_illisibles,
        "fichier": str(chemin.relative_to(RACINE)),
    }
    return index


def resoudre_insee(
    ville: object, dep: object, index: dict[tuple[str, str], str]
) -> tuple[str | None, str | None]:
    """Code INSEE d'une commune Parcoursup, et LA MÉTHODE employée.

    La méthode fait partie de la donnée : `etablissement.code_insee_methode`
    porte une contrainte qui l'exige. Une jointure sur libellé qui ne s'avoue
    pas est une dette silencieuse.
    """
    nom = normaliser(ville)
    code_dep = departement(dep)
    if nom is None:
        return (None, None)
    arrondissement = code_arrondissement(nom)
    if arrondissement is not None:
        return (arrondissement, "arrondissement")
    if code_dep is None:
        return (None, None)
    trouve = index.get((nom, code_dep))
    if trouve is not None:
        return (trouve, "nom_departement")
    return (None, None)


# ════════════════════════════════════════════ établissements et formations

# Les quatre statuts publiés par Parcoursup, relevés sur le jeu réel :
# Public (11 108), Privé sous contrat d'association (1 938), Privé
# enseignement supérieur (1 101), Privé hors contrat (105). On recopie le
# libellé publié, on ne le range pas dans une catégorie de notre invention.

def preparer_parcoursup(
    manifeste: dict, index: dict[tuple[str, str], str], rapport: dict
) -> None:
    """`reference.etablissement`, `reference.formation`, `reference.stat_admission`."""
    source = manifeste[CLE_PARCOURSUP]
    collecte = source["collecte_utc"][:10]
    mention = f"{source['titre']} ({source['portail']}, {source['dataset_id']})"

    etablissements: dict[str, dict] = {}
    formations: list[dict] = []
    stats: list[dict] = []
    vus: set[str] = set()

    methodes: dict[str, int] = defaultdict(int)
    doublons = 0
    sans_position = 0
    etab_discordants = 0

    for ligne in _lire(CLE_PARCOURSUP):
        uai = (ligne.get("cod_uai") or "").strip()
        cod_aff = (ligne.get("cod_aff_form") or "").strip()
        if len(uai) != 8 or cod_aff == "":
            continue
        if cod_aff in vus:
            # La clé pivot est unique dans le jeu (14 252 valeurs pour 14 252
            # lignes, vérifié). Un doublon signalerait un changement de format
            # du jeu, pas un cas à traiter en douce.
            doublons += 1
            continue
        vus.add(cod_aff)

        insee, methode = resoudre_insee(ligne.get("ville_etab"), ligne.get("dep"), index)
        methodes[methode or "non_resolu"] += 1
        position = point(ligne.get("g_olocalisation_des_formations"))
        if position is None:
            sans_position += 1

        if uai not in etablissements:
            etablissements[uai] = {
                "uai": uai,
                "millesime": SESSION,
                "nom": (ligne.get("g_ea_lib_vx") or "").strip() or uai,
                "statut": (ligne.get("contrat_etab") or "").strip() or "non renseigné",
                "code_insee": insee,
                "code_insee_methode": methode,
                "position": _wkt(position),
                "collecte_le": collecte,
                "source": mention,
            }
        elif insee is not None and etablissements[uai]["code_insee"] not in (None, insee):
            # Deux formations du même UAI annoncent deux communes. On garde la
            # première et on compte : un établissement multi-sites existe, et
            # c'est à la formation de porter sa commune, pas à l'établissement.
            etab_discordants += 1

        formations.append(
            {
                "cod_aff_form": cod_aff,
                "session": SESSION,
                "uai": uai,
                # Le code de groupe se lit dans l'URL de fiche ; c'est le pont
                # vers la cartographie (colonne `gta`).
                "g_ta_cod": _gta(ligne.get("lien_form_psup")),
                "filiere": (ligne.get("fili") or "").strip() or "non renseignée",
                "libelle": (ligne.get("lib_for_voe_ins") or "").strip() or cod_aff,
                "libelle_detaille": (ligne.get("lib_comp_voe_ins") or "").strip() or None,
                # Deux valeurs seulement dans le jeu : « formation sélective »
                # et « formation non sélective ».
                "selective": "false"
                if (ligne.get("select_form") or "").strip() == "formation non sélective"
                else "true",
                # L'apprentissage et l'internat ne se déduisent PAS de ce jeu :
                # `nb_voe_pp_internat` manque à 93 % et ne dit rien de l'offre.
                # Ces deux colonnes restent à leur défaut et seront remplies
                # depuis la cartographie, qui les publie (`app`, `int`).
                "apprentissage": "false",
                "internat": "false",
                "assujettie_cvec": "true",
                "position": _wkt(position),
                "code_insee": insee,
                "lien_fiche": (ligne.get("lien_form_psup") or "").strip() or None,
                "collecte_le": collecte,
                "source": mention,
            }
        )

        stats.append(
            {
                "cod_aff_form": cod_aff,
                "session": SESSION,
                "capacite": entier(ligne.get("capa_fin")),
                "voeux_total": entier(ligne.get("voe_tot")),
                "voeux_phase_principale": entier(ligne.get("nb_voe_pp")),
                "propositions_total": entier(ligne.get("prop_tot")),
                "admis_total": entier(ligne.get("acc_tot")),
                "admis_boursiers": entier(ligne.get("acc_brs")),
                "admis_bac_general": entier(ligne.get("acc_bg")),
                "admis_bac_techno": entier(ligne.get("acc_bt")),
                "admis_bac_pro": entier(ligne.get("acc_bp")),
                "taux_acces": entier(ligne.get("taux_acces_ens")),
                "part_acces_general": entier(ligne.get("part_acces_gen")),
                "part_acces_techno": entier(ligne.get("part_acces_tec")),
                "part_acces_pro": entier(ligne.get("part_acces_pro")),
                # Les colonnes pct_* du jeu sont arrondies au multiple de 5.
                # On la garde pour l'afficher, jamais pour reconstruire un
                # effectif : 10 % de 37 admis ne fait pas un nombre d'élèves.
                "pct_boursiers_arrondi": entier(decimal(ligne.get("pct_bours"))),
                "collecte_le": collecte,
                "source": mention,
            }
        )

    _ecrire(
        "etablissement",
        [
            "uai", "millesime", "nom", "statut", "code_insee", "code_insee_methode",
            "position", "collecte_le", "source",
        ],
        list(etablissements.values()),
    )
    _ecrire(
        "formation",
        [
            "cod_aff_form", "session", "uai", "g_ta_cod", "filiere", "libelle",
            "libelle_detaille", "selective", "apprentissage", "internat",
            "assujettie_cvec", "position", "code_insee", "lien_fiche",
            "collecte_le", "source",
        ],
        formations,
    )
    _ecrire(
        "stat_admission",
        [
            "cod_aff_form", "session", "capacite", "voeux_total",
            "voeux_phase_principale", "propositions_total", "admis_total",
            "admis_boursiers", "admis_bac_general", "admis_bac_techno",
            "admis_bac_pro", "taux_acces", "part_acces_general",
            "part_acces_techno", "part_acces_pro", "pct_boursiers_arrondi",
            "collecte_le", "source",
        ],
        stats,
    )

    total = len(formations)
    resolues = total - methodes["non_resolu"]
    rapport["parcoursup"] = {
        "session": SESSION,
        "formations": total,
        "etablissements": len(etablissements),
        "insee_resolu": resolues,
        "insee_resolu_pct": round(100 * resolues / total, 2) if total else 0,
        "methodes": dict(methodes),
        "sans_coordonnees": sans_position,
        "etablissements_multi_communes": etab_discordants,
        "doublons_cod_aff_form": doublons,
    }


def _gta(lien: object) -> str | None:
    """Code de groupe lu dans l'URL de fiche Parcoursup (`…&g_ta_cod=1234`)."""
    if lien is None:
        return None
    brut = str(lien)
    marqueur = "g_ta_cod="
    i = brut.find(marqueur)
    if i < 0:
        return None
    reste = brut[i + len(marqueur):]
    code = ""
    for c in reste:
        if not c.isdigit():
            break
        code += c
    return code or None


# ═══════════════════════════════════════════════════════════════════ loyers


def preparer_loyers(manifeste: dict, rapport: dict) -> None:
    """`reference.indicateur_logement` ← loyers_communes.

    Le jeu publie quatre typologies. On les garde TOUTES : le choix de celle
    qui sert au RAV appartient au calcul, pas à l'import. Un import qui filtre
    décide à la place du moteur, et on ne s'en aperçoit que des mois plus tard.
    """
    source = manifeste["loyers_communes"]
    collecte = source["collecte_utc"][:10]
    mention = (
        "Indicateur des loyers par commune (DGALN / ANIL), loyer d'annonce mensuel "
        "au m², charges comprises, bien loué vide, publié à titre expérimental"
    )

    mailles = {"commune": "commune", "maille": "maille", "epci": "EPCI"}
    lignes: list[dict] = []
    vus: set[tuple[str, int, str]] = set()
    bornes_incoherentes = 0
    maille_inconnue: dict[str, int] = defaultdict(int)

    for ligne in _lire("loyers_communes"):
        code = (ligne.get("insee_c") or "").strip()
        millesime = entier(ligne.get("year"))
        typologie = (ligne.get("type_logement") or "").strip()
        loyer = decimal(ligne.get("loypredm2"))
        bas = decimal(ligne.get("lwr_ipm2"))
        haut = decimal(ligne.get("upr_ipm2"))
        if len(code) != 5 or millesime is None or typologie == "":
            continue
        if loyer is None or bas is None or haut is None:
            continue
        if not (bas <= loyer <= haut):
            # La contrainte de la base refuserait la ligne. On la compte ici
            # plutôt que de faire échouer tout le chargement sur une ligne.
            bornes_incoherentes += 1
            continue
        brute = (ligne.get("typpred") or "").strip().lower()
        maille = mailles.get(brute)
        if maille is None:
            maille_inconnue[brute] += 1
            continue
        cle = (code, millesime, typologie)
        if cle in vus:
            continue
        vus.add(cle)
        lignes.append(
            {
                "code_insee": code,
                "millesime": millesime,
                "type_logement": typologie,
                "loyer_m2": round(loyer, 3),
                "loyer_m2_borne_basse": round(bas, 3),
                "loyer_m2_borne_haute": round(haut, 3),
                "maille": maille,
                "observations_commune": entier(ligne.get("nbobs_com")) or 0,
                "r2_ajuste": round(decimal(ligne.get("r2_adj")), 4)
                if decimal(ligne.get("r2_adj")) is not None
                else None,
                "experimental": "true",
                "collecte_le": collecte,
                "source": mention,
            }
        )

    _ecrire(
        "indicateur_logement",
        [
            "code_insee", "millesime", "type_logement", "loyer_m2",
            "loyer_m2_borne_basse", "loyer_m2_borne_haute", "maille",
            "observations_commune", "r2_ajuste", "experimental",
            "collecte_le", "source",
        ],
        lignes,
    )
    rapport["loyers"] = {
        "lignes": len(lignes),
        "communes": len({l["code_insee"] for l in lignes}),
        "typologies": sorted({l["type_logement"] for l in lignes}),
        "bornes_incoherentes_ecartees": bornes_incoherentes,
        "mailles_inconnues": dict(maille_inconnue),
    }


def main() -> int:
    manifeste = _manifeste()
    rapport: dict = {}
    index = preparer_communes(manifeste, rapport)
    preparer_parcoursup(manifeste, index, rapport)
    preparer_loyers(manifeste, rapport)

    (SORTIE / "rapport.json").write_text(
        json.dumps(rapport, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(rapport, ensure_ascii=False, indent=2))

    # Un import qui perd plus d'une formation sur cent n'est pas un import,
    # c'est un échantillon. Le seuil est délibérément proche du taux mesuré
    # (99,31 %) pour qu'une régression se voie tout de suite.
    pct = rapport["parcoursup"]["insee_resolu_pct"]
    if pct < 99.0:
        print(
            f"\nÉCHEC : seulement {pct} % des formations ont un code INSEE "
            "(99,31 % attendus). L'index des communes a changé.",
            file=sys.stderr,
        )
        return 1
    print(f"\nPrêt pour le chargement : {SORTIE.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
