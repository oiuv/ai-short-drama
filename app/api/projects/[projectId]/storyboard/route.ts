import { z } from 'zod'
import { createShot, getProjectBundle, replaceStoryboard } from '@/lib/db'
import { generateStoryboard } from '@/lib/providers/deepseek'
import { fail, ok } from '@/lib/api'

export const maxDuration = 600

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate'), episodeId: z.string().uuid() }),
  z.object({ action: z.literal('add'), episodeId: z.string().uuid() }),
])

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s*[/／]\s*/g, '/')
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = schema.parse(await request.json())
    const bundle = getProjectBundle(projectId)
    if (!bundle) return fail('项目不存在', 404)
    const episode = bundle.episodes.find(item => item.id === body.episodeId)
    if (!episode) return fail('分集不存在', 404)
    if (body.action === 'add') return ok(createShot(projectId, episode.id), { status: 201 })
    if (!episode.content.trim()) return fail('本集剧本内容为空', 400)

    const generated = await generateStoryboard({
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title,
      episodeContent: episode.content,
      visualStyle: bundle.project.visualStyle,
      ratio: bundle.project.ratio,
      entities: bundle.entities.map(entity => ({
        name: entity.name,
        variant: entity.variant,
        kind: entity.kind,
        description: entity.description,
      })),
    })
    const entityByName = new Map<string, string>()
    bundle.entities.forEach(entity => {
      entityByName.set(normalizeName(entity.name), entity.id)
      entityByName.set(normalizeName(`${entity.name}/${entity.variant}`), entity.id)
    })
    const shots = generated.shots.map((shot, index) => ({
      shotOrder: index + 1,
      prompt: shot.prompt,
      duration: shot.duration,
      referenceEntityIds: Array.from(new Set(
        shot.referenceEntityNames
          .map(name => entityByName.get(normalizeName(name)))
          .filter((id): id is string => Boolean(id)),
      )),
    }))
    return ok(replaceStoryboard(projectId, episode.id, shots))
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500)
  }
}
