import { z } from 'zod'
import { createEntity, deleteEntity, getProjectBundle, updateEntity } from '@/lib/db'
import { fail, ok } from '@/lib/api'

const entitySchema = z.object({
  kind: z.enum(['character', 'scene', 'prop']),
  name: z.string().trim().min(1).max(120),
  variant: z.string().max(120).optional(),
  description: z.string().max(10_000).optional(),
  episodes: z.array(z.number().int().positive()).max(100).optional(),
  category: z.string().max(80).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateSchema = entitySchema.partial().extend({ entityId: z.string().uuid() })

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    if (!getProjectBundle(projectId)) return fail('项目不存在', 404)
    return ok(createEntity(projectId, entitySchema.parse(await request.json())), { status: 201 })
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = updateSchema.parse(await request.json())
    const bundle = getProjectBundle(projectId)
    if (!bundle?.entities.some(entity => entity.id === body.entityId)) return fail('素材不存在', 404)
    const entity = updateEntity(body.entityId, body)
    return entity ? ok(entity) : fail('素材不存在', 404)
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const entityId = new URL(request.url).searchParams.get('entityId')
    const bundle = getProjectBundle(projectId)
    if (!entityId || !bundle?.entities.some(entity => entity.id === entityId)) return fail('素材不存在', 404)
    return deleteEntity(entityId) ? ok({ deleted: true }) : fail('素材不存在', 404)
  } catch (error) {
    return fail(error)
  }
}
