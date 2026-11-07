#!/usr/bin/env python3
"""Extrait des barèmes réglementaires depuis les paramètres d'OpenFisca-France.

Règle 1 de CLAUDE.md : aucun montant affiché ne peut provenir d'un LLM. Les
paramètres d'OpenFisca-France sont des valeurs légales datées, chacune portant
la référence du texte qui la fixe. Ce script les recopie mécaniquement dans
`donnees/*.json` — il n'en invente ni n'en arrondit aucune.

    pip install openfisca-france
    python3 packages/baremes/scripts/extraire_openfisca.py

Les barèmes que OpenFisca ne couvre pas (CVEC, droits d'inscription) sont
saisis à la main depuis leur source officielle, dans des fichiers séparés qui
portent la même structure et leur propre date de collecte.
"""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from typing import Any

import yaml

try:
    import openfisca_france
except ModuleNotFoundError:  # pragma: no cover - dépend de l'environnement
    raise SystemExit("openfisca-france n'est pas installé : pip install openfisca-france")

PARAMS = Path(openfisca_france.__file__).parent / "parameters"
SORTIE = Path(__file__).resolve().parents[1] / "donnees"

EDUCATION = "prestations_sociales/education"
BOURSES = f"{EDUCATION}/bourses/enseignement_superieur"


def charger(chemin: str) -> dict[str, Any]:
    return yaml.safe_load((PARAMS / chemin).read_text(encoding="utf-8"))


def references(meta: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    """Normalise le bloc `reference` d'OpenFisca : une date, une ou N sources."""
    brut = (meta or {}).get("reference") or {}
    sorti: dict[str, list[dict[str, str]]] = {}
    for applicable_depuis, valeur in brut.items():
        entrees = valeur if isinstance(valeur, list) else [valeur]
        propres = []
        for e in entrees:
            if isinstance(e, dict):
                propres.append({k: v for k, v in e.items() if k in ("title", "href", "note")})
        if propres:
            sorti[str(applicable_depuis)] = propres
    return sorti


def valeurs_datees(noeud: dict[str, Any]) -> dict[str, Any]:
    return {str(d): v.get("value") for d, v in (noeud.get("values") or {}).items()}


def bareme_simple(cle: str, libelle: str, chemin: str, unite: str) -> dict[str, Any]:
    y = charger(chemin)
    meta = y.get("metadata") or {}
    return {
        "cle": cle,
        "libelle": libelle,
        "unite": unite,
        "description_source": y.get("description"),
        "valeurs_par_date": valeurs_datees(y),
        "references_par_date": references(meta),
        "derniere_valeur_encore_valide_le": meta.get("last_value_still_valid_on"),
        "provenance": {
            "origine": "openfisca-france",
            "parametre": chemin,
            "extrait_le": date.today().isoformat(),
        },
    }


# OpenFisca indexe les échelons de 0 à 7, où 0 désigne l'échelon « 0 bis » et
# -1 l'absence de droit (voir bourse_criteres_sociaux_echelon dans
# openfisca_france/model/prestations/enseignement_superieur/). Les plafonds de
# ressources du même barème sont d'ailleurs nommés echelon_0bis à echelon_7.
# On rétablit le libellé officiel pour ne pas confondre l'échelon 0 (exonéré de
# droits, sans versement mensuel) et l'échelon 0 bis.
ECHELON_OPENFISCA_VERS_OFFICIEL = {"0": "0bis"}


def bareme_echelons() -> dict[str, Any]:
    """Montant mensuel de la bourse sur critères sociaux, par échelon."""
    y = charger(f"{BOURSES}/criteres_sociaux/montants.yaml")
    meta = y.get("metadata") or {}
    par_date: dict[str, dict[str, float]] = {}
    for tranche in y.get("brackets", []):
        seuils = {str(d): v["value"] for d, v in tranche["threshold"].items()}
        indice = str(sorted(seuils.items())[0][1])
        echelon = ECHELON_OPENFISCA_VERS_OFFICIEL.get(indice, indice)
        for d, v in tranche["amount"].items():
            par_date.setdefault(str(d), {})[echelon] = v["value"]
    # Une date ne redéfinit pas toujours tous les échelons : on complète chaque
    # millésime avec les valeurs encore en vigueur à cette date.
    ordre = ["0bis", "1", "2", "3", "4", "5", "6", "7"]
    complet: dict[str, dict[str, float]] = {}
    courant: dict[str, float] = {}
    for d in sorted(par_date):
        courant = {**courant, **par_date[d]}
        complet[d] = {e: courant[e] for e in ordre if e in courant}
    return {
        "cle": "bourse_criteres_sociaux",
        "libelle": "Bourse sur critères sociaux de l'enseignement supérieur",
        "note_echelons": (
            "Échelons officiels 0bis à 7. L'échelon 0, qui exonère des droits "
            "d'inscription et de la CVEC sans versement mensuel, n'a pas de montant "
            "dans ce barème."
        ),
        "unite": "euros_par_mois",
        "description_source": y.get("description"),
        "valeurs_par_date": complet,
        "references_par_date": references(meta),
        "derniere_valeur_encore_valide_le": meta.get("last_value_still_valid_on"),
        "provenance": {
            "origine": "openfisca-france",
            "parametre": f"{BOURSES}/criteres_sociaux/montants.yaml",
            "extrait_le": date.today().isoformat(),
        },
    }


def main() -> int:
    SORTIE.mkdir(parents=True, exist_ok=True)
    baremes = [
        bareme_echelons(),
        bareme_simple("bourse_nombre_mensualites",
                      "Nombre de mensualités de la bourse sur critères sociaux",
                      f"{BOURSES}/criteres_sociaux/nombre_mensualites.yaml", "mois"),
        bareme_simple("aide_merite", "Aide au mérite",
                      f"{BOURSES}/aide_merite/montant_annuel.yaml", "euros_par_an"),
        bareme_simple("aide_mobilite_parcoursup", "Aide à la mobilité Parcoursup",
                      f"{EDUCATION}/mobilite/parcoursup/montant.yaml", "euros_une_fois"),
        bareme_simple("repas_crous_boursier", "Repas en restaurant universitaire, étudiant boursier",
                      f"{EDUCATION}/alimentation/montant_repas_boursier.yaml", "euros_par_repas"),
        bareme_simple("repas_crous_non_boursier",
                      "Repas en restaurant universitaire, étudiant non boursier",
                      f"{EDUCATION}/alimentation/montant_repas_non_boursier.yaml",
                      "euros_par_repas"),
    ]
    for b in baremes:
        chemin = SORTIE / f"{b['cle'].replace('_', '-')}.json"
        chemin.write_text(json.dumps(b, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        dates = sorted(b["valeurs_par_date"])
        print(f"[{b['cle']}] {len(dates)} millésime(s), du {dates[0]} au {dates[-1]}"
              f" → {chemin.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
