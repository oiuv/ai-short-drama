'use client'

import { PROJECT_RATIOS, normalizeProjectRatio, type ProjectRatio } from '@/config/project-options'

interface AspectRatioPickerProps {
  value: string
  onChange: (value: ProjectRatio) => void
  disabled?: boolean
}

export function AspectRatioPicker({ value, onChange, disabled = false }: AspectRatioPickerProps) {
  const normalized = normalizeProjectRatio(value)

  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="画面比例" aria-disabled={disabled}>
      {PROJECT_RATIOS.map(option => {
        const selected = normalized === option.value
        const vertical = option.value === '9:16'
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex min-h-20 items-center gap-3 rounded-xl border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
              selected
                ? 'border-[var(--projector)] bg-[var(--projector)]/10 shadow-[0_0_0_2px_rgba(86,199,193,.13)]'
                : 'border-[var(--line)] bg-white hover:border-[#aeb8c6]'
            }`}
          >
            <span
              className={`shrink-0 rounded-[3px] border-2 ${selected ? 'border-[var(--projector)] bg-white' : 'border-[#8e99a8] bg-[var(--panel-muted)]'} ${
                vertical ? 'h-11 w-7' : 'h-7 w-11'
              }`}
              aria-hidden="true"
            />
            <span>
              <strong className="timecode block text-sm">{option.value}</strong>
              <span className="mt-1 block text-xs text-[var(--muted)]">{option.label} · {option.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
