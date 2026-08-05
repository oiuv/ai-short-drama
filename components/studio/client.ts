export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() || 'GET'
  const startedAt = performance.now()
  console.debug('[雪风AI短剧工坊][API] 请求开始', { method, url })

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body
        ? { 'Content-Type': 'application/json', ...init.headers }
        : init?.headers,
    })
  } catch (error) {
    console.error('[雪风AI短剧工坊][API] 网络请求失败', {
      method,
      url,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const raw = await response.text()
  const durationMs = Math.round(performance.now() - startedAt)
  let payload: { success: boolean; data?: T; error?: string; diagnostics?: Record<string, unknown> }
  try {
    payload = JSON.parse(raw) as typeof payload
  } catch {
    console.error('[雪风AI短剧工坊][API] 响应不是有效 JSON', {
      method,
      url,
      status: response.status,
      durationMs,
      contentType: response.headers.get('content-type'),
      responseLength: raw.length,
      responsePreview: raw.slice(0, 300),
    })
    throw new Error(`服务器返回了无效响应 (${response.status})`)
  }

  if (!response.ok || !payload.success) {
    const message = payload.error || `请求失败 (${response.status})`
    console.error('[雪风AI短剧工坊][API] 请求失败', {
      method,
      url,
      status: response.status,
      durationMs,
      error: message,
      ...(payload.diagnostics ? { diagnostics: payload.diagnostics } : {}),
    })
    throw new Error(message)
  }

  console.debug('[雪风AI短剧工坊][API] 请求完成', {
    method,
    url,
    status: response.status,
    durationMs,
  })
  return payload.data as T
}

export function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}
