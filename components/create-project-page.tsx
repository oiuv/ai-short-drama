'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clapperboard, Loader2, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_PROJECT_GENRE } from '@/config/project-options'
import { getDefaultVideoStyle } from '@/config/video-styles'
import type { Project } from '@/lib/types'
import { AspectRatioPicker } from './project-settings/aspect-ratio-picker'
import { GenrePicker } from './project-settings/genre-picker'
import { VideoStylePicker } from './project-settings/video-style-picker'
import { requestJson } from './studio/client'

const CREATION_STEPS = ['专业剧本', '角色造型', '空镜场景', '关键道具', '分镜视频', '剪辑成片']

const BRIEF_PLACEHOLDER = `描述你想要的短剧内容，简单想法也可以，点击右上角「AI 优化需求」自动扩写。

【主角设定】
• 姓名、性别、表面身份与隐藏身份
• 核心性格、当前困境、目标与失败代价

【故事框架】
• 开场处境：故事从什么危机、背叛或机会开始
• 核心矛盾：谁在阻碍主角，冲突为什么不断升级
• 身份反转：主角隐藏的优势、证据或秘密如何兑现
• 复仇 / 逆袭路径：主角如何一步步反击
• 高潮与结局：最终对决和人物关系如何收束

【关键场景】（可选）
• 首集吸引点、中期反转、最终对决

【特殊要求】（可选）
• 感情线、反派、金手指、时代、职业或世界观
• 无虐主 / 快节奏 / 反转多 / 指定结局 / 必须保留的情节`

export function CreateProjectPage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [optimizingBrief, setOptimizingBrief] = useState(false)
  const [briefHistory, setBriefHistory] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '',
    brief: '',
    genre: String(DEFAULT_PROJECT_GENRE),
    visualStyle: getDefaultVideoStyle().promptValue,
    ratio: '9:16',
  })
  const formLocked = optimizingBrief || creating

  const optimizeBrief = async () => {
    if (!form.brief.trim()) return toast.error('先写下一句话故事想法，再让 AI 帮你扩写')
    if (!form.genre.trim()) return toast.error('请选择题材或填写自定义题材')
    if (!form.visualStyle.trim()) return toast.error('请选择视觉风格')
    const requestInput = { ...form }
    setOptimizingBrief(true)
    try {
      const result = await requestJson<{ brief: string; genreDetected: string; tips: string[] }>('/api/script-brief', {
        method: 'POST',
        body: JSON.stringify({
          brief: requestInput.brief,
          title: requestInput.title,
          genre: requestInput.genre,
          visualStyle: requestInput.visualStyle,
          ratio: requestInput.ratio,
        }),
      })
      const optimizedBrief = result.brief.trim()
      if (!optimizedBrief) throw new Error('AI 未返回有效的创作需求')
      if (optimizedBrief !== requestInput.brief.trim()) {
        setBriefHistory(current => [...current, requestInput.brief].slice(-10))
        setForm(current => ({ ...current, brief: optimizedBrief }))
        toast.success('创作需求已优化，可继续修改或恢复上个版本')
      } else {
        toast.info('当前创作需求已经足够完整')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创作需求优化失败')
    } finally {
      setOptimizingBrief(false)
    }
  }

  const restoreBrief = () => {
    if (formLocked) return
    const previousBrief = briefHistory.at(-1)
    if (previousBrief === undefined) return
    setForm(current => ({ ...current, brief: previousBrief }))
    setBriefHistory(current => current.slice(0, -1))
    toast.success('已恢复上个创作需求版本')
  }

  const create = async () => {
    if (optimizingBrief) return
    if (!form.title.trim()) return toast.error('先给项目起个名字')
    if (!form.genre.trim()) return toast.error('请选择题材或填写自定义题材')
    if (!form.visualStyle.trim()) return toast.error('请选择视觉风格')
    setCreating(true)
    try {
      const project = await requestJson<Project>('/api/projects', { method: 'POST', body: JSON.stringify(form) })
      router.push(`/studio/${project.id}?step=script`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-4 py-5 md:px-8 md:py-8">
      <header className="overflow-hidden rounded-[26px] bg-[var(--navy)] text-white shadow-float">
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="p-6 md:p-9">
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-white/55 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> 返回本地项目
            </Link>
            <div className="mt-10 flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-white/45">
              <Clapperboard className="h-4 w-4 text-[var(--timecode)]" /> New production
            </div>
            <h1 className="display-type mt-3 text-4xl font-semibold md:text-5xl">建立一座新片场</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60 md:text-base">
              先确定故事方向与统一画面语言。建立后，DeepSeek 会从专业剧本开始，继续整理角色、场景和道具，再进入分镜与成片。
            </p>
          </div>
          <div className="relative border-t border-white/10 bg-[var(--navy-soft)] p-6 lg:border-l lg:border-t-0 md:p-8">
            <div className="timecode text-[10px] text-[var(--timecode)]">PROJECT SETUP / 01</div>
            <p className="mt-4 text-sm leading-7 text-white/65">
              这里保存的是创作底稿，不必一开始就写得完美。一句话也能交给 AI 补全，所有结果仍可继续编辑。
            </p>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="panel p-5 md:p-7">
            <div className="label">Basic setup</div>
            <h2 className="display-type text-2xl font-semibold">故事身份</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">先给项目一个可识别的名字，再选择最接近的题材方向。</p>
            <div className="mt-5 space-y-5">
              <label>
                <span className="label">片名</span>
                <input className="field" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="例如：雨夜最后一班车" autoFocus disabled={formLocked} />
              </label>
              <div>
                <span className="label">题材</span>
                <GenrePicker value={form.genre} onChange={genre => setForm({ ...form, genre })} disabled={formLocked} />
              </div>
            </div>
          </section>

          <section className="panel p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="label">Story brief</div>
                <label htmlFor="project-brief" className="display-type block text-2xl font-semibold">创作想法 / 原始故事</label>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">写一句话、详细大纲或粘贴已有素材。AI 优化会保存当前版本，随时可以恢复。</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {briefHistory.length > 0 && (
                  <button type="button" className="btn-secondary shrink-0" disabled={formLocked} onClick={restoreBrief}>
                    <RotateCcw className="h-4 w-4" />
                    恢复上个版本
                  </button>
                )}
                <button type="button" className="btn-secondary shrink-0" disabled={!form.brief.trim() || !form.genre.trim() || !form.visualStyle.trim() || formLocked} onClick={() => void optimizeBrief()}>
                  {optimizingBrief ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {optimizingBrief ? 'AI 优化中…' : 'AI 优化需求'}
                </button>
              </div>
            </div>
            <textarea id="project-brief" className="field mt-5 min-h-[620px] resize-y leading-7" value={form.brief} onChange={event => setForm({ ...form, brief: event.target.value })} placeholder={BRIEF_PLACEHOLDER} maxLength={100_000} disabled={formLocked} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <span>AI 会保留已明确的人物、情节、结局和禁忌，只补全缺失的创作要素。</span>
              <span className="timecode shrink-0">{form.brief.length} / 100000</span>
            </div>
          </section>

          <section className="panel p-5 md:p-7">
            <div className="label">Visual language</div>
            <h2 className="display-type text-2xl font-semibold">视觉风格</h2>
            <p className="mb-5 mt-1 text-sm leading-6 text-[var(--muted)]">统一角色、场景、道具和所有分镜的材质、色彩、光线与构图语言。</p>
            <VideoStylePicker value={form.visualStyle} onChange={visualStyle => setForm({ ...form, visualStyle })} disabled={formLocked} />
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="panel p-5">
            <div className="label">Frame</div>
            <h2 className="display-type text-xl font-semibold">画面比例</h2>
            <div className="mt-4">
              <AspectRatioPicker value={form.ratio} onChange={ratio => setForm({ ...form, ratio })} disabled={formLocked} />
            </div>
            <div className="panel-muted mt-4 p-4">
              <div className="timecode text-[10px] text-[var(--muted)]">PRODUCTION LOCK</div>
              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">画幅会贯穿角色、场景、道具、分镜与最终成片，建立后仍可在剧本页调整。</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-[var(--navy)] p-5 text-white shadow-float">
            <div className="timecode text-[10px] text-[var(--timecode)]">NEXT / 06 STAGES</div>
            <ol className="mt-4 space-y-1">
              {CREATION_STEPS.map((step, index) => (
                <li key={step} className="flex items-center gap-3 border-b border-white/10 py-2.5 last:border-0">
                  <span className="timecode w-6 text-[10px] text-white/35">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-semibold">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel p-5">
            <button className="btn-primary w-full justify-center" disabled={creating || optimizingBrief} onClick={() => void create()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? '正在建立片场…' : '建立并进入剧本'}
            </button>
            <Link href="/" className="btn-secondary mt-3 w-full justify-center">取消并返回</Link>
            <p className="mt-4 text-center text-xs leading-5 text-[var(--muted)]">建立项目本身不会调用模型；进入剧本页后由你决定何时开始生成。</p>
          </section>
        </aside>
      </div>
    </main>
  )
}
