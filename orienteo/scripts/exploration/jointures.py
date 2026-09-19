#!/usr/bin/env python3
"""Script jetable — mesure des taux de jointure entre les jeux de l'étape 1.

Il ne modélise rien : il mesure. Trois questions.

1. Combien de formations Parcoursup peut-on rattacher à un code INSEE de commune,
   et de là à l'indicateur de loyers ? (chaîne critique du RAV)
2. Les UAI de Parcoursup se retrouvent-ils dans la cartographie et chez l'Onisep ?
3. Les équipements CROUS, qui n'ont ni UAI ni INSEE, sont-ils rattachables par
   leur point GPS ?

Sortie : `data/jointures.json` + un rapport lisible sur stdout.
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parents[2]
BRUT = RACINE / "data" / "brut"
SORTIE = RACINE / "data" / "jointures.json"

# Codes INSEE des arrondissements municipaux : Paris, Lyon, Marseille ont un code
# par arrondissement dans l'indicateur de loyers, mais une seule commune dans le
# référentiel géographique. Sans cette table, 1 666 formations perdent leur loyer.
BASE_ARRONDISSEMENT = {"paris": 75100, "lyon": 69380, "marseille": 13200}


def normaliser(valeur: object) -> str | None:
    """Nom de commune comparable : ligatures, accents, casse, Saint/St."""
    if pd.isna(valeur):
        return None
    s = str(valeur).replace("œ", "oe").replace("Œ", "OE").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"\bst\b", "saint", s)
    s = re.sub(r"\bste\b", "sainte", s)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def code_arrondissement(nom: str | None) -> str | None:
    m = re.match(r"^(paris|lyon|marseille)\s+(\d{1,2})\s*(er|e|eme)?(\s+arrondissement)?$",
                 nom or "")
    return str(BASE_ARRONDISSEMENT[m.group(1)] + int(m.group(2))) if m else None


def departement(valeur: object) -> str:
    d = str(valeur)
    return d.zfill(2) if d.isdigit() and len(d) < 3 else d


def lire(cle: str) -> pd.DataFrame:
    return pd.read_csv(BRUT / f"{cle}.csv", sep=";", dtype=str, low_memory=False)


def main() -> int:
    communes = lire("georef_communes")
    communes["nom_norm"] = communes["com_name"].map(normaliser)
    communes["prio"] = (communes["com_type"] == "commune").astype(int)
    par_dep_nom = (communes.sort_values("prio", ascending=False)
                   .drop_duplicates(["dep_code", "nom_norm"])
                   .set_index(["dep_code", "nom_norm"])["com_code"].to_dict())
    par_nom: dict[str, set[str]] = {}
    for (_, nom), code in par_dep_nom.items():
        par_nom.setdefault(nom, set()).add(code)

    ps = lire("parcoursup_2025")
    ps["nom_norm"] = ps["ville_etab"].map(normaliser)

    def resoudre(ligne: pd.Series) -> tuple[str | None, str | None]:
        arr = code_arrondissement(ligne["nom_norm"])
        if arr:
            return arr, "arrondissement municipal"
        dep = departement(ligne["dep"])
        if (dep, ligne["nom_norm"]) in par_dep_nom:
            return par_dep_nom[(dep, ligne["nom_norm"])], "nom + département"
        if dep == "20":  # Corse : Parcoursup code encore 20, le référentiel 2A/2B
            for d in ("2A", "2B"):
                if (d, ligne["nom_norm"]) in par_dep_nom:
                    return par_dep_nom[(d, ligne["nom_norm"])], "nom + département (Corse)"
        candidats = par_nom.get(ligne["nom_norm"] or "", set())
        if len(candidats) == 1:
            return next(iter(candidats)), "nom unique au niveau national"
        return None, None

    resolus = ps.apply(resoudre, axis=1, result_type="expand")
    ps["insee"], ps["methode"] = resolus[0], resolus[1]
    etranger = ps["dep"].astype(str).eq("99")

    loyers = lire("loyers_communes")
    t1t2 = (loyers[loyers["type_logement"] == "appartement 1 ou 2 pièces"]
            .drop_duplicates("insee_c").set_index("insee_c"))
    ps["loyer_dispo"] = ps["insee"].isin(set(t1t2.index))
    qualite = ps.loc[ps["loyer_dispo"], "insee"].map(t1t2["typpred"])

    rapport: dict[str, object] = {
        "millesime_parcoursup": sorted(ps["session"].dropna().unique().tolist()),
        "millesime_loyers": sorted(loyers["year"].dropna().unique().tolist()),
        "formations": len(ps),
        "formations_etranger": int(etranger.sum()),
        "insee_resolu_pct": round(ps["insee"].notna().mean() * 100, 2),
        "insee_resolu_hors_etranger_pct": round(ps.loc[~etranger, "insee"].notna().mean() * 100, 2),
        "methodes": ps["methode"].value_counts(dropna=False).to_dict(),
        "loyer_dispo_pct": round(ps["loyer_dispo"].mean() * 100, 2),
        "loyer_dispo_hors_etranger_pct": round(ps.loc[~etranger, "loyer_dispo"].mean() * 100, 2),
        "qualite_loyer_pct": (qualite.value_counts(normalize=True) * 100).round(2).to_dict(),
        "communes_sans_loyer": (ps.loc[~ps["loyer_dispo"] & ~etranger, ["ville_etab", "dep"]]
                                .value_counts().head(20)
                                .rename_axis(["ville", "dep"]).reset_index(name="formations")
                                .to_dict("records")),
    }

    carto = lire("cartographie_formations")
    dernier = carto["annee"].max()
    uai_ps = set(ps["cod_uai"].dropna())
    onisep = lire("onisep_af_sup")
    rapport["cartographie"] = {
        "millesimes": sorted(carto["annee"].dropna().unique().tolist()),
        "lignes_dernier_millesime": int((carto["annee"] == dernier).sum()),
        "uai_parcoursup_couverts_dernier_pct": round(
            100 * len(uai_ps & set(carto.loc[carto["annee"] == dernier, "etab_uai"].dropna()))
            / len(uai_ps), 2),
        "uai_parcoursup_couverts_tous_pct": round(
            100 * len(uai_ps & set(carto["etab_uai"].dropna())) / len(uai_ps), 2),
    }
    # Clé formation : l'URL de fiche Parcoursup porte le code g_ta_cod, que la
    # cartographie expose dans sa colonne `gta`.
    ps["g_ta_cod"] = ps["lien_form_psup"].str.extract(r"g_ta_cod=(\d+)", expand=False)
    rapport["cle_formation"] = {
        "cod_aff_form_unique": bool(ps["cod_aff_form"].is_unique),
        "g_ta_cod_extrait_pct": round(ps["g_ta_cod"].notna().mean() * 100, 2),
        "g_ta_cod_dans_carto_dernier_pct": round(
            ps["g_ta_cod"].dropna().isin(
                set(carto.loc[carto["annee"] == dernier, "gta"].dropna())).mean() * 100, 2),
        "g_ta_cod_dans_carto_tous_pct": round(
            ps["g_ta_cod"].dropna().isin(set(carto["gta"].dropna())).mean() * 100, 2),
    }
    rapport["onisep"] = {
        "actions_de_formation": len(onisep),
        "uai_distincts": int(onisep["ENS code UAI"].nunique()),
        "uai_parcoursup_couverts_pct": round(
            100 * len(uai_ps & set(onisep["ENS code UAI"].dropna())) / len(uai_ps), 2),
        "cout_scolarite_renseigne_pct": round(
            onisep["AF coût scolarité"].notna().mean() * 100, 2),
    }

    # CROUS : ni UAI ni INSEE, seulement un point. Rattachement au centroïde le
    # plus proche, avec la distance comme mesure de confiance.
    ref = communes[communes["com_type"] == "commune"].reset_index(drop=True)
    ref[["lat", "lon"]] = ref["geo_point_2d"].str.split(",", expand=True).astype(float)
    lat_ref, lon_ref = ref["lat"].to_numpy(), ref["lon"].to_numpy()

    def plus_proche(lat: float, lon: float) -> tuple[str, float]:
        d = (lat_ref - lat) ** 2 + ((lon_ref - lon) * math.cos(math.radians(lat))) ** 2
        i = int(np.argmin(d))
        return ref.at[i, "com_code"], math.sqrt(float(d[i])) * 111.32

    for cle, colonne in (("crous_logement", "geocalisation"),
                         ("crous_restauration", "geolocalisation")):
        df = lire(cle)
        coord = df[colonne].str.split(",", expand=True)
        lat = pd.to_numeric(coord[0], errors="coerce")
        lon = pd.to_numeric(coord[1], errors="coerce")
        ok = lat.between(-90, 90) & lon.between(-180, 180)
        apparies = [plus_proche(lat[i], lon[i]) for i in df.index[ok]]
        dist = pd.Series([d for _, d in apparies])
        rapport[cle] = {
            "lignes": len(df),
            "geoloc_exploitable_pct": round(ok.mean() * 100, 2),
            "communes_atteintes": int(pd.Series([c for c, _ in apparies]).nunique()),
            "distance_km_mediane": round(float(dist.median()), 2),
            "distance_km_p90": round(float(dist.quantile(0.9)), 2),
            "distance_km_max": round(float(dist.max()), 2),
            "colonnes_tarif_ou_capacite": [
                c for c in df.columns
                if any(k in c.lower() for k in ("prix", "tarif", "loyer", "capacit", "places"))
            ],
        }

    SORTIE.write_text(json.dumps(rapport, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(rapport, ensure_ascii=False, indent=1))
    print(f"\nRapport écrit : {SORTIE.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
