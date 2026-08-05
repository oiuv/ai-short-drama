'use client'

import { AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface ConfirmToastOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'warning'
}

let cancelActiveConfirmation: (() => void) | null = null

export function confirmToast({
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'danger',
}: ConfirmToastOptions): Promise<boolean> {
  cancelActiveConfirmation?.()

  return new Promise(resolve => {
    let settled = false
    let toastId: string | number | undefined
    const settle = (confirmed: boolean) => {
      if (settled) return
      settled = true
      if (cancelActiveConfirmation === cancel) cancelActiveConfirmation = null
      if (toastId !== undefined) toast.dismiss(toastId)
      resolve(confirmed)
    }
    const cancel = () => settle(false)
    cancelActiveConfirmation = cancel

    const danger = tone === 'danger'
    toastId = toast.custom(() => (
      <div role="alertdialog" aria-label={title} aria-describedby="confirm-toast-description" className="w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-[0_24px_70px_-24px_rgba(9,16,29,.55)]">
        <div className={`h-1 ${danger ? 'bg-[var(--danger)]' : 'bg-[var(--timecode)]'}`} />
        <div className="flex gap-4 p-5 pb-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-[var(--danger)]' : 'bg-amber-50 text-amber-600'}`}>
            {danger ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold">{title}</h3>
            <p id="confirm-toast-description" className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel-muted)] px-5 py-3">
          <button type="button" className="btn-secondary !min-h-9 !px-4" autoFocus onClick={cancel}>{cancelLabel}</button>
          <button type="button" className={danger ? 'btn-danger !min-h-9 !bg-[var(--danger)] !px-4 !text-white' : 'btn-primary !min-h-9 !px-4'} onClick={() => settle(true)}>{confirmLabel}</button>
        </div>
      </div>
    ), {
      duration: Infinity,
      onDismiss: cancel,
    })
  })
}
