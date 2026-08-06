import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { migrations } from './migrations'
import { runMigrations } from './migrate-db'

let temporaryDataDir = ''

function createLegacyDatabase(): string {
  temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-migration-test-'))
  const dbPath = path.join(temporaryDataDir, 'studio.sqlite')
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      brief TEXT NOT NULL DEFAULT '',
      synopsis TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '短剧',
      visual_style TEXT NOT NULL DEFAULT '电影感写实风格',
      ratio TEXT NOT NULL DEFAULT '9:16',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE shot_videos (
      id TEXT PRIMARY KEY,
      shot_id TEXT NOT NULL,
      path TEXT,
      provider_task_id TEXT NOT NULL,
      model TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 0,
      resolution TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    INSERT INTO shot_videos (id, shot_id, path, provider_task_id, model, duration, resolution, created_at)
    VALUES ('video-before-migration', 'shot-1', 'videos/legacy.mp4', 'task-1', 'seedance', 5, '720p', '2026-08-05T00:00:00.000Z');
  `)
  db.prepare(`
    INSERT INTO projects (id, title, brief, synopsis, genre, visual_style, ratio, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'project-before-migration',
    '迁移前项目',
    '保留这条创作需求',
    '原有梗概',
    '悬疑复仇',
    '电影感写实',
    '9:16',
    '2026-08-05T00:00:00.000Z',
    '2026-08-05T00:00:00.000Z',
  )
  db.close()
  return dbPath
}

afterEach(() => {
  if (temporaryDataDir) rmSync(temporaryDataDir, { recursive: true, force: true })
  temporaryDataDir = ''
})

describe('显式 SQLite 迁移', () => {
  it('按时间戳注册全部迁移文件', () => {
    const migrationDir = path.join(process.cwd(), 'scripts', 'migrations')
    const fileIds = readdirSync(migrationDir)
      .filter(name => /^\d{14}-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/.test(name))
      .map(name => name.replace(/\.ts$/, ''))
      .sort()
    const registeredIds = migrations.map(migration => migration.id).sort()

    expect(fileIds).toEqual(registeredIds)
  })

  it('保留旧项目并可安全重复执行', () => {
    const dbPath = createLegacyDatabase()

    expect(runMigrations({ dbPath })).toEqual([
      { id: '20260805213800-add-planned-episodes', status: 'applied' },
      { id: '20260806171147-add-shot-video-details', status: 'applied' },
    ])
    expect(runMigrations({ dbPath })).toEqual([
      { id: '20260805213800-add-planned-episodes', status: 'skipped' },
      { id: '20260806171147-add-shot-video-details', status: 'skipped' },
    ])

    const db = new Database(dbPath, { readonly: true })
    const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
    const project = db.prepare(`
      SELECT id, title, brief, planned_episodes FROM projects WHERE id = ?
    `).get('project-before-migration') as Record<string, unknown>
    const videoColumns = db.prepare('PRAGMA table_info(shot_videos)').all() as Array<{ name: string }>
    const video = db.prepare('SELECT path, prompt, rating, note FROM shot_videos WHERE id = ?')
      .get('video-before-migration') as Record<string, unknown>
    const migrationCount = db.prepare('SELECT COUNT(*) count FROM schema_migrations').get() as { count: number }
    db.close()

    expect(columns.map(column => column.name)).toContain('planned_episodes')
    expect(project).toEqual({
      id: 'project-before-migration',
      title: '迁移前项目',
      brief: '保留这条创作需求',
      planned_episodes: null,
    })
    expect(videoColumns.map(column => column.name)).toEqual(expect.arrayContaining(['prompt', 'rating', 'note']))
    expect(video).toEqual({ path: 'videos/legacy.mp4', prompt: '', rating: null, note: '' })
    expect(migrationCount.count).toBe(2)
  })

  it('迁移失败时回滚全部修改且不记录为已完成', () => {
    const dbPath = createLegacyDatabase()
    expect(() => runMigrations({
      dbPath,
      migrationList: [{
        id: '20260805213900-failing-probe',
        description: '验证迁移事务回滚',
        up(db) {
          db.exec('CREATE TABLE migration_probe (id TEXT PRIMARY KEY)')
          throw new Error('模拟迁移失败')
        },
      }],
    })).toThrow('模拟迁移失败')

    const db = new Database(dbPath, { readonly: true })
    const probeTable = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'
    `).get()
    const migrationCount = db.prepare('SELECT COUNT(*) count FROM schema_migrations').get() as { count: number }
    const projectCount = db.prepare('SELECT COUNT(*) count FROM projects').get() as { count: number }
    db.close()

    expect(probeTable).toBeUndefined()
    expect(migrationCount.count).toBe(0)
    expect(projectCount.count).toBe(1)
  })
})
