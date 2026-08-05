export type PublicDiagnostics = Readonly<Record<string, string | number | boolean | null>>

/**
 * 可安全返回到本机浏览器 Console 的诊断错误。
 * diagnostics 只能放元数据，禁止放 API Key、请求正文、Base64 或完整模型响应。
 */
export class DiagnosticError extends Error {
  readonly diagnostics: PublicDiagnostics

  constructor(message: string, diagnostics: PublicDiagnostics, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DiagnosticError'
    this.diagnostics = diagnostics
  }
}

export function getPublicDiagnostics(error: unknown): PublicDiagnostics | undefined {
  return error instanceof DiagnosticError ? error.diagnostics : undefined
}
