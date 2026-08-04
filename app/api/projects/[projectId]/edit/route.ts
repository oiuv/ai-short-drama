import { z } from 'zod'
import { getProjectBundle, saveEditDraft, setEditOutput } from '@/lib/db'
import { renderEdit } from '@/lib/ffmpeg'
import { fail, ok } from '@/lib/api'

export const maxDuration = 600

const clipSchema = z.object({
  id: z.string().min(1).max(100),
  shotId: z.string().uuid(),
  enabled: z.boolean(),
  start: z.number().min(0),
  end: z.number().positive(),
})
const schema = z.object({ episodeId: z.string().uuid(), clips: z.array(clipSchema).max(500) })

function validateClips(projectId: string, episodeId: string, clips: z.infer<typeof clipSchema>[]) {
  const bundle = getProjectBundle(projectId)
  if (!bundle) throw new Error('项目不存在')
  if (!bundle.episodes.some(episode => episode.id === episodeId)) throw new Error('分集不存在')
  for (const clip of clips) {
    const shot = bundle.shots.find(item => item.id === clip.shotId && item.episodeId === episodeId)
    if (!shot) throw new Error('剪辑草稿包含无效分镜')
    if (clip.end <= clip.start) throw new Error('片段出点必须大于入点')
    const maxDuration = shot.selectedVideo?.duration || shot.duration
    if (clip.end > maxDuration + 0.01) throw new Error(`分镜 ${shot.shotOrder} 的出点超过视频时长`)
  }
  return bundle
}

export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = schema.parse(await request.json())
    validateClips(projectId, body.episodeId, body.clips)
    return ok(saveEditDraft(projectId, body.episodeId, body.clips))
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = schema.parse(await request.json())
    const bundle = validateClips(projectId, body.episodeId, body.clips)
    saveEditDraft(projectId, body.episodeId, body.clips)
    const outputPath = await renderEdit(bundle, body.episodeId, body.clips)
    return ok(setEditOutput(projectId, body.episodeId, outputPath))
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}
