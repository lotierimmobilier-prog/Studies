"""Normalisations partagées par les scripts d'import.

Sans dépendance : les scripts d'import doivent tourner sur le VPS, où pandas
n'est pas installé et n'a rien à faire.

Ce que ce module ne fait PAS : deviner. Chaque fonction rend `None` quand elle
ne sait pas, et l'appelant doit décider quoi en faire. Une normalisation qui
renvoie une valeur de repli silencieuse fabrique des jointures fausses qu'on
ne retrouve jamais.
"""

from __future__ import annotations

import re
import unicodedata

# Paris, Lyon et Marseille ont UN code INSEE de commune (75056, 69123, 13055)
# mais l'indicateur de loyers ne connaît que les arrondissements municipaux.
# Sans cette table, 1 666 formations perdent leur loyer — mesuré, pas estimé.
BASE_ARRONDISSEMENT = {"paris": 75100, "lyon": 69380, "marseille": 13200}

_ARRONDISSEMENT = re.compile(
    r"^(paris|lyon|marseille)\s+(\d{1,2})\s*(er|e|eme)?(\s+arrondissement)?$"
)


def normaliser(valeur: object) -> str | None:
    """Nom de commune comparable : ligatures, accents, casse, Saint/St.

    « SAINT-ÉTIENNE », « St Etienne » et « Saint-Etienne » doivent tomber sur
    la même chaîne, sinon la jointure par nom perd des milliers de lignes.
    """
    if valeur is None:
        return None
    brut = str(valeur).strip()
    if brut == "":
        return None
    s = brut.replace("œ", "oe").replace("Œ", "OE").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"\bst\b", "saint", s)
    s = re.sub(r"\bste\b", "sainte", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip() or None


def code_arrondissement(nom_normalise: str | None) -> str | None:
    """Code INSEE d'arrondissement municipal, ou None si ce n'en est pas un."""
    m = _ARRONDISSEMENT.match(nom_normalise or "")
    if m is None:
        return None
    return str(BASE_ARRONDISSEMENT[m.group(1)] + int(m.group(2)))


def departement(valeur: object) -> str | None:
    """Code département sur deux caractères, trois pour l'outre-mer.

    Parcoursup écrit « 1 » pour l'Ain et « 971 » pour la Guadeloupe. La Corse
    s'écrit « 2A » et « 2B », qui ne sont pas des nombres.
    """
    if valeur is None:
        return None
    d = str(valeur).strip().upper()
    if d == "":
        return None
    return d.zfill(2) if d.isdigit() and len(d) < 3 else d


def point(geo: object) -> tuple[float, float] | None:
    """« 44.35624, 2.56417 » → (longitude, latitude), l'ordre de PostGIS.

    Les jeux Opendatasoft écrivent latitude d'abord. PostGIS attend l'inverse.
    Inverser les deux place toutes les écoles françaises en Somalie, et rien
    ne le signale : les coordonnées restent valides.
    """
    if geo is None:
        return None
    brut = str(geo).strip()
    if brut == "":
        return None
    morceaux = brut.split(",")
    if len(morceaux) != 2:
        return None
    try:
        lat, lon = float(morceaux[0]), float(morceaux[1])
    except ValueError:
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return (lon, lat)


def entier(valeur: object) -> int | None:
    """Entier, ou None. Une chaîne vide n'est PAS un zéro."""
    if valeur is None:
        return None
    brut = str(valeur).strip()
    if brut == "":
        return None
    try:
        return int(float(brut))
    except ValueError:
        return None


def decimal(valeur: object) -> float | None:
    if valeur is None:
        return None
    brut = str(valeur).strip().replace(",", ".")
    if brut == "":
        return None
    try:
        return float(brut)
    except ValueError:
        return None
