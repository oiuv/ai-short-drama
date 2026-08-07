import { getSeedanceModel, normalizeSeedanceDuration } from '../model-config'

export type SeedanceContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string }; role: 'reference_image' | 'first_frame' | 'last_frame' }

export interface SeedanceTaskStatus {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled'
  videoUrl?: string
  lastFrameUrl?: string
  duration?: number
  resolution?: string
  error?: string
}

const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'
const CREATE_TASK_TIMEOUT_MS = 60_000
const QUERY_TASK_TIMEOUT_MS = 30_000

function apiKey(): string {
  const key = process.env.VOLCENGINE_API_KEY
  if (!key) throw new Error('未配置 VOLCENGINE_API_KEY')
  return key
}

export async function createSeedanceTask(input: {
  model: string
  content: SeedanceContent[]
  ratio: string
  resolution: string
  duration: number
}): Promise<string> {
  const model = getSeedanceModel(input.model)
  if (!model.resolutions.includes(input.resolution as never)) {
    throw new Error(`${model.name} 不支持 ${input.resolution}`)
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: model.id,
      content: input.content,
      ratio: input.ratio,
      resolution: input.resolution,
      duration: normalizeSeedanceDuration(model.id, input.duration),
      generate_audio: true,
      watermark: false,
      return_last_frame: true,
    }),
    signal: AbortSignal.timeout(CREATE_TASK_TIMEOUT_MS),
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`Seedance API 错误 (${response.status}): ${raw.slice(0, 500)}`)
  const data = JSON.parse(raw) as { id?: string; error?: { message?: string } }
  if (data.error) throw new Error(data.error.message || 'Seedance 任务创建失败')
  if (!data.id) throw new Error('Seedance 未返回任务 ID')
  return data.id
}

export async function querySeedanceTask(taskId: string): Promise<SeedanceTaskStatus> {
  const response = await fetch(`${API_URL}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(QUERY_TASK_TIMEOUT_MS),
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`Seedance 查询失败 (${response.status}): ${raw.slice(0, 500)}`)
  const data = JSON.parse(raw) as {
    status: SeedanceTaskStatus['status']
    content?: { video_url?: string; last_frame_url?: string }
    duration?: number
    resolution?: string
    error?: { message?: string }
  }
  return {
    status: data.status,
    videoUrl: data.content?.video_url,
    lastFrameUrl: data.content?.last_frame_url,
    duration: data.duration,
    resolution: data.resolution,
    error: data.error?.message,
  }
}
