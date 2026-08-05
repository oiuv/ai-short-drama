import { describe, expect, it } from 'vitest'
import {
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_MAX_OUTPUT_TOKENS,
  getSeedanceModel,
  normalizeSeedanceDuration,
  seedreamSizeForRatio,
  SEEDANCE_MODELS,
  SEEDREAM_5_LITE_MODEL,
} from './model-config'

describe('模型配置', () => {
  it('默认使用 DeepSeek V4 Flash，并请求当前模型的最大输出', () => {
    expect(DEEPSEEK_DEFAULT_MODEL).toBe('deepseek-v4-flash')
    expect(DEEPSEEK_MAX_OUTPUT_TOKENS).toBe(384_000)
  })

  it('固定使用 Seedream 5.0 Lite 并按画幅映射分辨率', () => {
    expect(SEEDREAM_5_LITE_MODEL).toBe('doubao-seedream-5-0-260128')
    expect(seedreamSizeForRatio('9:16')).toBe('1600x2848')
    expect(seedreamSizeForRatio('1:1')).toBe('2048x2048')
    expect(seedreamSizeForRatio('unknown')).toBe('2848x1600')
  })

  it('仅暴露 Seedance 2.0 系列并限制视频时长', () => {
    expect(SEEDANCE_MODELS).toHaveLength(3)
    expect(SEEDANCE_MODELS.every(model => model.id.includes('seedance-2-0'))).toBe(true)
    expect(normalizeSeedanceDuration(SEEDANCE_MODELS[0].id, 1)).toBe(4)
    expect(normalizeSeedanceDuration(SEEDANCE_MODELS[0].id, 8.6)).toBe(9)
    expect(normalizeSeedanceDuration(SEEDANCE_MODELS[0].id, 30)).toBe(15)
    expect(getSeedanceModel('invalid').id).toBe(SEEDANCE_MODELS[0].id)
  })
})
