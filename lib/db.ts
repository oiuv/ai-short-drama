import Database from 'better-sqlite3'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { DEFAULT_PROJECT_GENRE, normalizeProjectRatio } from '@/config/project-options'
import { getDefaultVideoStyle } from '@/config/video-styles'
import { getDataDir, mediaUrl } from './local-media'
import type {
  EditClip,
  EditDraft,
  Entity,
  EntityKind,
  Episode,
  GeneratedScript,
  ImageVersion,
  Project,
  ProjectBundle,
  ProjectListItem,
  Shot,
  ShotStatus,
  VideoVersion,
} from './types'

type SqlRow = Record<string, unknown>

declare global {
  var __shortDramaDb: Database.Database | undefined
}

function now(): string {
  return new Date().toISOString()
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function initialize(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      brief TEXT NOT NULL DEFAULT '',
      synopsis TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '短剧',
      visual_style TEXT NOT NULL DEFAULT '电影感写实风格',
      ratio TEXT NOT NULL DEFAULT '9:16',
      planned_episodes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
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

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('character', 'scene', 'prop')),
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

    CREATE TABLE IF NOT EXISTS entity_images (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shots (
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

    CREATE TABLE IF NOT EXISTS shot_videos (
      id TEXT PRIMARY KEY,
      shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
      path TEXT,
      provider_task_id TEXT NOT NULL,
      model TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 0,
      resolution TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      episode_id TEXT NOT NULL UNIQUE REFERENCES episodes(id) ON DELETE CASCADE,
      clips_json TEXT NOT NULL DEFAULT '[]',
      output_path TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project_id, episode_number);
    CREATE INDEX IF NOT EXISTS idx_entities_project_kind ON entities(project_id, kind);
    CREATE INDEX IF NOT EXISTS idx_entity_images_entity ON entity_images(entity_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_shots_episode ON shots(episode_id, shot_order);
    CREATE INDEX IF NOT EXISTS idx_shot_videos_shot ON shot_videos(shot_id, created_at);
  `)
}

export function getDb(): Database.Database {
  if (global.__shortDramaDb) return global.__shortDramaDb
  const dataDir = getDataDir()
  mkdirSync(dataDir, { recursive: true })
  const db = new Database(path.join(dataDir, 'studio.sqlite'))
  initialize(db)
  global.__shortDramaDb = db
  return db
}

function projectFromRow(row: SqlRow): Project {
  return {
    id: String(row.id),
    title: String(row.title),
    brief: String(row.brief ?? ''),
    synopsis: String(row.synopsis ?? ''),
    genre: String(row.genre ?? ''),
    visualStyle: String(row.visual_style ?? ''),
    ratio: String(row.ratio ?? '9:16'),
    plannedEpisodes: row.planned_episodes === null || row.planned_episodes === undefined
      ? null
      : Number(row.planned_episodes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function episodeFromRow(row: SqlRow): Episode {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    episodeNumber: Number(row.episode_number),
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    status: row.status === 'confirmed' ? 'confirmed' : 'draft',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function imageFromRow(row: SqlRow): ImageVersion {
  const imagePath = String(row.path)
  return {
    id: String(row.id),
    entityId: String(row.entity_id),
    path: imagePath,
    prompt: String(row.prompt ?? ''),
    createdAt: String(row.created_at),
    url: mediaUrl(imagePath)!,
  }
}

function videoFromRow(row: SqlRow): VideoVersion {
  const videoPath = row.path ? String(row.path) : null
  return {
    id: String(row.id),
    shotId: String(row.shot_id),
    path: videoPath,
    providerTaskId: String(row.provider_task_id),
    model: String(row.model),
    duration: Number(row.duration ?? 0),
    resolution: String(row.resolution ?? ''),
    createdAt: String(row.created_at),
    url: mediaUrl(videoPath),
  }
}

export function listProjects(): ProjectListItem[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as SqlRow[]
  return rows.map(row => {
    const project = projectFromRow(row)
    const episodeCounts = db.prepare(`
      SELECT COUNT(*) total, SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) confirmed
      FROM episodes WHERE project_id = ?
    `).get(project.id) as SqlRow
    const entityCounts = db.prepare(`
      SELECT kind, COUNT(*) total, SUM(CASE WHEN selected_image_id IS NOT NULL THEN 1 ELSE 0 END) with_image
      FROM entities WHERE project_id = ? GROUP BY kind
    `).all(project.id) as SqlRow[]
    const byKind = new Map(entityCounts.map(item => [String(item.kind), item]))
    const shotCounts = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) completed,
        SUM(CASE WHEN status = 'generating' THEN 1 ELSE 0 END) generating,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) failed
      FROM shots WHERE project_id = ?
    `).get(project.id) as SqlRow
    const count = (kind: EntityKind, field: 'total' | 'with_image') => Number(byKind.get(kind)?.[field] ?? 0)
    return {
      ...project,
      progress: {
        episodes: { total: Number(episodeCounts.total ?? 0), confirmed: Number(episodeCounts.confirmed ?? 0) },
        characters: { total: count('character', 'total'), withImage: count('character', 'with_image') },
        scenes: { total: count('scene', 'total'), withImage: count('scene', 'with_image') },
        props: { total: count('prop', 'total'), withImage: count('prop', 'with_image') },
        shots: {
          total: Number(shotCounts.total ?? 0),
          completed: Number(shotCounts.completed ?? 0),
          generating: Number(shotCounts.generating ?? 0),
          failed: Number(shotCounts.failed ?? 0),
        },
      },
    }
  })
}

export function createProject(input: Partial<Project> & { title: string }): Project {
  const db = getDb()
  const id = randomUUID()
  const timestamp = now()
  db.prepare(`
    INSERT INTO projects (id, title, brief, synopsis, genre, visual_style, ratio, planned_episodes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.title.trim() || '未命名项目',
    input.brief ?? '',
    input.synopsis ?? '',
    input.genre?.trim() || DEFAULT_PROJECT_GENRE,
    input.visualStyle?.trim() || getDefaultVideoStyle().promptValue,
    normalizeProjectRatio(input.ratio),
    input.plannedEpisodes ?? null,
    timestamp,
    timestamp,
  )
  return getProject(id)!
}

export function getProject(id: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as SqlRow | undefined
  return row ? projectFromRow(row) : null
}

export function updateProject(id: string, fields: Partial<Pick<Project, 'title' | 'brief' | 'synopsis' | 'genre' | 'visualStyle' | 'ratio' | 'plannedEpisodes'>>): Project | null {
  const db = getDb()
  const current = getProject(id)
  if (!current) return null
  db.prepare(`
    UPDATE projects SET title = ?, brief = ?, synopsis = ?, genre = ?, visual_style = ?, ratio = ?, planned_episodes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    fields.title ?? current.title,
    fields.brief ?? current.brief,
    fields.synopsis ?? current.synopsis,
    fields.genre ?? current.genre,
    fields.visualStyle ?? current.visualStyle,
    normalizeProjectRatio(fields.ratio ?? current.ratio),
    fields.plannedEpisodes === undefined ? current.plannedEpisodes : fields.plannedEpisodes,
    now(),
    id,
  )
  return getProject(id)
}

export function deleteProject(id: string): boolean {
  return getDb().prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0
}

export function getProjectBundle(projectId: string): ProjectBundle | null {
  const db = getDb()
  const project = getProject(projectId)
  if (!project) return null

  const episodes = (db.prepare('SELECT * FROM episodes WHERE project_id = ? ORDER BY episode_number').all(projectId) as SqlRow[])
    .map(episodeFromRow)

  const imageRows = db.prepare(`
    SELECT entity_images.* FROM entity_images
    JOIN entities ON entities.id = entity_images.entity_id
    WHERE entities.project_id = ? ORDER BY entity_images.created_at DESC
  `).all(projectId) as SqlRow[]
  const imagesByEntity = new Map<string, ImageVersion[]>()
  imageRows.map(imageFromRow).forEach(image => {
    imagesByEntity.set(image.entityId, [...(imagesByEntity.get(image.entityId) ?? []), image])
  })
  const entities = (db.prepare('SELECT * FROM entities WHERE project_id = ? ORDER BY kind, created_at').all(projectId) as SqlRow[])
    .map((row): Entity => {
      const images = imagesByEntity.get(String(row.id)) ?? []
      const selectedImageId = row.selected_image_id ? String(row.selected_image_id) : null
      return {
        id: String(row.id),
        projectId: String(row.project_id),
        kind: row.kind as EntityKind,
        name: String(row.name),
        variant: String(row.variant ?? ''),
        description: String(row.description ?? ''),
        episodes: parseJson<number[]>(row.episodes_json, []),
        category: String(row.category ?? ''),
        metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
        selectedImageId,
        images,
        selectedImage: images.find(image => image.id === selectedImageId) ?? images[0] ?? null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    })

  const videoRows = db.prepare(`
    SELECT shot_videos.* FROM shot_videos
    JOIN shots ON shots.id = shot_videos.shot_id
    WHERE shots.project_id = ? ORDER BY shot_videos.created_at DESC
  `).all(projectId) as SqlRow[]
  const videosByShot = new Map<string, VideoVersion[]>()
  videoRows.map(videoFromRow).forEach(video => {
    videosByShot.set(video.shotId, [...(videosByShot.get(video.shotId) ?? []), video])
  })
  const shots = (db.prepare('SELECT * FROM shots WHERE project_id = ? ORDER BY episode_id, shot_order').all(projectId) as SqlRow[])
    .map((row): Shot => {
      const videos = videosByShot.get(String(row.id)) ?? []
      const selectedVideoId = row.selected_video_id ? String(row.selected_video_id) : null
      return {
        id: String(row.id),
        projectId: String(row.project_id),
        episodeId: String(row.episode_id),
        shotOrder: Number(row.shot_order),
        prompt: String(row.prompt ?? ''),
        duration: Number(row.duration ?? 5),
        referenceEntityIds: parseJson<string[]>(row.reference_entity_ids_json, []),
        status: row.status as ShotStatus,
        providerTaskId: row.provider_task_id ? String(row.provider_task_id) : null,
        error: row.error ? String(row.error) : null,
        selectedVideoId,
        videos,
        selectedVideo: videos.find(video => video.id === selectedVideoId) ?? videos[0] ?? null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    })

  const edits = (db.prepare('SELECT * FROM edits WHERE project_id = ?').all(projectId) as SqlRow[])
    .map((row): EditDraft => ({
      id: String(row.id),
      projectId: String(row.project_id),
      episodeId: String(row.episode_id),
      clips: parseJson<EditClip[]>(row.clips_json, []),
      outputPath: row.output_path ? String(row.output_path) : null,
      outputUrl: mediaUrl(row.output_path ? String(row.output_path) : null),
      updatedAt: String(row.updated_at),
    }))

  return { project, episodes, entities, shots, edits }
}

interface GeneratedEntityRecord {
  kind: EntityKind
  name: string
  variant: string
  description: string
  episodes: number[]
  category: string
  metadata: Record<string, unknown>
}

function generatedEntityRecords(script: GeneratedScript): GeneratedEntityRecord[] {
  return [
    ...script.characters.map(character => ({
      kind: 'character' as const,
      name: character.name,
      variant: character.variant || '默认造型',
      description: character.description,
      episodes: character.episodes,
      category: '',
      metadata: {
        role: character.role,
        gender: character.gender,
        introduction: character.introduction || '',
        voiceDescription: character.voiceDescription || '',
      },
    })),
    ...script.scenes.map(scene => ({
      kind: 'scene' as const,
      name: scene.name,
      variant: '',
      description: scene.description,
      episodes: scene.episodes,
      category: '',
      metadata: {},
    })),
    ...script.props.map(prop => ({
      kind: 'prop' as const,
      name: prop.name,
      variant: '',
      description: prop.description,
      episodes: prop.episodes,
      category: prop.category,
      metadata: {},
    })),
  ]
}

function generatedEntityKey(entity: Pick<GeneratedEntityRecord, 'kind' | 'name' | 'variant'>): string {
  return `${entity.kind}\u0000${entity.name.trim()}\u0000${entity.variant.trim()}`
}

function mergeGeneratedEntities(
  db: Database.Database,
  projectId: string,
  script: GeneratedScript,
  timestamp: string,
  replaceEpisodeRange?: { start: number; end: number },
): void {
  const existingRows = db.prepare('SELECT * FROM entities WHERE project_id = ?').all(projectId) as SqlRow[]
  const updateEpisodes = db.prepare('UPDATE entities SET episodes_json = ?, updated_at = ? WHERE id = ?')

  if (replaceEpisodeRange) {
    existingRows.forEach(row => {
      const remaining = parseJson<number[]>(row.episodes_json, [])
        .filter(episode => episode < replaceEpisodeRange.start || episode > replaceEpisodeRange.end)
      row.episodes_json = JSON.stringify(remaining)
      updateEpisodes.run(row.episodes_json, timestamp, row.id)
    })
  }

  const existingByKey = new Map(existingRows.map(row => [generatedEntityKey({
    kind: row.kind as EntityKind,
    name: String(row.name),
    variant: String(row.variant ?? ''),
  }), row]))
  const insertEntity = db.prepare(`
    INSERT INTO entities (
      id, project_id, kind, name, variant, description, episodes_json, category, metadata_json,
      selected_image_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `)
  const updateEntity = db.prepare(`
    UPDATE entities
    SET description = ?, episodes_json = ?, category = ?, metadata_json = ?, updated_at = ?
    WHERE id = ?
  `)

  generatedEntityRecords(script).forEach(entity => {
    const key = generatedEntityKey(entity)
    const existing = existingByKey.get(key)
    const generatedEpisodes = entity.episodes.filter(episode => Number.isInteger(episode) && episode > 0)
    if (existing) {
      const episodes = [...new Set([
        ...parseJson<number[]>(existing.episodes_json, []),
        ...generatedEpisodes,
      ])].sort((a, b) => a - b)
      existing.episodes_json = JSON.stringify(episodes)
      updateEntity.run(
        entity.description,
        existing.episodes_json,
        entity.category,
        JSON.stringify(entity.metadata),
        timestamp,
        existing.id,
      )
      return
    }

    const id = randomUUID()
    const episodesJson = JSON.stringify([...new Set(generatedEpisodes)].sort((a, b) => a - b))
    insertEntity.run(
      id, projectId, entity.kind, entity.name, entity.variant, entity.description,
      episodesJson, entity.category, JSON.stringify(entity.metadata), timestamp, timestamp,
    )
    existingByKey.set(key, {
      id,
      kind: entity.kind,
      name: entity.name,
      variant: entity.variant,
      episodes_json: episodesJson,
    })
  })
}

function insertGeneratedEpisodes(
  db: Database.Database,
  projectId: string,
  episodes: GeneratedScript['episodes'],
  timestamp: string,
): void {
  const insertEpisode = db.prepare(`
    INSERT INTO episodes (id, project_id, episode_number, title, content, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
  `)
  episodes
    .sort((a, b) => a.episodeNumber - b.episodeNumber)
    .forEach(episode => insertEpisode.run(
      randomUUID(), projectId, episode.episodeNumber, episode.title, episode.content, timestamp, timestamp,
    ))
}

export function replaceGeneratedScript(
  projectId: string,
  script: GeneratedScript,
  plannedEpisodes: number | null,
): ProjectBundle {
  const db = getDb()
  const transaction = db.transaction(() => {
    const timestamp = now()
    db.prepare(`
      UPDATE projects SET title = ?, synopsis = ?, genre = ?, planned_episodes = ?, updated_at = ? WHERE id = ?
    `).run(script.project.title, script.project.synopsis, script.project.genre, plannedEpisodes, timestamp, projectId)
    db.prepare('DELETE FROM episodes WHERE project_id = ?').run(projectId)
    db.prepare('DELETE FROM entities WHERE project_id = ?').run(projectId)
    insertGeneratedEpisodes(db, projectId, script.episodes, timestamp)
    mergeGeneratedEntities(db, projectId, script, timestamp)
  })
  transaction()
  return getProjectBundle(projectId)!
}

export function appendGeneratedScript(
  projectId: string,
  script: GeneratedScript,
  options: { plannedEpisodes: number | null; brief?: string },
): ProjectBundle {
  const db = getDb()
  const transaction = db.transaction(() => {
    const existingNumbers = new Set((db.prepare(
      'SELECT episode_number FROM episodes WHERE project_id = ?',
    ).all(projectId) as SqlRow[]).map(row => Number(row.episode_number)))
    const conflict = script.episodes.find(episode => existingNumbers.has(episode.episodeNumber))
    if (conflict) throw new Error(`第 ${conflict.episodeNumber} 集已存在，无法续写覆盖`)

    const timestamp = now()
    if (options.brief !== undefined) {
      db.prepare(`
        UPDATE projects SET brief = ?, synopsis = ?, genre = ?, planned_episodes = ?, updated_at = ? WHERE id = ?
      `).run(options.brief, script.project.synopsis, script.project.genre, options.plannedEpisodes, timestamp, projectId)
    } else {
      db.prepare(`
        UPDATE projects SET synopsis = ?, genre = ?, planned_episodes = ?, updated_at = ? WHERE id = ?
      `).run(script.project.synopsis, script.project.genre, options.plannedEpisodes, timestamp, projectId)
    }
    insertGeneratedEpisodes(db, projectId, script.episodes, timestamp)
    mergeGeneratedEntities(db, projectId, script, timestamp)
  })
  transaction()
  return getProjectBundle(projectId)!
}

export function rewriteGeneratedScript(
  projectId: string,
  startEpisode: number,
  script: GeneratedScript,
): ProjectBundle {
  const db = getDb()
  const transaction = db.transaction(() => {
    const endEpisode = startEpisode + script.episodes.length - 1
    const targets = db.prepare(`
      SELECT id, episode_number FROM episodes
      WHERE project_id = ? AND episode_number BETWEEN ? AND ?
      ORDER BY episode_number
    `).all(projectId, startEpisode, endEpisode) as SqlRow[]
    if (targets.length !== script.episodes.length) throw new Error('重写范围包含不存在的分集')

    const targetByNumber = new Map(targets.map(target => [Number(target.episode_number), String(target.id)]))
    const timestamp = now()
    const updateEpisode = db.prepare(`
      UPDATE episodes SET title = ?, content = ?, status = 'draft', updated_at = ? WHERE id = ?
    `)
    script.episodes.forEach(episode => {
      const id = targetByNumber.get(episode.episodeNumber)
      if (!id) throw new Error(`重写结果缺少第 ${episode.episodeNumber} 集`)
      updateEpisode.run(episode.title, episode.content, timestamp, id)
    })

    const targetIds = [...targetByNumber.values()]
    const placeholders = targetIds.map(() => '?').join(', ')
    db.prepare(`DELETE FROM shots WHERE episode_id IN (${placeholders})`).run(...targetIds)
    db.prepare(`DELETE FROM edits WHERE episode_id IN (${placeholders})`).run(...targetIds)
    db.prepare(`
      UPDATE projects SET synopsis = ?, genre = ?, updated_at = ? WHERE id = ?
    `).run(script.project.synopsis, script.project.genre, timestamp, projectId)
    mergeGeneratedEntities(db, projectId, script, timestamp, { start: startEpisode, end: endEpisode })
  })
  transaction()
  return getProjectBundle(projectId)!
}

export function createEpisode(projectId: string): Episode {
  const db = getDb()
  const maxRow = db.prepare('SELECT MAX(episode_number) max_number FROM episodes WHERE project_id = ?').get(projectId) as SqlRow
  const episodeNumber = Number(maxRow.max_number ?? 0) + 1
  const id = randomUUID()
  const timestamp = now()
  db.prepare(`
    INSERT INTO episodes (id, project_id, episode_number, title, content, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', 'draft', ?, ?)
  `).run(id, projectId, episodeNumber, `第${episodeNumber}集`, timestamp, timestamp)
  return episodeFromRow(db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as SqlRow)
}

export function getEpisode(id: string): Episode | null {
  const row = getDb().prepare('SELECT * FROM episodes WHERE id = ?').get(id) as SqlRow | undefined
  return row ? episodeFromRow(row) : null
}

export function updateEpisode(id: string, fields: Partial<Pick<Episode, 'title' | 'content' | 'status'>>): Episode | null {
  const db = getDb()
  const current = getEpisode(id)
  if (!current) return null
  db.prepare('UPDATE episodes SET title = ?, content = ?, status = ?, updated_at = ? WHERE id = ?').run(
    fields.title ?? current.title,
    fields.content ?? current.content,
    fields.status ?? current.status,
    now(),
    id,
  )
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now(), current.projectId)
  return getEpisode(id)
}

export function deleteEpisode(id: string): boolean {
  return getDb().prepare('DELETE FROM episodes WHERE id = ?').run(id).changes > 0
}

export function createEntity(projectId: string, input: {
  kind: EntityKind
  name: string
  variant?: string
  description?: string
  episodes?: number[]
  category?: string
  metadata?: Record<string, unknown>
}): Entity {
  const db = getDb()
  const id = randomUUID()
  const timestamp = now()
  db.prepare(`
    INSERT INTO entities (
      id, project_id, kind, name, variant, description, episodes_json, category, metadata_json,
      selected_image_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    id, projectId, input.kind, input.name, input.variant ?? '', input.description ?? '',
    JSON.stringify(input.episodes ?? []), input.category ?? '', JSON.stringify(input.metadata ?? {}),
    timestamp, timestamp,
  )
  return getEntity(id)!
}

export function getEntity(id: string): Entity | null {
  const row = getDb().prepare('SELECT project_id FROM entities WHERE id = ?').get(id) as SqlRow | undefined
  if (!row) return null
  return getProjectBundle(String(row.project_id))?.entities.find(entity => entity.id === id) ?? null
}

export function updateEntity(id: string, fields: Partial<Pick<Entity, 'name' | 'variant' | 'description' | 'episodes' | 'category' | 'metadata'>>): Entity | null {
  const db = getDb()
  const current = getEntity(id)
  if (!current) return null
  db.prepare(`
    UPDATE entities SET name = ?, variant = ?, description = ?, episodes_json = ?, category = ?, metadata_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    fields.name ?? current.name,
    fields.variant ?? current.variant,
    fields.description ?? current.description,
    JSON.stringify(fields.episodes ?? current.episodes),
    fields.category ?? current.category,
    JSON.stringify(fields.metadata ?? current.metadata),
    now(),
    id,
  )
  return getEntity(id)
}

export function deleteEntity(id: string): boolean {
  return getDb().prepare('DELETE FROM entities WHERE id = ?').run(id).changes > 0
}

export function addEntityImage(entityId: string, imagePath: string, prompt: string): Entity {
  const db = getDb()
  const id = randomUUID()
  const timestamp = now()
  const transaction = db.transaction(() => {
    db.prepare('INSERT INTO entity_images (id, entity_id, path, prompt, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, entityId, imagePath, prompt, timestamp)
    db.prepare('UPDATE entities SET selected_image_id = ?, updated_at = ? WHERE id = ?')
      .run(id, timestamp, entityId)
  })
  transaction()
  return getEntity(entityId)!
}

export function selectEntityImage(entityId: string, imageId: string): Entity | null {
  const db = getDb()
  const owns = db.prepare('SELECT id FROM entity_images WHERE id = ? AND entity_id = ?').get(imageId, entityId)
  if (!owns) return null
  db.prepare('UPDATE entities SET selected_image_id = ?, updated_at = ? WHERE id = ?').run(imageId, now(), entityId)
  return getEntity(entityId)
}

export function replaceStoryboard(projectId: string, episodeId: string, shots: Array<{
  shotOrder: number
  prompt: string
  duration: number
  referenceEntityIds: string[]
}>): Shot[] {
  const db = getDb()
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM shots WHERE episode_id = ?').run(episodeId)
    const insert = db.prepare(`
      INSERT INTO shots (
        id, project_id, episode_id, shot_order, prompt, duration, reference_entity_ids_json,
        status, provider_task_id, error, selected_video_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?, ?)
    `)
    const timestamp = now()
    shots.forEach((shot, index) => insert.run(
      randomUUID(), projectId, episodeId, index + 1, shot.prompt, shot.duration,
      JSON.stringify(shot.referenceEntityIds), timestamp, timestamp,
    ))
  })
  transaction()
  return getProjectBundle(projectId)!.shots.filter(shot => shot.episodeId === episodeId)
}

export function createShot(projectId: string, episodeId: string): Shot {
  const db = getDb()
  const maxRow = db.prepare('SELECT MAX(shot_order) max_order FROM shots WHERE episode_id = ?').get(episodeId) as SqlRow
  const order = Number(maxRow.max_order ?? 0) + 1
  const id = randomUUID()
  const timestamp = now()
  db.prepare(`
    INSERT INTO shots (
      id, project_id, episode_id, shot_order, prompt, duration, reference_entity_ids_json,
      status, provider_task_id, error, selected_video_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, '', 5, '[]', 'pending', NULL, NULL, NULL, ?, ?)
  `).run(id, projectId, episodeId, order, timestamp, timestamp)
  return getShot(id)!
}

export function getShot(id: string): Shot | null {
  const row = getDb().prepare('SELECT project_id FROM shots WHERE id = ?').get(id) as SqlRow | undefined
  if (!row) return null
  return getProjectBundle(String(row.project_id))?.shots.find(shot => shot.id === id) ?? null
}

export function updateShot(id: string, fields: Partial<Pick<Shot, 'prompt' | 'duration' | 'referenceEntityIds' | 'selectedVideoId'>>): Shot | null {
  const db = getDb()
  const current = getShot(id)
  if (!current) return null
  if (fields.selectedVideoId) {
    const owns = db.prepare('SELECT id FROM shot_videos WHERE id = ? AND shot_id = ?').get(fields.selectedVideoId, id)
    if (!owns) return null
  }
  db.prepare(`
    UPDATE shots SET prompt = ?, duration = ?, reference_entity_ids_json = ?, selected_video_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    fields.prompt ?? current.prompt,
    fields.duration ?? current.duration,
    JSON.stringify(fields.referenceEntityIds ?? current.referenceEntityIds),
    fields.selectedVideoId ?? current.selectedVideoId,
    now(),
    id,
  )
  return getShot(id)
}

export function deleteShot(id: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT episode_id, shot_order FROM shots WHERE id = ?').get(id) as SqlRow | undefined
  if (!row) return false
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM shots WHERE id = ?').run(id)
    const remaining = db.prepare('SELECT id FROM shots WHERE episode_id = ? ORDER BY shot_order').all(row.episode_id) as SqlRow[]
    const update = db.prepare('UPDATE shots SET shot_order = ? WHERE id = ?')
    remaining.forEach((shot, index) => update.run(index + 1, shot.id))
  })
  transaction()
  return true
}

export function markShotGenerating(shotId: string, taskId: string, model: string, resolution: string): Shot {
  const db = getDb()
  const shot = getShot(shotId)
  if (!shot) throw new Error('分镜不存在')
  const versionId = randomUUID()
  const timestamp = now()
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO shot_videos (id, shot_id, path, provider_task_id, model, duration, resolution, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
    `).run(versionId, shotId, taskId, model, shot.duration, resolution, timestamp)
    db.prepare(`
      UPDATE shots SET status = 'generating', provider_task_id = ?, error = NULL, updated_at = ? WHERE id = ?
    `).run(taskId, timestamp, shotId)
  })
  transaction()
  return getShot(shotId)!
}

export function markShotFailed(shotId: string, error: string): Shot {
  getDb().prepare(`UPDATE shots SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
    .run(error.slice(0, 1000), now(), shotId)
  return getShot(shotId)!
}

export function addShotVideo(shotId: string, input: {
  path: string
  providerTaskId: string
  model: string
  duration: number
  resolution: string
}): Shot {
  const db = getDb()
  const timestamp = now()
  const transaction = db.transaction(() => {
    const pending = db.prepare(`
      SELECT id FROM shot_videos WHERE shot_id = ? AND provider_task_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(shotId, input.providerTaskId) as SqlRow | undefined
    const id = pending ? String(pending.id) : randomUUID()
    if (pending) {
      db.prepare(`
        UPDATE shot_videos SET path = ?, model = ?, duration = ?, resolution = ? WHERE id = ?
      `).run(input.path, input.model, input.duration, input.resolution, id)
    } else {
      db.prepare(`
        INSERT INTO shot_videos (id, shot_id, path, provider_task_id, model, duration, resolution, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, shotId, input.path, input.providerTaskId, input.model, input.duration, input.resolution, timestamp)
    }
    db.prepare(`
      UPDATE shots SET status = 'success', selected_video_id = ?, provider_task_id = ?, error = NULL, updated_at = ?
      WHERE id = ?
    `).run(id, input.providerTaskId, timestamp, shotId)
  })
  transaction()
  return getShot(shotId)!
}

export function saveEditDraft(projectId: string, episodeId: string, clips: EditClip[]): EditDraft {
  const db = getDb()
  const current = db.prepare('SELECT id FROM edits WHERE episode_id = ?').get(episodeId) as SqlRow | undefined
  const timestamp = now()
  if (current) {
    db.prepare('UPDATE edits SET clips_json = ?, updated_at = ? WHERE episode_id = ?')
      .run(JSON.stringify(clips), timestamp, episodeId)
  } else {
    db.prepare(`
      INSERT INTO edits (id, project_id, episode_id, clips_json, output_path, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?)
    `).run(randomUUID(), projectId, episodeId, JSON.stringify(clips), timestamp)
  }
  return getProjectBundle(projectId)!.edits.find(edit => edit.episodeId === episodeId)!
}

export function setEditOutput(projectId: string, episodeId: string, outputPath: string): EditDraft {
  const db = getDb()
  const current = db.prepare('SELECT id FROM edits WHERE episode_id = ?').get(episodeId)
  if (!current) saveEditDraft(projectId, episodeId, [])
  db.prepare('UPDATE edits SET output_path = ?, updated_at = ? WHERE episode_id = ?')
    .run(outputPath, now(), episodeId)
  return getProjectBundle(projectId)!.edits.find(edit => edit.episodeId === episodeId)!
}
