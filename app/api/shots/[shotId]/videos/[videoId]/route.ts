import { z } from 'zod'
import { deleteShotVideo, getShot, updateShotVideo } from '@/lib/db'
import { deleteMediaFile } from '@/lib/local-media'
import { fail, ok } from '@/lib/api'

const updateSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  note: z.string().trim().max(200).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ shotId: string; videoId: string }> }) {
  try {
    const { shotId, videoId } = await params
    if (!getShot(shotId)) return fail('分镜不存在', 404)
    const shot = updateShotVideo(shotId, videoId, updateSchema.parse(await request.json()))
    return shot ? ok(shot) : fail('视频版本不存在', 404)
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ shotId: string; videoId: string }> }) {
  try {
    const { shotId, videoId } = await params
    const shot = getShot(shotId)
    if (!shot) return fail('分镜不存在', 404)
    if (shot.status === 'generating') return fail('分镜视频正在生成，暂不能删除版本', 409)
    const deleted = deleteShotVideo(shotId, videoId)
    if (!deleted) return fail('视频版本不存在', 404)
    await deleteMediaFile(deleted.path)
    return ok(deleted.shot)
  } catch (error) {
    return fail(error)
  }
}
