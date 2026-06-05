/**
 * compras-ai.ts — Extracción de Compras con IA (v3 — Single-Shot)
 *
 * Arquitectura:
 *   1. Si la imagen es muy alta, se "ancla" la cabecera visual en cada rebanada
 *      (stitching real con sharp) para que el modelo SIEMPRE vea los títulos.
 *   2. Un único agente de visión lee TODA la tabla de una vez por imagen/rebanada
 *      y devuelve filas estructuradas con los campos semánticos correctos.
 *   3. No hay Detective, no hay Tipeadores ciegos, no hay mapeo de columnas en código.
 *      El modelo mapea internamente porque ve los encabezados visuales en CADA imagen.
 */

import { normalizarUnidad } from '@/lib/constantes/unidades'
import sharp from 'sharp'
import { buildPromptExtraccionCompleta, buildPromptCabecera } from './prompts/compras-prompts'

// ── Constantes ────────────────────────────────────────────────────────────────
const OPENAI_BASE    = 'https://api.openai.com/v1'
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'

// ↓ 700px ≈ 12-15 filas de producto → el modelo no se satura
const MAX_SLICE_H = 700   // px por rebanada de contenido (sin contar cabecera)
const HEADER_H    = 250   // px de cabecera visual anclada en cada rebanada

// Tokens máximos de respuesta — 8 192 evita truncado en facturas largas
const MAX_TOKENS_VISION = 8192

// ── Interfaces públicas ───────────────────────────────────────────────────────
export interface ItemCompraExtraido {
  descripcion:             string | null
  cantidad:                number | null
  unidad:                  string | null
  valor_unitario:          number | null
  precio_unitario:         number | null
  subtotal_linea:          number | null
  total_linea:             number | null
  precio_compra_unitario:  number | null
  subtotal:                number | null
}

export interface ResultadoExtracionCompra {
  tipo_documento:      'factura' | 'boleta' | 'nota_venta' | 'ticket' | 'desconocido'
  es_formal:           boolean
  ruc_emisor:          string | null
  razon_social_emisor: string | null
  numero_factura:      string | null
  fecha_factura:       string | null
  total_bruto:         number | null
  igv:                 number | null
  total_neto:          number | null
  items:               ItemCompraExtraido[]
  advertencias:        string[]
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function cleanBase64(b64: string): string {
  return b64.replace(/^data:[^;]+;base64,/, '')
}

function safeParseJSON(text: string): any {
  // 1. Intento directo
  try { return JSON.parse(text) } catch {}

  // 2. Eliminar code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) { try { return JSON.parse(fence[1]) } catch {} }

  // 3. Extraer desde primer '{' hasta último '}'
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s !== -1 && e !== -1) { try { return JSON.parse(text.slice(s, e + 1)) } catch {} }

  // 4. JSON truncado — el modelo se quedó sin tokens a mitad del array.
  //    Cerramos el último elemento incompleto y el objeto padre.
  if (s !== -1) {
    let partial = text.slice(s)
    // Eliminar última coma suelta
    partial = partial.replace(/,\s*$/, '')
    // Cerrar array si está abierto
    const openBrackets = (partial.match(/\[/g) || []).length
    const closeBrackets = (partial.match(/\]/g) || []).length
    for (let i = 0; i < openBrackets - closeBrackets; i++) partial += ']'
    // Cerrar objeto si está abierto
    const openBraces = (partial.match(/\{/g) || []).length
    const closeBraces = (partial.match(/\}/g) || []).length
    for (let i = 0; i < openBraces - closeBraces; i++) partial += '}'
    try { return JSON.parse(partial) } catch {}
  }

  throw new Error('JSON inválido de la IA: ' + text.slice(0, 300))
}

function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return isNaN(val) ? null : val
  const s = String(val).trim().replace(/[^0-9.,-]/g, '')
  if (!s) return null
  // Formato local peruano: 1.234,56 → 1234.56
  const hasComma  = s.includes(',')
  const hasPeriod = s.includes('.')
  let clean = s
  if (hasComma && hasPeriod) {
    clean = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (hasComma) {
    clean = s.replace(',', '.')
  }
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

// ── Llamadas a API ────────────────────────────────────────────────────────────

async function callOpenAIVision(
  systemPrompt: string,
  images: { base64: string; mimeType: string }[],
  model = 'gpt-4o',
  maxTokens = MAX_TOKENS_VISION
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const userContent: any[] = [{ type: 'text', text: 'Extrae los datos del documento.' }]
  for (const img of images) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${cleanBase64(img.base64)}`, detail: 'high' }
    })
  }

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent }
      ]
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${model} error ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  const raw  = data.choices?.[0]?.message?.content
  if (!raw) throw new Error('OpenAI devolvió respuesta vacía')
  return safeParseJSON(raw)
}

async function callClaudeVision(
  systemPrompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const userContent: any[] = []
  for (const img of images) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: cleanBase64(img.base64) }
    })
  }
  userContent.push({ type: 'text', text: 'Extrae los datos del documento.' })

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: MAX_TOKENS_VISION,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude error ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  const raw  = data.content?.[0]?.text
  if (!raw) throw new Error('Claude devolvió respuesta vacía')
  return safeParseJSON(raw)
}

// Llama al mejor modelo disponible con visión
async function callVision(
  systemPrompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<any> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAIVision(systemPrompt, images, 'gpt-4o', MAX_TOKENS_VISION)
    } catch (e: any) {
      console.warn('[Vision] gpt-4o falló, fallback a gpt-4o-mini:', e.message)
      return await callOpenAIVision(systemPrompt, images, 'gpt-4o-mini', MAX_TOKENS_VISION)
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return await callClaudeVision(systemPrompt, images)
  }
  throw new Error('No hay API key de visión configurada (OPENAI_API_KEY o ANTHROPIC_API_KEY)')
}

// ── Stitching visual (anclar cabecera) ────────────────────────────────────────
/**
 * Corta la imagen por altura.
 * - La primera rebanada siempre incluye la cabecera completa (primeras MAX_SLICE_H px).
 * - Cada rebanada siguiente recibe la franja de cabecera (HEADER_H px desde el top)
 *   pegada visualmente encima, para que el modelo vea los títulos de columna en TODAS.
 */
async function sliceWithHeader(
  base64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }[]> {
  const clean = cleanBase64(base64)

  try {
    const buf      = Buffer.from(clean, 'base64')
    const meta     = await sharp(buf).metadata()
    const h        = meta.height ?? 1000
    const w        = meta.width  ?? 800

    // Imagen corta: la devolvemos tal cual
    if (h <= MAX_SLICE_H) {
      return [{ base64: clean, mimeType }]
    }

    // Extraemos la franja de cabecera una sola vez — con nitidez mejorada
    const headerBuf = await sharp(buf)
      .extract({ left: 0, top: 0, width: w, height: Math.min(HEADER_H, h) })
      .sharpen({ sigma: 1.2 })   // mejora la nitidez del texto
      .toBuffer()

    const slices: { base64: string; mimeType: string }[] = []

    // La primera rebanada COMIENZA desde HEADER_H para no duplicar la cabecera
    // cuando se pega abajo de la franja anclada (excepto si la imagen es corta).
    // Lógica: siempre generamos rebanadas de SOLO el cuerpo de la tabla,
    // y luego pegamos la cabecera encima. Así el modelo siempre ve:
    //   [cabecera visual] + [chunk de ~15 filas]
    let y = HEADER_H  // empezamos justo después de la cabecera
    while (y < h) {
      const sliceH     = Math.min(MAX_SLICE_H, h - y)
      if (sliceH <= 0) break

      const contentBuf = await sharp(buf)
        .extract({ left: 0, top: y, width: w, height: sliceH })
        .sharpen({ sigma: 1.2 })
        .toBuffer()

      // Pegar cabecera arriba + contenido abajo
      const finalBuf = await sharp({
        create: {
          width:    w,
          height:   HEADER_H + sliceH,
          channels: 3 as const,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .composite([
          { input: headerBuf,  top: 0,       left: 0 },
          { input: contentBuf, top: HEADER_H, left: 0 }
        ])
        .jpeg({ quality: 92 })
        .toBuffer()

      slices.push({ base64: finalBuf.toString('base64'), mimeType: 'image/jpeg' })

      y += sliceH
    }

    // Si la imagen es tan corta que no hay nada después de la cabecera
    // (y===HEADER_H y slices está vacío), enviamos la imagen completa original.
    if (slices.length === 0) {
      slices.push({ base64: clean, mimeType })
    }

    console.log(`[Stitching] ${slices.length} rebanadas con cabecera anclada (${h}px total)`)
    return slices

  } catch (err) {
    console.error('[Stitching] Error con sharp, devolviendo imagen original:', err)
    return [{ base64: clean, mimeType }]
  }
}

// ── Extractor principal ───────────────────────────────────────────────────────

export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[],
  rucComprador: string | null = null
): Promise<ResultadoExtracionCompra> {
  if (imagenes.length === 0) throw new Error('No se enviaron imágenes')

  const advertencias: string[] = []

  // ── PASO 1: Preparar rebanadas con cabecera anclada ─────────────────────────
  console.log('[Extraccion] Preparando imágenes con stitching de cabecera...')
  const slicesAnidadas = await Promise.all(
    imagenes.map(img => sliceWithHeader(img.base64, img.mimeType))
  )
  const todasLasRebanadas = slicesAnidadas.flat()
  console.log(`[Extraccion] Total de rebanadas a procesar: ${todasLasRebanadas.length}`)

  // ── PASO 2: Extraer CABECERA del documento (primera imagen original) ─────────
  console.log('[Extraccion] Extrayendo cabecera del documento...')
  const promptCab = buildPromptCabecera(rucComprador)
  let cabeceraRaw: any = {}
  try {
    cabeceraRaw = await callVision(promptCab, [imagenes[0]])
  } catch (e: any) {
    advertencias.push(`No se pudo extraer cabecera: ${e.message}`)
  }

  const tipoDoc  = (cabeceraRaw.tipo_documento as string) ?? 'desconocido'
  const esFormal = ['factura', 'boleta'].includes(tipoDoc)
  const cabecera = {
    tipo_documento:      tipoDoc as ResultadoExtracionCompra['tipo_documento'],
    es_formal:           esFormal,
    ruc_emisor:          cabeceraRaw.ruc_emisor
                           ? String(cabeceraRaw.ruc_emisor).replace(/\D/g, '').slice(0, 11)
                           : null,
    razon_social_emisor: cabeceraRaw.razon_social_emisor?.trim() || null,
    numero_factura:      cabeceraRaw.numero_factura?.trim() || null,
    fecha_factura:       cabeceraRaw.fecha_factura || null,
    total_bruto:         toNumber(cabeceraRaw.total_bruto),
    igv:                 toNumber(cabeceraRaw.igv),
    total_neto:          toNumber(cabeceraRaw.total_neto),
  }

  // ── PASO 3: Extraer ÍTEMS — una llamada por rebanada en paralelo ─────────────
  console.log('[Extraccion] Extrayendo ítems de cada rebanada...')
  const promptItems = buildPromptExtraccionCompleta()

  const resultadosPorRebanada = await Promise.all(
    todasLasRebanadas.map(async (rebanada, idx) => {
      try {
        const resultado = await callVision(promptItems, [rebanada])
        const filas = Array.isArray(resultado.items) ? resultado.items : []
        console.log(`[Extraccion] Rebanada ${idx + 1}: ${filas.length} ítem(s) detectado(s)`)
        return filas
      } catch (e: any) {
        const msg = `Error en rebanada ${idx + 1}: ${e.message}`
        console.error('[Extraccion]', msg)
        advertencias.push(msg)
        return []
      }
    })
  )

  // ── PASO 4: Consolidar y deduplicar ─────────────────────────────────────────
  const todasLasFilasCrudas: any[] = resultadosPorRebanada.flat()

  // Deduplicación: dos filas son iguales si tienen la misma descripción Y la misma cantidad
  const itemsVistos = new Set<string>()
  const filasUnicas: any[] = []
  for (const fila of todasLasFilasCrudas) {
    const desc = String(fila.descripcion ?? '').trim().toLowerCase()
    const cant = String(fila.cantidad ?? '').trim()
    if (!desc) continue  // ignorar filas sin descripción
    const firma = `${desc}|${cant}`
    if (!itemsVistos.has(firma)) {
      itemsVistos.add(firma)
      filasUnicas.push(fila)
    }
  }

  if (filasUnicas.length === 0) {
    advertencias.push('No se detectaron productos en las imágenes.')
  }

  // ── PASO 5: Normalizar campos ────────────────────────────────────────────────
  const items: ItemCompraExtraido[] = filasUnicas.map(fila => ({
    descripcion:            String(fila.descripcion ?? '').trim() || 'Producto sin nombre',
    cantidad:               toNumber(fila.cantidad),
    unidad:                 fila.unidad ? normalizarUnidad(String(fila.unidad)) : 'NIU',
    valor_unitario:         toNumber(fila.valor_unitario),
    precio_unitario:        toNumber(fila.precio_unitario),
    subtotal_linea:         null,
    total_linea:            null,
    precio_compra_unitario: toNumber(fila.precio_compra_unitario ?? fila.precio_unitario),
    subtotal:               toNumber(fila.subtotal ?? fila.importe ?? fila.total_linea),
  }))

  // Advertencia si no se detectó RUC en factura formal
  if (!cabecera.ruc_emisor && esFormal) {
    advertencias.push('No se detectó RUC del proveedor.')
  }

  return { ...cabecera, items, advertencias }
}
