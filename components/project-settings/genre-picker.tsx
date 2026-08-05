'use client'

import { useMemo } from 'react'
import { PenLine } from 'lucide-react'
import { PROJECT_GENRES } from '@/config/project-options'

interface GenrePickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function GenrePicker({ value, onChange, disabled = false }: GenrePickerProps) {
  const isPreset = useMemo(
    () => PROJECT_GENRES.some(option => option === value),
    [value],
  )

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="题材" aria-disabled={disabled}>
        {PROJECT_GENRES.map(option => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${
              value === option
                ? 'border-[var(--navy)] bg-[var(--navy)] text-white shadow-sm'
                : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-[#aeb8c6] hover:text-[var(--ink)]'
            }`}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={!isPreset}
          disabled={disabled}
          onClick={() => {
            if (isPreset) onChange('')
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${
            !isPreset
              ? 'border-[var(--projector)] bg-[var(--projector)]/10 text-[var(--ink)]'
              : 'border-dashed border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--projector)] hover:text-[var(--ink)]'
          }`}
        >
          <PenLine className="h-3.5 w-3.5" />
          自定义
        </button>
      </div>
      {!isPreset && (
        <input
          className="field mt-3"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="输入自定义题材，例如：民国谍战"
          maxLength={80}
          autoFocus
          disabled={disabled}
        />
      )}
    </div>
  )
}
