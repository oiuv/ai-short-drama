import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { mediaUrl, parseDataUrl, resolveMediaPath } from './local-media'

describe('本地媒体边界', () => {
  it('解析标准 Base64 data URL', () => {
    const parsed = parseDataUrl('data:image/png;base64,aGVsbG8=')
    expect(parsed.mime).toBe('image/png')
    expect(parsed.buffer.toString('utf8')).toBe('hello')
  })

  it('拒绝 URL 和非法 Base64 参数', () => {
    expect(() => parseDataUrl('https://example.com/image.png')).toThrow('Base64 data URL')
    expect(() => parseDataUrl('data:image/png,not-base64')).toThrow('Base64 data URL')
  })

  it('媒体路径不能逃出 data/media', () => {
    expect(() => resolveMediaPath('../outside.png')).toThrow('非法媒体路径')
    expect(resolveMediaPath('images/a.png')).toContain(`${path.sep}media${path.sep}images${path.sep}a.png`)
  })

  it('为本地文件生成编码后的媒体地址', () => {
    expect(mediaUrl('images/镜头 01.png')).toBe('/api/media/images/%E9%95%9C%E5%A4%B4%2001.png')
    expect(mediaUrl(null)).toBeNull()
  })
})
