/**
 * compras-ai.ts — Extracción de Compras (v4 — Mindee OCR API)
 *
 * Arquitectura:
 *   1. Integración directa con Mindee API (modelo InvoiceV4).
 *   2. Reemplaza por completo el sistema multi-agente / LLM.
 *   3. No se requiere cortar la imagen ni usar prompts frágiles.
 */

import { normalizarUnidad } from '@/lib/constantes/unidades'

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

import * as mindee from 'mindee'

export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[],
  rucComprador: string | null = null
): Promise<ResultadoExtracionCompra> {
  if (imagenes.length === 0) throw new Error('No se enviaron imágenes')

  const apiKey = process.env.MINDEE_API_KEY
  if (!apiKey) throw new Error('MINDEE_API_KEY no está configurada en .env')

  const mindeeClient = new mindee.Client({ apiKey })
  const advertencias: string[] = []

  console.log('[Mindee] Iniciando extracción de factura con modelo personalizado V2...')

  const imgData = imagenes[0]
  const cleanB64 = imgData.base64.replace(/^data:[^;]+;base64,/, '')
  const ext = imgData.mimeType === 'application/pdf' ? 'pdf' : 
              imgData.mimeType.includes('png') ? 'png' : 'jpg'
  
  const inputSource = new mindee.Base64Input({ inputString: cleanB64, filename: `factura.${ext}` })

  let apiResponse
  try {
    apiResponse = await mindeeClient.enqueueAndGetResult(
      mindee.product.Extraction,
      inputSource,
      { modelId: '8ce28e2f-df16-48a9-a805-bba38150f597' }
    )
  } catch (error: any) {
    console.error('[Mindee] Error de API:', error)
    throw new Error('Error al conectar con Mindee API: ' + error.message)
  }

  const documentRes = (apiResponse as any).document || (apiResponse as any).inference?.document || (apiResponse as any)
  const prediction = documentRes?.inference?.prediction || documentRes?.prediction || {}
  const fields = prediction.fields || prediction

  // Inject raw keys into warnings if nothing was found, for debugging
  const foundKeys = Object.keys(fields)

  const getValue = (key1: string, key2?: string, key3?: string) => {
    let raw = fields[key1]
    if (raw === undefined && key2) raw = fields[key2]
    if (raw === undefined && key3) raw = fields[key3]

    if (raw === undefined || raw === null) return null
    if (typeof raw === 'string' || typeof raw === 'number') return raw
    if (raw.value !== undefined) return raw.value
    if (raw.content !== undefined) return raw.content
    return null
  }

  // 1. Extraer Cabecera
  const supplierName = getValue('supplier_name', 'Supplier Name', 'supplierName')
  
  // RUC
  const rucField = fields['supplier_company_registration'] || fields['Supplier Company Registrations'] || fields['Supplier Registration']
  let rucEmisor: string | null = null
  const rucArray = Array.isArray(rucField) ? rucField : (rucField?.values || rucField?.elements)
  if (Array.isArray(rucArray)) {
    const reg = rucArray.find((r: any) => r && (r.number?.value || r.number || r.value || typeof r === 'string'))
    rucEmisor = reg ? (reg.number?.value || reg.number?.content || reg.number || reg.value || reg) : null
  } else if (rucField) {
    rucEmisor = rucField.number?.value || rucField.number || rucField.value || rucField
  }
  
  if (rucEmisor && typeof rucEmisor === 'string') {
    const digits = rucEmisor.replace(/\D/g, '')
    rucEmisor = digits.length === 11 ? digits : rucEmisor
  }

  if (rucEmisor && rucComprador && rucEmisor === rucComprador) {
    rucEmisor = null
    advertencias.push('El RUC detectado era el de nuestra ferretería. Se omitió para el proveedor.')
  }

  const invoiceNumber = getValue('invoice_number', 'Invoice Number', 'invoiceNumber')
  const invoiceDate = getValue('date', 'Invoice Date', 'date_issue')
  const tipoDocumentoDetectado = 'factura'
  const esFormal = !!rucEmisor

  const parseNum = (val: any) => {
    if (val == null) return null
    const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''))
    return isNaN(num) ? null : num
  }

  const totalNeto = parseNum(getValue('total_amount', 'Total Amount', 'totalAmount'))
  const igvAmount = parseNum(getValue('total_tax', 'Total Tax', 'totalTax'))
  const totalBruto = parseNum(getValue('total_net', 'Total Net', 'totalNet')) || (totalNeto !== null && igvAmount !== null ? totalNeto - igvAmount : null)

  const cabecera = {
    tipo_documento:      (esFormal ? tipoDocumentoDetectado : 'nota_venta') as ResultadoExtracionCompra['tipo_documento'],
    es_formal:           esFormal,
    ruc_emisor:          rucEmisor,
    razon_social_emisor: supplierName || null,
    numero_factura:      invoiceNumber || null,
    fecha_factura:       invoiceDate || null,
    total_bruto:         totalBruto,
    igv:                 igvAmount,
    total_neto:          totalNeto,
  }

  // 2. Extraer Líneas de Productos
  const lineItemsField = fields['line_items'] || fields['Line Items'] || fields['lineItems'] || fields['items']
  const lineItemsRaw = Array.isArray(lineItemsField) ? lineItemsField : (lineItemsField?.values || lineItemsField?.elements || [])
  
  const items: ItemCompraExtraido[] = lineItemsRaw.map((line: any) => {
    if (!line || typeof line === 'string') return null

    const extractVal = (k1: string, k2?: string) => {
      let raw = line[k1] || line.fields?.[k1]
      if (raw === undefined && k2) raw = line[k2] || line.fields?.[k2]
      if (raw === undefined || raw === null) return null
      return raw.value !== undefined ? raw.value : (raw.content !== undefined ? raw.content : raw)
    }

    const desc = extractVal('description', 'Description')
    const qty = parseNum(extractVal('quantity', 'Quantity'))
    const price = parseNum(extractVal('unit_price', 'Unit Price'))
    const total = parseNum(extractVal('total_price', 'Total Price')) || parseNum(extractVal('total_amount', 'Total Amount'))
    
    return {
      descripcion:            desc ? String(desc).trim() : 'Producto sin nombre',
      cantidad:               qty,
      unidad:                 'NIU',
      valor_unitario:         null,
      precio_unitario:        null,
      subtotal_linea:         null,
      total_linea:            null,
      precio_compra_unitario: price,
      subtotal:               total,
    }
  }).filter((item: any) => item !== null && (item.descripcion !== 'Producto sin nombre' || item.cantidad !== null)) as ItemCompraExtraido[]

  if (items.length === 0) {
    advertencias.push('La IA no detectó ninguna línea de producto o la tabla no coincide con el esquema.')
  }

  if (!cabecera.ruc_emisor && esFormal) {
    advertencias.push('No se detectó RUC válido del proveedor.')
  }

  // Debugging fields if critical data is missing
  if (!cabecera.ruc_emisor || items.length === 0 || cabecera.total_neto === null) {
    advertencias.push(`DEBUG KEYS: ${foundKeys.join(', ')}`)
  }

  console.log(`[Mindee V2] Éxito. RUC: ${cabecera.ruc_emisor}, Items: ${items.length}, Total: ${cabecera.total_neto}`)

  return { ...cabecera, items, advertencias }
}
