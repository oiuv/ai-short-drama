export const PROJECT_GENRES = [
  '都市情感',
  '豪门霸总',
  '婚姻家庭',
  '赘婿逆袭',
  '重生复仇',
  '穿越逆袭',
  '战神归来',
  '神医高手',
  '商战职场',
  '古装权谋',
  '悬疑犯罪',
  '奇幻冒险',
] as const

export const DEFAULT_PROJECT_GENRE = PROJECT_GENRES[0]

export const PROJECT_RATIOS = [
  { value: '9:16', label: '竖屏', description: '短剧与移动端' },
  { value: '16:9', label: '横屏', description: '电影与桌面端' },
] as const

export type ProjectRatio = (typeof PROJECT_RATIOS)[number]['value']

export function isProjectRatio(value: string): value is ProjectRatio {
  return PROJECT_RATIOS.some(option => option.value === value)
}

export function normalizeProjectRatio(value?: string | null): ProjectRatio {
  return value && isProjectRatio(value) ? value : '9:16'
}
