import { normalizarUnidad } from '@/lib/constantes/unidades'
import sharp from 'sharp'
import {
  buildPromptOrquestadorCabecera,
  buildPromptLectorCabezal,
  buildPromptExtractorLiteral,
  buildPromptDetectiveColumnas
} from './prompts/compras-prompts'

const OPENAI_BASE = 'https://api.openai.com/v1'
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'

export interface ItemCompraExtraido {
  descripcion: string | null
  cantidad: number | null
  unidad: string | null
  valor_unitario: number | null
  precio_unitario: number | null
  subtotal_linea: number | null
  total_linea: number | null
  precio_compra_unitario: number | null
  subtotal: number | null
}

export interface ResultadoExtracionCompra {
  tipo_documento: 'factura' | 'boleta' | 'nota_venta' | 'ticket' | 'desconocido'
  es_formal: boolean
  ruc_emisor: string | null
  razon_social_emisor: string | null
  numero_factura: string | null
  fecha_factura: string | null
  total_bruto: number | null
  igv: number | null
  total_neto: number | null
  items: ItemCompraExtraido[]
  advertencias: string[]
}

// ── UTILIDADES DE API ─────────────────────────────────────────────────────────

function cleanBase64(base64: string): string {
  return base64.replace(/^data:[^;]+;base64,/, '')
}

function safeParseJSON(text: string): any {
  try {
    return JSON.parse(text)
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (match) {
      try { return JSON.parse(match[1]) } catch (e2) {}
    }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(text.substring(start, end + 1)) } catch (e3) {}
    }
    throw new Error('No se pudo parsear el JSON de la IA: ' + text)
  }
}

async function llamarOpenAIVision(systemPrompt: string, imagenes: { base64: string; mimeType: string }[]): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const contentBlocks: any[] = [{ type: 'text', text: 'Analiza este documento.' }]
  imagenes.forEach((img) => {
    const cleanB64 = cleanBase64(img.base64)
    contentBlocks.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${cleanB64}`, detail: 'high' },
    })
  })

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentBlocks },
      ],
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`OpenAI Vision error ${res.status}: ${errorText}`)
  }
  const data = await res.json()
  return safeParseJSON(data.choices[0].message.content)
}

async function llamarOpenAIText(systemPrompt: string, userPrompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI Text error ${res.status}`)
  const data = await res.json()
  return safeParseJSON(data.choices[0].message.content)
}

async function llamarClaudeVision(systemPrompt: string, imagenes: { base64: string; mimeType: string }[]): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const contentBlocks: any[] = []
  imagenes.forEach((img) => {
    const cleanB64 = cleanBase64(img.base64)
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: cleanB64 } })
  })
  contentBlocks.push({ type: 'text', text: 'Analiza esta imagen con extrema precisión.' })

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Claude Vision error ${res.status}: ${errorText}`)
  }
  const data = await res.json()
  return safeParseJSON(data.content[0].text)
}

async function llamarClaudeText(systemPrompt: string, userPrompt: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude Text error ${res.status}`)
  const data = await res.json()
  return safeParseJSON(data.content[0].text)
}

async function llamarDeepSeekText(systemPrompt: string, userPrompt: string): Promise<any> {
  const apiKey = process.env.DEEPSEEK_CATALOG_API_KEY ?? process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek error ${res.status}`)
  const data = await res.json()
  return safeParseJSON(data.choices[0].message.content)
}

// ── REBANADOR VISUAL DE IMÁGENES ──────────────────────────────────────────────
/**
 * Extrae solo la franja delgada de títulos de columnas (ej: "Cant | Descripción | Precio...")
 * Pide a la IA que identifique hasta qué píxel de altura termina esa fila de títulos.
 */
async function extraerFranjaHeader(
  imgBuffer: Buffer,
  width: number
): Promise<{ franja: Buffer; alturaFranja: number }> {
  // Tomamos solo el primer 25% de la imagen para buscar los títulos (máx 400px)
  const { data: metadata2 } = await sharp(imgBuffer).metadata().then(m => ({ data: m }))
  const totalHeight = metadata2.height || 1000
  const scanHeight = Math.min(Math.round(totalHeight * 0.25), 400)

  const scanBuffer = await sharp(imgBuffer)
    .extract({ left: 0, top: 0, width, height: scanHeight })
    .toBuffer()
  const scanB64 = scanBuffer.toString('base64')

  // Prompt para detectar únicamente la fila de títulos
  const promptDetectorHeader = `Eres un analizador de diseño de tablas.
Se te envía el fragmento SUPERIOR de una factura. Tu único objetivo es determinar en qué píxel (de altura, contando desde arriba) termina la FILA DE TÍTULOS de la tabla de productos (la fila que dice cosas como "Cant.", "Descripción", "Precio", "Total", etc.).
Ignora la cabecera del negocio (logo, dirección, número de factura). Solo enfocate en la fila de títulos de la tabla.
Responde SOLO con JSON: { "titulo_fila_fin_px": <número entero de píxeles> }`

  let finPx = 120 // fallback por defecto
  try {
    let respHeader: any
    if (process.env.OPENAI_API_KEY) {
      respHeader = await llamarOpenAIVision(promptDetectorHeader, [{ base64: scanB64, mimeType: 'image/png' }])
    } else if (process.env.ANTHROPIC_API_KEY) {
      respHeader = await llamarClaudeVision(promptDetectorHeader, [{ base64: scanB64, mimeType: 'image/png' }])
    }
    if (respHeader?.titulo_fila_fin_px && typeof respHeader.titulo_fila_fin_px === 'number') {
      finPx = Math.min(Math.max(respHeader.titulo_fila_fin_px, 40), scanHeight)
    }
  } catch (e) {
    console.warn('[Sharp] No se pudo detectar fin del header, usando fallback de 120px', e)
  }

  const franja = await sharp(imgBuffer)
    .extract({ left: 0, top: 0, width, height: finPx })
    .toBuffer()

  console.log(`[Sharp] Franja de títulos extraida: ${finPx}px de alto.`)
  return { franja, alturaFranja: finPx }
}

/**
 * Rebana la imagen solo por altura y pega la franja de títulos a todas las rebanadas que no sean la primera.
 */
async function sliceImage(
  base64: string,
  mimeType: string,
  franjaBuffer: Buffer | null,
  alturaFranja: number
): Promise<{ base64: string; mimeType: string }[]> {
  const cleanB64 = cleanBase64(base64)
  try {
    const imgBuffer = Buffer.from(cleanB64, 'base64')
    const metadata = await sharp(imgBuffer).metadata()
    const height = metadata.height || 1000
    const width = metadata.width || 1000

    const MAX_SLICE_HEIGHT = 900
    const OVERLAP = 100

    if (height <= MAX_SLICE_HEIGHT) {
      return [{ base64: cleanB64, mimeType }]
    }

    const slices: { base64: string; mimeType: string }[] = []
    let sliceIndex = 0
    for (let y = 0; y < height; y += (MAX_SLICE_HEIGHT - OVERLAP)) {
      let h = MAX_SLICE_HEIGHT
      if (y + h > height) h = height - y

      const rawSlice = await sharp(imgBuffer)
        .extract({ left: 0, top: y, width, height: h })
        .toBuffer()

      if (sliceIndex === 0 || !franjaBuffer) {
        // Primera rebanada: ya tiene sus títulos originales en la parte superior
        slices.push({ base64: cleanBase64(rawSlice.toString('base64')), mimeType })
      } else {
        // Rebanadas siguientes: pegar SOLO la franja delgada de títulos arriba
        const totalH = alturaFranja + h
        const compositeBuffer = await sharp({
          create: { width, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
        })
          .composite([
            { input: franjaBuffer, top: 0, left: 0 },
            { input: rawSlice, top: alturaFranja, left: 0 },
          ])
          .png()
          .toBuffer()
        slices.push({ base64: cleanBase64(compositeBuffer.toString('base64')), mimeType: 'image/png' })
      }

      sliceIndex++
      if (y + h >= height) break
    }
    return slices
  } catch (error) {
    console.error('[Sharp] Error rebanando imagen, fallback a imagen original', error)
    return [{ base64: cleanB64, mimeType }]
  }
}

function parseLocalCurrency(val: string): number {
  let clean = val.replace(/[^\d.,-]/g, '')
  const lastComma = clean.lastIndexOf(',')
  const lastPeriod = clean.lastIndexOf('.')

  if (lastComma === -1 && lastPeriod === -1) return parseFloat(clean) || 0

  if (lastComma !== -1 && lastPeriod !== -1) {
    if (lastPeriod > lastComma) clean = clean.replace(/,/g, '')
    else clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (lastComma !== -1) {
    if (clean.length - lastComma - 1 === 2) clean = clean.replace(',', '.')
    else clean = clean.replace(/,/g, '')
  } else if (lastPeriod !== -1) {
    if (clean.length - lastPeriod - 1 !== 2) clean = clean.replace(/\./g, '')
  }
  return parseFloat(clean) || 0
}

export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[],
  rucComprador: string | null = null
): Promise<ResultadoExtracionCompra> {
  if (imagenes.length === 0) throw new Error('No se enviaron imágenes')

  // ── 0. DETECTAR Y EXTRAER LA FRANJA DE TÍTULOS (Thin Header) ──────────────
  console.log('[Multi-Agent] Detectando franja de títulos de tabla...')
  let franjaBuffer: Buffer | null = null
  let alturaFranja = 120

  try {
    const firstImgBuffer = Buffer.from(cleanBase64(imagenes[0].base64), 'base64')
    const firstMeta = await sharp(firstImgBuffer).metadata()
    const firstWidth = firstMeta.width || 1000
    const resultado = await extraerFranjaHeader(firstImgBuffer, firstWidth)
    franjaBuffer = resultado.franja
    alturaFranja = resultado.alturaFranja
  } catch (e) {
    console.error('[Sharp] Error extrayendo franja, se procederá sin stitching', e)
  }

  // Rebanar imágenes largas e inyectar la franja de títulos delgada
  console.log('[Multi-Agent] Rebanando imágenes e inyectando franja de títulos...')
  const rebanadasPromises = imagenes.map(img =>
    sliceImage(img.base64, img.mimeType, franjaBuffer, alturaFranja)
  )
  const rebanadasArrays = await Promise.all(rebanadasPromises)
  const imageSlices = rebanadasArrays.flat()
  console.log(`[Multi-Agent] Se generaron ${imageSlices.length} rebanadas visuales.`)

  // ── 1. ORQUESTADOR: Cabecera ──────────────────────────────────────────────
  console.log('[Multi-Agent] Extrayendo metadatos de cabecera...')
  const promptCabecera = buildPromptOrquestadorCabecera(rucComprador)
  
  let cabeceraExtraida: any = {}
  if (process.env.OPENAI_API_KEY) {
    cabeceraExtraida = await llamarOpenAIVision(promptCabecera, imagenes) // pasamos originales para cabecera global
  } else if (process.env.ANTHROPIC_API_KEY) {
    cabeceraExtraida = await llamarClaudeVision(promptCabecera, imagenes)
  }

  const tipoDoc = cabeceraExtraida.tipo_documento ?? 'desconocido'
  const esFormal = ['factura', 'boleta'].includes(tipoDoc)
  const cabeceraFinal = {
    tipo_documento: tipoDoc,
    es_formal: esFormal,
    ruc_emisor: cabeceraExtraida.ruc_emisor ? String(cabeceraExtraida.ruc_emisor).replace(/\D/g, '') : null,
    razon_social_emisor: cabeceraExtraida.razon_social_emisor?.trim() || null,
    numero_factura: cabeceraExtraida.numero_factura?.trim() || null,
    fecha_factura: cabeceraExtraida.fecha_factura || null,
    total_bruto: typeof cabeceraExtraida.total_bruto === 'number' ? cabeceraExtraida.total_bruto : null,
    igv: typeof cabeceraExtraida.igv === 'number' ? cabeceraExtraida.igv : null,
    total_neto: typeof cabeceraExtraida.total_neto === 'number' ? cabeceraExtraida.total_neto : null,
  }

  // ── 2. LECTOR DE CABEZAL MAESTRO ──────────────────────────────────────────
  console.log('[Multi-Agent] Leyendo cabeceras maestras visuales de la tabla...')
  const promptLectorCabezal = buildPromptLectorCabezal()
  let cabezal: any = { encabezados_maestros: [] }
  try {
    if (process.env.OPENAI_API_KEY) {
      cabezal = await llamarOpenAIVision(promptLectorCabezal, [imageSlices[0]])
    } else if (process.env.ANTHROPIC_API_KEY) {
      cabezal = await llamarClaudeVision(promptLectorCabezal, [imageSlices[0]])
    }
  } catch (e) {
    console.error('[Multi-Agent] Error en Lector Cabezal:', e)
  }

  const encabezadosMaestros = Array.isArray(cabezal.encabezados_maestros) && cabezal.encabezados_maestros.length > 0 
    ? cabezal.encabezados_maestros 
    : ['codigo', 'descripcion', 'cantidad', 'precio_unitario', 'total']
    
  console.log('[Multi-Agent] Encabezados Maestros Detectados:', encabezadosMaestros)

  // ── 3. TIPEADORES: Extracción Literal por Rebanadas Visuales ───────────────
  const promptTipeador = buildPromptExtractorLiteral(encabezadosMaestros)
  const advertencias: string[] = []
  
  const trabajadoresPromises = imageSlices.map(async (slice, i) => {
    console.log(`[Multi-Agent] Lanzando Tipeador Visual para rebanada ${i + 1}...`)
    try {
      if (process.env.OPENAI_API_KEY) {
        return await llamarOpenAIVision(promptTipeador, [slice])
      }
      if (process.env.ANTHROPIC_API_KEY) {
        return await llamarClaudeVision(promptTipeador, [slice])
      }
      return { filas_literales: [] }
    } catch (e: any) {
      console.error(`[Multi-Agent] Error en Tipeador rebanada ${i + 1}:`, e)
      advertencias.push(`Error en extracción de bloque visual ${i + 1}: ${e.message}`)
      return { filas_literales: [] }
    }
  })

  const resultadosTrabajadores = await Promise.all(trabajadoresPromises)
  
  const matrizGlobalCruda: Record<string, any>[] = []
  resultadosTrabajadores.forEach(res => {
    if (res && Array.isArray(res.filas_literales)) {
      matrizGlobalCruda.push(...res.filas_literales)
    }
  })

  // ── 3.5 DEDUPLICACIÓN POR SOLAPAMIENTO ───────────────────────────────────
  // Como los cortes tienen superposición (overlap), un producto puede salir 2 veces.
  const matrizGlobal: Record<string, any>[] = []
  const firmasVistas = new Set<string>()

  matrizGlobalCruda.forEach(fila => {
    const firma = JSON.stringify(fila)
    if (!firmasVistas.has(firma)) {
      firmasVistas.add(firma)
      matrizGlobal.push(fila)
    }
  })

  if (matrizGlobal.length === 0) {
    advertencias.push('No se detectó ningún producto o todas las APIs fallaron.')
    return { ...cabeceraFinal, items: [], advertencias }
  }

  // ── 4. LÓGICA MATEMÁTICA: Sumas Verticales de Código ──────────────────────
  const sumasColumnas: Record<string, number> = {}
  matrizGlobal.forEach(fila => {
    Object.keys(fila).forEach(key => {
      const val = fila[key]
      if (typeof val === 'number') {
        sumasColumnas[key] = (sumasColumnas[key] || 0) + val
      } else if (typeof val === 'string') {
        const parsed = parseLocalCurrency(val)
        if (!isNaN(parsed) && parsed !== 0) {
          sumasColumnas[key] = (sumasColumnas[key] || 0) + parsed
          fila[key] = parsed // Normalizamos la matriz en sitio
        }
      }
    })
  })

  const filaMuestra = matrizGlobal.find(fila => {
    const values = Object.values(fila)
    return values.filter(v => typeof v === 'number').length >= 2
  }) || matrizGlobal[0]

  // ── 5. DETECTIVE: Validación Horizontal y Vertical ────────────────────────
  console.log('[Multi-Agent] Lanzando Agente Detective Matemático...')
  const promptDetective = buildPromptDetectiveColumnas()
  const detectiveUserPrompt = JSON.stringify({
    fila_muestra: filaMuestra,
    sumas_columnas: sumasColumnas,
    total_neto_factura: cabeceraFinal.total_neto ?? cabeceraFinal.total_bruto ?? null
  }, null, 2)

  let veredicto: any = { veredicto_mapeo: {} }
  try {
    if (process.env.OPENAI_API_KEY) {
      veredicto = await llamarOpenAIText(promptDetective, detectiveUserPrompt)
    } else if (process.env.ANTHROPIC_API_KEY) {
      veredicto = await llamarClaudeText(promptDetective, detectiveUserPrompt)
    } else {
      veredicto = await llamarDeepSeekText(promptDetective, detectiveUserPrompt)
    }
    console.log('[Multi-Agent] Conclusión del Detective:', veredicto.conclusiones_logicas)
  } catch (e) {
    console.error('[Multi-Agent] Error en Detective:', e)
  }

  // ── 6. MAPEO FINAL Y RESULTADOS ───────────────────────────────────────────
  const mapa = veredicto.veredicto_mapeo || {}
  
  const itemsFinales: ItemCompraExtraido[] = matrizGlobal.map(fila => {
    return {
      descripcion: mapa.llave_literal_descripcion && fila[mapa.llave_literal_descripcion] 
        ? String(fila[mapa.llave_literal_descripcion]) 
        : 'Producto sin nombre',
      cantidad: mapa.llave_literal_cantidad && typeof fila[mapa.llave_literal_cantidad] === 'number' 
        ? fila[mapa.llave_literal_cantidad] 
        : null,
      unidad: mapa.llave_literal_unidad && fila[mapa.llave_literal_unidad] 
        ? normalizarUnidad(String(fila[mapa.llave_literal_unidad])) 
        : 'NIU',
      valor_unitario: null, 
      precio_unitario: null,
      subtotal_linea: null,
      total_linea: null,
      precio_compra_unitario: mapa.llave_literal_precio_compra_unitario && typeof fila[mapa.llave_literal_precio_compra_unitario] === 'number'
        ? fila[mapa.llave_literal_precio_compra_unitario]
        : null,
      subtotal: mapa.llave_literal_subtotal && typeof fila[mapa.llave_literal_subtotal] === 'number'
        ? fila[mapa.llave_literal_subtotal]
        : null,
    }
  })

  if (!cabeceraFinal.ruc_emisor && esFormal) {
    advertencias.push('No se detectó RUC del proveedor (o fue confundido con el RUC del cliente).')
  }

  return {
    ...cabeceraFinal,
    items: itemsFinales,
    advertencias,
  }
}
