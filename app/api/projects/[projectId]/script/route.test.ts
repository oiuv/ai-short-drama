import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Episode, GeneratedScript, Project, ProjectBundle } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  appendGeneratedScript: vi.fn(),
  createEpisode: vi.fn(),
  deleteEpisode: vi.fn(),
  getProject: vi.fn(),
  getProjectBundle: vi.fn(),
  replaceGeneratedScript: vi.fn(),
  rewriteGeneratedScript: vi.fn(),
  updateEpisode: vi.fn(),
  generateScript: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  appendGeneratedScript: mocks.appendGeneratedScript,
  createEpisode: mocks.createEpisode,
  deleteEpisode: mocks.deleteEpisode,
  getProject: mocks.getProject,
  getProjectBundle: mocks.getProjectBundle,
  replaceGeneratedScript: mocks.replaceGeneratedScript,
  rewriteGeneratedScript: mocks.rewriteGeneratedScript,
  updateEpisode: mocks.updateEpisode,
}))

vi.mock('@/lib/providers/deepseek', () => ({
  generateScript: mocks.generateScript,
}))

import { POST } from './route'

const project: Project = {
  id: 'project-1',
  title: '雨夜证词',
  brief: '女记者追查好友失踪案。',
  synopsis: '前三集发现证词被篡改。',
  genre: '悬疑复仇',
  visualStyle: '电影感写实',
  ratio: '9:16',
  plannedEpisodes: 10,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
}

function episode(episodeNumber: number, status: Episode['status'] = 'draft'): Episode {
  return {
    id: `00000000-0000-4000-8000-${String(episodeNumber).padStart(12, '0')}`,
    projectId: project.id,
    episodeNumber,
    title: `第 ${episodeNumber} 集`,
    content: `第 ${episodeNumber} 集内容`,
    status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function bundle(episodes: Episode[]): ProjectBundle {
  return { project, episodes, entities: [], shots: [], edits: [] }
}

const generated: GeneratedScript = {
  project: { title: project.title, synopsis: '续写后梗概', genre: project.genre },
  episodes: [{ episodeNumber: 4, title: '第四集', content: '第四集新内容' }],
  characters: [],
  scenes: [],
  props: [],
}

function request(body: unknown): Request {
  return new Request(`http://localhost/api/projects/${project.id}/script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/projects/[projectId]/script', () => {
  it('拒绝单次生成超过 10 集且不调用模型', async () => {
    const response = await POST(request({
      action: 'generate',
      episodeCount: 11,
      plannedEpisodes: 20,
    }), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: '单次剧本创作最多 10 集' })
    expect(mocks.getProject).not.toHaveBeenCalled()
    expect(mocks.generateScript).not.toHaveBeenCalled()
  })

  it('拒绝计划总集数小于本次生成集数', async () => {
    mocks.getProject.mockReturnValue(project)
    mocks.getProjectBundle.mockReturnValue(bundle([]))

    const response = await POST(request({
      action: 'generate',
      episodeCount: 5,
      plannedEpisodes: 3,
    }), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: '计划总集数不能小于本次生成集数' })
    expect(mocks.generateScript).not.toHaveBeenCalled()
  })

  it('续写从已有最大集号之后开始并追加结果', async () => {
    const currentBundle = bundle([episode(1), episode(2), episode(3)])
    const continuedBundle = bundle([...currentBundle.episodes, episode(4)])
    mocks.getProject.mockReturnValue(project)
    mocks.getProjectBundle.mockReturnValue(currentBundle)
    mocks.generateScript.mockResolvedValue(generated)
    mocks.appendGeneratedScript.mockReturnValue(continuedBundle)

    const response = await POST(request({
      action: 'continue',
      episodeCount: 1,
      plannedEpisodes: 10,
      instruction: '让旧证人出现',
      isFinale: false,
    }), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(200)
    expect(mocks.generateScript).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'continue',
      startEpisode: 4,
      episodeCount: 1,
      plannedEpisodes: 10,
      existingEpisodes: currentBundle.episodes,
      instruction: '让旧证人出现',
    }))
    expect(mocks.appendGeneratedScript).toHaveBeenCalledWith(project.id, generated, {
      plannedEpisodes: 10,
    })
  })

  it('已定稿分集不能被 AI 重写', async () => {
    mocks.getProject.mockReturnValue(project)
    mocks.getProjectBundle.mockReturnValue(bundle([episode(1), episode(2, 'confirmed'), episode(3)]))

    const response = await POST(request({
      action: 'rewrite',
      startEpisode: 2,
      episodeCount: 1,
      instruction: '加强第二集反转',
    }), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: '重写范围包含已定稿分集，请先取消定稿' })
    expect(mocks.generateScript).not.toHaveBeenCalled()
    expect(mocks.rewriteGeneratedScript).not.toHaveBeenCalled()
  })
})
