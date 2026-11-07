#!/usr/bin/env python3
"""Régénère `docs/annexe-colonnes.md` depuis `data/profil.json`.

L'annexe liste les colonnes exactes de chaque jeu, telles qu'elles sont écrites
dans les CSV, avec leur type déclaré par le portail et leur taux de valeurs
manquantes. Elle est générée, jamais éditée à la main : c'est ce qui garantit
qu'aucun nom de colonne n'a été supposé.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
PROFIL = RACINE / "data" / "profil.json"
SORTIE = RACINE / "docs" / "annexe-colonnes.md"


def main() -> int:
    profil = json.loads(PROFIL.read_text())
    lignes = [
        "# Annexe — colonnes exactes des jeux de données",
        "",
        f"Généré le {date.today().isoformat()} par "
        "`scripts/exploration/annexe_colonnes.py` depuis `data/profil.json`.",
        "Ne pas éditer à la main.",
        "",
    ]
    for cle, jeu in profil.items():
        meta = jeu["meta"]
        lignes += [
            f"## `{cle}` — {meta.get('titre') or ''}",
            "",
            f"{jeu['lignes']:,} lignes × {jeu['colonnes_n']} colonnes · "
            f"licence {meta.get('licence')} · "
            f"mise à jour du portail {str(meta.get('modifie'))[:10]}".replace(",", " "),
            "",
            "| Colonne | Type déclaré | Manquant | Valeurs distinctes | Exemple |",
            "| --- | --- | ---: | ---: | --- |",
        ]
        for c in jeu["colonnes"]:
            ex = (c["exemple"] or "").replace("|", "\\|").replace("\n", " ").replace("\r", " ")
            ex = ex[:60] + ("…" if len(ex) > 60 else "")
            lignes.append(
                f"| `{c['colonne']}` | {c['type_portail']} | {c['manquant_pct']:.2f} % | "
                f"{c['valeurs_distinctes']} | {ex} |"
            )
        lignes.append("")
    SORTIE.write_text("\n".join(lignes))
    print(f"Annexe écrite : {SORTIE.relative_to(RACINE)} ({len(lignes)} lignes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
