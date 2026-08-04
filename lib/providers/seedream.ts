import { seedreamSizeForRatio, SEEDREAM_5_LITE_MODEL } from '../model-config'
import { fileToDataUrl, saveDataUrl } from '../local-media'

interface SeedreamResponse {
  data?: Array<{ b64_json?: string; error?: { message?: string } }>
  error?: { message?: string }
}

export async function generateSeedreamImage(input: {
  prompt: string
  ratio: string
  referencePath?: string | null
}): Promise<{ path: string; prompt: string }> {
  const apiKey = process.env.VOLCENGINE_API_KEY
  if (!apiKey) throw new Error('未配置 VOLCENGINE_API_KEY')
  const model = process.env.SEEDREAM_MODEL || SEEDREAM_5_LITE_MODEL
  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    size: seedreamSizeForRatio(input.ratio),
    sequential_image_generation: 'disabled',
    response_format: 'b64_json',
    output_format: 'png',
    watermark: false,
    optimize_prompt_options: { mode: 'standard' },
  }
  if (input.referencePath) body.image = await fileToDataUrl(input.referencePath)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000)
  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) throw new Error(`Seedream API 错误 (${response.status}): ${raw.slice(0, 500)}`)
    const data = JSON.parse(raw) as SeedreamResponse
    if (data.error) throw new Error(data.error.message || 'Seedream 生成失败')
    const first = data.data?.find(item => item.b64_json)
    if (!first?.b64_json) {
      const itemError = data.data?.find(item => item.error)?.error?.message
      throw new Error(itemError || 'Seedream 未返回 Base64 图片')
    }
    const imagePath = await saveDataUrl(`data:image/png;base64,${first.b64_json}`, 'images')
    return { path: imagePath, prompt: input.prompt }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Seedream 请求超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}
