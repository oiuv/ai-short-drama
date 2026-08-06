'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clapperboard, Film, FolderOpen, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { confirmToast } from '@/components/confirm-toast'
import type { ProjectListItem } from '@/lib/types'
import { requestJson } from './studio/client'

const STEP_LABELS = ['剧本', '角色', '场景', '道具', '分镜', '剪辑']

function progressSteps(project: ProjectListItem) {
  return [
    project.progress.episodes.total > 0,
    project.progress.characters.total > 0,
    project.progress.scenes.total > 0,
    project.progress.props.total > 0,
    project.progress.shots.total > 0,
    project.progress.shots.completed > 0,
  ]
}

export function Dashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setProjects(await requestJson<ProjectListItem[]>('/api/projects'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '项目加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visible = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN')
    return keyword
      ? projects.filter(project => `${project.title} ${project.genre}`.toLocaleLowerCase('zh-CN').includes(keyword))
      : projects
  }, [projects, query])

  const remove = async (project: ProjectListItem) => {
    if (!await confirmToast({
      title: '删除整个项目？',
      description: `《${project.title}》及其剧本、素材档案、分镜和剪辑记录将从片库隐藏；数据库记录与本地素材文件保留。`,
      confirmLabel: '删除项目',
    })) return
    try {
      await requestJson(`/api/projects/${project.id}`, { method: 'DELETE' })
      setProjects(current => current.filter(item => item.id !== project.id))
      toast.success('项目已删除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-4 py-5 md:px-8 md:py-8">
      <header className="overflow-hidden rounded-[26px] bg-[var(--navy)] text-white shadow-float">
        <div className="grid min-h-[280px] lg:grid-cols-[1.25fr_.75fr]">
          <div className="flex flex-col justify-between p-7 md:p-10">
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-white/55">
              <Clapperboard className="h-4 w-4 text-[var(--timecode)]" />
              雪风AI短剧工坊 · Local production desk
            </div>
            <div className="mt-12 max-w-3xl">
              <h1 className="display-type text-4xl font-semibold leading-tight md:text-6xl">把一个想法或故事，变成一部完整影片。</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 md:text-base">
                从构思和剧本，到角色、场景、道具与分镜视频，再通过本机剪辑完成成片——雪风AI短剧工坊覆盖完整的影片制作流程。
              </p>
            </div>
          </div>
          <div className="relative border-t border-white/10 bg-[var(--navy-soft)] p-7 lg:border-l lg:border-t-0 md:p-10">
            <div className="absolute bottom-0 left-5 top-0 w-5 film-perforation opacity-70" />
            <div className="ml-8 flex h-full flex-col justify-between">
              <div className="timecode text-xs text-[var(--timecode)]">PIPELINE / 06 STAGES</div>
              <ol className="mt-6 space-y-2">
                {STEP_LABELS.map((label, index) => (
                  <li key={label} className="flex items-center gap-4 border-b border-white/10 py-2.5">
                    <span className="timecode w-7 text-xs text-white/35">{String(index + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-semibold tracking-wide">{label}</span>
                  </li>
                ))}
              </ol>
              <button className="btn-primary mt-7 !border-[var(--projector)] !bg-[var(--projector)] !text-[var(--navy)]" onClick={() => router.push('/new')}>
                <Plus className="h-4 w-4" /> 建立新片场
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="label">Production archive</div>
            <h2 className="display-type text-2xl font-semibold">本地项目</h2>
          </div>
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input className="field !pl-10" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索片名或题材" />
          </label>
        </div>

        {loading ? (
          <div className="panel py-20 text-center text-sm text-[var(--muted)]">正在读取本地片库…</div>
        ) : projects.length === 0 ? (
          <button onClick={() => router.push('/new')} className="panel group flex w-full flex-col items-center border-dashed py-20 text-center hover:border-[var(--projector)]">
            <FolderOpen className="mb-4 h-10 w-10 text-[var(--projector)]" />
            <strong className="display-type text-xl">片场还是空的</strong>
            <span className="mt-2 text-sm text-[var(--muted)]">建立第一个项目，从创作需求开始。</span>
          </button>
        ) : visible.length === 0 ? (
          <div className="panel py-16 text-center text-sm text-[var(--muted)]">没有匹配的项目。</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(project => {
              const steps = progressSteps(project)
              return (
                <article key={project.id} className="panel group overflow-hidden transition hover:-translate-y-0.5 hover:border-[#b9c2ce]">
                  <button className="w-full p-5 text-left" onClick={() => router.push(`/studio/${project.id}`)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="timecode text-[10px] text-[var(--muted)]">UPDATED {new Date(project.updatedAt).toLocaleDateString('zh-CN')}</div>
                        <h3 className="display-type mt-2 truncate text-xl font-semibold">{project.title}</h3>
                        <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--muted)]">{project.synopsis || project.brief || '尚未生成剧本'}</p>
                      </div>
                      <Film className="mt-1 h-5 w-5 shrink-0 text-[var(--projector)]" />
                    </div>
                    <div className="mt-5 grid grid-cols-6 gap-1.5" aria-label="制作进度">
                      {steps.map((done, index) => (
                        <div key={STEP_LABELS[index]}>
                          <div className={`h-1.5 rounded-full ${done ? 'bg-[var(--projector)]' : 'bg-[#e2e6ec]'}`} />
                          <div className="mt-1.5 text-center text-[10px] text-[var(--muted)]">{STEP_LABELS[index]}</div>
                        </div>
                      ))}
                    </div>
                  </button>
                  <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--panel-muted)] px-5 py-3">
                    <span className="timecode text-[10px] text-[var(--muted)]">{project.progress.shots.completed}/{project.progress.shots.total} SHOTS READY</span>
                    <button className="btn-quiet !min-h-8 !px-2 text-xs hover:!text-[var(--danger)]" onClick={() => void remove(project)} aria-label={`删除 ${project.title}`}>
                      <Trash2 className="h-3.5 w-3.5" /> 删除
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

    </main>
  )
}
