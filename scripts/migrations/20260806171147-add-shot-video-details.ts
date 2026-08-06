import type { DatabaseMigration } from './types'

const migration: DatabaseMigration = {
  id: '20260806171147-add-shot-video-details',
  description: '为分镜视频版本增加提示词快照、评分和备注',
  up(db) {
    const table = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'shot_videos'
    `).get()
    if (!table) return

    const columns = db.prepare('PRAGMA table_info(shot_videos)').all() as Array<{ name: string }>
    const names = new Set(columns.map(column => column.name))
    if (!names.has('prompt')) db.exec("ALTER TABLE shot_videos ADD COLUMN prompt TEXT NOT NULL DEFAULT ''")
    if (!names.has('rating')) db.exec('ALTER TABLE shot_videos ADD COLUMN rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5))')
    if (!names.has('note')) db.exec("ALTER TABLE shot_videos ADD COLUMN note TEXT NOT NULL DEFAULT ''")
  },
}

export default migration
