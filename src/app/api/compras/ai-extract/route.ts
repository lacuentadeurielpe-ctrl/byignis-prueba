import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { extraerCompraDeImagenes } from '@/lib/ai/compras-ai'
import { buscarMatchProducto } from '@/lib/matching/product-matcher'

export interface ItemParaReconciliar {
  descripcion_factura: string
  cantidad: number
  unidad_factura: string
  precio_compra_unitario: number
  subtotal: number
  
  // Matching
  accion: 'crear' | 'actualizar'
  producto_existente_id: string | null
  producto_existente_nombre: string | null
  score_match: number
}

export interface RespuestaAIExtractCompras {
  tipo_documento: 'factura' | 'boleta' | 'nota_venta' | 'ticket' | 'desconocido'
  es_formal: boolean
  ruc_proveedor: string | null
  razon_social_proveedor: string | null
  numero_factura: string | null
  fecha_factura: string | null
  total_bruto: number
  igv: number
  total_neto: number
  items: ItemParaReconciliar[]
  advertencias: string[]
}

// POST /api/compras/ai-extract
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    const body = await request.json()
    const { imagenes } = body as {
      imagenes?: { base64: string; mimeType: string }[]
    }

    if (!imagenes || imagenes.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos una imagen' }, { status: 400 })
    }

    // 1. Extraer datos con IA (Vision o Fallback OCR + Text)
    const extraccion = await extraerCompraDeImagenes(imagenes)

    // 2. Cargar catálogo de productos activos
    const { data: productosCatalog } = await supabase
      .from('productos')
      .select('id, nombre, codigo_interno, unidad, precio_base, precio_compra, stock')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('activo', true)

    // 3. Cargar alias históricos de matching
    const { data: aliasHistoricos } = await supabase
      .from('alias_productos')
      .select('alias, producto_id')
      .eq('ferreteria_id', session.ferreteriaId)

    const catalogo = (productosCatalog ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      codigo_interno: p.codigo_interno,
      unidad: p.unidad,
      precio_base: Number(p.precio_base || 0),
      precio_compra: Number(p.precio_compra || 0),
      stock: Number(p.stock || 0),
    }))

    const alias = (aliasHistoricos ?? []).map((a) => ({
      alias: a.alias,
      producto_id: a.producto_id,
    }))

    // 4. Ejecutar matching para cada ítem
    const itemsProcesados: ItemParaReconciliar[] = extraccion.items.map((item) => {
      const desc = item.descripcion || 'Producto sin descripción'
      const match = buscarMatchProducto(desc, catalogo, alias)

      return {
        descripcion_factura: desc,
        cantidad: item.cantidad ?? 1,
        unidad_factura: item.unidad ?? 'NIU',
        precio_compra_unitario: item.precio_compra_unitario ?? 0,
        subtotal: item.subtotal ?? 0,
        
        accion: match.accion,
        producto_existente_id: match.producto_existente_id,
        producto_existente_nombre: match.producto_existente_nombre,
        score_match: match.score,
      }
    })

    const respuesta: RespuestaAIExtractCompras = {
      tipo_documento: extraccion.tipo_documento,
      es_formal: extraccion.es_formal,
      ruc_proveedor: extraccion.ruc_proveedor,
      razon_social_proveedor: extraccion.razon_social_emisor,
      numero_factura: extraccion.numero_factura,
      fecha_factura: extraccion.fecha_factura,
      total_bruto: extraccion.total_bruto ?? 0,
      igv: extraccion.igv ?? 0,
      total_neto: extraccion.total_neto ?? 0,
      items: itemsProcesados,
      advertencias: extraccion.advertencias,
    }

    return NextResponse.json(respuesta)
  } catch (err: any) {
    console.error('[API AI-Extract Compras]', err)
    return NextResponse.json(
      { error: err.message || 'Error al procesar el comprobante' },
      { status: 500 }
    )
  }
}
