import type Database from 'better-sqlite3'
import type { DatabaseMigration } from './types'

const TABLES = [
  'projects',
  'episodes',
  'entities',
  'entity_images',
  'shots',
  'shot_videos',
  'edits',
] as const

const INDEXES = [
  ['projects', 'idx_projects_active', 'projects(deleted_at, updated_at)'],
  ['episodes', 'idx_episodes_active', 'episodes(project_id, deleted_at, episode_number)'],
  ['entities', 'idx_entities_active', 'entities(project_id, deleted_at, kind)'],
  ['entity_images', 'idx_entity_images_active', 'entity_images(entity_id, deleted_at, created_at)'],
  ['shots', 'idx_shots_active', 'shots(episode_id, deleted_at, shot_order)'],
  ['shot_videos', 'idx_shot_videos_active', 'shot_videos(shot_id, deleted_at, created_at)'],
] as const

function tableExists(db: Database.Database, tableName: string): boolean {
  return Boolean(db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
  `).get(tableName))
}

const migration: DatabaseMigration = {
  id: '20260806223000-add-soft-deletion',
  description: '为工作流记录和本地素材版本增加非破坏式软删除标记',
  up(db) {
    const existingTables = new Set(TABLES.filter(tableName => tableExists(db, tableName)))
    existingTables.forEach(tableName => {
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
      if (!columns.some(column => column.name === 'deleted_at')) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN deleted_at TEXT`)
      }
    })

    if (existingTables.has('episodes')) {
      const columns = db.prepare('PRAGMA table_info(episodes)').all() as Array<{ name: string }>
      if (!columns.some(column => column.name === 'deleted_episode_number')) {
        db.exec('ALTER TABLE episodes ADD COLUMN deleted_episode_number INTEGER')
      }
    }
    if (existingTables.has('shots')) {
      const columns = db.prepare('PRAGMA table_info(shots)').all() as Array<{ name: string }>
      if (!columns.some(column => column.name === 'deleted_shot_order')) {
        db.exec('ALTER TABLE shots ADD COLUMN deleted_shot_order INTEGER')
      }
    }

    INDEXES.forEach(([tableName, indexName, expression]) => {
      if (existingTables.has(tableName)) {
        db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${expression}`)
      }
    })
  },
}

export default migration
