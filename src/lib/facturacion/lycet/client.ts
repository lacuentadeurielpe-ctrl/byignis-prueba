// Cliente HTTP del microservicio Lycet (API REST oficial de Greenter).
//
// Lycet autentica con ?token=... en query sobre las rutas /api/*.
// Endpoints usados:
//   PUT  /api/v1/configuration/company/{ruc}   → registrar empresa (cert + SOL)
//   POST /api/v1/invoice/send                  → boleta/factura
//   POST /api/v1/note/send                     → nota de crédito/débito
//   POST /api/v1/summary/send                  → resumen diario (RC) → ticket
//   GET  /api/v1/summary/status?ticket=&ruc=   → CDR del RC
//   POST /api/v1/invoice/pdf | /invoice/xml    → PDF/XML fiscal

const TIMEOUT_MS = 60_000

export interface LycetConfig {
  baseUrl: string
  token:   string
}

// Respuesta normalizada de un envío a SUNAT
export interface ResultadoSunat {
  ok:             boolean       // la llamada HTTP + parseo funcionaron
  aceptado:       boolean       // SUNAT aceptó el comprobante
  cdrCodigo:      string | null
  cdrDescripcion: string | null
  cdrNotas:       string[] | null
  cdrZipBase64:   string | null
  ticket:         string | null // solo para resúmenes
  xml:            string | null
  hash:           string | null
  error:          string | null
}

function urls(cfg: LycetConfig, path: string, extraQuery = ''): string {
  const base = cfg.baseUrl.replace(/\/$/, '')
  const sep  = extraQuery ? `&${extraQuery}` : ''
  return `${base}${path}?token=${encodeURIComponent(cfg.token)}${sep}`
}

async function fetchConTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// SUNAT: aceptado si code '0' o >= 4000 (observaciones). 100-3999 = rechazo.
function esAceptado(code: string | null): boolean {
  if (code === '0') return true
  const n = code != null && /^\d+$/.test(code) ? parseInt(code, 10) : NaN
  return !Number.isNaN(n) && n >= 4000
}

// Normaliza la respuesta { xml, hash, sunatResponse } de Lycet.
function normalizar(json: any): ResultadoSunat {
  const sr   = json?.sunatResponse ?? {}
  const cdr  = sr?.cdrResponse ?? null
  const err  = sr?.error ?? null
  const code = cdr?.code ?? null

  // success=false → rechazo/excepción (aquí aparece el error.code tipo 3305)
  if (sr?.success === false) {
    return {
      ok: true, aceptado: false,
      cdrCodigo:      err?.code ?? code ?? null,
      cdrDescripcion: err?.message ?? cdr?.description ?? 'SUNAT rechazó el comprobante',
      cdrNotas:       cdr?.notes ?? null,
      cdrZipBase64:   sr?.cdrZip ?? null,
      ticket:         sr?.ticket ?? null,
      xml:            json?.xml ?? null,
      hash:           json?.hash ?? null,
      error:          err?.message ?? null,
    }
  }

  return {
    ok: true,
    aceptado:       esAceptado(code),
    cdrCodigo:      code,
    cdrDescripcion: cdr?.description ?? null,
    cdrNotas:       cdr?.notes ?? null,
    cdrZipBase64:   sr?.cdrZip ?? null,
    ticket:         sr?.ticket ?? null,
    xml:            json?.xml ?? null,
    hash:           json?.hash ?? null,
    error:          null,
  }
}

function fallo(msg: string): ResultadoSunat {
  return {
    ok: false, aceptado: false, cdrCodigo: null, cdrDescripcion: null,
    cdrNotas: null, cdrZipBase64: null, ticket: null, xml: null, hash: null, error: msg,
  }
}

// ── Registrar/actualizar empresa en Lycet (idempotente) ───────────────────────
export async function ensureCompany(
  cfg: LycetConfig,
  data: { ruc: string; solUser: string; solPass: string; certPem: string; feUrl?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, string> = {
      SOL_USER:    data.solUser,
      SOL_PASS:    data.solPass,
      certificate: Buffer.from(data.certPem, 'utf-8').toString('base64'),
    }
    if (data.feUrl) body.FE_URL = data.feUrl

    const res = await fetchConTimeout(urls(cfg, `/api/v1/configuration/company/${data.ruc}`), {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, error: `Lycet config ${res.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function enviarDoc(cfg: LycetConfig, path: string, doc: any): Promise<ResultadoSunat> {
  try {
    const res = await fetchConTimeout(urls(cfg, path), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(doc),
    })
    const texto = await res.text().catch(() => '')
    if (!res.ok) return fallo(`Lycet ${res.status}: ${texto.slice(0, 300)}`)
    let json: any
    try { json = JSON.parse(texto) } catch { return fallo('Lycet devolvió una respuesta no-JSON') }
    return normalizar(json)
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError'
      ? 'Tiempo de espera agotado con el servicio SUNAT (>60s)'
      : `Error de red con el servicio SUNAT: ${e instanceof Error ? e.message : String(e)}`
    return fallo(msg)
  }
}

export const enviarInvoice = (cfg: LycetConfig, doc: any) => enviarDoc(cfg, '/api/v1/invoice/send', doc)
export const enviarNota    = (cfg: LycetConfig, doc: any) => enviarDoc(cfg, '/api/v1/note/send', doc)
export const enviarSummary = (cfg: LycetConfig, doc: any) => enviarDoc(cfg, '/api/v1/summary/send', doc)

// ── Consultar estado de un ticket de resumen diario ───────────────────────────
export async function consultarSummary(cfg: LycetConfig, ticket: string, ruc: string): Promise<ResultadoSunat> {
  try {
    const res = await fetchConTimeout(
      urls(cfg, '/api/v1/summary/status', `ticket=${encodeURIComponent(ticket)}&ruc=${encodeURIComponent(ruc)}`),
      { method: 'GET' },
    )
    const texto = await res.text().catch(() => '')
    if (!res.ok) return fallo(`Lycet ${res.status}: ${texto.slice(0, 300)}`)
    let json: any
    try { json = JSON.parse(texto) } catch { return fallo('Lycet devolvió una respuesta no-JSON') }
    // El status devuelve directamente el result serializado (sin envoltura xml/hash)
    return normalizar({ sunatResponse: json?.sunatResponse ?? json })
  } catch (e) {
    return fallo(e instanceof Error ? e.message : String(e))
  }
}

// ── PDF fiscal (devuelve base64) ──────────────────────────────────────────────
export async function obtenerPdf(cfg: LycetConfig, tipo: 'invoice' | 'note', doc: any): Promise<string | null> {
  try {
    const res = await fetchConTimeout(urls(cfg, `/api/v1/${tipo}/pdf`), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(doc),
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return Buffer.from(buf).toString('base64')
  } catch {
    return null
  }
}
