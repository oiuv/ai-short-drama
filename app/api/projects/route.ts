import { z } from 'zod'
import { createProject, listProjects } from '@/lib/db'
import { fail, ok } from '@/lib/api'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  brief: z.string().max(200_000).optional(),
  genre: z.string().trim().min(1).max(80).optional(),
  visualStyle: z.string().trim().min(1).max(500).optional(),
  ratio: z.enum(['16:9', '9:16']).optional(),
})

export async function GET() {
  try {
    return ok(listProjects())
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json())
    return ok(createProject(body), { status: 201 })
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}
