import { getDb } from '../lib/db'
import { ensureDataDirectories } from '../lib/local-media'

async function main() {
  await ensureDataDirectories()
  getDb()
  console.log('本地数据库和媒体目录已初始化。')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
