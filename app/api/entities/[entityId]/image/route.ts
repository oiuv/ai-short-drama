import { z } from 'zod'
import { addEntityImage, deleteEntityImage, getEntity, getProject, selectEntityImage } from '@/lib/db'
import { buildEntityImagePrompt } from '@/lib/prompts'
import { generateSeedreamImage } from '@/lib/providers/seedream'
import { saveDataUrl } from '@/lib/local-media'
import { fail, ok } from '@/lib/api'

export const maxDuration = 600

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate'), referenceCurrent: z.boolean().optional(), threeView: z.boolean().optional() }),
  z.object({ action: z.literal('upload'), dataUrl: z.string().min(20) }),
  z.object({ action: z.literal('select'), imageId: z.string().uuid() }),
  z.object({ action: z.literal('delete'), imageId: z.string().uuid() }),
])

export async function POST(request: Request, { params }: { params: Promise<{ entityId: string }> }) {
  try {
    const { entityId } = await params
    const entity = getEntity(entityId)
    if (!entity) return fail('素材不存在', 404)
    const body = schema.parse(await request.json())
    if (body.action === 'delete') {
      const deleted = deleteEntityImage(entity.id, body.imageId)
      if (!deleted) return fail('图片版本不存在', 404)
      return ok(deleted.entity)
    }
    if (body.action === 'select') {
      const selected = selectEntityImage(entity.id, body.imageId)
      return selected ? ok(selected) : fail('图片版本不存在', 404)
    }
    if (body.action === 'upload') {
      const imagePath = await saveDataUrl(body.dataUrl, 'uploads')
      return ok(addEntityImage(entity.id, imagePath, '本地上传'))
    }
    const project = getProject(entity.projectId)!
    const prompt = buildEntityImagePrompt(entity, project, body.threeView ?? true)
    const result = await generateSeedreamImage({
      prompt,
      ratio: entity.kind === 'scene' ? project.ratio : '1:1',
      referencePath: body.referenceCurrent ? entity.selectedImage?.path : null,
    })
    return ok(addEntityImage(entity.id, result.path, result.prompt))
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}
