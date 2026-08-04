import path from 'node:path'
import { Readable } from 'node:stream'
import { getMediaStat, streamMedia } from '@/lib/local-media'
import { fail } from '@/lib/api'

export const dynamic = 'force-dynamic'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await params
    const relativePath = pathSegments.map(decodeURIComponent).join('/')
    const fileStat = await getMediaStat(relativePath)
    const contentType = MIME_TYPES[path.extname(relativePath).toLowerCase()] || 'application/octet-stream'
    const range = request.headers.get('range')
    const commonHeaders = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      'Content-Type': contentType,
    }
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/)
      if (!match) return new Response(null, { status: 416 })
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1
      if (start < 0 || start > end || end >= fileStat.size) return new Response(null, { status: 416 })
      const stream = Readable.toWeb(streamMedia(relativePath, start, end))
      return new Response(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          ...commonHeaders,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${fileStat.size}`,
        },
      })
    }
    const stream = Readable.toWeb(streamMedia(relativePath))
    return new Response(stream as unknown as BodyInit, {
      headers: { ...commonHeaders, 'Content-Length': String(fileStat.size) },
    })
  } catch (error) {
    return fail(error, 404)
  }
}
