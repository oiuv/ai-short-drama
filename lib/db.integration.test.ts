import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedScript } from './types'
import {
  appendGeneratedScript,
  createProject,
  createShot,
  getProject,
  getProjectBundle,
  replaceGeneratedScript,
  rewriteGeneratedScript,
  saveEditDraft,
  updateProject,
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
