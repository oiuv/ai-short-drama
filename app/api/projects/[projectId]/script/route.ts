import { z } from 'zod'
import {
  appendGeneratedScript,
  confirmAllDraftEpisodes,
  createEpisode,
  deleteEpisode,
  getProject,
  getProjectBundle,
  replaceGeneratedScript,
  rewriteGeneratedScript,
  updateEpisode,
} from '@/lib/db'
import { generateScript } from '@/lib/providers/deepseek'
import { fail, ok } from '@/lib/api'
import { MAX_SCRIPT_EPISODES_PER_REQUEST } from '@/lib/model-config'

export const maxDuration = 600
export const dynamic = 'force-dynamic'

const episodeCountSchema = z.number().int().min(1).max(
  MAX_SCRIPT_EPISODES_PER_REQUEST,
  `单次剧本创作最多 ${MAX_SCRIPT_EPISODES_PER_REQUEST} 集`,
)

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    episodeCount: episodeCountSchema,
    plannedEpisodes: z.number().int().min(1).max(200).nullable(),
  }),
  z.object({
    action: z.literal('continue'),
    episodeCount: episodeCountSchema,
    plannedEpisodes: z.number().int().min(1).max(200).nullable(),
    instruction: z.string().trim().max(5_000).optional(),
    newBrief: z.string().trim().min(1).max(100_000).optional(),
    isFinale: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal('rewrite'),
    startEpisode: z.number().int().min(1),
    episodeCount: episodeCountSchema,
    instruction: z.string().trim().min(1).max(10_000),
  }),
  z.object({ action: z.literal('add') }),
  z.object({ action: z.literal('confirm-all') }),
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
    if (body.action === 'add') {
      const current = getProjectBundle(project.id)
      if (!current) return fail('项目不存在', 404)
      const currentMax = Math.max(0, ...current.episodes.map(episode => episode.episodeNumber))
      if (project.plannedEpisodes !== null && currentMax >= project.plannedEpisodes) {
        return fail(`计划总集数为 ${project.plannedEpisodes} 集，不能继续添加分集`, 409)
      }
      return ok(createEpisode(project.id), { status: 201 })
    }
    if (body.action === 'confirm-all') {
      const current = getProjectBundle(project.id)
      const empty = current?.episodes.find(episode => episode.status === 'draft' && !episode.content.trim())
      if (empty) return fail(`第 ${empty.episodeNumber} 集内容为空，不能批量定稿`, 400)
      return ok(confirmAllDraftEpisodes(project.id))
    }
    if (!project.brief.trim()) return fail('请先填写创作需求或原始素材', 400)
    const bundle = getProjectBundle(project.id)
    if (!bundle) return fail('项目不存在', 404)

    const maxEpisodeNumber = Math.max(0, ...bundle.episodes.map(episode => episode.episodeNumber))
    if (body.action === 'continue' && body.plannedEpisodes !== null && body.plannedEpisodes < maxEpisodeNumber) {
      return fail(`计划总集数不能小于当前已存在的第 ${maxEpisodeNumber} 集`, 400)
    }

    if (body.action === 'generate') {
      if (body.plannedEpisodes !== null && body.plannedEpisodes < body.episodeCount) {
        return fail('计划总集数不能小于本次生成集数', 400)
      }
      const generated = await generateScript({
        ...project,
        mode: 'generate',
        startEpisode: 1,
        episodeCount: body.episodeCount,
        plannedEpisodes: body.plannedEpisodes,
      })
      return ok(replaceGeneratedScript(project.id, generated, body.plannedEpisodes))
    }

    if (body.action === 'continue') {
      if (bundle.episodes.length === 0) return fail('请先生成第一批剧本，再进行续写', 400)
      const startEpisode = maxEpisodeNumber + 1
      const endEpisode = startEpisode + body.episodeCount - 1
      const effectivePlannedEpisodes = body.isFinale ? endEpisode : body.plannedEpisodes
      if (!body.isFinale && effectivePlannedEpisodes !== null && endEpisode > effectivePlannedEpisodes) {
        return fail(`本次续写将到第 ${endEpisode} 集，超过计划总集数 ${body.plannedEpisodes}`, 400)
      }
      const effectiveBrief = body.newBrief || project.brief
      const generated = await generateScript({
        ...project,
        brief: effectiveBrief,
        mode: 'continue',
        startEpisode,
        episodeCount: body.episodeCount,
        plannedEpisodes: effectivePlannedEpisodes,
        existingEpisodes: bundle.episodes,
        instruction: body.instruction,
        isFinale: body.isFinale,
      })
      return ok(appendGeneratedScript(project.id, generated, {
        plannedEpisodes: effectivePlannedEpisodes,
        brief: body.newBrief,
      }))
    }

    const endEpisode = body.startEpisode + body.episodeCount - 1
    const targets = bundle.episodes.filter(episode => (
      episode.episodeNumber >= body.startEpisode && episode.episodeNumber <= endEpisode
    ))
    if (targets.length !== body.episodeCount) return fail('重写范围包含不存在的分集', 400)
    if (targets.some(episode => episode.status === 'confirmed')) {
      return fail('重写范围包含已定稿分集，请先取消定稿', 409)
    }
    const targetIds = new Set(targets.map(episode => episode.id))
    if (bundle.shots.some(shot => targetIds.has(shot.episodeId)) || bundle.edits.some(edit => targetIds.has(edit.episodeId))) {
      return fail('重写范围已有分镜或剪辑内容，请先完成或移除下游制作数据', 409)
    }
    const generated = await generateScript({
      ...project,
      mode: 'rewrite',
      startEpisode: body.startEpisode,
      episodeCount: body.episodeCount,
      plannedEpisodes: project.plannedEpisodes,
      existingEpisodes: bundle.episodes,
      instruction: body.instruction,
      isFinale: project.plannedEpisodes !== null && endEpisode === project.plannedEpisodes,
    })
    return ok(rewriteGeneratedScript(project.id, body.startEpisode, generated))
  } catch (error) {
    if (error instanceof z.ZodError) return fail(error.issues[0]?.message || '剧本请求参数无效', 400)
    return fail(error, 500)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = updateSchema.parse(await request.json())
    const bundle = getProjectBundle(projectId)
    if (!bundle) return fail('项目不存在', 404)
    const current = bundle.episodes.find(episode => episode.id === body.episodeId)
    if (!current) return fail('分集不存在', 404)
    if (body.status === 'confirmed' && !(body.content ?? current.content).trim()) {
      return fail('本集剧本内容为空，不能定稿', 400)
    }
    const changesLockedContent = (body.title !== undefined && body.title !== current.title)
      || (body.content !== undefined && body.content !== current.content)
    if (current.status === 'confirmed' && body.status !== 'draft' && changesLockedContent) {
      return fail('本集已定稿，请先取消定稿再修改', 409)
    }
    if (body.status === 'draft' && current.status === 'confirmed') {
      const hasDownstreamData = bundle.shots.some(shot => shot.episodeId === current.id)
        || bundle.edits.some(edit => edit.episodeId === current.id)
      if (hasDownstreamData) return fail('本集已有分镜或剪辑内容，不能取消定稿', 409)
    }
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
