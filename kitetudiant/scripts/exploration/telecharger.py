#!/usr/bin/env python3
"""Étape 1 — téléchargement des jeux de données bruts.

Écrit dans `data/brut/` et produit `data/brut/manifeste.json` : pour chaque
fichier, l'URL exacte, l'horodatage de collecte, la taille et le SHA-256. Ce
manifeste est la preuve de provenance exigée par la règle 6 de CLAUDE.md.

    python3 scripts/exploration/telecharger.py [--cle parcoursup_2025 ...]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from sources import PAR_CLE, SOURCES

RACINE = Path(__file__).resolve().parents[2]
BRUT = RACINE / "data" / "brut"
TENTATIVES = 4


def _curl(url: str, dest: Path) -> bool:
    """Télécharge avec repli exponentiel : le proxy sortant coupe parfois."""
    for essai in range(TENTATIVES):
        code = subprocess.run(
            ["curl", "-sSL", "--max-time", "900", "-o", str(dest), url],
            capture_output=True, text=True,
        )
        if code.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
            return True
        attente = 2 ** (essai + 1)
        print(f"    échec ({code.stderr.strip()[:80]}) — nouvelle tentative dans {attente}s",
              file=sys.stderr)
        time.sleep(attente)
    return False


def _sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cle", nargs="*", default=None, help="clés de sources à télécharger")
    args = ap.parse_args()

    choisies = [PAR_CLE[c] for c in args.cle] if args.cle else list(SOURCES)
    BRUT.mkdir(parents=True, exist_ok=True)
    manifeste_f = BRUT / "manifeste.json"
    manifeste = json.loads(manifeste_f.read_text()) if manifeste_f.exists() else {}

    echecs: list[str] = []
    for s in choisies:
        print(f"[{s.cle}] {s.titre}")
        csv = BRUT / f"{s.cle}.csv"
        meta = BRUT / f"{s.cle}.meta.json"
        if not (_curl(s.url_meta, meta) and _curl(s.url_csv, csv)):
            echecs.append(s.cle)
            continue
        manifeste[s.cle] = {
            "titre": s.titre,
            "portail": s.portail,
            "dataset_id": s.dataset_id,
            "url_csv": s.url_csv,
            "url_meta": s.url_meta,
            "collecte_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "octets": csv.stat().st_size,
            "sha256": _sha256(csv),
        }
        print(f"    {csv.stat().st_size:,} octets")

    manifeste_f.write_text(json.dumps(manifeste, ensure_ascii=False, indent=2) + "\n")
    if echecs:
        print(f"\nÉCHECS : {', '.join(echecs)}", file=sys.stderr)
        return 1
    print(f"\nManifeste écrit : {manifeste_f.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
