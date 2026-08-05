import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_MAX_OUTPUT_TOKENS } from '../model-config'
import { optimizeScriptBrief } from './deepseek'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('DeepSeek provider', () => {
  it('按参考项目的模型硬上限请求，并接受超过旧限制的需求文本', async () => {
    const optimizedBrief = `【主角设定】\n${'完整设定'.repeat(15_000)}`
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            brief: optimizedBrief,
            genreDetected: '悬疑复仇',
            tips: ['可以继续调整结局'],
          }),
        },
      }],
    }), { status: 200 }))

    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const result = await optimizeScriptBrief({
      brief: '女主在雨夜发现自己被最信任的人背叛。',
      title: '雨夜证词',
      genre: '悬疑',
      visualStyle: '电影感写实',
      ratio: '9:16',
    })

    const requestInit = fetchMock.mock.calls[0]?.[1]
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      model: string
      max_tokens: number
      messages: Array<{ role: string; content: string }>
    }

    expect(requestBody.model).toBe(DEEPSEEK_DEFAULT_MODEL)
    expect(requestBody.max_tokens).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS)
    expect(requestBody.messages[1]?.content).toContain('雨夜证词')
    expect(result.brief).toBe(optimizedBrief)
  })
})
