import type { DatabaseMigration } from './types'

const migration: DatabaseMigration = {
  id: '20260805213800-add-planned-episodes',
  description: '为项目增加可选的计划总集数字段',
  up(db) {
    const projectsTable = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'
    `).get()
    if (!projectsTable) throw new Error('缺少 projects 表，请先确认目标数据库版本')

    const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
    if (columns.some(column => column.name === 'planned_episodes')) return

    db.exec('ALTER TABLE projects ADD COLUMN planned_episodes INTEGER')
  },
}

export default migration
