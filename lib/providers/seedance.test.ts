import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedanceTask, querySeedanceTask } from './seedance'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Seedance provider', () => {
  it('创建任务时发送当前模型参数并设置请求超时', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ id: 'task-1' }),
      { status: 200 },
    ))
    vi.stubEnv('VOLCENGINE_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    await expect(createSeedanceTask({
      model: 'doubao-seedance-2-0-260128',
      content: [{ type: 'text', text: '雨夜追车' }],
      ratio: '9:16',
      resolution: '720p',
      duration: 5,
    })).resolves.toBe('task-1')

    const request = fetchMock.mock.calls[0]
    const body = JSON.parse(String(request?.[1]?.body)) as Record<string, unknown>
    expect(request?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(body).toMatchObject({
      model: 'doubao-seedance-2-0-260128',
      content: [{ type: 'text', text: '雨夜追车' }],
      ratio: '9:16',
      resolution: '720p',
      duration: 5,
      generate_audio: true,
      watermark: false,
      return_last_frame: true,
    })
  })

  it('查询任务时设置超时并解析成功结果', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({
        status: 'succeeded',
        content: { video_url: 'https://example.com/video.mp4' },
        duration: 5,
        resolution: '720p',
      }),
      { status: 200 },
    ))
    vi.stubEnv('VOLCENGINE_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    await expect(querySeedanceTask('task-1')).resolves.toMatchObject({
      status: 'succeeded',
      videoUrl: 'https://example.com/video.mp4',
      duration: 5,
      resolution: '720p',
    })
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
