import { z } from 'zod'
import { deleteShot, getShot, updateShot } from '@/lib/db'
import { fail, ok } from '@/lib/api'

const updateSchema = z.object({
  prompt: z.string().max(20_000).optional(),
  duration: z.number().int().min(4).max(15).optional(),
  referenceEntityIds: z.array(z.string().uuid()).max(9).optional(),
  selectedVideoId: z.string().uuid().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ shotId: string }> }) {
  try {
    const { shotId } = await params
    if (!getShot(shotId)) return fail('分镜不存在', 404)
    const shot = updateShot(shotId, updateSchema.parse(await request.json()))
    return shot ? ok(shot) : fail('分镜或视频版本不存在', 404)
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ shotId: string }> }) {
  try {
    const { shotId } = await params
    return deleteShot(shotId) ? ok({ deleted: true }) : fail('分镜不存在', 404)
  } catch (error) {
    return fail(error)
  }
}
