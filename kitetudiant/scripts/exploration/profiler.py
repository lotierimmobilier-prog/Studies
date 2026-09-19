#!/usr/bin/env python3
"""Étape 1 — profilage des jeux de données téléchargés.

Pour chaque fichier de `data/brut/` : nombre de lignes, liste exacte des colonnes
avec le type déclaré par le portail, taux de valeurs manquantes, cardinalité et
un exemple réel. Aucun nom de colonne n'est supposé : ils sont lus dans le CSV.

Sortie : `data/profil.json`, consommé par docs/inventaire-donnees.md.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from sources import SOURCES

RACINE = Path(__file__).resolve().parents[2]
BRUT = RACINE / "data" / "brut"
SORTIE = RACINE / "data" / "profil.json"


def _meta(chemin: Path) -> dict:
    """Métadonnées normalisées, que le portail soit Opendatasoft ou Onisep."""
    if not chemin.exists():
        return {}
    brut = json.loads(chemin.read_text())
    if "metas" in brut or "fields" in brut and isinstance(brut.get("metas"), dict):
        metas = brut.get("metas", {}).get("default", {})
        champs = {f["name"]: f.get("type") for f in brut.get("fields", [])}
        return {
            "titre": metas.get("title"),
            "lignes_annoncees": metas.get("records_count"),
            "licence": metas.get("license"),
            "licence_url": metas.get("license_url"),
            "modifie": metas.get("modified"),
            "producteur": metas.get("publisher"),
            "types": champs,
        }
    # Portail Onisep
    return {
        "titre": brut.get("title"),
        "lignes_annoncees": brut.get("recordsCount"),
        "licence": brut.get("licence"),
        "licence_url": None,
        "modifie": brut.get("lastUpdatedAt"),
        "producteur": brut.get("providerCode"),
        "types": {},
    }


def profiler(csv: Path, types: dict[str, str]) -> dict:
    df = pd.read_csv(csv, sep=";", dtype=str, low_memory=False)
    lignes = len(df)
    colonnes = []
    for c in df.columns:
        presents = int(df[c].notna().sum())
        exemple = df[c].dropna().iloc[0][:80] if presents else None
        colonnes.append({
            "colonne": c,
            "type_portail": types.get(c, "non déclaré"),
            "manquant_pct": round(100 * (1 - presents / lignes), 2) if lignes else None,
            "valeurs_distinctes": int(df[c].nunique(dropna=True)),
            "exemple": exemple,
        })
    return {"lignes": lignes, "colonnes_n": df.shape[1], "colonnes": colonnes}


def main() -> int:
    profil = {}
    for s in SOURCES:
        csv = BRUT / f"{s.cle}.csv"
        if not csv.exists():
            print(f"[{s.cle}] absent — lancer telecharger.py d'abord")
            continue
        meta = _meta(BRUT / f"{s.cle}.meta.json")
        p = profiler(csv, meta.get("types", {}))
        noms = {c["colonne"] for c in p["colonnes"]}
        p["colonnes_critiques_absentes"] = sorted(set(s.colonnes_critiques) - noms)
        profil[s.cle] = {"meta": {k: v for k, v in meta.items() if k != "types"}, **p}
        print(f"[{s.cle}] {p['lignes']:,} lignes × {p['colonnes_n']} colonnes"
              + (f"  ⚠ colonnes attendues absentes : {p['colonnes_critiques_absentes']}"
                 if p["colonnes_critiques_absentes"] else ""))
    SORTIE.write_text(json.dumps(profil, ensure_ascii=False, indent=1) + "\n")
    print(f"\nProfil écrit : {SORTIE.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
