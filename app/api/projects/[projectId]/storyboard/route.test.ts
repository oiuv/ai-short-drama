import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Entity, Episode, Project, ProjectBundle } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  createShot: vi.fn(),
  getProjectBundle: vi.fn(),
  replaceStoryboard: vi.fn(),
  generateStoryboard: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  createShot: mocks.createShot,
  getProjectBundle: mocks.getProjectBundle,
  replaceStoryboard: mocks.replaceStoryboard,
}))
vi.mock('@/lib/providers/deepseek', () => ({ generateStoryboard: mocks.generateStoryboard }))

import { POST } from './route'

const project: Project = {
  id: 'project-1', title: '分镜门禁', brief: '', synopsis: '', genre: '悬疑犯罪',
  visualStyle: '电影感写实', ratio: '9:16', plannedEpisodes: 2,
  createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
}
const episode: Episode = {
  id: '00000000-0000-4000-8000-000000000001', projectId: project.id, episodeNumber: 1,
  title: '第一集', content: '雨夜追车。', status: 'draft',
  createdAt: project.createdAt, updatedAt: project.updatedAt,
}

function entity(id: string, name: string, episodes: number[]): Entity {
  return {
    id, projectId: project.id, kind: 'character', name, variant: '默认造型', description: `${name}的造型`,
    episodes, category: '', metadata: {}, selectedImageId: null, images: [], selectedImage: null,
    createdAt: project.createdAt, updatedAt: project.updatedAt,
  }
}

function bundle(status: Episode['status']): ProjectBundle {
  return {
    project,
    episodes: [{ ...episode, status }],
    entities: [
      entity('00000000-0000-4000-8000-000000000011', '林夏', [1]),
      entity('00000000-0000-4000-8000-000000000012', '陆远', [2]),
    ],
    shots: [], edits: [],
  }
}

function request(): Request {
  return new Request(`http://localhost/api/projects/${project.id}/storyboard`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate', episodeId: episode.id }),
  })
}

afterEach(() => vi.resetAllMocks())

describe('POST /api/projects/[projectId]/storyboard', () => {
  it('草稿分集不能进入分镜生成', async () => {
    mocks.getProjectBundle.mockReturnValue(bundle('draft'))

    const response = await POST(request(), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(409)
    expect(mocks.generateStoryboard).not.toHaveBeenCalled()
  })

  it('只把当前集适用素材交给分镜 Skill 并解析引用', async () => {
    mocks.getProjectBundle.mockReturnValue(bundle('confirmed'))
    mocks.generateStoryboard.mockResolvedValue({
      shots: [{ shotOrder: 1, prompt: '林夏冲入雨幕', duration: 5, referenceEntityNames: ['林夏/默认造型'] }],
    })
    mocks.replaceStoryboard.mockReturnValue([])

    const response = await POST(request(), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(200)
    expect(mocks.generateStoryboard).toHaveBeenCalledWith(expect.objectContaining({
      entities: [expect.objectContaining({ name: '林夏' })],
    }))
    expect(mocks.replaceStoryboard).toHaveBeenCalledWith(project.id, episode.id, [expect.objectContaining({
      referenceEntityIds: ['00000000-0000-4000-8000-000000000011'],
    })])
  })
})
