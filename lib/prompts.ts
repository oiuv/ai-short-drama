import { resolveVideoStylePrompt } from '@/config/video-styles'
import type { Entity, EntityKind, Project } from './types'

const KIND_LABELS: Record<EntityKind, string> = {
  character: '角色造型设定',
  scene: '空镜场景设定',
  prop: '关键道具设定',
}

export function buildEntityImagePrompt(entity: Entity, project: Project, threeView: boolean): string {
  const identity = entity.variant ? `${entity.name}，${entity.variant}` : entity.name
  const role = typeof entity.metadata.role === 'string' ? `，角色定位：${entity.metadata.role}` : ''
  const noPeople = entity.kind === 'scene' ? '画面中不得出现任何人物或人形主体。' : ''
  const cleanBackground = entity.kind !== 'scene' ? '纯净中性背景，主体完整，不出现文字、标签、水印和边框。' : ''
  const views = threeView && entity.kind !== 'scene'
    ? '以专业三视图设定稿呈现同一主体的正面、侧面和背面，三个视图比例一致、细节完全统一。'
    : ''
  const visualStyle = resolveVideoStylePrompt(project.visualStyle)
  return `${KIND_LABELS[entity.kind]}。${identity}${role}。${entity.description}。
视觉风格：${visualStyle}。${noPeople}${cleanBackground}${views}
高质量影视概念设计，材质、结构、色彩和光影清晰，保持可供后续视频生成复用的一致性。`
}
