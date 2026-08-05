import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { getDataDir } from '../lib/local-media'
import { migrations } from './migrations'
import type { DatabaseMigration } from './migrations/types'

const MIGRATION_ID_PATTERN = /^\d{14}-[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface MigrationResult {
  id: string
  status: 'applied' | 'skipped'
}

interface RunMigrationOptions {
  dbPath?: string
  migrationList?: DatabaseMigration[]
}

function validateMigrations(migrationList: DatabaseMigration[]): DatabaseMigration[] {
  const ordered = [...migrationList].sort((left, right) => left.id.localeCompare(right.id))
  const ids = new Set<string>()

  ordered.forEach(migration => {
    if (!MIGRATION_ID_PATTERN.test(migration.id)) {
      throw new Error(`迁移 ID 必须使用 YYYYMMDDHHmmss-description 格式：${migration.id}`)
    }
    if (ids.has(migration.id)) throw new Error(`迁移 ID 重复：${migration.id}`)
    ids.add(migration.id)
  })

  return ordered
}

export function runMigrations(options: RunMigrationOptions = {}): MigrationResult[] {
  const dataDir = getDataDir()
  const dbPath = path.resolve(options.dbPath ?? path.join(dataDir, 'studio.sqlite'))
  if (!existsSync(dbPath)) {
    throw new Error(`数据库不存在：${dbPath}。请先运行 npm run db:init`)
  }

  mkdirSync(path.dirname(dbPath), { recursive: true })
  const migrationList = validateMigrations(options.migrationList ?? migrations)
  const db = new Database(dbPath)

  try {
    db.pragma('foreign_keys = ON')
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `)

    const appliedIds = new Set((db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>)
      .map(row => row.id))
    const insertApplied = db.prepare(`
      INSERT INTO schema_migrations (id, description, applied_at) VALUES (?, ?, ?)
    `)
    const results: MigrationResult[] = []

    migrationList.forEach(migration => {
      if (appliedIds.has(migration.id)) {
        results.push({ id: migration.id, status: 'skipped' })
        return
      }

      const apply = db.transaction(() => {
        migration.up(db)
        insertApplied.run(migration.id, migration.description, new Date().toISOString())
      })
      apply()
      appliedIds.add(migration.id)
      results.push({ id: migration.id, status: 'applied' })
    })

    return results
  } finally {
    db.close()
  }
}

function main(): void {
  const results = runMigrations()
  if (results.length === 0) {
    console.log('没有已注册的数据库迁移。')
    return
  }
  results.forEach(result => console.log(`${result.status === 'applied' ? '已执行' : '已跳过'} ${result.id}`))
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    main()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
