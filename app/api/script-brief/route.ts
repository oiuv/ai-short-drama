import { z } from 'zod'
import { fail, ok } from '@/lib/api'
import { optimizeScriptBrief } from '@/lib/providers/deepseek'

export const dynamic = 'force-dynamic'

const optimizeSchema = z.object({
  brief: z.string().trim().min(1, '请先写下故事想法').max(100_000, '创作素材不能超过 100000 个字符'),
  title: z.string().trim().max(120).optional(),
  genre: z.string().trim().min(1).max(80),
  visualStyle: z.string().trim().min(1).max(500),
  ratio: z.enum(['16:9', '9:16']),
})

export async function POST(request: Request) {
  try {
    const input = optimizeSchema.parse(await request.json())
    return ok(await optimizeScriptBrief(input))
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}
