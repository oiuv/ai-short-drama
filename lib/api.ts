import { NextResponse } from 'next/server'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init)
}

export function fail(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error || '未知错误')
  return NextResponse.json({ success: false, error: message }, { status })
}
