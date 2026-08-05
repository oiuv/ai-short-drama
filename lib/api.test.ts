import { describe, expect, it } from 'vitest'
import { fail } from './api'
import { DiagnosticError } from './diagnostic-error'

describe('API diagnostics', () => {
  it('只把显式标记为公开的诊断元数据返回客户端', async () => {
    const response = fail(new DiagnosticError('DeepSeek 返回内容为空', {
      diagnosticId: 'debug-1',
      provider: 'deepseek',
      phase: 'empty_content',
      contentLength: 0,
    }), 500)

    expect(await response.json()).toEqual({
      success: false,
      error: 'DeepSeek 返回内容为空',
      diagnostics: {
        diagnosticId: 'debug-1',
        provider: 'deepseek',
        phase: 'empty_content',
        contentLength: 0,
      },
    })
  })

  it('普通错误不向客户端暴露额外属性', async () => {
    const error = Object.assign(new Error('普通错误'), { apiKey: 'should-not-leak' })
    const response = fail(error)

    expect(await response.json()).toEqual({ success: false, error: '普通错误' })
  })
})
