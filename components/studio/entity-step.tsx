'use client'

import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, Plus, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { confirmToast } from '@/components/confirm-toast'
import type { Entity, EntityKind, ProjectBundle } from '@/lib/types'
import { fileAsDataUrl, requestJson } from './client'

interface Props {
  kind: EntityKind
  bundle: ProjectBundle
  refresh: (quiet?: boolean) => Promise<void>
}

const CONFIG = {
  character: { title: '角色造型', eyebrow: 'Cast bible', empty: '剧本生成后会自动整理角色；也可以手动添加造型。', accent: '#8b7cf7' },
  scene: { title: '空镜场景', eyebrow: 'Location bible', empty: '在这里建立可重复使用的空间与光线设定。', accent: '#41a99e' },
  prop: { title: '关键道具', eyebrow: 'Prop bible', empty: '只保留跨镜头需要维持一致的关键物件。', accent: '#d79833' },
} as const

export function EntityStep({ kind, bundle, refresh }: Props) {
  const config = CONFIG[kind]
  const entities = useMemo(() => bundle.entities.filter(entity => entity.kind === kind), [bundle.entities, kind])
  const [showAdd, setShowAdd] = useState(false)
  const [threeView, setThreeView] = useState(kind !== 'scene')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [batching, setBatching] = useState(false)
  const [form, setForm] = useState({ name: '', variant: '', description: '', episodes: '', category: 'item' })

  const create = async () => {
    if (!form.name.trim() || !form.description.trim()) return toast.error('名称和视觉描述不能为空')
    try {
      await requestJson(`/api/projects/${bundle.project.id}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          name: form.name,
          variant: kind === 'character' ? form.variant || '默认造型' : '',
          description: form.description,
          episodes: form.episodes.split(/[,，\s]+/).map(Number).filter(Number.isFinite),
          category: kind === 'prop' ? form.category : '',
        }),
      })
      setShowAdd(false)
      setForm({ name: '', variant: '', description: '', episodes: '', category: 'item' })
      await refresh(true)
      toast.success('素材档案已添加')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败')
    }
  }

  const update = async (entity: Entity, fields: Partial<Entity>) => {
    try {
      await requestJson(`/api/projects/${bundle.project.id}/entities`, {
        method: 'PATCH',
        body: JSON.stringify({ entityId: entity.id, ...fields }),
      })
      await refresh(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败')
    }
  }

  const remove = async (entity: Entity) => {
    const entityLabel = `${entity.name}${entity.variant ? ` / ${entity.variant}` : ''}`
    if (!await confirmToast({
      title: `删除“${entityLabel}”？`,
      description: '该素材档案及其所有图片版本记录都会被删除，此操作不可撤销。',
      confirmLabel: '删除素材',
    })) return
    try {
      await requestJson(`/api/projects/${bundle.project.id}/entities?entityId=${entity.id}`, { method: 'DELETE' })
      await refresh(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const generate = async (entity: Entity, referenceCurrent = false, silent = false) => {
    setWorkingId(entity.id)
    try {
      await requestJson(`/api/entities/${entity.id}/image`, {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', referenceCurrent, threeView }),
      })
      if (!silent) toast.success('Seedream 图片已保存到本地')
      await refresh(true)
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : '生图失败')
      throw error
    } finally {
      setWorkingId(null)
    }
  }

  const batchGenerate = async () => {
    const pending = entities.filter(entity => !entity.selectedImage)
    if (!pending.length) return toast.info('所有素材都已有选定图片')
    if (!await confirmToast({
      title: `批量生成 ${pending.length} 个素材？`,
      description: '任务将依次调用 Seedream 生成图片，期间请保持应用运行。',
      confirmLabel: '开始生成',
      tone: 'warning',
    })) return
    setBatching(true)
    let succeeded = 0
    for (const entity of pending) {
      try {
        await generate(entity, false, true)
        succeeded += 1
      } catch { /* continue */ }
    }
    setBatching(false)
    toast.success(`批量生成完成：${succeeded}/${pending.length}`)
  }

  const upload = async (entity: Entity, file: File) => {
    setWorkingId(entity.id)
    try {
      const dataUrl = await fileAsDataUrl(file)
      await requestJson(`/api/entities/${entity.id}/image`, {
        method: 'POST', body: JSON.stringify({ action: 'upload', dataUrl }),
      })
      await refresh(true)
      toast.success('图片已保存到本地')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setWorkingId(null)
    }
  }

  const selectVersion = async (entity: Entity, imageId: string) => {
    try {
      await requestJson(`/api/entities/${entity.id}/image`, {
        method: 'POST', body: JSON.stringify({ action: 'select', imageId }),
      })
      await refresh(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '切换版本失败')
    }
  }

  const deleteVersion = async (entity: Entity, imageId: string) => {
    if (!await confirmToast({
      title: '删除这个图片版本？',
      description: '该版本记录和本地图片文件都会被删除；若它是当前版本，将自动切换到最近版本。',
      confirmLabel: '删除版本',
    })) return
    try {
      await requestJson(`/api/entities/${entity.id}/image`, {
        method: 'POST', body: JSON.stringify({ action: 'delete', imageId }),
      })
      await refresh(true)
      toast.success('图片版本已删除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除图片版本失败')
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <div className="label">{config.eyebrow}</div>
          <h3 className="display-type text-2xl font-semibold">{config.title}</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Seedream 5.0 Lite 只返回 Base64，服务端随即写入本地媒体目录；所有版本可回看和切换。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kind !== 'scene' && <label className="mr-2 flex items-center gap-2 text-xs text-[var(--muted)]"><input type="checkbox" checked={threeView} onChange={e => setThreeView(e.target.checked)} /> 三视图设定稿</label>}
          <button className="btn-secondary" disabled={batching || Boolean(workingId)} onClick={() => void batchGenerate()}>{batching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 批量补齐图片</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> 添加{kind === 'character' ? '造型' : kind === 'scene' ? '场景' : '道具'}</button>
        </div>
      </section>

      {entities.length === 0 ? (
        <button className="panel flex w-full flex-col items-center border-dashed py-24 text-center hover:border-[var(--projector)]" onClick={() => setShowAdd(true)}>
          <ImagePlus className="mb-4 h-10 w-10" style={{ color: config.accent }} />
          <strong>{config.empty}</strong>
          <span className="mt-2 text-sm text-[var(--muted)]">点击添加第一份档案。</span>
        </button>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entities.map(entity => (
            <EntityCard
              key={entity.id}
              entity={entity}
              accent={config.accent}
              working={workingId === entity.id}
              onGenerate={generate}
              onUpload={upload}
              onSelect={selectVersion}
              onDeleteVersion={deleteVersion}
              onUpdate={update}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09101d]/70 p-4 backdrop-blur-sm" onMouseDown={() => setShowAdd(false)}>
          <div className="panel w-full max-w-xl p-6" onMouseDown={event => event.stopPropagation()}>
            <div className="label">New {kind}</div><h3 className="display-type text-2xl font-semibold">添加{config.title}</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label><span className="label">名称</span><input className="field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></label>
              {kind === 'character' && <label><span className="label">造型阶段</span><input className="field" value={form.variant} onChange={e => setForm({ ...form, variant: e.target.value })} placeholder="默认造型 / 雨夜造型" /></label>}
              {kind === 'prop' && <label><span className="label">分类</span><select className="field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="item">物品</option><option value="weapon">武器</option><option value="vehicle">载具</option><option value="clothing">服装</option><option value="accessory">饰品</option></select></label>}
              <label><span className="label">出场集数</span><input className="field" value={form.episodes} onChange={e => setForm({ ...form, episodes: e.target.value })} placeholder="1, 2, 3" /></label>
              <label className="sm:col-span-2"><span className="label">稳定视觉描述</span><textarea className="field min-h-36 resize-y" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="描述材质、颜色、轮廓、结构和识别细节…" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setShowAdd(false)}>取消</button><button className="btn-primary" onClick={() => void create()}>添加档案</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function EntityCard({ entity, accent, working, onGenerate, onUpload, onSelect, onDeleteVersion, onUpdate, onDelete }: {
  entity: Entity
  accent: string
  working: boolean
  onGenerate: (entity: Entity, referenceCurrent?: boolean) => Promise<void>
  onUpload: (entity: Entity, file: File) => Promise<void>
  onSelect: (entity: Entity, imageId: string) => Promise<void>
  onDeleteVersion: (entity: Entity, imageId: string) => Promise<void>
  onUpdate: (entity: Entity, fields: Partial<Entity>) => Promise<void>
  onDelete: (entity: Entity) => Promise<void>
}) {
  const uploadRef = useRef<HTMLInputElement>(null)
  return (
    <article className="panel overflow-hidden">
      <div className="relative aspect-[4/3] bg-[#e8ebef]">
        {entity.selectedImage ? <img src={entity.selectedImage.url} alt={`${entity.name} ${entity.variant}`} className="h-full w-full object-contain" /> : <div className="flex h-full flex-col items-center justify-center text-sm text-[var(--muted)]"><ImagePlus className="mb-3 h-8 w-8" style={{ color: accent }} />尚无定稿图</div>}
        {working && <div className="absolute inset-0 flex items-center justify-center bg-[var(--navy)]/70 text-sm font-semibold text-white backdrop-blur-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在处理图片…</div>}
        <span className="timecode absolute left-3 top-3 rounded-md bg-[var(--navy)]/85 px-2 py-1 text-[9px] text-white">{entity.kind.toUpperCase()} / {String(entity.images.length).padStart(2, '0')} VER</span>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <input className="w-full border-0 bg-transparent p-0 font-semibold outline-none" defaultValue={entity.name} onBlur={e => { if (e.target.value !== entity.name) void onUpdate(entity, { name: e.target.value }) }} />
            {entity.kind === 'character' && <input className="mt-1 w-full border-0 bg-transparent p-0 text-xs text-[var(--muted)] outline-none" defaultValue={entity.variant} onBlur={e => { if (e.target.value !== entity.variant) void onUpdate(entity, { variant: e.target.value }) }} />}
          </div>
          <button className="btn-quiet !min-h-7 !px-1.5 hover:!text-[var(--danger)]" onClick={() => void onDelete(entity)}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        <textarea className="mt-3 min-h-24 w-full resize-y rounded-lg border border-transparent bg-[var(--panel-muted)] p-2.5 text-xs leading-5 outline-none focus:border-[var(--projector)]" defaultValue={entity.description} onBlur={e => { if (e.target.value !== entity.description) void onUpdate(entity, { description: e.target.value }) }} />
        {entity.images.length > 0 && <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">{entity.images.map((image, index) => <div key={image.id} className="relative h-12 w-12 shrink-0"><button onClick={() => void onSelect(entity, image.id)} className={`h-full w-full overflow-hidden rounded-lg border-2 ${image.id === entity.selectedImage?.id ? 'border-[var(--projector)]' : 'border-transparent opacity-65 hover:opacity-100'}`}><img src={image.url} alt={`版本 ${index + 1}`} className="h-full w-full object-cover" /></button><button className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white shadow" onClick={() => void onDeleteVersion(entity, image.id)} aria-label={`删除图片版本 ${index + 1}`}>×</button></div>)}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-primary" disabled={working} onClick={() => void onGenerate(entity, false)}><Sparkles className="h-3.5 w-3.5" /> {entity.selectedImage ? '生成新版本' : '生成图片'}</button>
          <button className="btn-secondary" disabled={working || !entity.selectedImage} onClick={() => void onGenerate(entity, true)}><RefreshCw className="h-3.5 w-3.5" /> 参考重绘</button>
          <button className="btn-secondary col-span-2" disabled={working} onClick={() => uploadRef.current?.click()}><Upload className="h-3.5 w-3.5" /> 上传本地图</button>
          <input ref={uploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void onUpload(entity, file); event.target.value = '' }} />
        </div>
      </div>
    </article>
  )
}
