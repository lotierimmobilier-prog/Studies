#!/usr/bin/env python3
"""Génère le jeu de communes embarqué par le front.

Parcoursup ne porte pas de code INSEE : le front ne peut donc pas retrouver
seul le loyer d'une formation. Ce script produit, pour les seules communes qui
accueillent au moins une formation, la correspondance libellé + département →
code INSEE, et le loyer de référence de la commune.

La méthode de résolution est la même que `jointures.py` — elle est ici figée
dans un fichier versionné, pour que le front ne devine rien à l'exécution.

    python3 kitetudiant/scripts/exploration/generer_communes.py
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd

from jointures import code_arrondissement, departement, normaliser

RACINE = Path(__file__).resolve().parents[2]
BRUT = RACINE / "data" / "brut"
SORTIE = RACINE / "web" / "donnees" / "communes.json"

TYPOLOGIE = "appartement 1 ou 2 pièces"


# Le référentiel georef ne contient que des communes : Paris, Lyon et Marseille
# y figurent d'un seul tenant, sans leurs arrondissements. Or Parcoursup situe
# les formations à l'arrondissement. On rattache donc chaque arrondissement au
# centre de sa commune mère : une approximation de quelques kilomètres, sans
# effet sur la question posée — quelle ville est la plus proche de l'élève —
# et bien plus honnête qu'un arrondissement sans position du tout, qui
# disparaîtrait purement et simplement du classement par distance.
COMMUNE_MERE = {"751": "75056", "6938": "69123", "132": "13055"}


def commune_mere(code: str) -> str | None:
    """Code de la commune portant la position, pour un arrondissement."""
    for prefixe, mere in COMMUNE_MERE.items():
        if code.startswith(prefixe) and code != mere:
            return mere
    return None


def coordonnees(brut: str | float | None) -> tuple[float, float] | None:
    """« 47.8083, -3.4376 » → (latitude, longitude), arrondi au centième.

    Deux décimales suffisent largement ici : elles situent à environ un
    kilomètre près, ce qui est plus fin que la commune elle-même. En garder
    davantage alourdirait le fichier embarqué sans rien apporter.
    """
    if not isinstance(brut, str) or "," not in brut:
        return None
    lat, _, lon = brut.partition(",")
    try:
        return round(float(lat), 2), round(float(lon), 2)
    except ValueError:
        return None


def main() -> int:
    communes = pd.read_csv(BRUT / "georef_communes.csv", sep=";", dtype=str)
    communes["nom_norm"] = communes["com_name"].map(normaliser)
    communes["prio"] = (communes["com_type"] == "commune").astype(int)
    par_dep_nom = (communes.sort_values("prio", ascending=False)
                   .drop_duplicates(["dep_code", "nom_norm"])
                   .set_index(["dep_code", "nom_norm"])["com_code"].to_dict())
    # Coordonnées du chef-lieu, pour que le front trouve la commune la plus
    # proche SANS envoyer la position de l'élève où que ce soit.
    par_code_geo = {}
    for code, geo in zip(communes["com_code"], communes["geo_point_2d"]):
        if code not in par_code_geo:
            pos = coordonnees(geo)
            if pos is not None:
                par_code_geo[code] = pos

    ps = pd.read_csv(BRUT / "parcoursup_2025.csv", sep=";", dtype=str, low_memory=False)
    ps["nom_norm"] = ps["ville_etab"].map(normaliser)

    villes: dict[str, str] = {}
    non_resolues: set[str] = set()
    for nom_norm, dep_brut, libelle in zip(ps["nom_norm"], ps["dep"], ps["ville_etab"]):
        cle = f"{nom_norm}|{departement(dep_brut)}"
        if cle in villes or cle in non_resolues:
            continue
        arr = code_arrondissement(nom_norm)
        if arr:
            villes[cle] = arr
            continue
        dep = departement(dep_brut)
        code = par_dep_nom.get((dep, nom_norm))
        if code is None and dep == "20":
            code = par_dep_nom.get(("2A", nom_norm)) or par_dep_nom.get(("2B", nom_norm))
        if code is None:
            non_resolues.add(cle)
            print(f"  non résolue : {libelle} ({dep_brut})")
            continue
        villes[cle] = code

    loyers = pd.read_csv(BRUT / "loyers_communes.csv", sep=";", dtype=str)
    loyers = loyers[loyers["type_logement"] == TYPOLOGIE].drop_duplicates("insee_c")
    utiles = set(villes.values())
    loyers = loyers[loyers["insee_c"].isin(utiles)]

    table = {}
    sans_position = 0
    for ligne in loyers.itertuples(index=False):
        entree = {
            "nom": ligne.libgeo,
            "bas": round(float(ligne.lwr_ipm2), 3),
            "central": round(float(ligne.loypredm2), 3),
            "haut": round(float(ligne.upr_ipm2), 3),
            "maille": ligne.typpred,
        }
        pos = par_code_geo.get(ligne.insee_c)
        if pos is None:
            mere = commune_mere(ligne.insee_c)
            if mere is not None:
                pos = par_code_geo.get(mere)
        if pos is None:
            # Pas de repli inventé : une commune sans position ne participera
            # simplement pas au classement par distance.
            sans_position += 1
        else:
            entree["lat"], entree["lon"] = pos
        table[ligne.insee_c] = entree

    millesime = sorted(set(loyers["year"]))
    sortie = {
        "millesimeLoyers": millesime[0] if len(millesime) == 1 else ",".join(millesime),
        "typologie": TYPOLOGIE,
        "source": (
            "Indicateur des loyers par commune (DGALN / ANIL), loyer d'annonce "
            "mensuel au m², charges comprises, bien loué vide, publié à titre "
            "expérimental pour le 3e trimestre 2025"
        ),
        "sourceUrl": "https://public.opendatasoft.com/explore/dataset/indicateur-loyers-communes-millesime/",
        "genereLe": date.today().isoformat(),
        "villes": dict(sorted(villes.items())),
        "communes": dict(sorted(table.items())),
    }
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")) + "\n")

    if sans_position:
        print(f"  {sans_position} commune(s) sans position : exclues du classement par distance")
    couvertes = sum(1 for c in villes.values() if c in table)
    print(f"\n{len(villes)} villes résolues, {len(non_resolues)} non résolues")
    print(f"{len(table)} communes avec un loyer, soit {100 * couvertes / len(villes):.2f} % des villes")
    print(f"{SORTIE.relative_to(RACINE.parent)} — {SORTIE.stat().st_size / 1024:.0f} Ko")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
