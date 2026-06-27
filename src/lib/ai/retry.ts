/**
 * Reintento con backoff exponencial para llamadas a modelos de IA.
 *
 * Los proveedores (sobre todo Gemini) devuelven errores TRANSITORIOS de forma
 * frecuente: 503 "high demand / Service Unavailable", 429 "rate limit", etc.
 * Una sola llamada sin reintento hace que esos picos momentáneos rompan toda
 * la operación (extraer factura/catálogo por foto, análisis de imagen del bot).
 *
 * Este helper reintenta SOLO ante errores transitorios; los errores reales
 * (clave inválida, prompt malo, 400) se propagan de inmediato sin reintentar.
 */

function esTransitorio(e: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any
  const status: number | undefined = err?.status ?? err?.response?.status ?? err?.code
  const msg = String(err?.message ?? err ?? '')
  if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504) return true
  return /\b(503|502|504|429|500)\b|overloaded|high demand|service unavailable|unavailable|rate limit|temporarily|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg)
}

/**
 * Ejecuta `fn` y reintenta ante errores transitorios con backoff exponencial.
 * @param intentos  Número total de intentos (default 3).
 * @param baseMs    Espera base; crece exponencialmente (default 800ms → 0.8s, 1.6s).
 */
export async function reintentarIA<T>(
  fn: () => Promise<T>,
  opciones: { intentos?: number; baseMs?: number; etiqueta?: string } = {},
): Promise<T> {
  const { intentos = 3, baseMs = 800, etiqueta = 'IA' } = opciones
  let ultimoError: unknown

  for (let i = 0; i < intentos; i++) {
    try {
      return await fn()
    } catch (e) {
      ultimoError = e
      const ultimo = i === intentos - 1
      if (ultimo || !esTransitorio(e)) throw e

      const espera = baseMs * 2 ** i + Math.floor(Math.random() * 300)
      const msg = String((e as { message?: string })?.message ?? e).slice(0, 140)
      console.warn(`[${etiqueta}] Error transitorio (intento ${i + 1}/${intentos}), reintentando en ${espera}ms: ${msg}`)
      await new Promise((r) => setTimeout(r, espera))
    }
  }

  throw ultimoError
}
