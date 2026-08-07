import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagnosticError } from '../diagnostic-error'
import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_MAX_OUTPUT_TOKENS } from '../model-config'
import { generateScript, generateStoryboard, optimizeScriptBrief } from './deepseek'

function episodeContent(locationPrefix: string, sceneCount = 10): string {
  const times = ['晨', '日', '昏', '夜']
  return Array.from({ length: sceneCount }, (_, index) => {
    const sceneNumber = index + 1
    const interior = index % 2 === 0 ? '内' : '外'
    return `[${sceneNumber}] ${interior} ${locationPrefix}${sceneNumber} ${times[index % times.length]}\n人物：林夏\n△ 林夏在此处推进第${sceneNumber}个行动。\n林夏：「线索又向前一步。」`
  }).join('\n\n')
}

function generatedScriptResponse(content: string): Response {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          summary: { title: '雨夜证词', synopsis: '林夏追查真相。', genre: '悬疑复仇' },
          episodes: [{ episodeNumber: 1, title: '追查', content }],
          characters: [],
          scenes: [],
          props: [],
        }),
      },
    }],
  }), { status: 200 })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('DeepSeek provider', () => {
  it('在请求模型前拒绝单次创作超过 10 集', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateScript({
      title: '雨夜证词',
      brief: '女记者追查好友失踪案。',
      genre: '悬疑复仇',
      visualStyle: '电影感写实',
      ratio: '9:16',
      episodeCount: 11,
      plannedEpisodes: 20,
    })).rejects.toThrow('单次剧本创作集数必须是 1–10 的整数')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('按当前 DeepSeek 模型的最大输出请求，并接受超过旧限制的需求文本', async () => {
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
      response_format: { type: string }
      messages: Array<{ role: string; content: string }>
    }

    expect(requestBody.model).toBe(DEEPSEEK_DEFAULT_MODEL)
    expect(requestBody.max_tokens).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS)
    expect(requestBody).toMatchObject({
      thinking: { type: 'enabled' },
      response_format: { type: 'json_object' },
      stream: true,
      stream_options: { include_usage: true },
    })
    expect(requestBody.messages[1]?.content).toContain('雨夜证词')
    expect(result.brief).toBe(optimizedBrief)
  })

  it('纠正模型把顶层数组误放进 summary 的合法 JSON', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: {
              title: '雨夜证词',
              synopsis: '林夏追查真相。',
              genre: '悬疑复仇',
              episodes: [{ episodeNumber: 1, title: '追查', content: episodeContent('旧仓库') }],
              characters: [],
              scenes: [],
              props: [],
            },
          }),
        },
      }],
    }), { status: 200 }))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateScript({
      title: '雨夜证词',
      brief: '女记者追查好友失踪案。',
      genre: '悬疑复仇',
      visualStyle: '电影感写实',
      ratio: '9:16',
      episodeCount: 1,
      plannedEpisodes: 10,
    })

    expect(result.episodes).toHaveLength(1)
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    expect(requestBody.messages[0]?.content).toContain('根对象固定且必须同时包含 `summary`、`episodes`、`characters`、`scenes`、`props` 五个同级字段')
    expect(requestBody.messages[1]?.content).not.toContain('最终 JSON 根结构硬约束')
  })

  it('结构校验失败时指出缺失字段路径', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        summary: { title: '雨夜证词', synopsis: '林夏追查真相。', genre: '悬疑复仇' },
      }) } }],
    }), { status: 200 })))

    let failure: unknown
    try {
      await generateScript({
        title: '雨夜证词', brief: '女记者追查好友失踪案。', genre: '悬疑复仇',
        visualStyle: '电影感写实', ratio: '9:16', episodeCount: 1, plannedEpisodes: 10,
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(DiagnosticError)
    expect((failure as Error).message).toContain('episodes: Required')
    expect((failure as DiagnosticError).diagnostics).toMatchObject({ phase: 'schema_validation' })
  })

  it('可收集参考项目同款 SSE 流式 JSON 响应', async () => {
    const optimized = JSON.stringify({
      brief: '完整爽剧需求',
      genreDetected: '逆袭',
      tips: ['强化集末钩子'],
    })
    const stream = [
      `data: ${JSON.stringify({ id: 'deepseek-response-1', choices: [{ delta: { reasoning_content: '分析中' } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: optimized.slice(0, 12) } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: optimized.slice(12) }, finish_reason: 'stop' }] })}`,
      'data: [DONE]',
      '',
    ].join('\n\n')
    const fetchMock = vi.fn(async () => new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'x-request-id': 'provider-request-1' },
    }))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const result = await optimizeScriptBrief({
      brief: '一个普通人逆袭的故事。',
      genre: '逆袭',
      visualStyle: '电影感写实',
      ratio: '9:16',
    })

    expect(result.brief).toBe('完整爽剧需求')
  })

  it('忽略单个异常 SSE 事件并继续收集有效 JSON', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const optimized = JSON.stringify({
      brief: '容错后仍然完整的需求',
      genreDetected: '逆袭',
      tips: [],
    })
    const stream = [
      `data: ${JSON.stringify({ id: 'deepseek-response-tolerant', choices: [{ delta: { content: optimized.slice(0, 10) } }] })}`,
      'data: provider-heartbeat',
      `data: ${JSON.stringify({ choices: [{ delta: { content: optimized.slice(10) }, finish_reason: 'stop' }] })}`,
      'data: [DONE]',
      '',
    ].join('\n\n')
    const fetchMock = vi.fn(async () => new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    await expect(optimizeScriptBrief({
      brief: '一个普通人逆袭的故事。',
      genre: '逆袭',
      visualStyle: '电影感写实',
      ratio: '9:16',
    })).resolves.toMatchObject({ brief: '容错后仍然完整的需求' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(consoleWarn).toHaveBeenCalledWith(
      '[雪风AI短剧工坊][DeepSeek] 已忽略异常 SSE 事件',
      expect.objectContaining({ malformedStreamEventCount: 1 }),
    )
  })

  it('首次正式内容为空时强化 JSON 指令并自动重试', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const emptyStream = [
      `data: ${JSON.stringify({ id: 'deepseek-response-empty-first', choices: [{ delta: { reasoning_content: '仅有推理' } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}`,
      'data: [DONE]',
      '',
    ].join('\n\n')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        brief: '第二次返回完整需求',
        genreDetected: '逆袭',
        tips: [],
      }) } }],
    }), { status: 200 }))
      .mockResolvedValueOnce(new Response(emptyStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    await expect(optimizeScriptBrief({
      brief: '一个普通人逆袭的故事。',
      genre: '逆袭',
      visualStyle: '电影感写实',
      ratio: '9:16',
    })).resolves.toMatchObject({ brief: '第二次返回完整需求' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>
    }
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ content: string }>
    }
    expect(firstBody.messages[1]?.content).not.toContain('JSON 输出重试要求')
    expect(retryBody.messages[1]?.content).toContain('只在 content 中输出一个完整 JSON 对象')
  })

  it('流读取失败时自动重试完整请求', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const brokenStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('模拟流中断'))
      },
    })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        brief: '重试后恢复',
        genreDetected: '悬疑',
        tips: [],
      }) } }],
    }), { status: 200 }))
      .mockResolvedValueOnce(new Response(brokenStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    await expect(optimizeScriptBrief({
      brief: '女记者追查真相。',
      genre: '悬疑',
      visualStyle: '电影感写实',
      ratio: '9:16',
    })).resolves.toMatchObject({ brief: '重试后恢复' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('连续两次空内容才返回诊断错误，且日志不泄露密钥和请求正文', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const stream = [
      `data: ${JSON.stringify({ id: 'deepseek-response-empty', choices: [{ delta: { reasoning_content: '仅有推理' } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] })}`,
      'data: [DONE]',
      '',
    ].join('\n\n')
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key-secret')
    const fetchMock = vi.fn(async () => new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'x-request-id': 'provider-request-empty' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    let failure: unknown
    try {
      await optimizeScriptBrief({
        brief: '不可写入日志的用户故事正文',
        genre: '逆袭',
        visualStyle: '电影感写实',
        ratio: '9:16',
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(DiagnosticError)
    expect((failure as Error).message).toBe('DeepSeek 连续两次返回内容为空')
    expect((failure as DiagnosticError).diagnostics).toMatchObject({
      provider: 'deepseek',
      model: DEEPSEEK_DEFAULT_MODEL,
      phase: 'empty_content',
      attempt: 2,
      maxAttempts: 2,
      httpStatus: 200,
      providerRequestId: 'provider-request-empty',
      providerResponseId: 'deepseek-response-empty',
      choicesCount: 1,
      finishReason: 'length',
      contentLength: 0,
      reasoningContentLength: 4,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const logged = JSON.stringify(consoleError.mock.calls)
    expect(logged).not.toContain('test-key-secret')
    expect(logged).not.toContain('不可写入日志的用户故事正文')
  })

  it('续写时传入完整上下文、绝对集数和计划总集数，并规范化资产集号', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: {
              title: '雨夜证词',
              synopsis: '林夏继续追查雨夜真相。',
              genre: '悬疑复仇',
            },
            episodes: [
              { episodeNumber: 1, title: '旧证人', content: episodeContent('旧仓库') },
              { episodeNumber: 2, title: '真相一角', content: episodeContent('河岸') },
            ],
            characters: [{
              name: '林夏',
              role: 'protagonist',
              gender: 'female',
              introduction: '记者',
              voiceDescription: '冷静清晰',
              looks: [{ name: '默认形象', description: '短发，深色风衣，全身站立', episodes: [1, 2] }],
            }],
            scenes: [{ name: '旧仓库_夜晚', description: '空旷旧仓库，冷色顶光', episodes: [1, 2] }],
            props: [{ name: '录音笔', category: 'item', description: '银色旧录音笔', episodes: [2] }],
          }),
        },
      }],
    }), { status: 200 }))

    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateScript({
      title: '雨夜证词',
      brief: '女记者追查好友失踪案。',
      synopsis: '前三集发现了被篡改的证词。',
      genre: '悬疑复仇',
      visualStyle: '电影感写实',
      ratio: '9:16',
      mode: 'continue',
      startEpisode: 4,
      episodeCount: 2,
      plannedEpisodes: 10,
      existingEpisodes: [
        { episodeNumber: 1, title: '失踪', content: '第一集完整内容' },
        { episodeNumber: 2, title: '伪证', content: '第二集完整内容' },
        { episodeNumber: 3, title: '雨夜', content: '第三集完整内容' },
      ],
      instruction: '让旧证人出现，但暂时不要揭晓幕后主使。',
    })

    const requestInit = fetchMock.mock.calls[0]?.[1]
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    const userPrompt = requestBody.messages[1]?.content ?? ''

    expect(userPrompt).toContain('这是续写任务')
    expect(userPrompt).toContain('本次生成：第 4 集到第 5 集，共 2 集')
    expect(userPrompt).toContain('已生成集数：3 集')
    expect(userPrompt).toContain('计划总集数：10 集')
    expect(userPrompt).toContain('第三集完整内容')
    expect(userPrompt).toContain('让旧证人出现')
    expect(userPrompt).toContain('禁止出现剧终标记')
    expect(result.episodes.map(episode => episode.episodeNumber)).toEqual([4, 5])
    expect(result.characters[0]?.episodes).toEqual([4, 5])
    expect(result.scenes[0]?.episodes).toEqual([4, 5])
    expect(result.props[0]?.episodes).toEqual([5])
  })

  it('单集不足默认场数时自动要求 DeepSeek 完整重写一次', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(generatedScriptResponse(episodeContent('短场', 3)))
      .mockResolvedValueOnce(generatedScriptResponse(episodeContent('完整场')))

    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateScript({
      title: '雨夜证词',
      brief: '女记者追查好友失踪案。',
      genre: '悬疑复仇',
      visualStyle: '电影感写实',
      ratio: '9:16',
      episodeCount: 1,
      plannedEpisodes: 10,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ content: string }>
    }
    expect(retryBody.messages[1]?.content).toContain('第 1 集只有 3 场，要求 10–15 场')
    expect(retryBody.messages[1]?.content).toContain('不得只补场号')
    expect(result.episodes[0]?.content.match(/^\[\d+\]/gm)).toHaveLength(10)
  })

  it('模型漏掉场次间空行时在落库前统一补齐', async () => {
    const compactContent = episodeContent('连续场').replace(/\n\n(?=\[\d+\])/g, '\n')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      generatedScriptResponse(compactContent)
    ))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateScript({
      title: '雨夜证词',
      brief: '女记者追查好友失踪案。',
      genre: '悬疑复仇',
      visualStyle: '电影感写实',
      ratio: '9:16',
      episodeCount: 1,
      plannedEpisodes: 10,
    })

    expect(result.episodes[0]?.content).toContain('林夏：「线索又向前一步。」\n\n[2] 外 连续场2 日')
    expect(result.episodes[0]?.content).not.toMatch(/[^\n]\n\[\d+\]\s+(?:内|外)/)
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>
    }
    expect(requestBody.messages[1]?.content).toContain('相邻场次之间必须空一行')
  })

  it('用户明确指定较少场数时遵循用户要求而不强制扩写', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      generatedScriptResponse(episodeContent('限定场', 3))
    ))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    await generateScript({
      title: '三场试炼',
      brief: '每集3场戏，三场都要有完整冲突。',
      genre: '逆袭',
      visualStyle: '电影感写实',
      ratio: '9:16',
      episodeCount: 1,
      plannedEpisodes: 10,
    })

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(requestBody.messages[1]?.content).toContain('每集必须为 3 场，这是用户明确要求')
  })

  it('分镜请求携带角色文字音色描述但不需要音频参考', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            shots: [{
              shotOrder: 1,
              prompt: '林夏压低声音说出台词。',
              duration: 6,
              referenceEntityNames: ['林夏 / 默认造型', '旧仓库_夜晚'],
            }],
          }),
        },
      }],
    }), { status: 200 }))
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    await generateStoryboard({
      episodeNumber: 1,
      episodeTitle: '追查',
      episodeContent: '林夏在旧仓库质问证人。',
      visualStyle: '电影感写实',
      ratio: '9:16',
      entities: [
        {
          name: '林夏',
          variant: '默认造型',
          kind: 'character',
          description: '短发，深色风衣',
          voiceDescription: '青年女声，音调中低，冷静清晰',
        },
        {
          name: '旧仓库_夜晚',
          variant: '',
          kind: 'scene',
          description: '空旷旧仓库，冷色顶光',
        },
      ],
    })

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>
    }
    const userPrompt = requestBody.messages[1]?.content ?? ''
    expect(userPrompt).toContain('林夏 / 默认造型')
    expect(userPrompt).toContain('音色描述：青年女声，音调中低，冷静清晰')
    expect(userPrompt).not.toContain('音频参考')
  })
})
