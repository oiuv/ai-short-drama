import { mkdtempSync, rmSync } from 'node:fs'
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
  deleteEntityImage,
  deleteShotVideo,
  getProject,
  getProjectBundle,
  markShotGenerating,
  replaceGeneratedScript,
  rewriteGeneratedScript,
  saveEditDraft,
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
    expect(deleteShotVideo(shot.id, latest.id)).toMatchObject({ path: 'videos/take-2.mp4' })
    expect(getProjectBundle(project.id)?.shots[0].selectedVideoId).toBe(first.id)
    expect(deleteShotVideo(shot.id, first.id)).toMatchObject({ path: 'videos/take-1.mp4' })
    expect(getProjectBundle(project.id)?.shots[0]).toMatchObject({ status: 'pending', selectedVideoId: null })
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
