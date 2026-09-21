import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolve, relative, dirname, sep } from 'node:path'

// Le serveur déployé sur le VPS n'est pas le dépôt : le script de déploiement
// recopie une poignée de dossiers dans /opt/<slug>, et l'API tourne à partir
// de cette copie. Si elle importe un fichier que le script ne copie pas, rien
// n'échoue au build — ça casse au démarrage, sur la machine, en production :
// tsx meurt sur un import introuvable, pm2 relance en boucle, nginx répond 502.
// Le front s'affiche parfaitement pendant ce temps, ce qui rend le symptôme
// trompeur. C'est arrivé le 19/09/2026 avec kitetudiant/packages/baremes.
//
// Ce test rejoue le raisonnement du script : il part de server/index.ts, suit
// tous les imports relatifs de proche en proche, et vérifie que chaque fichier
// atteint hors de server/ tombe bien dans un dossier recopié.

const RACINE = resolve(import.meta.dirname, '..', '..')

/** Dossiers sources que le script recopie vers ${APP_DIR}, lus dans le script. */
function dossiersDeployes(): string[] {
  const script = readFileSync(resolve(RACINE, 'deploy/vps-setup.sh'), 'utf8')
  const motif = /rsync[^\n]*"\$\{SRC_DIR\}\/([^"]+)"\s+"\$\{APP_DIR\}/g
  const dossiers = [...script.matchAll(motif)].map((m) => m[1]!.replace(/\/$/, ''))
  // Les fichiers isolés recopiés un à un (package.json, tsconfig.server.json…).
  const isoles = /for f in ([^;]+); do/.exec(script)
  if (isoles) dossiers.push(...isoles[1]!.trim().split(/\s+/))
  return dossiers
}

/** Résout un import relatif vers un chemin de fichier réel. */
function resoudre(depuis: string, specificateur: string): string | null {
  const brut = resolve(dirname(depuis), specificateur)
  const candidats = [brut, `${brut}.ts`, `${brut}/index.ts`]
  return candidats.find((c) => existsSync(c) && !c.endsWith(sep)) ?? null
}

/** Tous les fichiers atteints depuis une entrée, en suivant les imports relatifs. */
function fermetureDesImports(entree: string): Set<string> {
  const vus = new Set<string>()
  const aVoir = [entree]
  while (aVoir.length > 0) {
    const fichier = aVoir.pop()!
    if (vus.has(fichier)) continue
    vus.add(fichier)
    if (!fichier.endsWith('.ts')) continue // un .json ne réimporte rien
    const source = readFileSync(fichier, 'utf8')
    for (const m of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const cible = resoudre(fichier, m[1]!)
      if (cible) aVoir.push(cible)
      else throw new Error(`Import irrésoluble : « ${m[1]} » depuis ${relative(RACINE, fichier)}`)
    }
  }
  return vus
}

describe('le script de déploiement copie tout ce que l’API importe', () => {
  const deployes = dossiersDeployes()
  const atteints = [...fermetureDesImports(resolve(RACINE, 'server/index.ts'))]
    .map((f) => relative(RACINE, f))
    .sort()

  it('recopie bien server/ et les paquets de kitetudiant', () => {
    expect(deployes).toContain('server')
    expect(deployes).toContain('kitetudiant/packages')
  })

  it('atteint effectivement des fichiers hors de server/', () => {
    // Garde-fou : si la fermeture ne trouvait plus rien hors de server/, le
    // test passerait pour de mauvaises raisons et ne protégerait plus rien.
    const dehors = atteints.filter((f) => !f.startsWith('server/'))
    expect(dehors.length).toBeGreaterThan(0)
  })

  it.each(
    [...fermetureDesImports(resolve(RACINE, 'server/index.ts'))]
      .map((f) => relative(RACINE, f))
      .filter((f) => !f.startsWith('server/'))
      .sort(),
  )('%s est dans un dossier déployé', (fichier) => {
    const couvert = deployes.some((d) => fichier === d || fichier.startsWith(`${d}/`))
    expect(
      couvert,
      `${fichier} est importé par l'API mais n'est recopié par aucun rsync de ` +
        `deploy/vps-setup.sh (dossiers copiés : ${deployes.join(', ')}). ` +
        `En production, l'API meurt au démarrage et nginx répond 502.`,
    ).toBe(true)
  })
})

/**
 * Le serveur Node tourne derrière nginx, qui termine le TLS. Deux protections
 * dépendent donc entièrement de ce que nginx veut bien transmettre, et leur
 * absence ne se voit ni au build, ni aux tests unitaires, ni en local — mais
 * elles cassent en production, silencieusement.
 */
describe('ce que nginx doit transmettre à l’API', () => {
  const SCRIPT = readFileSync(resolve(RACINE, 'deploy/vps-setup.sh'), 'utf8')

  it('transmet le protocole, sinon la console refuse un site pourtant en HTTPS', () => {
    // admin.ts exige HTTPS et le constate par x-forwarded-proto. Derrière
    // nginx, la connexion reçue est en clair : sans cet en-tête la console
    // répond 421 pour toujours. Observé sur kitetudiant.fr, certificat valide.
    expect(SCRIPT).toMatch(/proxy_set_header\s+X-Forwarded-Proto\s+\\\$scheme;/)
  })

  it('transmet l’adresse du client, sinon un seul visiteur verrouille tout le monde', () => {
    // Le verrou après cinq échecs se compte par client. Sans cet en-tête,
    // tous les visiteurs partagent l'adresse de nginx (127.0.0.1) et les
    // échecs de l'un bloquent l'accès des autres.
    expect(SCRIPT).toMatch(/proxy_set_header\s+X-Forwarded-For\s+\\\$proxy_add_x_forwarded_for;/)
  })
})

/**
 * Le script réécrit `.env` de zéro à chaque passage. C'est voulu — il est la
 * seule source de vérité du fichier — mais cela rend une relance SANS les
 * secrets destructrice : le 20/09/2026, la commande que j'avais donnée à
 * l'utilisateur aurait effacé COMPTES_MASTER_KEY (comptes élèves illisibles,
 * détail chiffré ouvert à tous), ADMIN_TOKEN (console refermée) et
 * ANTHROPIC_API_KEY (analyse de bulletin en panne).
 *
 * La mise à jour automatique rend le point critique : elle relance le script
 * sans personne pour retaper les clés.
 */
describe('le script ne peut pas effacer les secrets en place', () => {
  const SCRIPT = readFileSync(resolve(RACINE, 'deploy/vps-setup.sh'), 'utf8')

  it('relit le .env existant AVANT de le réécrire', () => {
    const relecture = SCRIPT.indexOf('HERITEES=""')
    const remiseAZero = SCRIPT.indexOf(': > "${APP_DIR}/.env"')
    expect(relecture, 'la reprise des secrets est absente du script').toBeGreaterThan(-1)
    expect(remiseAZero).toBeGreaterThan(-1)
    // L'ordre est tout : relire après avoir vidé ne relit rien.
    expect(relecture).toBeLessThan(remiseAZero)
  })

  it('lit le fichier ligne à ligne, sans jamais l’exécuter', () => {
    // « source .env » ou « . .env » exécuterait son contenu : une ligne
    // trafiquée deviendrait une commande lancée en root.
    expect(SCRIPT).not.toMatch(/^\s*(source|\.)\s+"?\$\{APP_DIR\}\/\.env/m)
    expect(SCRIPT).toMatch(/while IFS= read -r ligne[\s\S]*?done < "\$\{APP_DIR\}\/\.env"/)
  })

  it('n’exporte que des noms de variables plausibles', () => {
    // Sans ce filtre, une ligne comme « $(rm -rf /)=x » nommerait l'export.
    expect(SCRIPT).toMatch(/case "\$\{cle\}" in ''\|\*\[!A-Za-z0-9_\]\*\) continue ;; esac/)
  })

  it('laisse une valeur passée à l’appel l’emporter sur le fichier', () => {
    // C'est ainsi qu'on remplace une clé : sans cela, l'ancienne gagnerait
    // et une rotation de secret serait impossible.
    expect(SCRIPT).toMatch(/\[ -n "\$\{!cle:-\}" \] && continue/)
  })
})

/**
 * Mise en ligne automatique, modèle « pull » : le VPS va chercher, personne ne
 * pousse vers lui. Aucune clé SSH déposée chez GitHub, aucun accès entrant.
 */
describe('la mise en ligne automatique', () => {
  const SCRIPT = readFileSync(resolve(RACINE, 'deploy/vps-setup.sh'), 'utf8')

  /* ── AUTO_MAJ non passé ne doit RIEN décider ──────────────────────────
   *
   * Le paramètre valait zéro par défaut, et le bloc de fin s'en servait pour
   * arrêter le minuteur déjà posé. Relancer ce script à la main — pour
   * pousser un correctif, sans repenser à AUTO_MAJ=1 — éteignait donc la mise
   * en ligne automatique. Le déploiement réussissait, la ligne « désactivée »
   * passait inaperçue, et plus rien ne repartait ensuite. Constaté en
   * production le 20/09/2026 : quatre fusions restées hors ligne neuf heures,
   * avec un site qui répondait normalement pendant tout ce temps.
   *
   * Ces tests EXÉCUTENT la fonction de décision, avec un faux `systemctl`,
   * plutôt que de relire le script. Une assertion sur le texte du script est
   * ce qui a laissé passer la régression : elle vérifiait fidèlement la
   * présence de la ligne fautive. */
  /* Résolu une fois, hors du bac à sable : le PATH réduit passé au fils
     l'empêcherait de se trouver lui-même. */
  const BASH = execFileSync('sh', ['-c', 'command -v bash'], { encoding: 'utf8' }).trim()

  const FONCTION = /^auto_maj_voulu\(\) \{$[\s\S]*?^\}$/m.exec(SCRIPT)

  function decider(passe: string, minuteur: 'actif' | 'inactif' | 'absent'): string {
    const bac = mkdtempSync(join(tmpdir(), 'automaj-'))
    if (minuteur !== 'absent') {
      // `systemctl is-enabled` rend 0 pour une unité active, non-zéro sinon.
      writeFileSync(join(bac, 'systemctl'), `#!/bin/sh\nexit ${minuteur === 'actif' ? 0 : 1}\n`, {
        mode: 0o755,
      })
    }
    // PATH réduit au bac à sable : « absent » veut dire systemctl introuvable,
    // ce qui est l'état d'une machine neuve ou d'un conteneur sans systemd.
    // bash est donc appelé par son chemin absolu — le PATH du fils ne sert
    // plus qu'aux recherches faites DEPUIS le script.
    return execFileSync(
      BASH,
      ['-c', `set -euo pipefail\n${FONCTION?.[0] ?? ''}\nauto_maj_voulu "$1" "kitetudiant-maj.timer"`, 'bash', passe],
      { env: { PATH: bac }, encoding: 'utf8' },
    )
  }

  it('expose la décision dans une fonction, pas dans une valeur par défaut', () => {
    expect(FONCTION, 'auto_maj_voulu doit rester une fonction de premier niveau').not.toBeNull()
  })

  it('reconduit le minuteur en place quand AUTO_MAJ n’est pas passé', () => {
    // LA régression. Une mise en ligne manuelle ne doit pas éteindre
    // l'automatique au passage.
    expect(decider('', 'actif')).toBe('1')
  })

  it('ne s’active toujours pas toute seule sur une machine qui ne l’avait pas', () => {
    // L'intention d'origine, préservée : l'autre projet de la machine
    // n'hérite pas d'un minuteur qu'on n'a pas demandé pour lui.
    expect(decider('', 'inactif')).toBe('0')
    expect(decider('', 'absent')).toBe('0')
  })

  it('obéit à la valeur passée, dans les deux sens', () => {
    // AUTO_MAJ=0 explicite reste la façon de désactiver — et il doit gagner
    // contre un minuteur actif, sinon on ne pourrait plus l'arrêter.
    expect(decider('0', 'actif')).toBe('0')
    expect(decider('1', 'absent')).toBe('1')
  })

  it('installe un minuteur systemd, pas une tâche cron anonyme', () => {
    expect(SCRIPT).toMatch(/\/etc\/systemd\/system\/\$\{MAJ_UNITE\}\.timer/)
    expect(SCRIPT).toMatch(/systemctl enable --now "\$\{MAJ_UNITE\}\.timer"/)
    // « oneshot » : systemd ne relance pas le service tant qu'il tourne, donc
    // deux déploiements ne peuvent pas se chevaucher.
    expect(SCRIPT).toMatch(/Type=oneshot/)
  })

  it('ne redéploie que si le commit distant a bougé', () => {
    // Sans ce garde-fou, certbot et le pré-vol DNS tourneraient toutes les
    // cinq minutes pour rien — et le quota Let's Encrypt est de 5 par heure.
    expect(SCRIPT).toMatch(/if \[ "\\\$\{ICI\}" = "\\\$\{LA\}" \]; then\n\s*exit 0/)
  })

  it('n’écrit aucun secret dans le script qu’elle installe', () => {
    // /usr/local/bin/<slug>-maj est en clair ; .env est en 0600. Les clés
    // restent du côté du fichier protégé.
    const debut = SCRIPT.indexOf('cat > "${MAJ_BIN}"')
    const fin = SCRIPT.indexOf('\nMAJ\n', debut)
    expect(debut).toBeGreaterThan(-1)
    const genere = SCRIPT.slice(debut, fin)
    for (const secret of [
      'ANTHROPIC_API_KEY',
      'COMPTES_MASTER_KEY',
      'ADMIN_TOKEN',
      'ADMIN_MASTER_KEY',
      'GOOGLE_MAPS_API_KEY',
      'MODERATION_TOKEN',
    ]) {
      expect(genere, `${secret} ne doit pas figurer dans le script installé`).not.toContain(
        `${secret}=`,
      )
    }
  })

  it('peut être désactivée sans supprimer ce qu’elle a posé', () => {
    expect(SCRIPT).toMatch(/systemctl disable --now "\$\{MAJ_UNITE\}\.timer"/)
  })
})

/* ------------------------------------------------- racine du domaine et HSTS */

describe('le mode racine', () => {
  const script = readFileSync(resolve(RACINE, 'deploy/vps-setup.sh'), 'utf8')

  it('existe, et vaut 0 par défaut', () => {
    // Un déploiement qui basculerait tout seul sur la racine casserait les
    // liens existants sans prévenir.
    expect(script).toMatch(/RACINE="\$\{RACINE:-0\}"/)
  })

  it('construit le front avec la bonne base', () => {
    // La base conditionne les chemins des assets, l'adresse de l'API, les
    // liens du blog, les cartes de partage et le plan du site. Une base fausse
    // ne casse rien au build : tout revient en 404 une fois en ligne.
    expect(script).toMatch(/if \[ "\$\{RACINE\}" = "1" \]; then BASE_WEB="\/"; else BASE_WEB="\/\$\{SLUG\}\/"; fi/)
    expect(script).toContain('VITE_BASE="${BASE_WEB}" npm run "${COMMANDE_BUILD}"')
  })

  it('n’écrit aucune adresse finale en dur', () => {
    // Trois messages annonçaient « /${SLUG}/ » : en mode racine ils auraient
    // envoyé l'exploitant sur une page qui n'existe plus.
    expect(script).not.toMatch(/URL_FINALE="[^"]*\/\$\{SLUG\}\//)
    expect((script.match(/URL_FINALE="[^"]*\$\{BASE_WEB\}"/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('retire la redirection de « / » quand le projet EST la racine', () => {
    // La laisser ferait boucler « / » sur lui-même.
    const bloc = script.slice(script.indexOf('# Redirection facultative'))
    const racine = bloc.indexOf('if [ "${RACINE}" = "1" ]; then')
    const suppression = bloc.indexOf('rm -f "${INCLUDE_DIR}/000-root-redirect.conf"')
    expect(racine).toBeGreaterThan(-1)
    expect(suppression).toBeGreaterThan(racine)
  })

  it('sert le front et l’API aux bons chemins dans chaque mode', () => {
    expect(script).toMatch(/location \/ \{\n\s+root \/var\/www\/\$\{SLUG\};/)
    expect(script).toMatch(/location \/api\/ \{\n\s+proxy_pass http:\/\/127\.0\.0\.1:\$\{API_PORT\}\/api\//)
    expect(script).toMatch(/location \/\$\{SLUG\}\/ \{/)
    expect(script).toMatch(/location \/\$\{SLUG\}\/api\/ \{/)
  })

  it('garde les deux en-têtes qui cassent l’API en silence, dans les DEUX modes', () => {
    // Le mode racine a été ajouté en dupliquant le bloc : c'est exactement le
    // genre de copie où l'on oublie la moitié des en-têtes.
    expect((script.match(/proxy_set_header X-Forwarded-Proto/g) ?? []).length).toBe(2)
    expect((script.match(/proxy_set_header X-Forwarded-For/g) ?? []).length).toBe(2)
  })
})

describe('HSTS', () => {
  const script = readFileSync(resolve(RACINE, 'deploy/vps-setup.sh'), 'utf8')

  it('n’est posé qu’avec un certificat', () => {
    // Annoncer HSTS sans TLS enfermerait les visiteurs devant un site
    // inatteignable, pour la durée annoncée.
    expect(script).toMatch(/if \[ "\$\{HSTS\}" = "1" \] && \[ "\$\{TLS\}" = "1" \]; then/)
  })

  it('passe par une table, pour n’émettre l’en-tête qu’en HTTPS', () => {
    // Le même fichier d'include sert les blocs 80 et 443. La RFC interdit
    // d'envoyer l'en-tête en clair ; nginx n'émet pas une valeur vide.
    expect(script).toMatch(/map \\\$scheme \\\$hsts \{/)
    expect(script).toMatch(/default\s+"";/)
    expect(script).toMatch(/https\s+"max-age=\$\{HSTS_AGE\}"/)
    expect(script).toContain('add_header Strict-Transport-Security $hsts always;')
  })

  it('ne s’engage pas sur les sous-domaines', () => {
    // Engager un an sur des sous-domaines qui n'existent pas encore se paie
    // cher : le jour où l'un d'eux sort en HTTP, il est inatteignable. À
    // ajouter à la main, en connaissance de cause.
    //
    // On inspecte la POLITIQUE émise, pas le fichier entier : la première
    // version de ce test tombait sur le commentaire qui explique justement
    // pourquoi on ne le met pas.
    const politique = /https\s+"([^"]*)"/.exec(script)
    expect(politique, 'la table HSTS n’a pas de valeur pour https').not.toBeNull()
    expect(politique![1]).not.toMatch(/includeSubDomains/i)
    expect(politique![1]).not.toMatch(/preload/i)
  })

  it('annonce un an par défaut, et reste réglable', () => {
    expect(script).toMatch(/HSTS_AGE="\$\{HSTS_AGE:-31536000\}"/)
  })
})

/* ------------------------------------------------ la base de données du VPS */

describe('l’installation de PostgreSQL', () => {
  const PG = readFileSync(resolve(RACINE, 'deploy/postgres-setup.sh'), 'utf8')
  const VPS = readFileSync(resolve(RACINE, 'deploy/vps-setup.sh'), 'utf8')

  it('ne tourne jamais derrière le minuteur de mise en ligne', () => {
    /* vps-setup.sh est relancé toutes les cinq minutes. Appliquer des
       migrations à ce rythme, sur une base de production, c'est les appliquer
       sans que personne ne l'ait décidé. */
    expect(VPS).not.toContain('postgres-setup.sh')
  })

  it('ne régénère pas un mot de passe déjà posé', () => {
    /* Une rotation silencieuse casse l'API jusqu'au prochain redémarrage, et
       rien ne le dit : le script lit DATABASE_URL avant de décider. Même
       règle que les secrets repris du .env, et qu'AUTO_MAJ. */
    expect(PG).toMatch(/URL_EXISTANTE="\$\(sed -n 's\/\^DATABASE_URL=\/\/p'/)
    const decision = PG.slice(PG.indexOf('if [ -n "${URL_EXISTANTE}" ]; then'))
    expect(decision).toContain('mot de passe conservé')
  })

  it('n’écrit aucun mot de passe en dur', () => {
    expect(PG).toContain('openssl rand -hex 24')
    // Un mot de passe littéral dans un script versionné est un mot de passe
    // public. Aucune affectation de MDP à autre chose qu'un tirage.
    const affectations = PG.match(/^\s*MDP=.*/gm) ?? []
    for (const a of affectations) {
      expect(a, `MDP ne doit venir que d'un tirage : ${a}`).toMatch(
        /MDP=""|MDP="\$\(openssl rand -hex 24\)"/,
      )
    }
  })

  it('relance pm2 avec TOUT l’environnement, pas la seule DATABASE_URL', () => {
    /* `pm2 --update-env` REMPLACE l'environnement du processus par celui du
       shell. Ne lui passer que DATABASE_URL effacerait ANTHROPIC_API_KEY,
       ADMIN_TOKEN et surtout COMPTES_MASTER_KEY — sans laquelle les comptes
       déjà créés deviennent illisibles et le détail chiffré s'ouvre à tous. */
    const avantRestart = PG.slice(0, PG.indexOf('pm2 restart'))
    expect(avantRestart).toContain('done < "${APP_DIR}/.env"')
    // Lecture ligne à ligne et non `source` : une valeur contenant une espace
    // — ADMIN_EMAILS="a@b.fr, c@d.fr" — casse un `source`.
    expect(PG).not.toMatch(/^\s*(source|\.) "\$\{APP_DIR\}\/\.env"/m)
  })

  it('garde le .env illisible hors de root', () => {
    // Il contient désormais le mot de passe de la base.
    expect(PG).toContain('chmod 600 "${APP_DIR}/.env"')
  })

  it('S’ARRÊTE si la base écoute au-delà de la machine', () => {
    /* Le défaut de Debian est « localhost », mais quelqu'un a pu le desserrer
       pour se connecter depuis son poste et l'oublier.

       Avertir ne suffit pas : l'avertissement défile, « Terminé. » s'affiche
       quelques lignes plus bas, et la base de comptes de mineurs vient d'être
       créée sur un serveur qui écoute l'Internet. Le script sort en erreur, à
       moins qu'on ne l'ait explicitement assumé. */
    expect(PG).toContain('show listen_addresses')
    expect(PG).toContain('[ "${ECOUTE_LARGE_ASSUMEE:-0}" = "1" ] || exit 1')
  })

  it('S’ARRÊTE si PostGIS manque, plutôt que de migrer en mode dégradé', () => {
    /* appliquer.sh compare les NOMS, jamais la colonne « degrade » : une
       migration passée en mode dégradé n'est plus jamais rejouée. Une panne
       passagère d'apt-get figerait donc le schéma de production en texte pour
       toujours, carte et recherches par distance mortes sans message. */
    expect(PG).toContain('[ "${SANS_POSTGIS:-0}" = "1" ] || exit 1')
  })

  it('pose ses deux gardes AVANT de créer quoi que ce soit', () => {
    // Un garde posé après la création ne garde plus rien.
    const gardePostgis = PG.indexOf('SANS_POSTGIS:-0')
    const gardeEcoute = PG.indexOf('ECOUTE_LARGE_ASSUMEE:-0')
    const creation = PG.indexOf('CREATE ROLE ${BASE}')
    const migration = PG.indexOf('appliquer.sh"')
    expect(gardePostgis).toBeGreaterThan(-1)
    expect(gardeEcoute).toBeGreaterThan(-1)
    expect(gardePostgis).toBeLessThan(creation)
    expect(gardeEcoute).toBeLessThan(creation)
    expect(creation).toBeLessThan(migration)
  })

  it('démarre PostgreSQL avant de l’interroger', () => {
    // Version, PostGIS et listen_addresses passent tous par psql. Le service
    // doit tourner avant la première requête, y compris sur une machine où
    // quelqu'un l'a arrêté.
    const demarrage = PG.indexOf('systemctl enable --now postgresql')
    const premiereRequete = PG.indexOf('psql --version')
    expect(demarrage).toBeGreaterThan(-1)
    expect(demarrage).toBeLessThan(premiereRequete)
  })

  it('lit la version de PostgreSQL au lieu de la supposer', () => {
    // Le nom du paquet PostGIS la porte : postgresql-16-postgis-3. Une
    // version en dur cesserait de s'installer à la prochaine version de la
    // distribution, sans autre symptôme qu'un mode dégradé silencieux.
    expect(PG).toContain('VERSION="$(psql --version |')
    expect(PG).toContain('"postgresql-${VERSION}-postgis-3"')
  })
})

describe('une migration dégradée cesse d’être silencieuse', () => {
  const APPLIQUER = readFileSync(
    resolve(RACINE, 'kitetudiant/db/migrations/appliquer.sh'),
    'utf8',
  )

  it('rappelle les migrations appliquées sans PostGIS, une fois PostGIS là', () => {
    /* La boucle saute sur le nom seul : « select count(*) … where nom = … ».
       La colonne « degrade » était donc écrite puis jamais relue, et le
       passage suivant annonçait « Migrations à jour » sur un schéma resté en
       texte. Reproduit contre un vrai PostgreSQL 16 : sans ce rappel, rien ne
       distingue une base saine d'une base définitivement dégradée. */
    expect(APPLIQUER).toContain('select count(*) from public.migration where degrade')
    expect(APPLIQUER).toContain('migration(s) ont été appliquées SANS')
  })

  it('ne le rappelle pas pendant un passage lui-même dégradé', () => {
    // Sinon un poste de développement sans PostGIS afficherait l'alerte à
    // chaque lancement, et une alerte permanente n'est plus une alerte.
    expect(APPLIQUER).toContain('[ "$DEGRADEES" != "0" ] && [ "$DEGRADE" = false ]')
  })

  it('ne prétend pas réparer', () => {
    // Rejouer une migration sur une base qui porte des données est une
    // décision, pas un effet de bord de script.
    expect(APPLIQUER).toContain("c'est une migration à écrire")
  })
})
