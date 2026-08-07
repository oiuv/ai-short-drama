import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedScript } from './types'
import {
  appendGeneratedScript,
  addEntityImage,
  addShotVideo,
  confirmAllDraftEpisodes,
  createEpisode,
  createProject,
  createShot,
  deleteEntity,
  deleteEntityImage,
  deleteEpisode,
  deleteProject,
  deleteShot,
  deleteShotVideo,
  getDb,
  getProject,
  getProjectBundle,
  listProjects,
  markShotGenerating,
  markShotSubmitting,
  replaceGeneratedScript,
  replaceStoryboard,
  rewriteGeneratedScript,
  saveEditDraft,
  setEditOutput,
  updateProject,
  updateShot,
  updateShotVideo,
} from './db'

let temporaryDataDir = ''

function generatedScript(
  episodes: GeneratedScript['episodes'],
  options?: { characterDescription?: string; scenes?: GeneratedScript['scenes'] },
): GeneratedScript {
  const episodeNumbers = episodes.map(episode => episode.episodeNumber)
  return {
    project: {
      title: '雨夜证词',
      synopsis: `当前已写到第 ${Math.max(...episodeNumbers)} 集`,
      genre: '悬疑复仇',
    },
    episodes,
    characters: [{
      name: '林夏',
      variant: '默认形象',
      role: 'protagonist',
      gender: 'female',
      introduction: '调查记者',
      voiceDescription: '冷静清晰',
      description: options?.characterDescription ?? '短发，深色风衣，全身站立',
      episodes: episodeNumbers,
    }],
    scenes: options?.scenes ?? [{
      name: '旧仓库_夜晚',
      description: '空旷旧仓库，冷色顶光',
      episodes: episodeNumbers,
    }],
    props: [],
  }
}

afterEach(() => {
  global.__shortDramaDb?.close()
  global.__shortDramaDb = undefined
  vi.unstubAllEnvs()
  if (temporaryDataDir) rmSync(temporaryDataDir, { recursive: true, force: true })
  temporaryDataDir = ''
})

describe('剧本分批生成数据事务', () => {
  it('持久化计划总集数，续写保留下游数据，改写只替换目标分集和资产引用', () => {
    temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-short-drama-test-'))
    vi.stubEnv('DATA_DIR', temporaryDataDir)

    const created = createProject({
      title: '雨夜证词',
      brief: '女记者追查好友失踪案。',
      genre: '悬疑复仇',
      visualStyle: '电影感写实',
      ratio: '9:16',
    })
    expect(created.plannedEpisodes).toBeNull()
    expect(updateProject(created.id, { plannedEpisodes: 12 })?.plannedEpisodes).toBe(12)

    const initial = replaceGeneratedScript(created.id, generatedScript([
      { episodeNumber: 1, title: '失踪', content: '第一集内容' },
      { episodeNumber: 2, title: '伪证', content: '第二集内容' },
    ]), 12)
    const firstEpisode = initial.episodes.find(episode => episode.episodeNumber === 1)!
    const shot = createShot(created.id, firstEpisode.id)
    saveEditDraft(created.id, firstEpisode.id, [{
      id: 'clip-1',
      shotId: shot.id,
      enabled: true,
      start: 0,
      end: 5,
    }])

    const continued = appendGeneratedScript(created.id, generatedScript([
      { episodeNumber: 3, title: '旧证人', content: '第三集内容' },
    ]), { plannedEpisodes: 12 })
    expect(continued.episodes.map(episode => episode.episodeNumber)).toEqual([1, 2, 3])
    expect(continued.shots).toHaveLength(1)
    expect(continued.edits).toHaveLength(1)
    expect(continued.entities.find(entity => entity.name === '林夏')?.episodes).toEqual([1, 2, 3])

    const rewritten = rewriteGeneratedScript(created.id, 2, generatedScript([
      { episodeNumber: 2, title: '证词反转', content: '重写后的第二集内容' },
    ], {
      characterDescription: '短发，风衣被雨水打湿，全身站立',
      scenes: [{ name: '街角咖啡馆_雨夜', description: '玻璃窗布满雨痕', episodes: [2] }],
    }))
    expect(rewritten.episodes.find(episode => episode.episodeNumber === 1)?.content).toBe('第一集内容')
    expect(rewritten.episodes.find(episode => episode.episodeNumber === 2)?.content).toBe('重写后的第二集内容')
    expect(rewritten.episodes.find(episode => episode.episodeNumber === 3)?.content).toBe('第三集内容')
    expect(rewritten.shots).toHaveLength(1)
    expect(rewritten.edits).toHaveLength(1)
    expect(rewritten.entities.find(entity => entity.name === '林夏')?.episodes).toEqual([1, 2, 3])
    expect(rewritten.entities.find(entity => entity.name === '旧仓库_夜晚')?.episodes).toEqual([1, 3])
    expect(rewritten.entities.find(entity => entity.name === '街角咖啡馆_雨夜')?.episodes).toEqual([2])

    global.__shortDramaDb?.close()
    global.__shortDramaDb = undefined
    expect(getProject(created.id)?.plannedEpisodes).toBe(12)
    expect(getProjectBundle(created.id)?.episodes).toHaveLength(3)
  })
})

describe('分镜视频版本', () => {
  it('保存生成快照并支持评分、备注、切换后安全删除', () => {
    temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-short-drama-video-test-'))
    vi.stubEnv('DATA_DIR', temporaryDataDir)
    const project = createProject({ title: '版本测试', brief: '测试视频版本' })
    const bundle = replaceGeneratedScript(project.id, generatedScript([
      { episodeNumber: 1, title: '第一集', content: '第一集内容' },
    ]), 1)
    const shot = createShot(project.id, bundle.episodes[0].id)
    updateShot(shot.id, { prompt: '雨夜追车，低机位跟拍' })

    markShotGenerating(shot.id, 'task-1', 'seedance-model', '720p')
    let updated = addShotVideo(shot.id, {
      path: 'videos/take-1.mp4', providerTaskId: 'task-1', model: 'seedance-model', duration: 5, resolution: '720p',
    })
    expect(updated.selectedVideo?.prompt).toBe('雨夜追车，低机位跟拍')

    updateShot(shot.id, { prompt: '雨夜追车，航拍转近景' })
    markShotGenerating(shot.id, 'task-2', 'seedance-model', '1080p')
    updated = addShotVideo(shot.id, {
      path: 'videos/take-2.mp4', providerTaskId: 'task-2', model: 'seedance-model', duration: 6, resolution: '1080p',
    })
    const latest = updated.selectedVideo!
    expect(latest.prompt).toBe('雨夜追车，航拍转近景')
    expect(updateShotVideo(shot.id, latest.id, { rating: 5, note: '保留动作节奏' })?.selectedVideo)
      .toMatchObject({ rating: 5, note: '保留动作节奏' })

    const first = updated.videos.find(video => video.providerTaskId === 'task-1')!
    const edit = saveEditDraft(project.id, bundle.episodes[0].id, [{
      id: 'video-version-clip',
      shotId: shot.id,
      enabled: true,
      start: 0,
      end: 5,
    }])
    setEditOutput(project.id, bundle.episodes[0].id, 'exports/previous.mp4')
    expect(deleteShotVideo(shot.id, latest.id)).toMatchObject({ path: 'videos/take-2.mp4' })
    expect(getProjectBundle(project.id)?.shots[0].selectedVideoId).toBe(first.id)
    expect(getProjectBundle(project.id)?.edits[0]).toMatchObject({
      id: edit.id,
      clips: [expect.objectContaining({ shotId: shot.id })],
      outputPath: null,
    })
    expect(deleteShotVideo(shot.id, first.id)).toMatchObject({ path: 'videos/take-1.mp4' })
    expect(getProjectBundle(project.id)?.shots[0]).toMatchObject({ status: 'pending', selectedVideoId: null })
    expect(getProjectBundle(project.id)?.edits[0]).toMatchObject({ id: edit.id, clips: [], outputPath: null })
  })
})

describe('素材图片版本', () => {
  it('删除选定图片后自动切换到最近的保留版本', () => {
    temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-short-drama-image-test-'))
    vi.stubEnv('DATA_DIR', temporaryDataDir)
    const project = createProject({ title: '素材版本测试', brief: '测试图片版本' })
    const bundle = replaceGeneratedScript(project.id, generatedScript([
      { episodeNumber: 1, title: '第一集', content: '第一集内容' },
    ]), 1)
    const entity = bundle.entities.find(item => item.kind === 'character')!
    const first = addEntityImage(entity.id, 'images/first.png', '第一版').selectedImage!
    const second = addEntityImage(entity.id, 'images/second.png', '第二版').selectedImage!

    expect(deleteEntityImage(entity.id, second.id)).toMatchObject({ path: 'images/second.png' })
    expect(getProjectBundle(project.id)?.entities.find(item => item.id === entity.id)?.selectedImageId).toBe(first.id)
    expect(deleteEntityImage(entity.id, first.id)).toMatchObject({ path: 'images/first.png' })
    expect(getProjectBundle(project.id)?.entities.find(item => item.id === entity.id)?.selectedImageId).toBeNull()
    expect(deleteEntity(entity.id)).toBe(true)
    expect(() => addEntityImage(entity.id, 'images/late.png', '迟到的生成结果')).toThrow('素材不存在或已删除')
  })
})

describe('文本记录替换、媒体软删除与本地文件保留', () => {
  it('重新生成直接替换旧文本记录，并允许复用原分集号与镜头序号', () => {
    temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-short-drama-replace-test-'))
    vi.stubEnv('DATA_DIR', temporaryDataDir)
    const project = createProject({ title: '软删除替换测试', brief: '测试重新生成' })
    const initial = replaceGeneratedScript(project.id, generatedScript([
      { episodeNumber: 1, title: '旧第一集', content: '旧内容' },
    ]), 1)
    const oldEpisode = initial.episodes[0]
    const oldShot = createShot(project.id, oldEpisode.id)
    const oldEdit = saveEditDraft(project.id, oldEpisode.id, [{
      id: 'old-clip',
      shotId: oldShot.id,
      enabled: true,
      start: 0,
      end: 5,
    }])

    expect(replaceStoryboard(project.id, oldEpisode.id, [{
      shotOrder: 1,
      prompt: '新分镜',
      duration: 5,
      referenceEntityIds: [],
    }])).toHaveLength(1)
    expect(getDb().prepare('SELECT id FROM shots WHERE id = ?').get(oldShot.id)).toBeUndefined()
    expect(getProjectBundle(project.id)?.edits).toHaveLength(0)
    expect(getDb().prepare('SELECT id FROM edits WHERE id = ?').get(oldEdit.id)).toBeUndefined()

    const replaced = replaceGeneratedScript(project.id, generatedScript([
      { episodeNumber: 1, title: '新第一集', content: '新内容' },
    ]), 1)
    expect(replaced.episodes).toHaveLength(1)
    expect(replaced.episodes[0]).toMatchObject({ episodeNumber: 1, title: '新第一集' })
    expect(replaced.shots).toHaveLength(0)
    expect(getDb().prepare('SELECT id FROM episodes WHERE id = ?').get(oldEpisode.id)).toBeUndefined()
  })

  it('生成中的视频阻止重拆分，并自动恢复中断的任务提交锁', () => {
    temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-short-drama-lock-test-'))
    vi.stubEnv('DATA_DIR', temporaryDataDir)
    const project = createProject({ title: '生成互斥测试', brief: '测试重拆分互斥' })
    const bundle = replaceGeneratedScript(project.id, generatedScript([
      { episodeNumber: 1, title: '第一集', content: '第一集内容' },
    ]), 1)
    const shot = createShot(project.id, bundle.episodes[0].id)
    markShotSubmitting(shot.id)

    expect(() => replaceStoryboard(project.id, bundle.episodes[0].id, [{
      shotOrder: 1,
      prompt: '不应写入的新分镜',
      duration: 5,
      referenceEntityIds: [],
    }])).toThrow('本集仍有视频正在生成')
    expect(getProjectBundle(project.id)?.shots).toHaveLength(1)
    expect(getProjectBundle(project.id)?.shots[0]).toMatchObject({
      id: shot.id,
      status: 'generating',
      providerTaskId: null,
    })

    getDb().prepare('UPDATE shots SET updated_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 3 * 60 * 1000).toISOString(), shot.id)
    expect(getProjectBundle(project.id)?.shots[0]).toMatchObject({
      id: shot.id,
      status: 'failed',
      providerTaskId: null,
      error: '任务提交中断，请重新生成',
    })
    expect(replaceStoryboard(project.id, bundle.episodes[0].id, [{
      shotOrder: 1,
      prompt: '恢复后的新分镜',
      duration: 5,
      referenceEntityIds: [],
    }])).toHaveLength(1)
  })

  it('仅图片和视频版本软删除，父级文本记录直接删除且本地文件保持不变', () => {
    temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-short-drama-soft-delete-test-'))
    vi.stubEnv('DATA_DIR', temporaryDataDir)
    const imagePath = path.join(temporaryDataDir, 'media', 'images', 'keep.png')
    const videoPath = path.join(temporaryDataDir, 'media', 'videos', 'keep.mp4')
    const exportPath = path.join(temporaryDataDir, 'media', 'exports', 'keep.mp4')
    mkdirSync(path.dirname(imagePath), { recursive: true })
    mkdirSync(path.dirname(videoPath), { recursive: true })
    mkdirSync(path.dirname(exportPath), { recursive: true })
    writeFileSync(imagePath, 'image')
    writeFileSync(videoPath, 'video')
    writeFileSync(exportPath, 'export')

    const project = createProject({ title: '素材保留测试', brief: '测试所有删除层级' })
    const bundle = replaceGeneratedScript(project.id, generatedScript([
      { episodeNumber: 1, title: '第一集', content: '第一集内容' },
      { episodeNumber: 2, title: '第二集', content: '第二集内容' },
    ]), 2)
    const entity = bundle.entities.find(item => item.kind === 'character')!
    const image = addEntityImage(entity.id, 'images/keep.png', '保留图片').selectedImage!
    const firstShot = createShot(project.id, bundle.episodes[0].id)
    markShotGenerating(firstShot.id, 'task-keep', 'seedance-model', '720p')
    const video = addShotVideo(firstShot.id, {
      path: 'videos/keep.mp4',
      providerTaskId: 'task-keep',
      model: 'seedance-model',
      duration: 5,
      resolution: '720p',
    }).selectedVideo!
    saveEditDraft(project.id, bundle.episodes[0].id, [{
      id: 'keep-clip',
      shotId: firstShot.id,
      enabled: true,
      start: 0,
      end: 5,
    }])
    setEditOutput(project.id, bundle.episodes[0].id, 'exports/keep.mp4')

    expect(deleteEntityImage(entity.id, image.id)).not.toBeNull()
    expect(deleteShotVideo(firstShot.id, video.id)).not.toBeNull()
    expect(getDb().prepare('SELECT deleted_at FROM entity_images WHERE id = ?').get(image.id))
      .toMatchObject({ deleted_at: expect.any(String) })
    expect(getDb().prepare('SELECT deleted_at FROM shot_videos WHERE id = ?').get(video.id))
      .toMatchObject({ deleted_at: expect.any(String) })
    expect(existsSync(imagePath)).toBe(true)
    expect(existsSync(videoPath)).toBe(true)
    expect(existsSync(exportPath)).toBe(true)

    const secondEntity = getProjectBundle(project.id)!.entities.find(item => item.kind === 'scene')!
    const selectedImage = addEntityImage(secondEntity.id, 'images/keep.png', '父级删除前选中版本').selectedImage!
    const secondShot = createShot(project.id, bundle.episodes[1].id)
    markShotGenerating(secondShot.id, 'task-selected', 'seedance-model', '720p')
    const selectedVideo = addShotVideo(secondShot.id, {
      path: 'videos/keep.mp4',
      providerTaskId: 'task-selected',
      model: 'seedance-model',
      duration: 5,
      resolution: '720p',
    }).selectedVideo!
    const secondEdit = saveEditDraft(project.id, bundle.episodes[1].id, [{
      id: 'selected-clip',
      shotId: secondShot.id,
      enabled: true,
      start: 0,
      end: 5,
    }])
    expect(deleteEntity(secondEntity.id)).toBe(true)
    expect(deleteShot(secondShot.id)).toBe(true)
    expect(getDb().prepare('SELECT id FROM entities WHERE id = ?').get(secondEntity.id)).toBeUndefined()
    expect(getDb().prepare('SELECT id FROM entity_images WHERE id = ?').get(selectedImage.id)).toBeUndefined()
    expect(getDb().prepare('SELECT id FROM shots WHERE id = ?').get(secondShot.id)).toBeUndefined()
    expect(getDb().prepare('SELECT id FROM shot_videos WHERE id = ?').get(selectedVideo.id)).toBeUndefined()
    expect(getProjectBundle(project.id)?.edits.find(edit => edit.id === secondEdit.id))
      .toMatchObject({ clips: [], outputPath: null })
    expect(deleteEpisode(bundle.episodes[1].id)).toBe(true)
    expect(getDb().prepare('SELECT id FROM edits WHERE id = ?').get(secondEdit.id)).toBeUndefined()
    expect(deleteProject(project.id)).toBe(true)

    expect(getProject(project.id)).toBeNull()
    expect(getProjectBundle(project.id)).toBeNull()
    expect(listProjects()).toHaveLength(0)
    for (const table of ['projects', 'episodes', 'entities', 'shots', 'edits'] as const) {
      const rows = getDb().prepare(`SELECT COUNT(*) count FROM ${table}`).get() as { count: number }
      expect(rows.count).toBe(0)
    }
    expect(existsSync(imagePath)).toBe(true)
    expect(existsSync(videoPath)).toBe(true)
    expect(existsSync(exportPath)).toBe(true)
  })
})

describe('分集批量定稿', () => {
  it('原子定稿全部非空草稿并拒绝空白分集', () => {
    temporaryDataDir = mkdtempSync(path.join(tmpdir(), 'xuefeng-short-drama-confirm-test-'))
    vi.stubEnv('DATA_DIR', temporaryDataDir)
    const project = createProject({ title: '批量定稿测试', brief: '测试定稿' })
    replaceGeneratedScript(project.id, generatedScript([
      { episodeNumber: 1, title: '第一集', content: '第一集内容' },
      { episodeNumber: 2, title: '第二集', content: '第二集内容' },
    ]), 3)

    expect(confirmAllDraftEpisodes(project.id).episodes.every(episode => episode.status === 'confirmed')).toBe(true)
    createEpisode(project.id)
    expect(() => confirmAllDraftEpisodes(project.id)).toThrow('第 3 集内容为空，不能批量定稿')
    expect(getProjectBundle(project.id)?.episodes.find(episode => episode.episodeNumber === 3)?.status).toBe('draft')
  })
})
