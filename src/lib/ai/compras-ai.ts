import { normalizarUnidad } from '@/lib/constantes/unidades'
import {
  buildPromptOrquestadorCabecera,
  buildPromptExtractorFragmento,
  buildPromptEnsambladorMatematico
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

async function ocrImagen(base64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY ?? 'helloworld'
  try {
    const body = new URLSearchParams({
      base64Image: `data:${mimeType};base64,${base64}`,
      language: 'spa',
      isOverlayRequired: 'false',
      detectOrientation: 'true',
      scale: 'true',
      OCREngine: '2',
    })

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!res.ok) throw new Error(`OCR error status ${res.status}`)
    const data = await res.json()
    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] ?? 'Error procesando OCR')
    }

    return (data.ParsedResults ?? [])
      .map((r: any) => r.ParsedText)
      .join('\n')
      .trim()
  } catch (e) {
    console.error('[OCR fallback]', e)
    return ''
  }
}

async function llamarOpenAIVision(systemPrompt: string, imagenes: { base64: string; mimeType: string }[]): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const contentBlocks: any[] = [{ type: 'text', text: 'Analiza este documento.' }]
  imagenes.forEach((img) => {
    contentBlocks.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'high' },
    })
  })

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentBlocks },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI Vision error ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
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
  return JSON.parse(data.choices[0].message.content)
}

async function llamarClaudeVision(systemPrompt: string, imagenes: { base64: string; mimeType: string }[]): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const contentBlocks: any[] = []
  imagenes.forEach((img) => {
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } })
  })
  contentBlocks.push({ type: 'text', text: 'Analiza esta compra.' })

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  })

  if (!res.ok) throw new Error(`Claude Vision error ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.content[0].text)
}

async function llamarClaudeText(systemPrompt: string, userPrompt: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude Text error ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.content[0].text)
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
  return JSON.parse(data.choices[0].message.content)
}

// Envoltorio de Agente Genérico de Texto
async function llamarAgenteTexto(promptSistema: string, promptUsuario: string): Promise<any> {
  if (process.env.OPENAI_API_KEY) return llamarOpenAIText(promptSistema, promptUsuario)
  if (process.env.ANTHROPIC_API_KEY) return llamarClaudeText(promptSistema, promptUsuario)
  if (process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_CATALOG_API_KEY) return llamarDeepSeekText(promptSistema, promptUsuario)
  throw new Error('No hay proveedor de IA configurado para Texto')
}

// ── MOTOR MULTI-AGENTE ────────────────────────────────────────────────────────

/**
 * Fragmenta un texto largo en bloques de líneas (ej. 20 líneas por bloque con solapamiento opcional).
 */
function chunkText(text: string, linesPerChunk = 25): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const chunks: string[] = []
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push(lines.slice(i, i + linesPerChunk).join('\n'))
  }
  return chunks
}

export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[],
  rucComprador: string | null = null
): Promise<ResultadoExtracionCompra> {
  if (imagenes.length === 0) throw new Error('No se enviaron imágenes')

  // 1. Ejecutar OCR y Orquestador de Cabecera en paralelo para ganar tiempo
  console.log('[Multi-Agent] Iniciando OCR y Orquestador Cabecera...')
  const promptCabecera = buildPromptOrquestadorCabecera(rucComprador)
  
  const ocrPromise = Promise.all(imagenes.map(img => ocrImagen(img.base64, img.mimeType)))
  
  let cabeceraPromise: Promise<any>
  if (process.env.OPENAI_API_KEY) {
    cabeceraPromise = llamarOpenAIVision(promptCabecera, imagenes)
  } else if (process.env.ANTHROPIC_API_KEY) {
    cabeceraPromise = llamarClaudeVision(promptCabecera, imagenes)
  } else {
    // Fallback: usar DeepSeek con el resultado del OCR
    cabeceraPromise = ocrPromise.then(textos => llamarDeepSeekText(promptCabecera, textos.join('\n')))
  }

  const [textosOcr, cabeceraExtraida] = await Promise.all([ocrPromise, cabeceraPromise])
  const textoCompleto = textosOcr.join('\n\n--- PAGINA ---\n\n')

  // 2. Fragmentación del documento
  console.log('[Multi-Agent] Fragmentando texto OCR...')
  const bloques = chunkText(textoCompleto, 25)
  console.log(`[Multi-Agent] Creados ${bloques.length} bloques de trabajo.`)

  // 3. Agentes Extractores (Trabajadores de Fragmentos) en paralelo
  const promptExtractor = buildPromptExtractorFragmento()
  const trabajadoresPromises = bloques.map((bloque, i) => {
    console.log(`[Multi-Agent] Lanzando Agente Extractor para bloque ${i + 1}...`)
    const userPrompt = `Analiza el siguiente bloque de texto y extrae su tabla de productos:\n\n${bloque}`
    return llamarAgenteTexto(promptExtractor, userPrompt)
      .catch(e => {
        console.error(`[Multi-Agent] Error en trabajador ${i + 1}:`, e)
        return { items: [] } // Si un trabajador falla, devolvemos vacío para no romper todo
      })
  })

  const resultadosTrabajadores = await Promise.all(trabajadoresPromises)
  
  // 4. Agrupar resultados de trabajadores
  const itemsCrudosCombinados: any[] = []
  resultadosTrabajadores.forEach(res => {
    if (res && Array.isArray(res.items)) {
      itemsCrudosCombinados.push(...res.items)
    }
  })

  // 5. Agente Ensamblador Matemático
  console.log(`[Multi-Agent] Lanzando Agente Ensamblador con ${itemsCrudosCombinados.length} items crudos...`)
  const promptEnsamblador = buildPromptEnsambladorMatematico()
  const ensambladorUserPrompt = JSON.stringify({
    cabecera_detectada: cabeceraExtraida,
    items_crudos_extraidos_por_trabajadores: itemsCrudosCombinados
  }, null, 2)

  let datosEnsamblados = { items_ensamblados: [], analisis_global: {} }
  if (itemsCrudosCombinados.length > 0) {
    try {
      datosEnsamblados = await llamarAgenteTexto(promptEnsamblador, ensambladorUserPrompt)
    } catch (e) {
      console.error('[Multi-Agent] Error en Agente Ensamblador:', e)
    }
  } else {
    console.warn('[Multi-Agent] No se extrajeron items crudos. Omitiendo ensamblador.')
  }

  // ── NORMALIZACIÓN Y RESULTADO FINAL ───────────────────────────────────────
  
  const tipoDoc = cabeceraExtraida.tipo_documento ?? 'desconocido'
  const esFormal = ['factura', 'boleta'].includes(tipoDoc)

  const cabeceraFinal = {
    tipo_documento: tipoDoc,
    es_formal: esFormal,
    ruc_emisor: cabeceraExtraida.ruc_emisor ? String(cabeceraExtraida.ruc_emisor).replace(/\\D/g, '') : null,
    razon_social_emisor: cabeceraExtraida.razon_social_emisor?.trim() || null,
    numero_factura: cabeceraExtraida.numero_factura?.trim() || null,
    fecha_factura: cabeceraExtraida.fecha_factura || null,
    total_bruto: typeof cabeceraExtraida.total_bruto === 'number' ? cabeceraExtraida.total_bruto : null,
    igv: typeof cabeceraExtraida.igv === 'number' ? cabeceraExtraida.igv : null,
    total_neto: typeof cabeceraExtraida.total_neto === 'number' ? cabeceraExtraida.total_neto : null,
  }

  const itemsFinales: ItemCompraExtraido[] = (datosEnsamblados.items_ensamblados ?? []).map((item: any) => ({
    descripcion: item.descripcion?.trim() || 'Producto sin nombre',
    cantidad: typeof item.cantidad === 'number' && item.cantidad > 0 ? item.cantidad : null,
    unidad: item.unidad ? normalizarUnidad(item.unidad) : 'NIU',
    valor_unitario: null, // Estos ya fueron reconciliados por el ensamblador
    precio_unitario: null,
    subtotal_linea: null,
    total_linea: null,
    precio_compra_unitario: typeof item.precio_compra_unitario === 'number' ? item.precio_compra_unitario : null,
    subtotal: typeof item.subtotal === 'number' ? item.subtotal : null,
  }))

  const advertencias: string[] = []
  if (!cabeceraFinal.ruc_emisor && esFormal) {
    advertencias.push('No se detectó RUC del proveedor (o fue confundido con el RUC del cliente).')
  }
  if ((datosEnsamblados.analisis_global as any)?.advertencia_general) {
    advertencias.push((datosEnsamblados.analisis_global as any).advertencia_general)
  }

  return {
    ...cabeceraFinal,
    items: itemsFinales,
    advertencias,
  }
}
