'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clock3,
  FilePenLine,
  Forward,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { confirmToast } from '@/components/confirm-toast'
import { normalizeProjectRatio } from '@/config/project-options'
import { useTimer } from '@/lib/hooks/use-timer'
import { MAX_SCRIPT_EPISODES_PER_REQUEST } from '@/lib/model-config'
import type { Episode, ProjectBundle } from '@/lib/types'
import { AspectRatioPicker } from '../project-settings/aspect-ratio-picker'
import { GenrePicker } from '../project-settings/genre-picker'
import { VideoStylePicker } from '../project-settings/video-style-picker'
import { requestJson } from './client'

interface Props {
  bundle: ProjectBundle
  refresh: (quiet?: boolean) => Promise<void>
}

type CountInput = number | ''

function parseRequiredEpisodeCount(value: CountInput, max = MAX_SCRIPT_EPISODES_PER_REQUEST): number | null {
  const count = Number(value)
  return Number.isInteger(count) && count >= 1 && count <= max ? count : null
}

function parsePlannedEpisodes(value: CountInput): { valid: boolean; value: number | null } {
  if (value === '') return { valid: true, value: null }
  const count = Number(value)
  return Number.isInteger(count) && count >= 1 && count <= 200
    ? { valid: true, value: count }
    : { valid: false, value: null }
}

export function ScriptStep({ bundle, refresh }: Props) {
  const project = bundle.project
  const [form, setForm] = useState({ ...project, ratio: normalizeProjectRatio(project.ratio) })
  const [generationEpisodeCount, setGenerationEpisodeCount] = useState<CountInput>(5)
  const [plannedEpisodes, setPlannedEpisodes] = useState<CountInput>(project.plannedEpisodes ?? '')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(bundle.episodes[0]?.id ?? null)

  const [showContinueDialog, setShowContinueDialog] = useState(false)
  const [continueEpisodeCount, setContinueEpisodeCount] = useState<CountInput>(1)
  const [continueInstruction, setContinueInstruction] = useState('')
  const [continueBrief, setContinueBrief] = useState('')
  const [continueAsFinale, setContinueAsFinale] = useState(false)

  const [showRewriteDialog, setShowRewriteDialog] = useState(false)
  const [rewriteStartEpisode, setRewriteStartEpisode] = useState(1)
  const [rewriteEpisodeCount, setRewriteEpisodeCount] = useState<CountInput>(1)
  const [rewriteInstruction, setRewriteInstruction] = useState('')

  const operationBusy = saving || generating || continuing || rewriting
  const creativeBusy = generating || continuing || rewriting
  const { formatted: elapsedTime } = useTimer(creativeBusy)
  const creativeStatus = generating
    ? '正在创作剧本与整理素材档案'
    : continuing
      ? '正在续写后续分集'
      : rewriting
        ? '正在重写指定分集'
        : ''

  useEffect(() => {
    setForm({ ...project, ratio: normalizeProjectRatio(project.ratio) })
    setPlannedEpisodes(project.plannedEpisodes ?? '')
  }, [project])

  useEffect(() => {
    if (selectedId && !bundle.episodes.some(episode => episode.id === selectedId)) {
      setSelectedId(bundle.episodes[0]?.id ?? null)
    }
  }, [bundle.episodes, selectedId])

  useEffect(() => {
    if (!showContinueDialog && !showRewriteDialog) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [showContinueDialog, showRewriteDialog])

  const selected = useMemo(
    () => bundle.episodes.find(episode => episode.id === selectedId) ?? null,
    [bundle.episodes, selectedId],
  )
  const maxEpisodeNumber = useMemo(
    () => Math.max(0, ...bundle.episodes.map(episode => episode.episodeNumber)),
    [bundle.episodes],
  )
  const maxRewriteCount = Math.max(1, Math.min(MAX_SCRIPT_EPISODES_PER_REQUEST, maxEpisodeNumber - rewriteStartEpisode + 1))

  const readPlannedEpisodes = (): number | null | undefined => {
    const parsed = parsePlannedEpisodes(plannedEpisodes)
    if (!parsed.valid) {
      toast.error('计划总集数应为 1–200 的整数，或留空表示不设定')
      return undefined
    }
    return parsed.value
  }

  const saveProject = async (quiet = false): Promise<boolean> => {
    if (!form.genre.trim()) {
      toast.error('请选择题材或填写自定义题材')
      return false
    }
    const planned = readPlannedEpisodes()
    if (planned === undefined) return false
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
          plannedEpisodes: planned,
        }),
      })
      await refresh(true)
      if (!quiet) toast.success('项目设定已保存')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }

  const generate = async () => {
    if (!form.brief.trim()) return toast.error('先填写创作需求或粘贴原始故事')
    if (!form.genre.trim()) return toast.error('请选择题材或填写自定义题材')
    const episodeCount = parseRequiredEpisodeCount(generationEpisodeCount)
    if (episodeCount === null) return toast.error(`本次生成集数必须是 1–${MAX_SCRIPT_EPISODES_PER_REQUEST} 的整数`)
    const planned = readPlannedEpisodes()
    if (planned === undefined) return
    if (planned !== null && planned < episodeCount) return toast.error('计划总集数不能小于本次生成集数')
    if (bundle.episodes.length > 0 && !await confirmToast({
      title: '重新生成整套剧本？',
      description: '现有分集、角色、空镜场景、道具、分镜和剪辑草稿都会被替换，此操作不可撤销。',
      confirmLabel: '重新生成',
    })) return

    setGenerating(true)
    try {
      if (!await saveProject(true)) return
      const next = await requestJson<ProjectBundle>(`/api/projects/${project.id}/script`, {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', episodeCount, plannedEpisodes: planned }),
      })
      setSelectedId(next.episodes[0]?.id ?? null)
      await refresh(true)
      toast.success(`DeepSeek 已完成第 1–${next.episodes.length} 集剧本与素材档案`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '剧本生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const continueScript = async () => {
    const episodeCount = parseRequiredEpisodeCount(continueEpisodeCount)
    if (episodeCount === null) return toast.error(`本次续写集数必须是 1–${MAX_SCRIPT_EPISODES_PER_REQUEST} 的整数`)
    const planned = readPlannedEpisodes()
    if (planned === undefined) return
    const endEpisode = maxEpisodeNumber + episodeCount
    if (planned !== null && endEpisode > planned) {
      return toast.error(`本次续写将到第 ${endEpisode} 集，超过计划总集数 ${planned}`)
    }

    setContinuing(true)
    setShowContinueDialog(false)
    try {
      const next = await requestJson<ProjectBundle>(`/api/projects/${project.id}/script`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'continue',
          episodeCount,
          plannedEpisodes: planned,
          instruction: continueInstruction.trim() || undefined,
          newBrief: continueBrief.trim() || undefined,
          isFinale: continueAsFinale,
        }),
      })
      const firstNewEpisode = next.episodes.find(episode => episode.episodeNumber === maxEpisodeNumber + 1)
      setSelectedId(firstNewEpisode?.id ?? next.episodes.at(-1)?.id ?? null)
      if (continueBrief.trim()) setForm(current => ({ ...current, brief: continueBrief.trim() }))
      setContinueInstruction('')
      setContinueBrief('')
      setContinueAsFinale(false)
      await refresh(true)
      toast.success(`已续写第 ${maxEpisodeNumber + 1}–${endEpisode} 集`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '续写失败')
    } finally {
      setContinuing(false)
    }
  }

  const openRewriteDialog = () => {
    const startEpisode = selected?.episodeNumber ?? bundle.episodes[0]?.episodeNumber ?? 1
    setRewriteStartEpisode(startEpisode)
    setRewriteEpisodeCount(1)
    setShowRewriteDialog(true)
  }

  const rewriteScript = async () => {
    const episodeCount = parseRequiredEpisodeCount(rewriteEpisodeCount, maxRewriteCount)
    if (episodeCount === null) return toast.error(`本次最多可连续重写 ${maxRewriteCount} 集`)
    if (!rewriteInstruction.trim()) return toast.error('请填写具体重写要求')
    const endEpisode = rewriteStartEpisode + episodeCount - 1
    const targets = bundle.episodes.filter(episode => (
      episode.episodeNumber >= rewriteStartEpisode && episode.episodeNumber <= endEpisode
    ))
    if (targets.some(episode => episode.status === 'confirmed')) return toast.error('重写范围包含已定稿分集，请先取消定稿')
    const targetIds = new Set(targets.map(episode => episode.id))
    if (bundle.shots.some(shot => targetIds.has(shot.episodeId)) || bundle.edits.some(edit => targetIds.has(edit.episodeId))) {
      return toast.error('重写范围已有分镜或剪辑内容，请先移除下游制作数据')
    }

    setRewriting(true)
    setShowRewriteDialog(false)
    try {
      const next = await requestJson<ProjectBundle>(`/api/projects/${project.id}/script`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'rewrite',
          startEpisode: rewriteStartEpisode,
          episodeCount,
          instruction: rewriteInstruction.trim(),
        }),
      })
      setSelectedId(next.episodes.find(episode => episode.episodeNumber === rewriteStartEpisode)?.id ?? null)
      setRewriteInstruction('')
      await refresh(true)
      toast.success(`已重写第 ${rewriteStartEpisode}–${endEpisode} 集`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重写失败')
    } finally {
      setRewriting(false)
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
    if (!await confirmToast({
      title: `删除第 ${episode.episodeNumber} 集？`,
      description: '本集剧本及其全部分镜和剪辑记录都会被删除，此操作不可撤销。',
      confirmLabel: '删除分集',
    })) return
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
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="label">Story brief</div>
                <h3 className="display-type text-2xl font-semibold">创作底稿</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">DeepSeek 按本次集数分批创作，剧本可继续续写或按指定范围重写。</p>
              </div>
              <button className="btn-secondary" disabled={operationBusy} onClick={() => void saveProject()}><Save className="h-4 w-4" />{saving ? '保存中…' : '保存设定'}</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label><span className="label">片名</span><input className="field" value={form.title} disabled={operationBusy} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
              <div><span className="label">画面比例</span><AspectRatioPicker value={form.ratio} disabled={operationBusy} onChange={ratio => setForm({ ...form, ratio })} /></div>
              <div className="md:col-span-2"><span className="label">题材</span><GenrePicker value={form.genre} disabled={operationBusy} onChange={genre => setForm({ ...form, genre })} /></div>
              <div className="md:col-span-2"><span className="label">视觉风格</span><VideoStylePicker value={form.visualStyle} disabled={operationBusy} onChange={visualStyle => setForm({ ...form, visualStyle })} /></div>
              <label className="md:col-span-2"><span className="label">故事梗概</span><textarea className="field min-h-20 resize-y" value={form.synopsis} disabled={operationBusy} onChange={e => setForm({ ...form, synopsis: e.target.value })} placeholder="生成后会自动写入，也可以先给出已有梗概。" /></label>
              <label className="md:col-span-2"><span className="label">创作需求 / 原始素材</span><textarea className="field min-h-52 resize-y leading-7" value={form.brief} disabled={operationBusy} onChange={e => setForm({ ...form, brief: e.target.value })} placeholder="粘贴故事、小说片段或写下人物、核心冲突与结局要求…" /></label>
            </div>
          </div>
          <div className="flex flex-col justify-between border-t border-[var(--line)] bg-[var(--navy)] p-6 text-white lg:border-l lg:border-t-0">
            <div>
              <div className="timecode text-[10px] text-[var(--timecode)]">TEXT MODEL</div>
              <div className="mt-2 text-lg font-semibold">DeepSeek V4 Flash · drama-script</div>
              <p className="mt-2 text-xs leading-6 text-white/55">本次生成集数决定当前调用输出多少集；计划总集数用于安排全剧情绪曲线，可以留空。</p>
              {bundle.episodes.length > 0 && (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="timecode text-[10px] text-white/40">CURRENT PROGRESS</div>
                  <div className="mt-2 text-xl font-semibold">已生成 {bundle.episodes.length} 集</div>
                  <div className="mt-1 text-xs text-white/50">计划 {plannedEpisodes === '' ? '未设定' : `${plannedEpisodes} 集`}</div>
                </div>
              )}
              {creativeBusy && (
                <div className="mt-5 rounded-xl border border-[var(--projector)]/35 bg-[var(--projector)]/10 p-4" role="status">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin text-[var(--projector)]" />{creativeStatus}</span>
                    <span className="timecode flex shrink-0 items-center gap-1.5 text-[var(--timecode)]" aria-hidden="true"><Clock3 className="h-3.5 w-3.5" />{elapsedTime}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/50">内容越长、分集越多，创作时间越久；完成后会自动刷新结果。</p>
                </div>
              )}
            </div>
            <div className="mt-8 space-y-4">
              <label>
                <span className="mb-2 flex items-center gap-2 text-xs text-white/60">本次生成集数 <b className="text-[var(--timecode)]">必填</b></span>
                <input
                  type="number"
                  min={1}
                  max={MAX_SCRIPT_EPISODES_PER_REQUEST}
                  step={1}
                  inputMode="numeric"
                  className="field !border-white/20 !bg-[#17243a] !text-white caret-[var(--projector)] [color-scheme:dark] placeholder:!text-white/35 focus:!border-[var(--projector)]"
                  value={generationEpisodeCount}
                  disabled={operationBusy}
                  onChange={event => setGenerationEpisodeCount(event.target.value === '' ? '' : Number(event.target.value))}
                  placeholder={`1–${MAX_SCRIPT_EPISODES_PER_REQUEST}`}
                />
                <span className="mt-1.5 block text-[10px] text-white/40">当前这一次实际生成的分集数量</span>
              </label>
              <label>
                <span className="mb-2 flex items-center gap-2 text-xs text-white/60">计划总集数 <b className="font-normal text-white/35">可选</b></span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  inputMode="numeric"
                  className="field !border-white/20 !bg-[#17243a] !text-white caret-[var(--projector)] [color-scheme:dark] placeholder:!text-white/35 focus:!border-[var(--projector)]"
                  value={plannedEpisodes}
                  disabled={operationBusy}
                  onChange={event => setPlannedEpisodes(event.target.value === '' ? '' : Number(event.target.value))}
                  placeholder="留空表示开放式长剧"
                />
                <span className="mt-1.5 block text-[10px] text-white/40">1–200 集；用于规划节奏，不要求一次生成完</span>
              </label>
              <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--projector)] px-4 font-bold text-[var(--navy)] disabled:opacity-45" disabled={operationBusy} onClick={() => void generate()}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? `正在创作… ${elapsedTime}` : bundle.episodes.length ? '按本次集数重新生成' : '生成剧本与素材档案'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-h-[560px] gap-4 lg:grid-cols-[280px_1fr]">
        <div className="panel flex flex-col p-3">
          <div className="border-b border-[var(--line)] px-2 pb-3 pt-2">
            <div className="flex items-center justify-between gap-2">
              <div><div className="label !mb-0">Episodes</div><strong>{bundle.episodes.length} 集</strong></div>
              <button className="btn-quiet !min-h-8 !px-2" disabled={operationBusy} onClick={() => void addEpisode()} title="手动添加空白分集"><Plus className="h-4 w-4" /></button>
            </div>
            {bundle.episodes.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-secondary !min-h-9 !px-2 text-xs" disabled={operationBusy} onClick={() => setShowContinueDialog(true)}>{continuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Forward className="h-3.5 w-3.5" />}{continuing ? `续写中 ${elapsedTime}` : '续写'}</button>
                <button className="btn-secondary !min-h-9 !px-2 text-xs" disabled={operationBusy} onClick={openRewriteDialog}>{rewriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePenLine className="h-3.5 w-3.5" />}{rewriting ? `重写中 ${elapsedTime}` : '重写'}</button>
              </div>
            )}
          </div>
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

      {showContinueDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#09101d]/80 p-4 backdrop-blur-sm" onMouseDown={() => setShowContinueDialog(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="continue-dialog-title" className="scrollbar-thin max-h-[min(760px,calc(100vh-2rem))] w-full max-w-3xl overflow-y-auto rounded-3xl bg-[var(--panel)] p-6 shadow-float" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><div className="label">Continue script</div><h3 id="continue-dialog-title" className="display-type text-2xl font-semibold">续写剧本</h3><p className="mt-1 text-sm text-[var(--muted)]">从第 {maxEpisodeNumber + 1} 集继续，已有分集和下游制作内容不会被覆盖。</p></div>
              <button className="btn-quiet !min-h-9 !px-2.5" onClick={() => setShowContinueDialog(false)} aria-label="关闭续写弹窗"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 space-y-5">
              <label><span className="label">新的创作需求（可选）</span><textarea className="field min-h-28 resize-y" maxLength={100_000} value={continueBrief} onChange={event => setContinueBrief(event.target.value)} placeholder="留空沿用当前创作底稿；填写后将作为后续创作的新底稿保存。" /></label>
              <label><span className="label">续写指导（可选）</span><textarea className="field min-h-24 resize-y" maxLength={5_000} value={continueInstruction} onChange={event => setContinueInstruction(event.target.value)} placeholder="例如：反派升级、加强感情线、加快节奏、在本批最后制造身份反转…" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="label">本次续写集数</span><input className="field" type="number" min={1} max={MAX_SCRIPT_EPISODES_PER_REQUEST} value={continueEpisodeCount} onChange={event => setContinueEpisodeCount(event.target.value === '' ? '' : Number(event.target.value))} /></label>
                <label className="panel-muted flex min-h-20 items-center gap-3 p-4"><input type="checkbox" className="h-4 w-4 accent-[var(--projector)]" checked={continueAsFinale} onChange={event => setContinueAsFinale(event.target.checked)} /><span><strong className="block text-sm">本次续写后剧终</strong><span className="mt-1 block text-xs text-[var(--muted)]">最后一集完整收尾，不再保留下一集钩子。</span></span></label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-[var(--line)] pt-4"><button className="btn-secondary" onClick={() => setShowContinueDialog(false)}>取消</button><button className="btn-primary" onClick={() => void continueScript()}><Forward className="h-4 w-4" />确认续写</button></div>
          </section>
        </div>
      )}

      {showRewriteDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#09101d]/80 p-4 backdrop-blur-sm" onMouseDown={() => setShowRewriteDialog(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="rewrite-dialog-title" className="scrollbar-thin max-h-[min(700px,calc(100vh-2rem))] w-full max-w-3xl overflow-y-auto rounded-3xl bg-[var(--panel)] p-6 shadow-float" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><div className="label">Rewrite episodes</div><h3 id="rewrite-dialog-title" className="display-type text-2xl font-semibold">重写指定分集</h3><p className="mt-1 text-sm text-[var(--muted)]">AI 会读取全集保持前后连贯，只覆盖选定范围；已定稿或已进入分镜/剪辑的分集不能重写。</p></div>
              <button className="btn-quiet !min-h-9 !px-2.5" onClick={() => setShowRewriteDialog(false)} aria-label="关闭重写弹窗"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 space-y-5">
              <label><span className="label">重写要求</span><textarea className="field min-h-32 resize-y" maxLength={10_000} autoFocus value={rewriteInstruction} onChange={event => setRewriteInstruction(event.target.value)} placeholder="例如：保留人物关系，重写冲突过程，让反转更合理并加强结尾悬念…" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="label">从第几集开始</span><select className="field" value={rewriteStartEpisode} onChange={event => { setRewriteStartEpisode(Number(event.target.value)); setRewriteEpisodeCount(1) }}>{bundle.episodes.map(episode => <option key={episode.id} value={episode.episodeNumber}>第 {episode.episodeNumber} 集 · {episode.title}</option>)}</select></label>
                <label><span className="label">连续重写集数</span><input className="field" type="number" min={1} max={maxRewriteCount} value={rewriteEpisodeCount} onChange={event => setRewriteEpisodeCount(event.target.value === '' ? '' : Number(event.target.value))} /><span className="mt-1.5 block text-xs text-[var(--muted)]">当前起点最多重写 {maxRewriteCount} 集</span></label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-[var(--line)] pt-4"><button className="btn-secondary" onClick={() => setShowRewriteDialog(false)}>取消</button><button className="btn-primary" disabled={!rewriteInstruction.trim()} onClick={() => void rewriteScript()}><FilePenLine className="h-4 w-4" />确认重写</button></div>
          </section>
        </div>
      )}
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
