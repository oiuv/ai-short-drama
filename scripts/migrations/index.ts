import addPlannedEpisodes from './20260805213800-add-planned-episodes'
import type { DatabaseMigration } from './types'

export const migrations: DatabaseMigration[] = [
  addPlannedEpisodes,
]
