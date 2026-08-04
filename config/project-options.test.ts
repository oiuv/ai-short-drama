import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PROJECT_RATIOS,
  isProjectRatio,
  normalizeProjectRatio,
} from './project-options'
import {
  VIDEO_STYLES,
  getDefaultVideoStyle,
  resolveVideoStylePrompt,
} from './video-styles'

describe('project creation options', () => {
  it('only exposes landscape and portrait ratios', () => {
    expect(PROJECT_RATIOS.map(option => option.value)).toEqual(['9:16', '16:9'])
    expect(isProjectRatio('9:16')).toBe(true)
    expect(isProjectRatio('16:9')).toBe(true)
    expect(isProjectRatio('1:1')).toBe(false)
    expect(normalizeProjectRatio('4:3')).toBe('9:16')
  })

  it('contains the complete migrated XuefengAI style library', () => {
    expect(VIDEO_STYLES).toHaveLength(39)
    expect(VIDEO_STYLES.filter(style => style.category === 'live-action')).toHaveLength(16)
    expect(VIDEO_STYLES.filter(style => style.category === '2d')).toHaveLength(12)
    expect(VIDEO_STYLES.filter(style => style.category === '3d')).toHaveLength(11)
    expect(getDefaultVideoStyle().id).toBe('cinematic')
  })

  it('uses local previews and resolves the full generation prompt', () => {
    for (const style of VIDEO_STYLES) {
      expect(style.previewImageUrl).toMatch(/^\/style-previews\/.+\.webp$/)
      expect(existsSync(path.join(process.cwd(), 'public', style.previewImageUrl))).toBe(true)
      expect(resolveVideoStylePrompt(style.promptValue)).toBe(style.generationPrompt)
    }
  })
})
