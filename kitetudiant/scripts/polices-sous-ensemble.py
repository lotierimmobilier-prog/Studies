"""
Fabrique les fichiers de polices servis par le site.

Pourquoi ce script existe : les fichiers que publie Google sont des polices
VARIABLES, 330 Ko pour les quatre graisses — quatorze fois l'ancienne
Poppins, sur un site dont le public lit au téléphone. Chaque famille est
donc figée à sa graisse et à sa taille optique, puis réduite aux caractères
dont ce site a besoin : 72 Ko en tout.

Il n'est PAS lancé au build. Les .woff2 sont versionnés, parce qu'ils ne
changent qu'au changement de police et qu'imposer fonttools à chaque
installation coûterait plus qu'il ne rapporte. Ce fichier est là pour qu'on
puisse refaire les mêmes, et savoir comment ils ont été faits.

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python kitetudiant/scripts/polices-sous-ensemble.py

La plage de caractères est reprise telle quelle de l'ancien réglage : elle
exclut volontairement U+202F, l'espace fine insécable que « 1 246 » contient
— une police qui la réclame sans savoir la rendre la fait disparaître.
Voir le commentaire en tête de web/src/styles.css.
"""
import subprocess, os, glob
PLAGE = "U+0000-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+20AC,U+2039-203A,U+2212"
DEST = "/home/user/Studies/kitetudiant/web/src/polices"
SRC = "/tmp/claude-0/fonts"
# Les variables téléchargées (latin, dédoublonnées) servent de source.
travaux = [
    ("bricolage", f"{DEST}/bricolage-600-latin.woff2", [("wght", 600), ("opsz", 24)], "bricolage-600.woff2"),
    ("bricolage", f"{DEST}/bricolage-800-latin.woff2", [("wght", 800), ("opsz", 48)], "bricolage-800.woff2"),
    ("serif",     f"{DEST}/source-serif-400-latin.woff2", [("wght", 400), ("opsz", 16)], "source-serif-400.woff2"),
    ("serif",     f"{DEST}/source-serif-600-latin.woff2", [("wght", 600), ("opsz", 16)], "source-serif-600.woff2"),
]
for _, src, axes, nom in travaux:
    inst = f"/tmp/claude-0/{nom}.inst.ttf"
    subprocess.run(["/tmp/claude-0/.venv/bin/fonttools", "varLib.instancer", src,
                    *[f"{a}={v}" for a, v in axes], "-o", inst], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["/tmp/claude-0/.venv/bin/fonttools", "subset", inst,
                    f"--unicodes={PLAGE.replace('U+','')}",
                    "--layout-features=kern,liga,ccmp,locl,tnum",
                    "--flavor=woff2", f"--output-file={DEST}/{nom}"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{nom:28} {os.path.getsize(f'{DEST}/{nom}'):6} octets")
# On retire les variables complètes : elles ne sont pas servies.
for f in glob.glob(f"{DEST}/*-latin*.woff2"):
    os.remove(f)
total = sum(os.path.getsize(f"{DEST}/{n}") for _,_,_,n in travaux)
print("total nouvelles polices :", total, "octets")
