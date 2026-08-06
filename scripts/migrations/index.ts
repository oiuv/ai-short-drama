import addPlannedEpisodes from './20260805213800-add-planned-episodes'
import addShotVideoDetails from './20260806171147-add-shot-video-details'
import type { DatabaseMigration } from './types'

export const migrations: DatabaseMigration[] = [
  addPlannedEpisodes,
  addShotVideoDetails,
]
