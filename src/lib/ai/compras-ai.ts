/**
 * compras-ai.ts — Extracción de Compras (v4 — Mindee OCR API)
 *
 * Arquitectura:
 *   1. Integración directa con Mindee API (modelo InvoiceV4).
 *   2. Reemplaza por completo el sistema multi-agente / LLM.
 *   3. No se requiere cortar la imagen ni usar prompts frágiles.
 */

import { normalizarUnidad } from '@/lib/constantes/unidades'
import { reintentarIA } from '@/lib/ai/retry'
import { visionJSONOpenAI } from '@/lib/ai/openai'

import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai'

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
  
  const schema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      ruc_proveedor: { type: SchemaType.STRING, description: "El número de RUC de 11 dígitos del proveedor" },
      razon_social: { type: SchemaType.STRING, description: "El nombre o razón social del proveedor" },
      numero_documento: { type: SchemaType.STRING, description: "El número de serie y correlativo (ej. F001-12345)" },
      fecha_emision: { type: SchemaType.STRING, description: "La fecha de emisión en formato YYYY-MM-DD" },
      es_formal: { type: SchemaType.BOOLEAN, description: "true si detectas un RUC válido de 11 dígitos, false si es una nota de venta sin RUC" },
      total_bruto: { type: SchemaType.NUMBER, description: "El valor subtotal antes de aplicar el IGV" },
      igv: { type: SchemaType.NUMBER, description: "El monto exacto del impuesto IGV" },
      total_neto: { type: SchemaType.NUMBER, description: "El importe total final a pagar" },
      productos: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            descripcion: { type: SchemaType.STRING, description: "Nombre detallado del producto, incluyendo marca y medidas" },
            cantidad: { type: SchemaType.NUMBER, description: "Cantidad numérica de unidades" },
            precio_unitario: { type: SchemaType.NUMBER, description: "PRECIO CON IGV INCLUIDO. Si la tabla muestra Valor Unitario (sin IGV), multiplícalo por 1.18" },
            subtotal: { type: SchemaType.NUMBER, description: "TOTAL DE LA LÍNEA CON IGV INCLUIDO." }
          },
          required: ["descripcion", "cantidad", "precio_unitario", "subtotal"]
        }
      }
    },
    required: ["es_formal", "total_neto"]
  }

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { 
      responseMimeType: 'application/json',
      responseSchema: schema
    }
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
    Eres un experto contable procesando facturas y boletas de ferreterías en Perú.
    Extrae la siguiente información de las imágenes proporcionadas y devuélvela ESTRICTAMENTE en formato JSON usando esta estructura exacta (si no encuentras un valor, pon null, para números usa floats sin comillas):

    {
      "ruc_proveedor": "El número de RUC de 11 dígitos del proveedor que emite el documento",
      "razon_social": "El nombre o razón social del proveedor",
      "numero_documento": "El número de serie y correlativo (ej. F001-12345 o B001-987)",
      "fecha_emision": "La fecha de emisión en formato YYYY-MM-DD",
      "es_formal": "booleano, true si detectas un RUC válido de 11 dígitos y parece una Factura formal, false si es una nota de venta sin RUC",
      "total_bruto": "número float, el valor subtotal o valor de venta (el monto antes de aplicar el IGV)",
      "igv": "número float, el monto exacto del impuesto IGV (usualmente 18% en Perú)",
      "total_neto": "número float, el importe total final a pagar (incluyendo impuestos)",
      "productos": [
        {
          "descripcion": "Nombre detallado del producto, incluyendo marca y medidas",
          "cantidad": "número float, cantidad numérica de unidades",
          "precio_unitario": "número float, PRECIO CON IGV INCLUIDO. Si la tabla muestra 'Valor Unitario' (sin IGV), multiplícalo por 1.18",
          "subtotal": "número float, TOTAL DE LA LÍNEA CON IGV INCLUIDO. Si la tabla muestra importe sin IGV, multiplícalo por 1.18"
        }
      ]
    }

    REGLAS CRÍTICAS DE EXTRACCIÓN:
    1. Limpia los números (quita símbolos de moneda S/, comas de miles, solo deja el punto decimal).
    2. El RUC de nuestra empresa (comprador) es ${rucComprador || 'desconocido'}, así que el ruc_proveedor DEBE SER DIFERENTE a este.
    3. Para los productos: Es MUY COMÚN que las facturas en Perú detallen los ítems SIN IGV (Valor Unitario e Importe de línea). Tu trabajo es asegurar que el "precio_unitario" y el "subtotal" de cada producto en el JSON FINAL SÍ INCLUYAN EL IGV. Si la factura desglosa el IGV al final, haz el cálculo (multiplicar x 1.18) en cada ítem para que la suma matemática de todos los "subtotal" de los productos sea aproximadamente igual al "total_neto".
    4. Extrae TODAS las filas sin saltarte absolutamente ninguna. No resumas.
  `

  let jsonResult: any = null

  try {
    // Reintento con backoff: Gemini devuelve 503 "high demand" con frecuencia.
    const result = await reintentarIA(
      () => model.generateContent([prompt, ...imageParts]),
      { etiqueta: 'Gemini/compras' },
    )
    const textResponse = result.response.text()
    const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim()
    jsonResult = JSON.parse(cleanJson)
  } catch (error: any) {
    console.error('[Gemini] Error al comunicarse con Gemini:', error)

    // Fallback a OpenAI GPT-4o Vision (mismo prompt → mismo JSON).
    // No aplica a PDFs (GPT-4o Vision no los acepta): visionJSONOpenAI devuelve null.
    try {
      const fb = await visionJSONOpenAI({ imagenes, prompt, maxTokens: 4000 })
      if (fb?.json) {
        console.log('[IA] Extracción de factura resuelta con fallback OpenAI GPT-4o')
        jsonResult = fb.json
      }
    } catch (fbErr: any) {
      console.error('[OpenAI] Fallback de visión también falló:', fbErr?.message ?? fbErr)
    }

    if (!jsonResult) {
      const transitorio = /503|overloaded|high demand|service unavailable|unavailable|429|rate limit/i.test(String(error?.message ?? ''))
      throw new Error(
        transitorio
          ? 'El servicio de IA está temporalmente saturado. Espera unos segundos y vuelve a intentar.'
          : 'Error al analizar la imagen con IA: ' + error.message,
      )
    }
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
