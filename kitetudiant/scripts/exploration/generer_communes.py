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


def main() -> int:
    communes = pd.read_csv(BRUT / "georef_communes.csv", sep=";", dtype=str)
    communes["nom_norm"] = communes["com_name"].map(normaliser)
    communes["prio"] = (communes["com_type"] == "commune").astype(int)
    par_dep_nom = (communes.sort_values("prio", ascending=False)
                   .drop_duplicates(["dep_code", "nom_norm"])
                   .set_index(["dep_code", "nom_norm"])["com_code"].to_dict())

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
    for ligne in loyers.itertuples(index=False):
        table[ligne.insee_c] = {
            "nom": ligne.libgeo,
            "bas": round(float(ligne.lwr_ipm2), 3),
            "central": round(float(ligne.loypredm2), 3),
            "haut": round(float(ligne.upr_ipm2), 3),
            "maille": ligne.typpred,
        }

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

    couvertes = sum(1 for c in villes.values() if c in table)
    print(f"\n{len(villes)} villes résolues, {len(non_resolues)} non résolues")
    print(f"{len(table)} communes avec un loyer, soit {100 * couvertes / len(villes):.2f} % des villes")
    print(f"{SORTIE.relative_to(RACINE.parent)} — {SORTIE.stat().st_size / 1024:.0f} Ko")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
