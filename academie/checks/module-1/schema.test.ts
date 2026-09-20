/**
 * Module 1 — vérifications structurelles.
 *
 * Elles lisent le dépôt sans exécuter de code : présence d'une migration
 * versionnée, contraintes déclarées, montants en entiers. Ce sont les critères
 * c1 et c4 de la consigne.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), 'migrations')

function migrations(): string {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))
  expect(files.length, 'aucune migration .sql dans migrations/').toBeGreaterThan(0)
  return files.map((name) => readFileSync(join(migrationsDir, name), 'utf8')).join('\n')
}

describe('migration initiale', () => {
  it('crée les tables du domaine', () => {
    const sql = migrations().toLowerCase()
    for (const table of ['passengers', 'drivers', 'vehicles', 'rides']) {
      expect(sql, `table ${table} absente`).toContain(table)
    }
  })

  it('déclare des clés primaires et des clés étrangères', () => {
    const sql = migrations().toLowerCase()
    expect(sql).toContain('primary key')
    expect(sql).toMatch(/references|foreign key/)
  })

  it('déclare des colonnes obligatoires', () => {
    expect(migrations().toLowerCase()).toContain('not null')
  })

  it('stocke les montants en entiers, jamais en virgule flottante', () => {
    const sql = migrations().toLowerCase()
    const fareColumn = /fare[_a-z]*\s+(\w+)/.exec(sql)
    expect(fareColumn?.[1], 'aucune colonne de montant trouvée').toBeDefined()
    expect(['integer', 'int', 'int4', 'bigint', 'int8']).toContain(fareColumn?.[1])
    expect(sql).not.toMatch(/fare[_a-z]*\s+(real|double|float|numeric|decimal)/)
  })
})
