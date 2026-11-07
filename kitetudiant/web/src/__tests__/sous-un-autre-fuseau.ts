/**
 * Le complice de `dates.test.ts`.
 *
 * Il existe uniquement pour être lancé dans un autre fuseau que celui du
 * lanceur de tests, qui fixe le sien au démarrage du processus. Il imprime
 * trois dates seules, rendues par la fonction réelle.
 *
 * Pas de `.test.ts` dans le nom : vitest le ramasserait comme un fichier de
 * tests, et un fichier sans `it` fait échouer la campagne.
 */

import { dateLisible } from '../dates.ts'

process.stdout.write(
  ['2025-09-01', '2025-01-01', '2025-12-31'].map(dateLisible).join('|'),
)
