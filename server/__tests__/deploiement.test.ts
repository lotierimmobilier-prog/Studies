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
