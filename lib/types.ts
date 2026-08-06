export type EntityKind = 'character' | 'scene' | 'prop'
export type EpisodeStatus = 'draft' | 'confirmed'
export type ShotStatus = 'pending' | 'generating' | 'success' | 'failed'

export interface Project {
  id: string
  title: string
  brief: string
  synopsis: string
  genre: string
  visualStyle: string
  ratio: string
  plannedEpisodes: number | null
  createdAt: string
  updatedAt: string
}

export interface ProjectProgress {
  episodes: { total: number; confirmed: number }
  characters: { total: number; withImage: number }
  scenes: { total: number; withImage: number }
  props: { total: number; withImage: number }
  shots: { total: number; completed: number; generating: number; failed: number }
}

export interface ProjectListItem extends Project {
  progress: ProjectProgress
}

export interface Episode {
  id: string
  projectId: string
  episodeNumber: number
  title: string
  content: string
  status: EpisodeStatus
  createdAt: string
  updatedAt: string
}

export interface ImageVersion {
  id: string
  entityId: string
  path: string
  prompt: string
  createdAt: string
  url: string
}

export interface Entity {
  id: string
  projectId: string
  kind: EntityKind
  name: string
  variant: string
  description: string
  episodes: number[]
  category: string
  metadata: Record<string, unknown>
  selectedImageId: string | null
  images: ImageVersion[]
  selectedImage: ImageVersion | null
  createdAt: string
  updatedAt: string
}

export interface VideoVersion {
  id: string
  shotId: string
  path: string | null
  providerTaskId: string
  model: string
  duration: number
  resolution: string
  prompt: string
  rating: number | null
  note: string
  createdAt: string
  url: string | null
}

export interface Shot {
  id: string
  projectId: string
  episodeId: string
  shotOrder: number
  prompt: string
  duration: number
  referenceEntityIds: string[]
  status: ShotStatus
  providerTaskId: string | null
  error: string | null
  selectedVideoId: string | null
  videos: VideoVersion[]
  selectedVideo: VideoVersion | null
  createdAt: string
  updatedAt: string
}

export interface EditClip {
  id: string
  shotId: string
  enabled: boolean
  start: number
  end: number
}

export interface EditDraft {
  id: string
  projectId: string
  episodeId: string
  clips: EditClip[]
  outputPath: string | null
  outputUrl: string | null
  updatedAt: string
}

export interface ProjectBundle {
  project: Project
  episodes: Episode[]
  entities: Entity[]
  shots: Shot[]
  edits: EditDraft[]
}

export interface GeneratedScript {
  project: { title: string; synopsis: string; genre: string }
  episodes: Array<{ episodeNumber: number; title: string; content: string }>
  characters: Array<{
    name: string
    variant: string
    role: string
    gender: string
    introduction?: string
    voiceDescription?: string
    description: string
    episodes: number[]
  }>
  scenes: Array<{ name: string; description: string; episodes: number[] }>
  props: Array<{ name: string; category: string; description: string; episodes: number[] }>
}

export interface GeneratedStoryboard {
  shots: Array<{
    shotOrder: number
    prompt: string
    duration: number
    referenceEntityNames: string[]
  }>
}
