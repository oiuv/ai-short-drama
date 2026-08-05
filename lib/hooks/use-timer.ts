'use client'

import { useEffect, useState } from 'react'

export function formatElapsedTime(elapsedSeconds: number): string {
  const seconds = Math.max(0, Math.floor(elapsedSeconds))
  if (seconds < 60) return `${seconds}秒`
  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`
}

export function useTimer(active: boolean): { elapsed: number; formatted: string } {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }

    const timer = window.setInterval(() => setElapsed(current => current + 1), 1_000)
    return () => window.clearInterval(timer)
  }, [active])

  return { elapsed, formatted: formatElapsedTime(elapsed) }
}
