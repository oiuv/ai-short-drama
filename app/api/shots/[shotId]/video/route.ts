import { z } from 'zod'
import {
  addShotVideo,
  getProjectBundle,
  getShot,
  markShotFailed,
  markShotGenerating,
} from '@/lib/db'
import { fileToDataUrl, saveRemoteFile } from '@/lib/local-media'
import { createSeedanceTask, querySeedanceTask, type SeedanceContent } from '@/lib/providers/seedance'
import { SEEDANCE_MODELS } from '@/lib/model-config'
import { fail, ok } from '@/lib/api'

export const maxDuration = 600
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  model: z.enum([
    'doubao-seedance-2-0-260128',
    'doubao-seedance-2-0-fast-260128',
    'doubao-seedance-2-0-mini-260615',
  ]).optional(),
  resolution: z.enum(['480p', '720p', '1080p', '4k']).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ shotId: string }> }) {
  try {
    const { shotId } = await params
    const body = createSchema.parse(await request.json())
    const shot = getShot(shotId)
    if (!shot) return fail('分镜不存在', 404)
    if (shot.status === 'generating') return fail('该分镜正在生成中', 409)
    if (!shot.prompt.trim()) return fail('请先填写分镜提示词', 400)
    const bundle = getProjectBundle(shot.projectId)!
    const requestedModel = body.model || process.env.SEEDANCE_MODEL || SEEDANCE_MODELS[0].id
    const model = SEEDANCE_MODELS.find(item => item.id === requestedModel) ?? SEEDANCE_MODELS[0]
    const resolution = body.resolution && model.resolutions.includes(body.resolution as never)
      ? body.resolution
      : '720p'

    const references = shot.referenceEntityIds
      .map(id => bundle.entities.find(entity => entity.id === id))
      .filter(entity => entity?.selectedImage?.path)
      .slice(0, 9)
    const referenceGuide = references.length
      ? `参考图绑定（图片按以下顺序随请求提供）：\n${references.map((entity, index) => {
          const kind = entity!.kind === 'character' ? '角色' : entity!.kind === 'scene' ? '场景' : '道具'
          const name = entity!.variant ? `${entity!.name} / ${entity!.variant}` : entity!.name
          return `- 参考图${index + 1}：${kind}「${name}」`
        }).join('\n')}\n请在下述分镜中按名称使用对应参考图，保持其视觉特征一致。\n\n`
      : ''
    const content: SeedanceContent[] = [{ type: 'text', text: `${referenceGuide}${shot.prompt}` }]
    for (const entity of references) {
      content.push({
        type: 'image_url',
        image_url: { url: await fileToDataUrl(entity!.selectedImage!.path) },
        role: 'reference_image',
      })
    }
    const taskId = await createSeedanceTask({
      model: model.id,
      content,
      ratio: bundle.project.ratio,
      resolution,
      duration: shot.duration,
    })
    return ok(markShotGenerating(shot.id, taskId, model.id, resolution), { status: 202 })
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ shotId: string }> }) {
  const { shotId } = await params
  try {
    let shot = getShot(shotId)
    if (!shot) return fail('分镜不存在', 404)
    if (shot.status === 'success' && shot.selectedVideo?.path) return ok(shot)
    if (!shot.providerTaskId) return ok(shot)

    const task = await querySeedanceTask(shot.providerTaskId)
    if (task.status === 'failed' || task.status === 'expired' || task.status === 'cancelled') {
      return ok(markShotFailed(shot.id, task.error || `任务状态：${task.status}`))
    }
    if (task.status !== 'succeeded') return ok(shot)
    if (!task.videoUrl) return ok(markShotFailed(shot.id, 'Seedance 任务成功但未返回视频地址'))

    shot = getShot(shot.id)!
    if (shot.status === 'success' && shot.selectedVideo?.path) return ok(shot)
    const pending = shot.videos.find(version => version.providerTaskId === shot!.providerTaskId)
    const videoPath = await saveRemoteFile(task.videoUrl, 'videos', 'mp4')
    return ok(addShotVideo(shot.id, {
      path: videoPath,
      providerTaskId: shot.providerTaskId!,
      model: pending?.model || process.env.SEEDANCE_MODEL || SEEDANCE_MODELS[0].id,
      duration: task.duration || shot.duration,
      resolution: task.resolution || pending?.resolution || '720p',
    }))
  } catch (error) {
    const shot = getShot(shotId)
    if (shot?.status === 'generating') markShotFailed(shot.id, error instanceof Error ? error.message : '任务查询失败')
    return fail(error)
  }
}
