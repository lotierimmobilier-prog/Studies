import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
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

  it('est facultative et ne s’active pas toute seule', () => {
    // L'autre projet de la machine ne doit pas hériter d'un minuteur qu'on
    // n'a pas demandé pour lui.
    expect(SCRIPT).toMatch(/AUTO_MAJ="\$\{AUTO_MAJ:-0\}"/)
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
