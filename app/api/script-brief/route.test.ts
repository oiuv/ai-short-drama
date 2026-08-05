import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  optimizeScriptBrief: vi.fn(),
}))

vi.mock('@/lib/providers/deepseek', () => ({
  optimizeScriptBrief: mocks.optimizeScriptBrief,
}))

import { POST } from './route'

afterEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/script-brief', () => {
  it('自定义题材为空时返回可直接展示的校验信息', async () => {
    const response = await POST(new Request('http://localhost/api/script-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief: '一个复仇故事',
        title: '未命名',
        genre: '',
        visualStyle: '电影感写实',
        ratio: '9:16',
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: '请选择题材或填写自定义题材',
    })
    expect(mocks.optimizeScriptBrief).not.toHaveBeenCalled()
  })
})
