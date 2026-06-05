import { UNIDADES_SUNAT, normalizarUnidad } from '@/lib/constantes/unidades'

const OPENAI_BASE = 'https://api.openai.com/v1'
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'

export interface ItemCompraExtraido {
  descripcion: string | null
  cantidad: number | null
  unidad: string | null // Código SUNAT o null
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

const UNIDADES_PARA_PROMPT = UNIDADES_SUNAT
  .map((u) => `${u.code} (${u.label})`)
  .join(', ')

// Prompts para los Agentes
const SYSTEM_PROMPT_CABECERA = `Eres un agente contable experto en ferreterías peruanas.
Tu objetivo es analizar la/s imagen/es de una compra (factura, boleta, nota de venta) y clasificar el tipo de documento y extraer los metadatos de cabecera.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "tipo_documento": "factura" | "boleta" | "nota_venta" | "ticket" | "desconocido",
  "ruc_emisor": "RUC de 11 dígitos del proveedor o null si no existe",
  "razon_social_emisor": "nombre o razón social del proveedor o null",
  "numero_factura": "número de serie-correlativo del comprobante (ej: F001-12345, B003-999) o null",
  "fecha_factura": "fecha en formato YYYY-MM-DD o null",
  "total_bruto": número base imponible (subtotal antes de IGV si es factura formal, de lo contrario total) o null,
  "igv": número de IGV extraído o calculado (18% si es factura formal, de lo contrario 0) o null,
  "total_neto": número del monto total a pagar o null
}

Reglas:
1. "factura" y "boleta" son formales. "nota_venta" y "ticket" son informales.
2. Si es una Factura, extrae o calcula el total_bruto (Base Imponible) e igv (18% de total_bruto).
3. Si es Boleta o Nota de Venta, total_neto es igual a total_bruto, y el igv debe ser 0.
4. Responde en soles peruanos (S/).`

const SYSTEM_PROMPT_ITEMS = `Eres un agente de inventario experto en ferreterías peruanas.
Tu objetivo es analizar la/s imagen/es de la compra y extraer la lista completa de ítems comprados.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "items": [
    {
      "descripcion": "nombre o descripción del producto comprado",
      "cantidad": número de unidades compradas (entero o decimal),
      "unidad": "código SUNAT de la unidad de medida (ver lista) o null",
      "precio_compra_unitario": número del costo unitario de compra o null,
      "subtotal": número cantidad * precio_compra_unitario o null
    }
  ]
}

UNIDADES VÁLIDAS (Usa EXACTAMENTE el código SUNAT):
${UNIDADES_PARA_PROMPT}

Reglas:
1. Extrae todos los ítems legibles del documento.
2. Mapea la unidad al código SUNAT. Por ejemplo: "unidad", "und", "pza", "tubo", "balde" -> NIU; "caja" -> BX; "bolsa" -> BG; "rollo" -> ROL; "metro" -> MTR; "kilo", "kg" -> KGM.
3. Si no viene el precio unitario pero sí cantidad y subtotal, calcúlalo: subtotal / cantidad.`

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

// Llamar a OpenAI GPT-4o-mini con imágenes
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

// Llamar a Claude con imágenes (Anthropic)
async function llamarClaudeVision(
  systemPrompt: string,
  imagenes: { base64: string; mimeType: string }[]
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const contentBlocks: any[] = []

  imagenes.forEach((img) => {
    // Anthropic requiere extraer la base64 sin el prefijo data:
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

// Fallback: Llamar a DeepSeek con texto extraído de OCR
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
        { role: 'user', content: `Analiza esta transcripción de compra obtenida por OCR:\n\n"${textoOCR}"` },
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
 * Procesa imágenes de compra en paralelo utilizando el proveedor de IA disponible.
 */
export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[]
): Promise<ResultadoExtracionCompra> {
  if (imagenes.length === 0) {
    throw new Error('No se enviaron imágenes para procesar')
  }

  const openAiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const deepseekKey = process.env.DEEPSEEK_CATALOG_API_KEY ?? process.env.DEEPSEEK_API_KEY

  let cabeceraRaw: any = null
  let itemsRaw: any = null

  if (openAiKey) {
    console.log('[ComprasAI] Utilizando OpenAI GPT-4o-mini Vision')
    const [c, i] = await Promise.all([
      llamarOpenAIVision(SYSTEM_PROMPT_CABECERA, imagenes),
      llamarOpenAIVision(SYSTEM_PROMPT_ITEMS, imagenes),
    ])
    cabeceraRaw = c
    itemsRaw = i
  } else if (anthropicKey) {
    console.log('[ComprasAI] Utilizando Anthropic Claude Vision')
    const [c, i] = await Promise.all([
      llamarClaudeVision(SYSTEM_PROMPT_CABECERA, imagenes),
      llamarClaudeVision(SYSTEM_PROMPT_ITEMS, imagenes),
    ])
    cabeceraRaw = c
    itemsRaw = i
  } else if (deepseekKey) {
    console.log('[ComprasAI] Utilizando fallback OCR + DeepSeek Chat')
    // Ejecutar OCR en paralelo para todas las imágenes
    const ocrPromises = imagenes.map((img) => ocrImagen(img.base64, img.mimeType))
    const textos = await Promise.all(ocrPromises)
    const textoCompleto = textos.join('\n\n--- PAGINA ---\n\n')

    if (!textoCompleto.trim()) {
      throw new Error('El OCR no pudo extraer ningún texto de las imágenes')
    }

    const [c, i] = await Promise.all([
      llamarDeepSeekText(SYSTEM_PROMPT_CABECERA, textoCompleto),
      llamarDeepSeekText(SYSTEM_PROMPT_ITEMS, textoCompleto),
    ])
    cabeceraRaw = c
    itemsRaw = i
  } else {
    throw new Error('No se configuró ninguna API Key válida (OpenAI, Anthropic, o DeepSeek).')
  }

  // ── Normalización de Resultados de Cabecera ────────────────────────────────
  const tipoDoc = cabeceraRaw.tipo_documento ?? 'desconocido'
  const esFormal = ['factura', 'boleta'].includes(tipoDoc)

  const cabecera = {
    tipo_documento: tipoDoc,
    es_formal: esFormal,
    ruc_emisor: cabeceraRaw.ruc_emisor ? String(cabeceraRaw.ruc_emisor).replace(/\D/g, '') : null,
    razon_social_emisor: cabeceraRaw.razon_social_emisor?.trim() || null,
    numero_factura: cabeceraRaw.numero_factura?.trim() || null,
    fecha_factura: cabeceraRaw.fecha_factura || null,
    total_bruto: typeof cabeceraRaw.total_bruto === 'number' ? cabeceraRaw.total_bruto : null,
    igv: typeof cabeceraRaw.igv === 'number' ? cabeceraRaw.igv : null,
    total_neto: typeof cabeceraRaw.total_neto === 'number' ? cabeceraRaw.total_neto : null,
  }

  // ── Normalización de Ítems ─────────────────────────────────────────────────
  const items: ItemCompraExtraido[] = (itemsRaw.items ?? []).map((item: any) => {
    const unidadNormalizada = item.unidad ? normalizarUnidad(item.unidad) : 'NIU'
    return {
      descripcion: item.descripcion?.trim() || 'Producto sin nombre',
      cantidad: typeof item.cantidad === 'number' && item.cantidad > 0 ? item.cantidad : 1,
      unidad: unidadNormalizada,
      precio_compra_unitario: typeof item.precio_compra_unitario === 'number' ? item.precio_compra_unitario : 0,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal : 0,
    }
  })

  // ── Validación Cruzada e Alertas ───────────────────────────────────────────
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

  // Validar precios e importes
  let sumaSubtotales = 0
  let itemsSinPrecio = 0

  items.forEach((item) => {
    if (item.precio_compra_unitario === 0 || item.subtotal === 0) {
      itemsSinPrecio++
    }
    sumaSubtotales += item.subtotal || 0
  })

  if (itemsSinPrecio > 0) {
    advertencias.push(`Detectamos ${itemsSinPrecio} ítems sin precio de compra. Deberás completarlos manualmente.`)
  }

  if (cabecera.total_neto && sumaSubtotales > 0) {
    const diferencia = Math.abs(cabecera.total_neto - sumaSubtotales)
    if (diferencia > 0.5) {
      advertencias.push(
        `Discrepancia en importes: El total extraído es S/. ${cabecera.total_neto.toFixed(2)}, pero la suma de los ítems es S/. ${sumaSubtotales.toFixed(2)}.`
      )
    }
  }

  return {
    ...cabecera,
    items,
    advertencias,
  }
}
