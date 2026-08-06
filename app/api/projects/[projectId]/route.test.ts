import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Episode, Project, ProjectBundle } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  deleteProject: vi.fn(),
  getProjectBundle: vi.fn(),
  updateProject: vi.fn(),
}))

vi.mock('@/lib/db', () => mocks)

import { PATCH } from './route'

const project: Project = {
  id: 'project-1', title: '计划校验', brief: '', synopsis: '', genre: '悬疑犯罪',
  visualStyle: '电影感写实', ratio: '9:16', plannedEpisodes: 5,
  createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
}
const fifthEpisode: Episode = {
  id: '00000000-0000-4000-8000-000000000005', projectId: project.id, episodeNumber: 5,
  title: '第五集', content: '第五集内容', status: 'draft',
  createdAt: project.createdAt, updatedAt: project.updatedAt,
}

function request(plannedEpisodes: number): Request {
  return new Request(`http://localhost/api/projects/${project.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plannedEpisodes }),
  })
}

afterEach(() => vi.resetAllMocks())

describe('PATCH /api/projects/[projectId]', () => {
  it('拒绝把计划总集数保存到已有最大集号以下', async () => {
    mocks.getProjectBundle.mockReturnValue({
      project,
      episodes: [fifthEpisode],
      entities: [], shots: [], edits: [],
    } satisfies ProjectBundle)

    const response = await PATCH(request(4), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: '计划总集数不能小于当前已存在的第 5 集' })
    expect(mocks.updateProject).not.toHaveBeenCalled()
  })

  it('允许计划总集数等于已有最大集号', async () => {
    mocks.getProjectBundle.mockReturnValue({
      project,
      episodes: [fifthEpisode],
      entities: [], shots: [], edits: [],
    } satisfies ProjectBundle)
    mocks.updateProject.mockReturnValue(project)

    const response = await PATCH(request(5), { params: Promise.resolve({ projectId: project.id }) })

    expect(response.status).toBe(200)
    expect(mocks.updateProject).toHaveBeenCalledWith(project.id, { plannedEpisodes: 5 })
  })
})
