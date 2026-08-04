'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Film, Loader2, Plus, Save, Scissors, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { EditClip, EditDraft, ProjectBundle, Shot } from '@/lib/types'
import { requestJson } from './client'

interface Props {
  bundle: ProjectBundle
  refresh: (quiet?: boolean) => Promise<void>
}

function clipId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function fullClip(shot: Shot): EditClip {
  return {
    id: clipId(),
    shotId: shot.id,
    enabled: true,
    start: 0,
    end: shot.selectedVideo?.duration || shot.duration,
  }
}

export function EditorStep({ bundle, refresh }: Props) {
  const [episodeId, setEpisodeId] = useState(bundle.episodes[0]?.id ?? '')
  const [clips, setClips] = useState<EditClip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rendering, setRendering] = useState(false)
  const episode = bundle.episodes.find(item => item.id === episodeId)
  const readyShots = useMemo(() => bundle.shots.filter(shot => shot.episodeId === episodeId && shot.selectedVideo?.path).sort((a, b) => a.shotOrder - b.shotOrder), [bundle.shots, episodeId])
  const draft = bundle.edits.find(edit => edit.episodeId === episodeId)
  const selectedClip = clips.find(clip => clip.id === selectedClipId) ?? clips[0] ?? null
  const selectedShot = selectedClip ? readyShots.find(shot => shot.id === selectedClip.shotId) ?? null : null
  const totalDuration = clips.filter(clip => clip.enabled).reduce((sum, clip) => sum + Math.max(0, clip.end - clip.start), 0)

  useEffect(() => {
    if (episodeId && !bundle.episodes.some(item => item.id === episodeId)) setEpisodeId(bundle.episodes[0]?.id ?? '')
  }, [bundle.episodes, episodeId])

  useEffect(() => {
    const existing = bundle.edits.find(edit => edit.episodeId === episodeId)
    const next = existing?.clips.length ? existing.clips : readyShots.map(fullClip)
    setClips(next)
    setSelectedClipId(next[0]?.id ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId])

  const updateClip = (id: string, fields: Partial<EditClip>) => {
    setClips(current => current.map(clip => clip.id === id ? { ...clip, ...fields } : clip))
  }

  const move = (index: number, direction: -1 | 1) => {
    setClips(current => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const addClip = (shot: Shot) => {
    const next = fullClip(shot)
    setClips(current => [...current, next])
    setSelectedClipId(next.id)
  }

  const save = async (quiet = false): Promise<EditDraft | null> => {
    if (!episode) return null
    setSaving(true)
    try {
      const result = await requestJson<EditDraft>(`/api/projects/${bundle.project.id}/edit`, {
        method: 'PUT', body: JSON.stringify({ episodeId: episode.id, clips }),
      })
      await refresh(true)
      if (!quiet) toast.success('剪辑草稿已保存')
      return result
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
      return null
    } finally {
      setSaving(false)
    }
  }

  const render = async () => {
    if (!episode || !clips.some(clip => clip.enabled)) return toast.error('至少启用一个片段')
    setRendering(true)
    try {
      const result = await requestJson<EditDraft>(`/api/projects/${bundle.project.id}/edit`, {
        method: 'POST', body: JSON.stringify({ episodeId: episode.id, clips }),
      })
      await refresh(true)
      toast.success('FFmpeg 已完成本集成片')
      if (result.outputUrl) setSelectedClipId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '合成失败')
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="panel flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="label">Local edit suite</div>
          <h3 className="display-type text-2xl font-semibold">分集剪辑台</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">调整顺序和入出点，草稿留在 SQLite；最终由本机 FFmpeg 生成 MP4。</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-56"><span className="label">分集</span><select className="field" value={episodeId} onChange={e => setEpisodeId(e.target.value)}>{bundle.episodes.map(item => <option key={item.id} value={item.id}>第{item.episodeNumber}集 · {item.title}</option>)}</select></label>
          <button className="btn-secondary" disabled={saving || !episode} onClick={() => void save()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 保存草稿</button>
          <button className="btn-primary" disabled={rendering || !clips.some(clip => clip.enabled)} onClick={() => void render()}>{rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}{rendering ? '本机合成中…' : '导出本集 MP4'}</button>
        </div>
      </section>

      {!episode ? (
        <div className="panel py-24 text-center text-sm text-[var(--muted)]">请先创建分集。</div>
      ) : readyShots.length === 0 ? (
        <div className="panel flex flex-col items-center border-dashed py-24 text-center"><Scissors className="mb-4 h-10 w-10 text-[var(--projector)]" /><strong>本集还没有可剪辑视频</strong><p className="mt-2 text-sm text-[var(--muted)]">先到分镜步骤生成并选定至少一个视频版本。</p></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel-muted)] px-5 py-3">
              <div className="timecode text-xs text-[var(--muted)]">TIMELINE · {clips.filter(clip => clip.enabled).length} CLIPS · {totalDuration.toFixed(1)} SEC</div>
              <div className="flex items-center gap-2">
                <select className="field !w-44 !py-1.5" defaultValue="" onChange={event => { const shot = readyShots.find(item => item.id === event.target.value); if (shot) addClip(shot); event.target.value = '' }}><option value="">追加分镜片段…</option>{readyShots.map(shot => <option key={shot.id} value={shot.id}>镜头 {shot.shotOrder}</option>)}</select>
                <button className="btn-secondary !min-h-8 !py-1.5" onClick={() => { const next = readyShots.map(fullClip); setClips(next); setSelectedClipId(next[0]?.id ?? null) }}>按分镜重置</button>
              </div>
            </div>
            <div className="scrollbar-thin max-h-[calc(100vh-230px)] space-y-2 overflow-y-auto p-4">
              {clips.map((clip, index) => {
                const shot = readyShots.find(item => item.id === clip.shotId)
                if (!shot) return null
                const active = selectedClipId === clip.id
                const max = shot.selectedVideo?.duration || shot.duration
                return (
                  <div key={clip.id} onClick={() => setSelectedClipId(clip.id)} className={`grid cursor-pointer gap-3 rounded-xl border p-3 transition md:grid-cols-[34px_110px_1fr_auto] md:items-center ${active ? 'border-[var(--projector)] bg-[var(--projector)]/5' : 'border-[var(--line)] bg-white hover:border-[#b8c1cc]'}`}>
                    <label className="flex items-center justify-center"><input type="checkbox" checked={clip.enabled} onChange={e => updateClip(clip.id, { enabled: e.target.checked })} onClick={e => e.stopPropagation()} /></label>
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-black"><video src={shot.selectedVideo!.url!} muted preload="metadata" className="h-full w-full object-cover" /><span className="timecode absolute bottom-1 left-1 rounded bg-black/65 px-1.5 text-[9px] text-white">S{String(shot.shotOrder).padStart(2, '0')}</span></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">镜头 {shot.shotOrder}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <label className="text-[var(--muted)]">入点 <input className="field mt-1 !py-1.5" type="number" min={0} max={clip.end - .1} step={.1} value={clip.start} onChange={e => updateClip(clip.id, { start: Math.max(0, Math.min(Number(e.target.value), clip.end - .1)) })} onClick={e => e.stopPropagation()} /></label>
                        <label className="text-[var(--muted)]">出点 <input className="field mt-1 !py-1.5" type="number" min={clip.start + .1} max={max} step={.1} value={clip.end} onChange={e => updateClip(clip.id, { end: Math.max(clip.start + .1, Math.min(Number(e.target.value), max)) })} onClick={e => e.stopPropagation()} /></label>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button className="btn-quiet !min-h-8 !px-2" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button className="btn-quiet !min-h-8 !px-2" disabled={index === clips.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button className="btn-quiet !min-h-8 !px-2 hover:!text-[var(--danger)]" onClick={() => setClips(current => current.filter(item => item.id !== clip.id))}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )
              })}
              {clips.length === 0 && <button className="flex w-full flex-col items-center py-16 text-sm text-[var(--muted)]" onClick={() => { const next = readyShots.map(fullClip); setClips(next) }}><Plus className="mb-2 h-5 w-5" />把全部分镜加入时间线</button>}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-[18px] bg-[var(--navy)] p-4 text-white">
              <div className="timecode mb-3 flex justify-between text-[10px] text-white/45"><span>PROGRAM MONITOR</span><span>{bundle.project.ratio}</span></div>
              <div className={`flex items-center justify-center overflow-hidden rounded-xl bg-black ${bundle.project.ratio === '9:16' ? 'mx-auto aspect-[9/16] max-h-[520px]' : 'aspect-video'}`}>
                {selectedShot?.selectedVideo?.url ? <video key={selectedShot.selectedVideo.url} src={selectedShot.selectedVideo.url} controls className="h-full w-full object-contain" /> : <Film className="h-10 w-10 text-white/15" />}
              </div>
              {selectedClip && <div className="timecode mt-3 text-center text-[10px] text-[var(--timecode)]">IN {selectedClip.start.toFixed(1)} / OUT {selectedClip.end.toFixed(1)} / DUR {(selectedClip.end - selectedClip.start).toFixed(1)}</div>}
            </div>
            {draft?.outputUrl && <div className="panel p-4"><div className="label">Latest export</div><video src={draft.outputUrl} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black object-contain" /><a href={draft.outputUrl} download={`第${episode.episodeNumber}集.mp4`} className="btn-secondary mt-3 w-full"><Download className="h-4 w-4" /> 下载本集成片</a></div>}
            <div className="panel-muted p-4 text-xs leading-6 text-[var(--muted)]"><strong className="block text-[var(--ink)]">本机导出说明</strong>需要系统 PATH 中可调用 <code className="timecode">ffmpeg</code>。导出会统一画幅、30fps、H.264/AAC，并保存到 <code className="timecode">data/media/exports</code>。</div>
          </aside>
        </div>
      )}
    </div>
  )
}
