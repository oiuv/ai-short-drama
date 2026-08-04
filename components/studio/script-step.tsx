'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { normalizeProjectRatio } from '@/config/project-options'
import type { Episode, ProjectBundle } from '@/lib/types'
import { AspectRatioPicker } from '../project-settings/aspect-ratio-picker'
import { GenrePicker } from '../project-settings/genre-picker'
import { VideoStylePicker } from '../project-settings/video-style-picker'
import { requestJson } from './client'

interface Props {
  bundle: ProjectBundle
  refresh: (quiet?: boolean) => Promise<void>
}

function normalizeEpisodeCount(value: number | ''): number {
  return Math.max(1, Math.min(20, Number(value) || 1))
}

export function ScriptStep({ bundle, refresh }: Props) {
  const project = bundle.project
  const [form, setForm] = useState({ ...project, ratio: normalizeProjectRatio(project.ratio) })
  const [episodeCount, setEpisodeCount] = useState<number | ''>(Math.max(1, bundle.episodes.length || 3))
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(bundle.episodes[0]?.id ?? null)

  useEffect(() => { setForm({ ...project, ratio: normalizeProjectRatio(project.ratio) }) }, [project])
  useEffect(() => {
    if (selectedId && !bundle.episodes.some(episode => episode.id === selectedId)) setSelectedId(bundle.episodes[0]?.id ?? null)
  }, [bundle.episodes, selectedId])

  const selected = useMemo(() => bundle.episodes.find(episode => episode.id === selectedId) ?? null, [bundle.episodes, selectedId])

  const saveProject = async (quiet = false) => {
    if (!form.genre.trim()) {
      toast.error('请选择题材或填写自定义题材')
      return
    }
    setSaving(true)
    try {
      await requestJson(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.title,
          brief: form.brief,
          synopsis: form.synopsis,
          genre: form.genre,
          visualStyle: form.visualStyle,
          ratio: form.ratio,
        }),
      })
      await refresh(true)
      if (!quiet) toast.success('项目设定已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
      throw error
    } finally {
      setSaving(false)
    }
  }

  const generate = async () => {
    if (!form.brief.trim()) return toast.error('先填写创作需求或粘贴原始故事')
    if (!form.genre.trim()) return toast.error('请选择题材或填写自定义题材')
    if (bundle.episodes.length > 0 && !window.confirm('重新生成会替换现有分集、角色、场景、道具、分镜和剪辑草稿。继续吗？')) return
    const requestedEpisodeCount = normalizeEpisodeCount(episodeCount)
    setEpisodeCount(requestedEpisodeCount)
    setGenerating(true)
    try {
      await saveProject(true)
      const next = await requestJson<ProjectBundle>(`/api/projects/${project.id}/script`, {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', episodeCount: requestedEpisodeCount }),
      })
      setSelectedId(next.episodes[0]?.id ?? null)
      await refresh(true)
      toast.success(`DeepSeek 已完成 ${next.episodes.length} 集剧本与素材档案`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '剧本生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const addEpisode = async () => {
    try {
      const episode = await requestJson<Episode>(`/api/projects/${project.id}/script`, {
        method: 'POST', body: JSON.stringify({ action: 'add' }),
      })
      await refresh(true)
      setSelectedId(episode.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败')
    }
  }

  const removeEpisode = async (episode: Episode) => {
    if (!window.confirm(`删除第 ${episode.episodeNumber} 集及其分镜与剪辑？`)) return
    try {
      await requestJson(`/api/projects/${project.id}/script?episodeId=${episode.id}`, { method: 'DELETE' })
      await refresh(true)
      toast.success('分集已删除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <section className="panel overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_330px]">
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="label">Story brief</div>
                <h3 className="display-type text-2xl font-semibold">创作底稿</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">DeepSeek 会一次产出分集剧本，以及角色、场景和道具档案。</p>
              </div>
              <button className="btn-secondary" disabled={saving} onClick={() => void saveProject()}><Save className="h-4 w-4" />{saving ? '保存中…' : '保存设定'}</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label><span className="label">片名</span><input className="field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
              <div><span className="label">画面比例</span><AspectRatioPicker value={form.ratio} onChange={ratio => setForm({ ...form, ratio })} /></div>
              <div className="md:col-span-2"><span className="label">题材</span><GenrePicker value={form.genre} onChange={genre => setForm({ ...form, genre })} /></div>
              <div className="md:col-span-2"><span className="label">视觉风格</span><VideoStylePicker value={form.visualStyle} onChange={visualStyle => setForm({ ...form, visualStyle })} /></div>
              <label className="md:col-span-2"><span className="label">故事梗概</span><textarea className="field min-h-20 resize-y" value={form.synopsis} onChange={e => setForm({ ...form, synopsis: e.target.value })} placeholder="生成后会自动写入，也可以先给出已有梗概。" /></label>
              <label className="md:col-span-2"><span className="label">创作需求 / 原始素材</span><textarea className="field min-h-52 resize-y leading-7" value={form.brief} onChange={e => setForm({ ...form, brief: e.target.value })} placeholder="粘贴故事、小说片段或写下人物、核心冲突与结局要求…" /></label>
            </div>
          </div>
          <div className="flex flex-col justify-between border-t border-[var(--line)] bg-[var(--navy)] p-6 text-white lg:border-l lg:border-t-0">
            <div>
              <div className="timecode text-[10px] text-[var(--timecode)]">TEXT MODEL</div>
              <div className="mt-2 text-lg font-semibold">DeepSeek · drama-script</div>
              <p className="mt-2 text-xs leading-6 text-white/55">加载项目内标准 Skill，结构化输出分集、人物造型、无人场景和关键道具。模型由 DEEPSEEK_MODEL 配置。</p>
            </div>
            <div className="mt-8">
              <label>
                <span className="mb-2 block text-xs text-white/50">计划集数</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  inputMode="numeric"
                  className="field !border-white/20 !bg-[#17243a] !text-white caret-[var(--projector)] [color-scheme:dark] placeholder:!text-white/35 focus:!border-[var(--projector)]"
                  value={episodeCount}
                  onChange={event => {
                    const value = event.target.value
                    setEpisodeCount(value === '' ? '' : Number(value))
                  }}
                  onBlur={() => setEpisodeCount(normalizeEpisodeCount(episodeCount))}
                />
                <span className="mt-1.5 block text-[10px] text-white/40">1–20 集</span>
              </label>
              <button className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--projector)] px-4 font-bold text-[var(--navy)] disabled:opacity-45" disabled={generating || saving} onClick={() => void generate()}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? '正在创作与整理档案…' : bundle.episodes.length ? '重新生成整套剧本' : '生成剧本与素材档案'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-h-[560px] gap-4 lg:grid-cols-[260px_1fr]">
        <div className="panel flex flex-col p-3">
          <div className="flex items-center justify-between px-2 py-2"><div><div className="label !mb-0">Episodes</div><strong>{bundle.episodes.length} 集</strong></div><button className="btn-quiet !min-h-8 !px-2" onClick={() => void addEpisode()}><Plus className="h-4 w-4" /></button></div>
          <div className="scrollbar-thin mt-2 flex-1 space-y-1 overflow-y-auto">
            {bundle.episodes.map(episode => (
              <button key={episode.id} onClick={() => setSelectedId(episode.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${selectedId === episode.id ? 'border-[var(--projector)] bg-[var(--projector)]/10' : 'border-transparent hover:bg-black/[.035]'}`}>
                <span className="timecode text-xs text-[var(--muted)]">{String(episode.episodeNumber).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{episode.title || `第${episode.episodeNumber}集`}</span><span className={`mt-1 block text-[10px] ${episode.status === 'confirmed' ? 'text-emerald-600' : 'text-[var(--muted)]'}`}>{episode.status === 'confirmed' ? '已定稿' : '草稿'}</span></span>
              </button>
            ))}
            {bundle.episodes.length === 0 && <div className="px-3 py-16 text-center text-sm text-[var(--muted)]">生成剧本后，分集会出现在这里。</div>}
          </div>
        </div>
        {selected ? <EpisodeEditor key={selected.id + selected.updatedAt} projectId={project.id} episode={selected} refresh={refresh} onDelete={() => void removeEpisode(selected)} /> : <div className="panel flex items-center justify-center text-sm text-[var(--muted)]">选择一个分集开始编辑。</div>}
      </section>
    </div>
  )
}

function EpisodeEditor({ projectId, episode, refresh, onDelete }: { projectId: string; episode: Episode; refresh: (quiet?: boolean) => Promise<void>; onDelete: () => void }) {
  const [title, setTitle] = useState(episode.title)
  const [content, setContent] = useState(episode.content)
  const [saving, setSaving] = useState(false)

  const save = async (status = episode.status) => {
    setSaving(true)
    try {
      await requestJson(`/api/projects/${projectId}/script`, { method: 'PATCH', body: JSON.stringify({ episodeId: episode.id, title, content, status }) })
      await refresh(true)
      toast.success(status === 'confirmed' ? '本集已定稿' : '本集已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel flex min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--panel-muted)] px-5 py-3">
        <span className="timecode text-xs text-[var(--muted)]">EP {String(episode.episodeNumber).padStart(2, '0')}</span>
        <input className="field !min-w-48 flex-1 !bg-white !py-2 font-semibold" value={title} onChange={e => setTitle(e.target.value)} />
        <button className="btn-secondary" disabled={saving} onClick={() => void save()}><Save className="h-3.5 w-3.5" /> 保存</button>
        <button className={episode.status === 'confirmed' ? 'btn-secondary' : 'btn-primary'} disabled={saving} onClick={() => void save(episode.status === 'confirmed' ? 'draft' : 'confirmed')}><Check className="h-3.5 w-3.5" />{episode.status === 'confirmed' ? '取消定稿' : '定稿'}</button>
        <button className="btn-danger !px-2.5" onClick={onDelete} aria-label="删除分集"><Trash2 className="h-4 w-4" /></button>
      </div>
      <textarea className="min-h-[500px] flex-1 resize-y border-0 bg-white p-5 font-mono text-sm leading-7 outline-none lg:resize-none" value={content} onChange={e => setContent(e.target.value)} placeholder="写下本集场景、动作与对白…" />
    </div>
  )
}
