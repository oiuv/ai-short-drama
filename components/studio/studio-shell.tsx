'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Box, Clapperboard, Image as ImageIcon, Loader2, RefreshCw,
  Scissors, ScrollText, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectBundle } from '@/lib/types'
import { requestJson } from './client'
import { ScriptStep } from './script-step'
import { EntityStep } from './entity-step'
import { StoryboardStep } from './storyboard-step'
import { EditorStep } from './editor-step'

export type StepKey = 'script' | 'character' | 'scene' | 'prop' | 'storyboard' | 'edit'

const STEPS = [
  { key: 'script' as const, label: '剧本', note: '故事与分集', icon: ScrollText },
  { key: 'character' as const, label: '角色', note: '人物与造型', icon: Users },
  { key: 'scene' as const, label: '场景', note: '空间与光线', icon: ImageIcon },
  { key: 'prop' as const, label: '道具', note: '关键物件', icon: Box },
  { key: 'storyboard' as const, label: '分镜', note: '镜头与视频', icon: Clapperboard },
  { key: 'edit' as const, label: '剪辑', note: '排序与成片', icon: Scissors },
]

export function StudioShell({ projectId }: { projectId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get('step')
  const activeStep = (STEPS.some(step => step.key === requested) ? requested : 'script') as StepKey
  const [bundle, setBundle] = useState<ProjectBundle | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      setBundle(await requestJson<ProjectBundle>(`/api/projects/${projectId}`))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '项目加载失败')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh])

  const counts = useMemo(() => {
    if (!bundle) return { script: '0 集', character: '0', scene: '0', prop: '0', storyboard: '0 镜', edit: '未开始' }
    const successful = bundle.shots.filter(shot => shot.status === 'success').length
    return {
      script: `${bundle.episodes.length} 集`,
      character: String(bundle.entities.filter(entity => entity.kind === 'character').length),
      scene: String(bundle.entities.filter(entity => entity.kind === 'scene').length),
      prop: String(bundle.entities.filter(entity => entity.kind === 'prop').length),
      storyboard: `${successful}/${bundle.shots.length} 镜`,
      edit: bundle.edits.some(edit => edit.outputPath) ? '已成片' : '未成片',
    }
  }, [bundle])

  const changeStep = (step: StepKey) => {
    router.replace(`/studio/${projectId}?step=${step}`, { scroll: false })
  }

  if (loading && !bundle) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在开机片场…</div>
  }
  if (!bundle) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4"><p>项目不存在或无法读取。</p><Link className="btn-secondary" href="/">返回项目页</Link></div>
  }

  return (
    <main className="min-h-screen bg-[var(--stage)] lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[270px_1fr]">
        <aside className="relative overflow-hidden bg-[var(--navy)] text-white lg:h-screen">
          <div className="absolute bottom-0 left-0 top-0 w-6 film-perforation opacity-60" />
          <div className="ml-6 flex h-full flex-col">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="timecode mb-3 text-[10px] font-semibold tracking-[.16em] text-[var(--timecode)]">雪风AI短剧工坊</div>
              <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-white/55 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> 返回片库</Link>
              <h1 className="display-type mt-4 line-clamp-2 text-2xl font-semibold leading-tight">{bundle.project.title}</h1>
              <div className="timecode mt-2 text-[10px] text-[var(--timecode)]">LOCAL / {bundle.project.ratio} / {bundle.project.genre}</div>
            </div>
            <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:flex-1 lg:space-y-1 lg:overflow-y-auto" aria-label="制作步骤">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                const active = step.key === activeStep
                return (
                  <button
                    key={step.key}
                    onClick={() => changeStep(step.key)}
                    className={`group flex min-w-40 items-center gap-3 rounded-xl border px-3 py-3 text-left transition lg:w-full ${active ? 'border-[var(--projector)]/40 bg-[var(--projector)]/10' : 'border-transparent hover:bg-white/5'}`}
                  >
                    <span className={`timecode flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${active ? 'bg-[var(--projector)] text-[var(--navy)]' : 'bg-white/8 text-white/45'}`}>{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? 'text-white' : 'text-white/75'}`}><Icon className="h-3.5 w-3.5" />{step.label}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-white/38">{step.note} · {counts[step.key]}</span>
                    </span>
                  </button>
                )
              })}
            </nav>
            <div className="border-t border-white/10 p-4">
              <div className="flex items-center justify-between text-[10px] text-white/35"><span>本地 SQLite</span><span className="h-1.5 w-1.5 rounded-full bg-[var(--projector)]" /></div>
              <div className="mt-1 text-[10px] text-white/35">无登录 · 无积分 · 无 OSS</div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 lg:h-screen lg:overflow-hidden">
          <header className="flex h-16 items-center justify-between border-b border-[var(--line)] bg-white/85 px-4 backdrop-blur md:px-7">
            <div>
              <div className="label !mb-0">Stage {String(STEPS.findIndex(step => step.key === activeStep) + 1).padStart(2, '0')}</div>
              <h2 className="display-type text-xl font-semibold">{STEPS.find(step => step.key === activeStep)?.label}</h2>
            </div>
            <button className="btn-secondary !min-h-9" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新</button>
          </header>
          <div className="scrollbar-thin min-h-[calc(100vh-4rem)] overflow-y-auto p-4 md:p-7 lg:h-[calc(100vh-4rem)]">
            {activeStep === 'script' && <ScriptStep bundle={bundle} refresh={refresh} />}
            {activeStep === 'character' && <EntityStep kind="character" bundle={bundle} refresh={refresh} />}
            {activeStep === 'scene' && <EntityStep kind="scene" bundle={bundle} refresh={refresh} />}
            {activeStep === 'prop' && <EntityStep kind="prop" bundle={bundle} refresh={refresh} />}
            {activeStep === 'storyboard' && <StoryboardStep bundle={bundle} refresh={refresh} />}
            {activeStep === 'edit' && <EditorStep bundle={bundle} refresh={refresh} />}
          </div>
        </section>
      </div>
    </main>
  )
}
