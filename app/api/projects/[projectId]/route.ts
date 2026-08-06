import { z } from 'zod'
import { deleteProject, getProjectBundle, updateProject } from '@/lib/db'
import { fail, ok } from '@/lib/api'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  brief: z.string().max(200_000).optional(),
  synopsis: z.string().max(50_000).optional(),
  genre: z.string().trim().min(1).max(80).optional(),
  visualStyle: z.string().trim().min(1).max(500).optional(),
  ratio: z.enum(['16:9', '9:16']).optional(),
  plannedEpisodes: z.number().int().min(1).max(200).nullable().optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const bundle = getProjectBundle(projectId)
    return bundle ? ok(bundle) : fail('项目不存在', 404)
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = updateSchema.parse(await request.json())
    const bundle = getProjectBundle(projectId)
    if (!bundle) return fail('项目不存在', 404)
    const maxEpisodeNumber = Math.max(0, ...bundle.episodes.map(episode => episode.episodeNumber))
    if (body.plannedEpisodes !== undefined && body.plannedEpisodes !== null && body.plannedEpisodes < maxEpisodeNumber) {
      return fail(`计划总集数不能小于当前已存在的第 ${maxEpisodeNumber} 集`, 400)
    }
    const project = updateProject(projectId, body)
    return project ? ok(project) : fail('项目不存在', 404)
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const bundle = getProjectBundle(projectId)
    if (!bundle) return fail('项目不存在', 404)
    if (bundle.shots.some(shot => shot.status === 'generating')) {
      return fail('仍有视频正在生成，完成后才能删除项目', 409)
    }
    return deleteProject(projectId) ? ok({ deleted: true }) : fail('项目不存在', 404)
  } catch (error) {
    return fail(error, error instanceof Error && error.message.includes('正在生成') ? 409 : 500)
  }
}
