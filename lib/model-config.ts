export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-pro'
export const SEEDREAM_5_LITE_MODEL = 'doubao-seedream-5-0-260128'

export const SEEDANCE_MODELS = [
  {
    id: 'doubao-seedance-2-0-260128',
    name: 'Seedance 2.0',
    resolutions: ['480p', '720p', '1080p', '4k'],
    minDuration: 4,
    maxDuration: 15,
  },
  {
    id: 'doubao-seedance-2-0-fast-260128',
    name: 'Seedance 2.0 Fast',
    resolutions: ['480p', '720p'],
    minDuration: 4,
    maxDuration: 15,
  },
  {
    id: 'doubao-seedance-2-0-mini-260615',
    name: 'Seedance 2.0 Mini',
    resolutions: ['480p', '720p'],
    minDuration: 4,
    maxDuration: 15,
  },
] as const

export function seedreamSizeForRatio(ratio: string): string {
  const sizes: Record<string, string> = {
    '16:9': '2848x1600',
    '9:16': '1600x2848',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '1:1': '2048x2048',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3136x1344',
  }
  return sizes[ratio] ?? sizes['16:9']
}

export function getSeedanceModel(modelId: string) {
  return SEEDANCE_MODELS.find(model => model.id === modelId) ?? SEEDANCE_MODELS[0]
}

export function normalizeSeedanceDuration(modelId: string, duration: number): number {
  const model = getSeedanceModel(modelId)
  return Math.max(model.minDuration, Math.min(model.maxDuration, Math.round(duration)))
}
