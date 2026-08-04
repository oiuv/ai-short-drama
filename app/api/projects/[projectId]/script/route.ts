import { z } from 'zod'
import {
  createEpisode,
  deleteEpisode,
  getProject,
  getProjectBundle,
  replaceGeneratedScript,
  updateEpisode,
} from '@/lib/db'
import { generateScript } from '@/lib/providers/deepseek'
import { fail, ok } from '@/lib/api'

export const maxDuration = 600
export const dynamic = 'force-dynamic'

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate'), episodeCount: z.number().int().min(1).max(20) }),
  z.object({ action: z.literal('add') }),
])

const updateSchema = z.object({
  episodeId: z.string().uuid(),
  title: z.string().max(200).optional(),
  content: z.string().max(200_000).optional(),
  status: z.enum(['draft', 'confirmed']).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = requestSchema.parse(await request.json())
    const project = getProject(projectId)
    if (!project) return fail('项目不存在', 404)
    if (body.action === 'add') return ok(createEpisode(project.id), { status: 201 })
    if (!project.brief.trim()) return fail('请先填写创作需求或原始素材', 400)
    const generated = await generateScript({
      ...project,
      episodeCount: body.episodeCount,
    })
    return ok(replaceGeneratedScript(project.id, generated))
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = updateSchema.parse(await request.json())
    const bundle = getProjectBundle(projectId)
    if (!bundle?.episodes.some(episode => episode.id === body.episodeId)) return fail('分集不存在', 404)
    const episode = updateEpisode(body.episodeId, body)
    return episode ? ok(episode) : fail('分集不存在', 404)
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const episodeId = new URL(request.url).searchParams.get('episodeId')
    const bundle = getProjectBundle(projectId)
    if (!episodeId || !bundle?.episodes.some(episode => episode.id === episodeId)) return fail('分集不存在', 404)
    return deleteEpisode(episodeId) ? ok({ deleted: true }) : fail('分集不存在', 404)
  } catch (error) {
    return fail(error)
  }
}
