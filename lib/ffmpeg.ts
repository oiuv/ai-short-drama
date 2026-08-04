import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getDataDir, resolveMediaPath } from './local-media'
import type { EditClip, ProjectBundle } from './types'

const execFileAsync = promisify(execFile)

export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

async function runFfmpeg(args: string[], timeout = 10 * 60 * 1000): Promise<void> {
  await execFileAsync('ffmpeg', args, { timeout, maxBuffer: 10 * 1024 * 1024 })
}

export async function renderEdit(
  bundle: ProjectBundle,
  episodeId: string,
  clips: EditClip[],
): Promise<string> {
  if (!(await checkFfmpeg())) throw new Error('未检测到 FFmpeg，请先安装并加入 PATH')
  const enabled = clips.filter(clip => clip.enabled)
  if (enabled.length === 0) throw new Error('至少需要启用一个剪辑片段')

  const renderId = randomUUID()
  const tempDir = path.join(getDataDir(), 'tmp', renderId)
  await mkdir(tempDir, { recursive: true })
  const project = bundle.project
  const isPortrait = project.ratio === '9:16' || project.ratio === '3:4'
  const targetWidth = isPortrait ? 720 : 1280
  const targetHeight = isPortrait ? 1280 : 720

  try {
    const normalizedPaths: string[] = []
    for (let index = 0; index < enabled.length; index += 1) {
      const clip = enabled[index]
      const shot = bundle.shots.find(item => item.id === clip.shotId && item.episodeId === episodeId)
      if (!shot?.selectedVideo?.path) throw new Error(`片段 ${index + 1} 缺少可用视频`)
      const sourceDuration = shot.selectedVideo.duration || shot.duration
      const start = Math.max(0, Math.min(clip.start, sourceDuration - 0.1))
      const end = Math.max(start + 0.1, Math.min(clip.end, sourceDuration))
      const output = path.join(tempDir, `${String(index).padStart(3, '0')}.mp4`)
      await runFfmpeg([
        '-ss', String(start),
        '-i', resolveMediaPath(shot.selectedVideo.path),
        '-t', String(end - start),
        '-map', '0:v:0',
        '-map', '0:a?',
        '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        output,
      ])
      normalizedPaths.push(output)
    }

    const fileList = path.join(tempDir, 'files.txt')
    await writeFile(fileList, normalizedPaths.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8')
    const relativePath = `exports/${project.id}/${episodeId}-${Date.now()}.mp4`
    const outputPath = resolveMediaPath(relativePath)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await runFfmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', fileList,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ])
    return relativePath
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
