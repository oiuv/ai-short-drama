import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestJson } from './client'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('requestJson diagnostics', () => {
  it('在浏览器 Console 输出失败阶段和安全诊断信息', async () => {
    const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: false,
      error: 'DeepSeek 返回内容为空',
      diagnostics: {
        diagnosticId: 'debug-client-1',
        provider: 'deepseek',
        phase: 'empty_content',
        finishReason: 'length',
      },
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })))

    await expect(requestJson('/api/script-brief', {
      method: 'POST',
      body: JSON.stringify({ brief: '不应出现在 Console 的故事正文' }),
    })).rejects.toThrow('DeepSeek 返回内容为空')

    expect(consoleDebug).toHaveBeenCalledWith(
      '[雪风AI短剧工坊][API] 请求开始',
      { method: 'POST', url: '/api/script-brief' },
    )
    expect(consoleError).toHaveBeenCalledWith(
      '[雪风AI短剧工坊][API] 请求失败',
      expect.objectContaining({
        status: 500,
        diagnostics: expect.objectContaining({
          diagnosticId: 'debug-client-1',
          phase: 'empty_content',
        }),
      }),
    )
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('不应出现在 Console 的故事正文')
  })
})
