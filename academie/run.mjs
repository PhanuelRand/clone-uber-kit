#!/usr/bin/env node
// Lanceur des vérifications de l'Académie IA (ADR-0014).
//
// Usage : node academie/run.mjs 3
//
// Exécute les suites des modules 1 à N — elles sont cumulatives, donc une
// régression sur une étape déjà validée fait échouer les suivantes. C'est
// exactement ce que fait l'intégration continue : lancez-le avant de pousser.

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const checksDir = join(dirname(fileURLToPath(import.meta.url)), 'checks')
const target = Number(process.argv[2])

if (!Number.isInteger(target) || target < 1) {
  console.error('Usage : node academie/run.mjs <numéro de module>')
  process.exit(2)
}

// Les suites sont cumulatives : valider le module N exige les modules 1 à N.
const suites = Array.from({ length: target }, (_unused, index) => ({
  name: `module-${index + 1}`,
  path: join(checksDir, `module-${index + 1}`),
}))

// Une suite absente ne doit jamais se lire comme une réussite.
const missing = suites.filter((suite) => !existsSync(suite.path))
if (missing.length > 0) {
  console.error(`Suites introuvables : ${missing.map((suite) => suite.name).join(', ')}.`)
  console.error('Le harnais est incomplet; restaurez-le depuis le dépôt modèle.')
  process.exit(2)
}

let failed = 0
for (const suite of suites) {
  console.log(`\n── ${suite.name} ${'─'.repeat(Math.max(0, 40 - suite.name.length))}`)
  // Le lanceur de tests vient de votre dépôt, pas du harnais.
  const result = spawnSync('npx', ['vitest', 'run', suite.path, '--reporter=basic'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) failed += 1
}

if (failed > 0) {
  console.error(`\n${failed} suite(s) en échec. Le module ${target} n'est pas validé.`)
  process.exit(1)
}
console.log(`\nToutes les suites jusqu'au module ${target} sont au vert.`)
