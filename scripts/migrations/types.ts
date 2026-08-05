import type Database from 'better-sqlite3'

export interface DatabaseMigration {
  id: string
  description: string
  up: (db: Database.Database) => void
}
