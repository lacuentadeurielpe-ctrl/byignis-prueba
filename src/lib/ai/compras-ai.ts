import { normalizarUnidad } from '@/lib/constantes/unidades'
import { buildPromptVisionConsolidado, buildPromptParserTextoItems } from './prompts/compras-prompts'

const OPENAI_BASE = 'https://api.openai.com/v1'
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'

export interface ItemCompraExtraido {
  descripcion: string | null
  cantidad: number | null
  unidad: string | null // Código SUNAT o null
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
  total_bruto: number | null // base imponible
  igv: number | null
  total_neto: number | null // total
  items: ItemCompraExtraido[]
  advertencias: string[]
}

// OCR con ocr.space como fallback para DeepSeek
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

// Llamar a OpenAI GPT-4o-mini con imágenes (Paso 1)
async function llamarOpenAIVision(
  systemPrompt: string,
  imagenes: { base64: string; mimeType: string }[]
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const contentBlocks: any[] = [
    { type: 'text', text: 'Analiza este documento de compra.' }
  ]

  imagenes.forEach((img) => {
    contentBlocks.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: 'high',
      },
    })
  })

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentBlocks },
      ],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OpenAI Vision error ${res.status}: ${txt}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Respuesta de OpenAI vacía')
  return JSON.parse(content)
}

// Llamar a OpenAI GPT-4o-mini con texto plano (Paso 2)
async function llamarOpenAIText(
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OpenAI Text error ${res.status}: ${txt}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Respuesta de OpenAI vacía')
  return JSON.parse(content)
}

// Llamar a Claude con imágenes (Anthropic - Paso 1)
async function llamarClaudeVision(
  systemPrompt: string,
  imagenes: { base64: string; mimeType: string }[]
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const contentBlocks: any[] = []

  imagenes.forEach((img) => {
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.base64,
      },
    })
  })

  contentBlocks.push({
    type: 'text',
    text: 'Analiza esta compra y devuelve el JSON estructurado según tus instrucciones de sistema.',
  })

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: contentBlocks },
      ],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Claude Vision error ${res.status}: ${txt}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  if (!text) throw new Error('Respuesta de Claude vacía')
  return JSON.parse(text)
}

// Llamar a Claude con texto plano (Anthropic - Paso 2)
async function llamarClaudeText(
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Claude Text error ${res.status}: ${txt}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  if (!text) throw new Error('Respuesta de Claude vacía')
  return JSON.parse(text)
}

// Fallback: Llamar a DeepSeek con texto
async function llamarDeepSeekText(
  systemPrompt: string,
  textoOCR: string
): Promise<any> {
  const apiKey = process.env.DEEPSEEK_CATALOG_API_KEY ?? process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('No hay API key de DeepSeek configurada')

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textoOCR },
      ],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`DeepSeek error ${res.status}: ${txt}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Respuesta de DeepSeek vacía')
  return JSON.parse(content)
}

/**
 * Procesa imágenes de compra en dos pasos (híbrido visión-texto).
 * Paso 1: Visión de cabecera y transcripción horizontal de filas.
 * Paso 2: Análisis textual y estructuración de ítems.
 */
export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[],
  rucComprador: string | null = null
): Promise<ResultadoExtracionCompra> {
  if (imagenes.length === 0) {
    throw new Error('No se enviaron imágenes para procesar')
  }

  const openAiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const deepseekKey = process.env.DEEPSEEK_CATALOG_API_KEY ?? process.env.DEEPSEEK_API_KEY

  const promptVision = buildPromptVisionConsolidado(rucComprador)
  const promptParser = buildPromptParserTextoItems()

  let visionRaw: any = null

  // ── PASO 1: EXTRAER CABECERA Y TRANSCRIPCION DE FILAS (VISION / OCR) ───────
  if (openAiKey) {
    console.log('[ComprasAI] Paso 1 - OpenAI Vision (Cabecera + Renglones)')
    visionRaw = await llamarOpenAIVision(promptVision, imagenes)
  } else if (anthropicKey) {
    console.log('[ComprasAI] Paso 1 - Claude Vision (Cabecera + Renglones)')
    visionRaw = await llamarClaudeVision(promptVision, imagenes)
  } else if (deepseekKey) {
    console.log('[ComprasAI] Paso 1 - Fallback OCR + DeepSeek Chat (Cabecera + Renglones)')
    const ocrPromises = imagenes.map((img) => ocrImagen(img.base64, img.mimeType))
    const textos = await Promise.all(ocrPromises)
    const textoCompleto = textos.join('\n\n--- PAGINA ---\n\n')

    if (!textoCompleto.trim()) {
      throw new Error('El OCR no pudo extraer ningún texto de las imágenes')
    }
    visionRaw = await llamarDeepSeekText(promptVision, textoCompleto)
  } else {
    throw new Error('No se configuró ninguna API Key válida (OpenAI, Anthropic, o DeepSeek).')
  }

  // ── PASO 2: PARSEAR RENGLONES DE TABLA A JSON ESTRUCTURADO (TEXTO) ──────────
  const lineasTabla: string[] = visionRaw.lineas_tabla ?? []
  let itemsRaw: any = { items: [] }

  if (lineasTabla.length > 0) {
    const userPrompt = JSON.stringify({ lineas_tabla: lineasTabla })
    
    if (openAiKey) {
      console.log('[ComprasAI] Paso 2 - OpenAI Text (Estructurando items)')
      itemsRaw = await llamarOpenAIText(promptParser, userPrompt)
    } else if (anthropicKey) {
      console.log('[ComprasAI] Paso 2 - Claude Text (Estructurando items)')
      itemsRaw = await llamarClaudeText(promptParser, userPrompt)
    } else if (deepseekKey) {
      console.log('[ComprasAI] Paso 2 - DeepSeek Text (Estructurando items)')
      itemsRaw = await llamarDeepSeekText(promptParser, userPrompt)
    }
  } else {
    console.log('[ComprasAI] Paso 2 - Omitido, no se extrajeron líneas de tabla en el Paso 1.')
  }

  // ── NORMALIZACIÓN DE RESULTADOS DE CABECERA ────────────────────────────────
  const tipoDoc = visionRaw.tipo_documento ?? 'desconocido'
  const esFormal = ['factura', 'boleta'].includes(tipoDoc)

  const cabecera = {
    tipo_documento: tipoDoc,
    es_formal: esFormal,
    ruc_emisor: visionRaw.ruc_emisor ? String(visionRaw.ruc_emisor).replace(/\D/g, '') : null,
    razon_social_emisor: visionRaw.razon_social_emisor?.trim() || null,
    numero_factura: visionRaw.numero_factura?.trim() || null,
    fecha_factura: visionRaw.fecha_factura || null,
    total_bruto: typeof visionRaw.total_bruto === 'number' ? visionRaw.total_bruto : null,
    igv: typeof visionRaw.igv === 'number' ? visionRaw.igv : null,
    total_neto: typeof visionRaw.total_neto === 'number' ? visionRaw.total_neto : null,
  }

  // ── NORMALIZACIÓN DE ÍTEMS ─────────────────────────────────────────────────
  const items: ItemCompraExtraido[] = (itemsRaw.items ?? []).map((item: any) => {
    const unidadNormalizada = item.unidad ? normalizarUnidad(item.unidad) : 'NIU'
    return {
      descripcion: item.descripcion?.trim() || 'Producto sin nombre',
      cantidad: typeof item.cantidad === 'number' && item.cantidad > 0 ? item.cantidad : null,
      unidad: unidadNormalizada,
      valor_unitario: typeof item.valor_unitario === 'number' ? item.valor_unitario : null,
      precio_unitario: typeof item.precio_unitario === 'number' ? item.precio_unitario : null,
      subtotal_linea: typeof item.subtotal_linea === 'number' ? item.subtotal_linea : null,
      total_linea: typeof item.total_linea === 'number' ? item.total_linea : null,
      precio_compra_unitario: typeof item.precio_compra_unitario === 'number' ? item.precio_compra_unitario : null,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal : null,
    }
  })

  // ── VALIDACIÓN DE CABECERA ─────────────────────────────────────────────────
  const advertencias: string[] = []

  // Validar si faltan datos en la cabecera
  if (!cabecera.ruc_emisor && esFormal) {
    advertencias.push('No se detectó RUC del proveedor en la factura/boleta.')
  }
  if (!cabecera.numero_factura) {
    advertencias.push('No se detectó número de comprobante.')
  }
  if (!cabecera.fecha_factura) {
    advertencias.push('Fecha de emisión ausente, se usará la fecha de hoy.')
  }

  return {
    ...cabecera,
    items,
    advertencias,
  }
}
