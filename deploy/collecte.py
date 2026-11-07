#!/usr/bin/env python3
"""La date de collecte la plus ANCIENNE d'un manifeste de téléchargement.

Sert au seul message « réutilisation de data/brut/, collecté le … » de
charger-donnees.sh. La plus ancienne et non la plus récente : c'est l'âge du
jeu le plus périmé qui dit si une réutilisation est raisonnable.

    python3 deploy/collecte.py kitetudiant/data/brut/manifeste.json
"""

from __future__ import annotations

import json
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage : collecte.py <manifeste.json>", file=sys.stderr)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        manifeste = json.load(f)
    dates = sorted(
        v["collecte_utc"]
        for v in manifeste.values()
        if isinstance(v, dict) and isinstance(v.get("collecte_utc"), str)
    )
    if not dates:
        return 1
    print(dates[0][:10])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
