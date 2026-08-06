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
    CREATE TABLE episodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      episode_number INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, episode_number)
    );
    CREATE TABLE entities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      variant TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      episodes_json TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      selected_image_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE entity_images (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE shots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
      shot_order INTEGER NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL DEFAULT 5,
      reference_entity_ids_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      provider_task_id TEXT,
      error TEXT,
      selected_video_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(episode_id, shot_order)
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
    CREATE TABLE edits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      episode_id TEXT NOT NULL UNIQUE REFERENCES episodes(id) ON DELETE CASCADE,
      clips_json TEXT NOT NULL DEFAULT '[]',
      output_path TEXT,
      updated_at TEXT NOT NULL
    );
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
  db.exec(`
    INSERT INTO episodes (id, project_id, episode_number, title, content, status, created_at, updated_at)
    VALUES ('episode-before-migration', 'project-before-migration', 1, '第一集', '旧剧本内容', 'confirmed', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z');
    INSERT INTO entities (
      id, project_id, kind, name, variant, description, episodes_json, category, metadata_json,
      selected_image_id, created_at, updated_at
    ) VALUES (
      'entity-before-migration', 'project-before-migration', 'character', '林夏', '默认形象', '旧角色描述', '[1]', '', '{}',
      'image-before-migration', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z'
    );
    INSERT INTO entity_images (id, entity_id, path, prompt, created_at)
    VALUES ('image-before-migration', 'entity-before-migration', 'images/legacy.png', '旧图片提示词', '2026-08-05T00:00:00.000Z');
    INSERT INTO shots (
      id, project_id, episode_id, shot_order, prompt, duration, reference_entity_ids_json,
      status, provider_task_id, error, selected_video_id, created_at, updated_at
    ) VALUES (
      'shot-1', 'project-before-migration', 'episode-before-migration', 1, '旧分镜提示词', 5,
      '["entity-before-migration"]', 'success', 'task-1', NULL, 'video-before-migration',
      '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z'
    );
    INSERT INTO shot_videos (id, shot_id, path, provider_task_id, model, duration, resolution, created_at)
    VALUES ('video-before-migration', 'shot-1', 'videos/legacy.mp4', 'task-1', 'seedance', 5, '720p', '2026-08-05T00:00:00.000Z');
    INSERT INTO edits (id, project_id, episode_id, clips_json, output_path, updated_at)
    VALUES (
      'edit-before-migration', 'project-before-migration', 'episode-before-migration',
      '[{"id":"clip-1","shotId":"shot-1","enabled":true,"start":0,"end":5}]',
      'exports/legacy.mp4', '2026-08-05T00:00:00.000Z'
    );
  `)
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
      { id: '20260806223000-add-soft-deletion', status: 'applied' },
    ])
    expect(runMigrations({ dbPath })).toEqual([
      { id: '20260805213800-add-planned-episodes', status: 'skipped' },
      { id: '20260806171147-add-shot-video-details', status: 'skipped' },
      { id: '20260806223000-add-soft-deletion', status: 'skipped' },
    ])

    const db = new Database(dbPath, { readonly: true })
    const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
    const project = db.prepare(`
      SELECT id, title, brief, planned_episodes FROM projects WHERE id = ?
    `).get('project-before-migration') as Record<string, unknown>
    const videoColumns = db.prepare('PRAGMA table_info(shot_videos)').all() as Array<{ name: string }>
    const video = db.prepare('SELECT path, prompt, rating, note, deleted_at FROM shot_videos WHERE id = ?')
      .get('video-before-migration') as Record<string, unknown>
    const tableColumns = Object.fromEntries([
      'projects', 'episodes', 'entities', 'entity_images', 'shots', 'shot_videos', 'edits',
    ].map(table => [
      table,
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(column => column.name),
    ]))
    const episode = db.prepare(`
      SELECT episode_number, deleted_episode_number, deleted_at FROM episodes WHERE id = ?
    `).get('episode-before-migration') as Record<string, unknown>
    const entity = db.prepare(`
      SELECT selected_image_id, deleted_at FROM entities WHERE id = ?
    `).get('entity-before-migration') as Record<string, unknown>
    const image = db.prepare(`
      SELECT path, deleted_at FROM entity_images WHERE id = ?
    `).get('image-before-migration') as Record<string, unknown>
    const shot = db.prepare(`
      SELECT shot_order, deleted_shot_order, selected_video_id, deleted_at FROM shots WHERE id = ?
    `).get('shot-1') as Record<string, unknown>
    const edit = db.prepare(`
      SELECT output_path, deleted_at FROM edits WHERE id = ?
    `).get('edit-before-migration') as Record<string, unknown>
    const migrationCount = db.prepare('SELECT COUNT(*) count FROM schema_migrations').get() as { count: number }
    db.close()

    expect(columns.map(column => column.name)).toEqual(expect.arrayContaining(['planned_episodes', 'deleted_at']))
    expect(project).toEqual({
      id: 'project-before-migration',
      title: '迁移前项目',
      brief: '保留这条创作需求',
      planned_episodes: null,
    })
    expect(videoColumns.map(column => column.name)).toEqual(expect.arrayContaining(['prompt', 'rating', 'note', 'deleted_at']))
    expect(video).toEqual({ path: 'videos/legacy.mp4', prompt: '', rating: null, note: '', deleted_at: null })
    Object.values(tableColumns).forEach(names => expect(names).toContain('deleted_at'))
    expect(tableColumns.episodes).toContain('deleted_episode_number')
    expect(tableColumns.shots).toContain('deleted_shot_order')
    expect(episode).toEqual({ episode_number: 1, deleted_episode_number: null, deleted_at: null })
    expect(entity).toEqual({ selected_image_id: 'image-before-migration', deleted_at: null })
    expect(image).toEqual({ path: 'images/legacy.png', deleted_at: null })
    expect(shot).toEqual({
      shot_order: 1,
      deleted_shot_order: null,
      selected_video_id: 'video-before-migration',
      deleted_at: null,
    })
    expect(edit).toEqual({ output_path: 'exports/legacy.mp4', deleted_at: null })
    expect(migrationCount.count).toBe(3)
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
