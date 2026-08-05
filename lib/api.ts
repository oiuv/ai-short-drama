import { NextResponse } from 'next/server'
import { getPublicDiagnostics } from './diagnostic-error'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init)
}

export function fail(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error || '未知错误')
  const diagnostics = getPublicDiagnostics(error)
  return NextResponse.json({
    success: false,
    error: message,
    ...(diagnostics ? { diagnostics } : {}),
  }, { status })
}
