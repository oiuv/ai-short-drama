import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data')

export function getDataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || DEFAULT_DATA_DIR)
}

export function getMediaDir(): string {
  return path.join(getDataDir(), 'media')
}

export async function ensureDataDirectories(): Promise<void> {
  await Promise.all([
    mkdir(getMediaDir(), { recursive: true }),
    mkdir(path.join(getDataDir(), 'tmp'), { recursive: true }),
  ])
}

export function mediaUrl(relativePath: string | null): string | null {
  if (!relativePath) return null
  const encoded = relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  return `/api/media/${encoded}`
}

export function resolveMediaPath(relativePath: string): string {
  const mediaRoot = path.resolve(getMediaDir())
  const resolved = path.resolve(mediaRoot, relativePath)
  if (resolved !== mediaRoot && !resolved.startsWith(`${mediaRoot}${path.sep}`)) {
    throw new Error('非法媒体路径')
  }
  return resolved
}

function extensionForMime(mime: string): string {
  const normalized = mime.toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  if (normalized.includes('mp4')) return 'mp4'
  if (normalized.includes('quicktime')) return 'mov'
  if (normalized.includes('mpeg')) return 'mp3'
  if (normalized.includes('wav')) return 'wav'
  return 'jpg'
}

export function parseDataUrl(value: string): { mime: string; buffer: Buffer } {
  const match = value.match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/)
  if (!match) throw new Error('图片必须是有效的 Base64 data URL')
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') }
}

export async function saveDataUrl(
  dataUrl: string,
  folder: 'images' | 'uploads' = 'images',
): Promise<string> {
  const { mime, buffer } = parseDataUrl(dataUrl)
  if (buffer.length === 0 || buffer.length > 30 * 1024 * 1024) {
    throw new Error('图片大小必须在 1B 到 30MB 之间')
  }
  const relativePath = `${folder}/${randomUUID()}.${extensionForMime(mime)}`
  const absolutePath = resolveMediaPath(relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  const temporaryPath = `${absolutePath}.tmp`
  await writeFile(temporaryPath, buffer)
  await rename(temporaryPath, absolutePath)
  return relativePath
}

export async function fileToDataUrl(relativePath: string): Promise<string> {
  const absolutePath = resolveMediaPath(relativePath)
  const buffer = await readFile(absolutePath)
  const ext = path.extname(absolutePath).slice(1).toLowerCase()
  const mime = ext === 'jpg' || ext === 'jpeg'
    ? 'image/jpeg'
    : ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : 'application/octet-stream'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

export async function saveRemoteFile(
  url: string,
  folder: 'videos' | 'images' | 'exports',
  fallbackExtension: string,
): Promise<string> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`下载生成结果失败 (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || ''
  const urlExtension = path.extname(new URL(url).pathname).slice(1)
  const extension = contentType ? extensionForMime(contentType) : (urlExtension || fallbackExtension)
  const relativePath = `${folder}/${randomUUID()}.${extension}`
  const absolutePath = resolveMediaPath(relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  const temporaryPath = `${absolutePath}.tmp`

  await pipeline(
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
    createWriteStream(temporaryPath),
  )
  await rename(temporaryPath, absolutePath)
  return relativePath
}

export async function getMediaStat(relativePath: string) {
  return stat(resolveMediaPath(relativePath))
}

export function streamMedia(relativePath: string, start?: number, end?: number) {
  return createReadStream(resolveMediaPath(relativePath), { start, end })
}

export async function deleteMediaFile(relativePath: string): Promise<void> {
  try {
    await unlink(resolveMediaPath(relativePath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
