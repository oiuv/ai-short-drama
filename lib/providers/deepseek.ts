import { z } from 'zod'
import { resolveVideoStylePrompt } from '@/config/video-styles'
import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_MAX_OUTPUT_TOKENS } from '../model-config'
import type { GeneratedScript, GeneratedStoryboard } from '../types'
import { loadSkillPrompt } from '../skills'

const generatedScriptSchema = z.object({
  summary: z.object({
    title: z.string().min(1),
    synopsis: z.string().min(1),
    genre: z.string().min(1),
    protagonist: z.string().default(''),
    background: z.string().default(''),
    setting: z.string().default(''),
    oneSentence: z.string().default(''),
  }),
  episodes: z.array(z.object({
    episodeNumber: z.number().int().positive(),
    title: z.string(),
    content: z.string().min(1),
  })).min(1),
  characters: z.array(z.object({
    name: z.string().min(1),
    role: z.string().default('supporting'),
    gender: z.string().default('unknown'),
    introduction: z.string().default(''),
    voiceDescription: z.string().default(''),
    looks: z.array(z.object({
      name: z.string().min(1).default('默认形象'),
      description: z.string().min(1),
      episodes: z.array(z.number().int().positive()).default([]),
      voiceDescription: z.string().optional(),
    })).min(1),
  })),
  scenes: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    episodes: z.array(z.number().int().positive()).default([]),
  })),
  props: z.array(z.object({
    name: z.string().min(1),
    category: z.string().default('item'),
    description: z.string().min(1),
    episodes: z.array(z.number().int().positive()).default([]),
  })),
})

const generatedStoryboardSchema = z.object({
  shots: z.array(z.object({
    shotOrder: z.number().int().positive(),
    sceneName: z.string().default(''),
    characters: z.array(z.string()).default([]),
    action: z.string().default(''),
    dialogue: z.string().default(''),
    prompt: z.string().min(1),
    duration: z.number().int().min(4).max(15),
    referenceEntityNames: z.array(z.string()).default([]),
  })).min(1),
})

const optimizedScriptBriefSchema = z.object({
  brief: z.string().min(1).max(100_000),
  genreDetected: z.string().default(''),
  tips: z.array(z.string()).max(5).default([]),
})

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('DeepSeek 未返回有效 JSON')
  }
}

async function callDeepSeekJson<Schema extends z.ZodTypeAny>(
  systemPrompt: string,
  userPrompt: string,
  schema: Schema,
): Promise<z.output<Schema>> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('未配置 DEEPSEEK_API_KEY')
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const model = process.env.DEEPSEEK_MODEL || DEEPSEEK_DEFAULT_MODEL
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: DEEPSEEK_MAX_OUTPUT_TOKENS,
        stream: false,
      }),
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) throw new Error(`DeepSeek API 错误 (${response.status}): ${raw.slice(0, 500)}`)
    const payload = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }
    if (payload.error) throw new Error(payload.error.message || 'DeepSeek 调用失败')
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek 返回内容为空')
    return schema.parse(extractJson(content))
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('DeepSeek 请求超时')
    if (error instanceof z.ZodError) {
      throw new Error(`DeepSeek 返回结构不符合要求：${error.issues[0]?.message || '结构错误'}`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function optimizeScriptBrief(input: {
  brief: string
  title?: string
  genre: string
  visualStyle: string
  ratio: string
}) {
  const systemPrompt = await loadSkillPrompt('script-brief')
  const visualStyle = resolveVideoStylePrompt(input.visualStyle)
  const userPrompt = `请使用本 Skill 优化下面的爽剧创作需求，保留用户已经明确的人物、关系、情节、结局和禁忌。只返回符合 Skill 输出契约的 JSON。

剧名：${input.title?.trim() || '暂未命名'}
题材：${input.genre}
画面比例：${input.ratio}
视觉风格：${visualStyle}

用户原始想法或素材：
${input.brief}`

  return callDeepSeekJson(systemPrompt, userPrompt, optimizedScriptBriefSchema)
}

export async function generateScript(input: {
  title: string
  brief: string
  synopsis?: string
  genre: string
  visualStyle: string
  ratio: string
  episodeCount: number
}): Promise<GeneratedScript> {
  const systemPrompt = await loadSkillPrompt('drama-script')
  const visualStyle = resolveVideoStylePrompt(input.visualStyle)

  const userPrompt = `请使用本 Skill 完成以下短剧创作。分集数量必须精确等于 ${input.episodeCount}，episodeNumber 从 1 连续递增，并严格遵循 Skill 的 JSON 输出契约。

剧名：${input.title || '由你拟定'}
题材：${input.genre}
集数：${input.episodeCount}
画面比例：${input.ratio}
视觉风格：${visualStyle}
已有梗概：${input.synopsis || '无'}
创作需求或原始素材：
${input.brief}`
  const generated = await callDeepSeekJson(systemPrompt, userPrompt, generatedScriptSchema)
  if (generated.episodes.length !== input.episodeCount) {
    throw new Error(`Skill 返回 ${generated.episodes.length} 集，要求为 ${input.episodeCount} 集`)
  }
  return {
    project: {
      title: generated.summary.title,
      synopsis: generated.summary.synopsis,
      genre: generated.summary.genre || input.genre,
    },
    episodes: generated.episodes,
    characters: generated.characters.flatMap(character => character.looks.map(look => ({
      name: character.name,
      variant: look.name || '默认形象',
      role: character.role,
      gender: character.gender,
      introduction: character.introduction,
      voiceDescription: look.voiceDescription || character.voiceDescription,
      description: look.description,
      episodes: look.episodes,
    }))),
    scenes: generated.scenes,
    props: generated.props,
  }
}

export async function generateStoryboard(input: {
  episodeNumber: number
  episodeTitle: string
  episodeContent: string
  visualStyle: string
  ratio: string
  entities: Array<{ name: string; variant: string; kind: string; description: string }>
}): Promise<GeneratedStoryboard> {
  const systemPrompt = await loadSkillPrompt('drama-shot-prompt')
  const visualStyle = resolveVideoStylePrompt(input.visualStyle)

  const entityText = input.entities.map(entity =>
    `- [${entity.kind}] ${entity.name}${entity.variant ? ` / ${entity.variant}` : ''}：${entity.description}`
  ).join('\n')
  const userPrompt = `请使用本 Skill 拆分以下单集剧本。referenceEntityNames 只能逐字使用“可用资产”清单中的名称；角色造型使用“角色名 / 造型名”。输出严格遵循 Skill 的 JSON 契约。

第 ${input.episodeNumber} 集：${input.episodeTitle}
画面比例：${input.ratio}
视觉风格：${visualStyle}

可用素材：
${entityText || '暂无素材'}

本集剧本：
${input.episodeContent}`
  const generated = await callDeepSeekJson(systemPrompt, userPrompt, generatedStoryboardSchema)
  return {
    shots: generated.shots
      .sort((a, b) => a.shotOrder - b.shotOrder)
      .map((shot, index) => ({
        shotOrder: index + 1,
        prompt: shot.prompt,
        duration: shot.duration,
        referenceEntityNames: shot.referenceEntityNames,
      })),
  }
}
