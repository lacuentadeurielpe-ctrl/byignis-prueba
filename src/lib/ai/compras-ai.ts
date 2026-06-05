/**
 * compras-ai.ts — Extracción de Compras (v4 — Mindee OCR API)
 *
 * Arquitectura:
 *   1. Integración directa con Mindee API (modelo InvoiceV4).
 *   2. Reemplaza por completo el sistema multi-agente / LLM.
 *   3. No se requiere cortar la imagen ni usar prompts frágiles.
 */

import { normalizarUnidad } from '@/lib/constantes/unidades'

import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Interfaces públicas (mantienen compatibilidad 100%) ─────────────
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

export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[],
  rucComprador?: string | null
): Promise<ResultadoExtracionCompra> {
  const advertencias: string[] = []

  if (imagenes.length === 0) {
    throw new Error('No se enviaron imágenes para analizar.')
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error('Falta configurar la llave GOOGLE_GENERATIVE_AI_API_KEY en las variables de entorno.')
  }

  console.log('[Gemini] Iniciando extracción de factura con gemini-2.5-flash...')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  })

  const imageParts = imagenes.map(img => {
    const base64Data = img.base64.replace(/^data:[^;]+;base64,/, '')
    const mimeType = img.mimeType === 'application/pdf' ? 'application/pdf' : 
                     img.mimeType.includes('png') ? 'image/png' : 'image/jpeg'
    
    return {
      inlineData: {
        data: base64Data,
        mimeType
      }
    }
  })

  const prompt = `
    Eres un experto contable procesando facturas y boletas en Perú.
    Extrae la siguiente información de las imágenes proporcionadas y devuélvela ESTRICTAMENTE en formato JSON usando esta estructura exacta (si no encuentras un valor, pon null, para números usa floats):

    {
      "ruc_proveedor": "El número de RUC de 11 dígitos del proveedor que emite el documento",
      "razon_social": "El nombre o razón social del proveedor",
      "numero_documento": "El número de serie y correlativo (ej. F001-12345 o B001-987)",
      "fecha_emision": "La fecha de emisión en formato YYYY-MM-DD",
      "es_formal": true si detectas un RUC válido de 11 dígitos y parece una Factura/Boleta formal, false si es una nota de venta sin RUC,
      "total_bruto": el valor de venta total (antes de impuestos) si está especificado explícitamente, sino null,
      "igv": el monto del impuesto IGV si está especificado,
      "total_neto": el importe total final a pagar (incluyendo impuestos),
      "productos": [
        {
          "descripcion": "Nombre detallado del producto o servicio",
          "cantidad": cantidad numérica,
          "precio_unitario": el precio de compra unitario,
          "subtotal": el precio total por esa línea (cantidad * precio_unitario)
        }
      ]
    }

    Reglas adicionales:
    - Asegúrate de limpiar los números (remueve símbolos de moneda como S/ o comas de miles, solo deja el punto decimal).
    - El RUC de nuestra empresa (comprador) es ${rucComprador || 'desconocido'}, así que el ruc_proveedor DEBE SER DIFERENTE a este.
    - Para los productos, extrae TODAS las líneas de la tabla de detalle. Si hay muchas líneas, extráelas todas. No inventes datos.
  `

  let jsonResult: any = null

  try {
    const result = await model.generateContent([prompt, ...imageParts])
    const textResponse = result.response.text()
    const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim()
    jsonResult = JSON.parse(cleanJson)
  } catch (error: any) {
    console.error('[Gemini] Error al comunicarse con Gemini:', error)
    throw new Error('Error al analizar la imagen con IA: ' + error.message)
  }

  let rucEmisor = jsonResult.ruc_proveedor
  if (rucEmisor && typeof rucEmisor === 'string') {
    const digits = rucEmisor.replace(/\D/g, '')
    rucEmisor = digits.length === 11 ? digits : rucEmisor
  }

  const esFormal = Boolean(jsonResult.es_formal && rucEmisor)

  const items: ItemCompraExtraido[] = (jsonResult.productos || []).map((p: any) => ({
    descripcion: p.descripcion ? String(p.descripcion).trim() : 'Producto sin nombre',
    cantidad: typeof p.cantidad === 'number' ? p.cantidad : parseFloat(p.cantidad) || null,
    unidad: 'NIU',
    valor_unitario: null,
    precio_unitario: null,
    subtotal_linea: null,
    total_linea: null,
    precio_compra_unitario: typeof p.precio_unitario === 'number' ? p.precio_unitario : parseFloat(p.precio_unitario) || null,
    subtotal: typeof p.subtotal === 'number' ? p.subtotal : parseFloat(p.subtotal) || null,
  })).filter((item: ItemCompraExtraido) => item.descripcion !== 'Producto sin nombre' || item.cantidad !== null)

  if (items.length === 0) {
    advertencias.push('La IA no detectó ninguna línea de producto en la imagen proporcionada.')
  }

  if (!rucEmisor && jsonResult.es_formal) {
    advertencias.push('El documento parece formal pero no se pudo leer el RUC del proveedor.')
  }

  const cabecera = {
    tipo_documento:      (esFormal ? 'factura' : 'nota_venta') as ResultadoExtracionCompra['tipo_documento'],
    es_formal:           esFormal,
    ruc_emisor:          rucEmisor || null,
    razon_social_emisor: jsonResult.razon_social || null,
    numero_factura:      jsonResult.numero_documento || null,
    fecha_factura:       jsonResult.fecha_emision || null,
    total_bruto:         typeof jsonResult.total_bruto === 'number' ? jsonResult.total_bruto : parseFloat(jsonResult.total_bruto) || null,
    igv:                 typeof jsonResult.igv === 'number' ? jsonResult.igv : parseFloat(jsonResult.igv) || null,
    total_neto:          typeof jsonResult.total_neto === 'number' ? jsonResult.total_neto : parseFloat(jsonResult.total_neto) || null,
  }

  console.log(`[Gemini V1] Éxito. RUC: ${cabecera.ruc_emisor}, Items: ${items.length}, Total: ${cabecera.total_neto}`)

  return { ...cabecera, items, advertencias }
}
