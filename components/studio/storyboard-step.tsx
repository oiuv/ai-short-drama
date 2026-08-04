'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clapperboard, Loader2, Plus, Save, Sparkles, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { SEEDANCE_MODELS } from '@/lib/model-config'
import type { Entity, ProjectBundle, Shot } from '@/lib/types'
import { requestJson } from './client'

interface Props {
  bundle: ProjectBundle
  refresh: (quiet?: boolean) => Promise<void>
}

export function StoryboardStep({ bundle, refresh }: Props) {
  const [episodeId, setEpisodeId] = useState(bundle.episodes[0]?.id ?? '')
  const [model, setModel] = useState<string>(SEEDANCE_MODELS[0].id)
  const selectedModel = SEEDANCE_MODELS.find(item => item.id === model) ?? SEEDANCE_MODELS[0]
  const [resolution, setResolution] = useState<string>('720p')
  const [splitting, setSplitting] = useState(false)
  const [batching, setBatching] = useState(false)

  useEffect(() => {
    if (episodeId && !bundle.episodes.some(episode => episode.id === episodeId)) setEpisodeId(bundle.episodes[0]?.id ?? '')
  }, [bundle.episodes, episodeId])
  useEffect(() => {
    if (!selectedModel.resolutions.includes(resolution as never)) setResolution(selectedModel.resolutions[0])
  }, [selectedModel, resolution])

  const episode = bundle.episodes.find(item => item.id === episodeId)
  const shots = useMemo(() => bundle.shots.filter(shot => shot.episodeId === episodeId).sort((a, b) => a.shotOrder - b.shotOrder), [bundle.shots, episodeId])
  const availableEntities = useMemo(() => bundle.entities.filter(entity => (
    entity.selectedImage && (!episode || entity.episodes.length === 0 || entity.episodes.includes(episode.episodeNumber))
  )), [bundle.entities, episode])
  const generatingIds = bundle.shots.filter(shot => shot.status === 'generating').map(shot => shot.id).join(',')

  useEffect(() => {
    if (!generatingIds) return
    let cancelled = false
    const poll = async () => {
      const ids = generatingIds.split(',').filter(Boolean)
      let changed = false
      await Promise.all(ids.map(async id => {
        try {
          const shot = await requestJson<Shot>(`/api/shots/${id}/video`)
          if (shot.status !== 'generating') changed = true
        } catch { /* next poll */ }
      }))
      if (changed && !cancelled) await refresh(true)
    }
    void poll()
    const timer = setInterval(() => void poll(), 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [generatingIds, refresh])

  const split = async () => {
    if (!episode) return
    if (shots.length && !window.confirm('重新拆分会删除本集现有分镜及视频版本。继续吗？')) return
    setSplitting(true)
    try {
      const next = await requestJson<Shot[]>(`/api/projects/${bundle.project.id}/storyboard`, {
        method: 'POST', body: JSON.stringify({ action: 'generate', episodeId: episode.id }),
      })
      await refresh(true)
      toast.success(`DeepSeek 已拆分 ${next.length} 个镜头`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '分镜拆分失败')
    } finally {
      setSplitting(false)
    }
  }

  const add = async () => {
    if (!episode) return
    try {
      await requestJson(`/api/projects/${bundle.project.id}/storyboard`, {
        method: 'POST', body: JSON.stringify({ action: 'add', episodeId: episode.id }),
      })
      await refresh(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败')
    }
  }

  const generateVideo = async (shotId: string, silent = false) => {
    try {
      await requestJson<Shot>(`/api/shots/${shotId}/video`, {
        method: 'POST', body: JSON.stringify({ model, resolution }),
      })
      await refresh(true)
      if (!silent) toast.success('Seedance 任务已提交')
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : '提交失败')
      throw error
    }
  }

  const batchGenerate = async () => {
    const pending = shots.filter(shot => shot.status !== 'generating' && shot.prompt.trim())
    if (!pending.length) return toast.info('没有可提交的分镜')
    if (!window.confirm(`将提交 ${pending.length} 个 Seedance 视频任务，按 2 个一组控制并发。继续吗？`)) return
    setBatching(true)
    let succeeded = 0
    for (let index = 0; index < pending.length; index += 2) {
      const group = pending.slice(index, index + 2)
      const results = await Promise.allSettled(group.map(shot => generateVideo(shot.id, true)))
      succeeded += results.filter(result => result.status === 'fulfilled').length
    }
    setBatching(false)
    await refresh(true)
    toast.success(`已提交 ${succeeded}/${pending.length} 个视频任务`)
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="panel p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="label">Shot planning & generation</div>
            <h3 className="display-type text-2xl font-semibold">分镜导演台</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">DeepSeek 加载 drama-shot-prompt Skill 拆镜，Seedance 2.0 使用选定角色、场景和道具的本地图片 Base64 作为参考。</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[180px_230px_120px_auto_auto]">
            <label><span className="label">分集</span><select className="field" value={episodeId} onChange={e => setEpisodeId(e.target.value)}>{bundle.episodes.map(item => <option key={item.id} value={item.id}>第{item.episodeNumber}集 · {item.title}</option>)}</select></label>
            <label><span className="label">视频模型</span><select className="field" value={model} onChange={e => setModel(e.target.value)}>{SEEDANCE_MODELS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span className="label">分辨率</span><select className="field" value={resolution} onChange={e => setResolution(e.target.value)}>{selectedModel.resolutions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <button className="btn-secondary self-end" disabled={!episode || splitting} onClick={() => void split()}>{splitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{shots.length ? '重新拆分' : 'AI 拆分'}</button>
            <button className="btn-primary self-end" disabled={!shots.length || batching} onClick={() => void batchGenerate()}>{batching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}批量生成</button>
          </div>
        </div>
      </section>

      {!episode ? (
        <div className="panel py-24 text-center text-sm text-[var(--muted)]">请先在剧本步骤创建分集。</div>
      ) : shots.length === 0 ? (
        <div className="panel flex flex-col items-center border-dashed py-24 text-center"><Clapperboard className="mb-4 h-10 w-10 text-[var(--projector)]" /><strong className="text-lg">本集还没有分镜</strong><p className="mt-2 text-sm text-[var(--muted)]">确认剧本和素材后，让 DeepSeek 拆成可生成的视频镜头。</p><button className="btn-primary mt-5" disabled={splitting} onClick={() => void split()}><Sparkles className="h-4 w-4" /> AI 拆分本集</button></div>
      ) : (
        <div className="space-y-4">
          {shots.map(shot => (
            <ShotCard key={shot.id + shot.updatedAt} shot={shot} entities={availableEntities} model={model} resolution={resolution} refresh={refresh} onGenerate={generateVideo} />
          ))}
          <button className="panel flex w-full items-center justify-center border-dashed py-5 text-sm font-semibold text-[var(--muted)] hover:border-[var(--projector)] hover:text-[var(--ink)]" onClick={() => void add()}><Plus className="mr-2 h-4 w-4" /> 手动追加镜头</button>
        </div>
      )}
    </div>
  )
}

function ShotCard({ shot, entities, refresh, onGenerate }: {
  shot: Shot
  entities: Entity[]
  model: string
  resolution: string
  refresh: (quiet?: boolean) => Promise<void>
  onGenerate: (shotId: string) => Promise<void>
}) {
  const [prompt, setPrompt] = useState(shot.prompt)
  const [duration, setDuration] = useState(shot.duration)
  const [referenceIds, setReferenceIds] = useState(shot.referenceEntityIds)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const dirty = prompt !== shot.prompt || duration !== shot.duration || JSON.stringify(referenceIds) !== JSON.stringify(shot.referenceEntityIds)

  const save = async (quiet = false) => {
    setSaving(true)
    try {
      await requestJson(`/api/shots/${shot.id}`, { method: 'PATCH', body: JSON.stringify({ prompt, duration, referenceEntityIds: referenceIds }) })
      await refresh(true)
      if (!quiet) toast.success(`镜头 ${shot.shotOrder} 已保存`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
      throw error
    } finally {
      setSaving(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      if (dirty) await save(true)
      await onGenerate(shot.id)
    } finally {
      setGenerating(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`删除镜头 ${shot.shotOrder} 及其所有视频版本？`)) return
    try {
      await requestJson(`/api/shots/${shot.id}`, { method: 'DELETE' })
      await refresh(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const selectVideo = async (videoId: string) => {
    await requestJson(`/api/shots/${shot.id}`, { method: 'PATCH', body: JSON.stringify({ selectedVideoId: videoId }) })
    await refresh(true)
  }

  const statusStyle = shot.status === 'success' ? 'bg-emerald-100 text-emerald-700' : shot.status === 'generating' ? 'bg-blue-100 text-blue-700' : shot.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'

  return (
    <article className="panel overflow-hidden">
      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="timecode rounded-md bg-[var(--navy)] px-2.5 py-1 text-xs text-white">SHOT {String(shot.shotOrder).padStart(2, '0')}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle}`}>{shot.status === 'success' ? '已完成' : shot.status === 'generating' ? '生成中' : shot.status === 'failed' ? '失败' : '待生成'}</span>
            <label className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">时长 <input type="number" min={4} max={15} className="field !w-20 !py-1.5" value={duration} onChange={e => setDuration(Math.max(4, Math.min(15, Number(e.target.value) || 4)))} /> 秒</label>
          </div>
          <label className="mt-4 block"><span className="label">Seedance 提示词</span><textarea className="field min-h-36 resize-y leading-6" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="主体、动作、台词、景别、运镜、光线与声音…" /></label>
          <div className="mt-4">
            <div className="label">Base64 参考素材 · 最多 9 张</div>
            <div className="flex flex-wrap gap-2">
              {entities.map(entity => {
                const selected = referenceIds.includes(entity.id)
                return <button key={entity.id} onClick={() => setReferenceIds(current => selected ? current.filter(id => id !== entity.id) : current.length < 9 ? [...current, entity.id] : current)} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${selected ? 'border-[var(--projector)] bg-[var(--projector)]/10' : 'border-[var(--line)] bg-white'}`}><img src={entity.selectedImage!.url} alt="" className="h-7 w-7 rounded object-cover" /><span>{entity.name}{entity.variant ? ` / ${entity.variant}` : ''}</span></button>
              })}
              {!entities.length && <span className="text-xs text-[var(--muted)]">本集暂无已定稿图片，仍可纯文本生成。</span>}
            </div>
          </div>
          {shot.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{shot.error}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={!dirty || saving || shot.status === 'generating'} onClick={() => void save()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 保存镜头</button>
            <button className="btn-primary" disabled={generating || shot.status === 'generating' || !prompt.trim()} onClick={() => void generate()}>{generating || shot.status === 'generating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}{shot.selectedVideo ? '再生成一个版本' : '生成分镜视频'}</button>
            <button className="btn-danger ml-auto" disabled={shot.status === 'generating'} onClick={() => void remove()}><Trash2 className="h-4 w-4" /> 删除</button>
          </div>
        </div>
        <div className="border-t border-[var(--line)] bg-[var(--navy)] p-4 text-white xl:border-l xl:border-t-0">
          <div className="timecode mb-3 flex items-center justify-between text-[10px] text-white/45"><span>VIDEO TAKE</span><span>{shot.videos.filter(video => video.path).length} VERSIONS</span></div>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black/45">
            {shot.selectedVideo?.url ? <video key={shot.selectedVideo.url} src={shot.selectedVideo.url} controls preload="metadata" className="h-full w-full object-contain" /> : shot.status === 'generating' ? <div className="text-center text-xs text-white/60"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-[var(--projector)]" />Seedance 正在制作</div> : <Video className="h-10 w-10 text-white/15" />}
          </div>
          {shot.videos.filter(video => video.path).length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto">{shot.videos.filter(video => video.path).map((video, index) => <button key={video.id} onClick={() => void selectVideo(video.id)} className={`timecode rounded-lg border px-3 py-2 text-[10px] ${video.id === shot.selectedVideo?.id ? 'border-[var(--projector)] bg-[var(--projector)]/10 text-[var(--projector)]' : 'border-white/10 text-white/50'}`}>TAKE {String(index + 1).padStart(2, '0')}</button>)}</div>}
        </div>
      </div>
    </article>
  )
}
