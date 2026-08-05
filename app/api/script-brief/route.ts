import { z } from 'zod'
import { fail, ok } from '@/lib/api'
import { optimizeScriptBrief } from '@/lib/providers/deepseek'

export const dynamic = 'force-dynamic'

const optimizeSchema = z.object({
  brief: z.string().trim().min(1, '请先写下故事想法').max(100_000, '创作素材不能超过 100000 个字符'),
  title: z.string().trim().max(120).optional(),
  genre: z.string().trim().min(1, '请选择题材或填写自定义题材').max(80, '题材不能超过 80 个字符'),
  visualStyle: z.string().trim().min(1, '请选择视觉风格').max(500, '视觉风格不能超过 500 个字符'),
  ratio: z.enum(['16:9', '9:16']),
})

export async function POST(request: Request) {
  try {
    const input = optimizeSchema.parse(await request.json())
    return ok(await optimizeScriptBrief(input))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.issues[0]?.message || '创作需求参数无效', 400)
    }
    return fail(error, 500)
  }
}
