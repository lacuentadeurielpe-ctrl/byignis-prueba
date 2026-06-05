/**
 * compras-ai.ts — Extracción de Compras (v4 — Mindee OCR API)
 *
 * Arquitectura:
 *   1. Integración directa con Mindee API (modelo InvoiceV4).
 *   2. Reemplaza por completo el sistema multi-agente / LLM.
 *   3. No se requiere cortar la imagen ni usar prompts frágiles.
 */

import type * as mindeeTypes from 'mindee'
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

// ── Extractor principal ───────────────────────────────────────────────────────

export async function extraerCompraDeImagenes(
  imagenes: { base64: string; mimeType: string }[],
  rucComprador: string | null = null
): Promise<ResultadoExtracionCompra> {
  const mindee = require('mindee')
  if (imagenes.length === 0) throw new Error('No se enviaron imágenes')

  const apiKey = process.env.MINDEE_API_KEY
  if (!apiKey) throw new Error('MINDEE_API_KEY no está configurada en .env')

  const mindeeClient = new mindee.Client({ apiKey })
  const advertencias: string[] = []

  console.log('[Mindee] Iniciando extracción de factura con Invoice V4...')

  // Como la mayoría de facturas en Perú se pueden leer en la primera página
  // mandamos la primera imagen (Mindee cobra por página/documento).
  // Si enviaste un PDF completo, lo ideal es mandar el documento completo.
  // Por ahora procesamos la imagen [0] que suele contener toda la tabla
  // si es una foto de comprobante largo, o la factura principal.
  const imgData = imagenes[0]
  const cleanB64 = imgData.base64.replace(/^data:[^;]+;base64,/, '')
  
  // Asignamos una extensión basada en el mimeType
  const ext = imgData.mimeType === 'application/pdf' ? 'pdf' : 
              imgData.mimeType.includes('png') ? 'png' : 'jpg'
  
  const inputSource = new mindee.Base64Input({ inputString: cleanB64, filename: `factura.${ext}` })

  let apiResponse
  try {
    // @ts-ignore: Mindee v5 types are strictly expecting BaseProduct which InvoiceV4 extends but TS fails to resolve
    apiResponse = await mindeeClient.enqueueAndGetResult(mindee.v1.product.InvoiceV4, inputSource, {})
  } catch (error: any) {
    console.error('[Mindee] Error de API:', error)
    throw new Error('Error al conectar con Mindee API: ' + error.message)
  }

  const prediction = apiResponse.document.inference.prediction

  // 1. Extraer Cabecera
  const rucsRaw = prediction.supplierCompanyRegistrations?.map((r: any) => r.value) || []
  let rucEmisor = rucsRaw.find((r: string) => r && r.length === 11 && /^\d+$/.test(r)) || null
  
  // Lógica inversa: si el RUC detectado es el nuestro, lo ignoramos y advertimos
  if (rucEmisor && rucComprador && rucEmisor === rucComprador) {
    rucEmisor = null
    advertencias.push('El RUC detectado era el de nuestra ferretería. Se omitió para el proveedor.')
  }

  const tipoDocumentoDetectado = prediction.documentType?.value === 'INVOICE' ? 'factura' : 'boleta'
  const esFormal = !!rucEmisor

  const totalBruto = prediction.totalNet?.value ?? null
  const totalNeto = prediction.totalAmount?.value ?? null
  const igvAmount = prediction.taxes?.[0]?.value ?? null

  const cabecera = {
    tipo_documento:      (esFormal ? tipoDocumentoDetectado : 'nota_venta') as ResultadoExtracionCompra['tipo_documento'],
    es_formal:           esFormal,
    ruc_emisor:          rucEmisor,
    razon_social_emisor: prediction.supplierName?.value || null,
    numero_factura:      prediction.invoiceNumber?.value || null,
    fecha_factura:       prediction.date?.value || null,
    total_bruto:         totalBruto,
    igv:                 igvAmount,
    total_neto:          totalNeto,
  }

  // 2. Extraer Líneas de Productos (Line Items)
  const lineItemsRaw = prediction.lineItems || []
  const items: ItemCompraExtraido[] = lineItemsRaw.map((line: any) => {
    // line tiene campos como: description, quantity, unitPrice, totalAmount
    const qty = line.quantity ?? null
    const price = line.unitPrice ?? null
    const total = line.totalAmount ?? null
    
    return {
      descripcion:            line.description ? String(line.description).trim() : 'Producto sin nombre',
      cantidad:               qty,
      unidad:                 'NIU', // Mindee v4 no suele extraer unidad estándar, por defecto 'NIU'
      valor_unitario:         null,
      precio_unitario:        null,
      subtotal_linea:         null,
      total_linea:            null,
      precio_compra_unitario: price,
      subtotal:               total,
    }
  }).filter((item: ItemCompraExtraido) => item.descripcion !== 'Producto sin nombre' || item.cantidad !== null)

  if (items.length === 0) {
    advertencias.push('Mindee no detectó ninguna línea de producto en este comprobante.')
  }

  if (!cabecera.ruc_emisor && esFormal) {
    advertencias.push('No se detectó RUC válido del proveedor.')
  }

  console.log(`[Mindee] Éxito. RUC: ${cabecera.ruc_emisor}, Items: ${items.length}, Total: ${cabecera.total_neto}`)

  return { ...cabecera, items, advertencias }
}
