'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Images, X } from 'lucide-react'
import {
  VIDEO_STYLES,
  getStyleByPromptValue,
  type VideoStyleCategory,
} from '@/config/video-styles'

type StyleCategory = 'all' | VideoStyleCategory

const CATEGORIES: Array<{ value: StyleCategory; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'live-action', label: '真人' },
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
]

interface VideoStylePickerProps {
  value: string
  onChange: (value: string) => void
}

export function VideoStylePicker({ value, onChange }: VideoStylePickerProps) {
  const selectedStyle = getStyleByPromptValue(value)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<StyleCategory>('all')
  const filteredStyles = useMemo(
    () => category === 'all' ? VIDEO_STYLES : VIDEO_STYLES.filter(style => style.category === category),
    [category],
  )

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-3 text-left transition hover:border-[#aeb8c6] hover:bg-[#fbfcfd]"
      >
        {selectedStyle ? (
          <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[#dfe4ea]">
            <Image src={selectedStyle.previewImageUrl} alt="" fill sizes="80px" className="object-cover" />
          </span>
        ) : (
          <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-[var(--navy)] text-[var(--projector)]">
            <Images className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="label !mb-1">Selected look</span>
          <strong className="block truncate text-sm">{selectedStyle?.label ?? (value ? '原有自定义风格' : '选择视觉风格')}</strong>
          <span className="mt-1 block truncate text-xs text-[var(--muted)]">
            {selectedStyle?.generationPrompt ?? (value || '从 XuefengAI 风格库中选择统一画面语言')}
          </span>
        </span>
        <span className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--ink)]">选择风格</span>
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#09101d]/80 p-3 backdrop-blur-md md:p-6"
          onMouseDown={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-style-dialog-title"
            className="flex h-[min(760px,calc(100vh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-white/15 bg-[var(--panel)] shadow-[0_36px_100px_-24px_rgba(0,0,0,.75)]"
            onMouseDown={event => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 md:px-6 md:py-5">
              <div>
                <div className="label">Visual library · 39 looks</div>
                <h3 id="video-style-dialog-title" className="display-type text-2xl font-semibold">选择视觉风格</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">统一角色、场景、道具和分镜的画面语言。</p>
              </div>
              <button
                type="button"
                aria-label="关闭视觉风格库"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:border-[#aeb8c6] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2.5 md:px-6">
              {CATEGORIES.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    category === option.value
                      ? 'bg-[var(--navy)] text-white shadow-sm'
                      : 'text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <span className="ml-auto whitespace-nowrap pl-4 text-[10px] font-semibold text-[var(--muted)]">{filteredStyles.length} 种风格</span>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredStyles.map(style => {
                  const selected = value === style.promptValue
                  return (
                    <button
                      key={style.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        onChange(style.promptValue)
                        setOpen(false)
                      }}
                      className={`group relative aspect-[146/100] overflow-hidden rounded-xl border bg-[#dfe4ea] text-left transition ${
                        selected
                          ? 'border-[var(--projector)] shadow-[0_0_0_2px_rgba(86,199,193,.4)]'
                          : 'border-transparent hover:-translate-y-0.5 hover:border-white hover:shadow-lg'
                      }`}
                    >
                      <Image
                        src={style.previewImageUrl}
                        alt={style.label}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 180px"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 px-2.5 py-2 text-xs font-semibold text-white">{style.label}</span>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--projector)] text-[var(--navy)] shadow">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
