"""Catalogue des jeux de données de l'étape 1.

Une seule source de vérité pour le téléchargement, le profilage et les tests de
jointure. Chaque entrée porte son portail, son identifiant exact et sa licence
telle qu'elle est publiée — jamais telle qu'on la suppose.
"""

from __future__ import annotations

from dataclasses import dataclass, field

ESR = "https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets"
PUBLIC_ODS = "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets"
ONISEP = "https://api.opendata.onisep.fr"

EXPORT_CSV = "/exports/csv?delimiter=%3B&with_bom=false"


@dataclass(frozen=True)
class Source:
    cle: str
    titre: str
    portail: str
    dataset_id: str
    url_csv: str
    url_meta: str
    # Colonnes que l'inventaire doit obligatoirement documenter (taux de manquants).
    colonnes_critiques: tuple[str, ...] = field(default_factory=tuple)
    # Colonnes utilisées comme sélection d'export (None = toutes).
    select: str | None = None


def _esr(cle: str, titre: str, ds: str, critiques: tuple[str, ...]) -> Source:
    return Source(cle, titre, "data.enseignementsup-recherche.gouv.fr", ds,
                  f"{ESR}/{ds}{EXPORT_CSV}", f"{ESR}/{ds}", critiques)


SOURCES: tuple[Source, ...] = (
    _esr("parcoursup_2025", "Parcoursup 2025 — vœux et réponses des établissements",
         "fr-esr-parcoursup",
         ("cod_uai", "cod_aff_form", "ville_etab", "dep", "capa_fin", "voe_tot",
          "acc_tot", "taux_acces_ens", "g_olocalisation_des_formations")),
    _esr("parcoursup_2024", "Parcoursup 2024 — vœux et réponses des établissements",
         "fr-esr-parcoursup_2024",
         ("cod_uai", "cod_aff_form", "capa_fin", "acc_tot", "taux_acces_ens")),
    _esr("parcoursup_2023", "Parcoursup 2023 — vœux et réponses des établissements",
         "fr-esr-parcoursup_2023",
         ("cod_uai", "cod_aff_form", "capa_fin", "acc_tot", "taux_acces_ens")),
    _esr("cartographie_formations", "Cartographie des formations Parcoursup",
         "fr-esr-cartographie_formations_parcoursup",
         ("annee", "etab_uai", "commune", "etab_gps", "gta", "gti", "rnd", "code_formation")),
    _esr("crous_logement", "Logements CROUS — France entière",
         "fr_crous_logement_france_entiere",
         ("id", "title", "zone", "geocalisation", "address", "infos")),
    _esr("crous_restauration", "Lieux de restauration CROUS — France entière",
         "fr_crous_restauration_france_entiere",
         ("id", "title", "zone", "geolocalisation", "type")),
    Source("loyers_communes", "Indicateur des loyers par commune, millésimé (ANIL / CEREMA)",
           "public.opendatasoft.com", "indicateur-loyers-communes-millesime",
           f"{PUBLIC_ODS}/indicateur-loyers-communes-millesime{EXPORT_CSV}",
           f"{PUBLIC_ODS}/indicateur-loyers-communes-millesime",
           ("year", "insee_c", "type_logement", "loypredm2", "lwr_ipm2", "upr_ipm2",
            "typpred", "nbobs_com")),
    Source("onisep_af_sup", "Idéo — Actions de formation initiale, univers enseignement supérieur",
           "api.opendata.onisep.fr", "605344579a7d7",
           f"{ONISEP}/downloads/605344579a7d7/605344579a7d7.csv",
           f"{ONISEP}/api/1.0/dataset/605344579a7d7",
           ("Action de Formation (AF) identifiant Onisep", "ENS code UAI",
            "FOR URL et ID Onisep", "AF coût scolarité")),
    # Référentiel commune, indispensable pour donner un code INSEE aux formations.
    Source("georef_communes", "Référentiel géographique des communes de France",
           "public.opendatasoft.com", "georef-france-commune",
           f"{PUBLIC_ODS}/georef-france-commune{EXPORT_CSV}"
           "&select=com_code,com_current_code,com_name,com_name_upper,dep_code,dep_name,"
           "reg_code,reg_name,epci_code,com_type,geo_point_2d,year",
           f"{PUBLIC_ODS}/georef-france-commune",
           ("com_code", "com_name", "dep_code", "com_type", "geo_point_2d")),
)

PAR_CLE = {s.cle: s for s in SOURCES}
