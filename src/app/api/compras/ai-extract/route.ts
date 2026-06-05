import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { extraerCompraDeImagenes } from '@/lib/ai/compras-ai'
import { filtrarRucProveedor } from '@/lib/matching/ruc-filter'
import { reconciliarPreciosEImpuestos } from '@/lib/matching/math-reconciler'
import { aplicarUmbralMatching } from '@/lib/matching/threshold-rules'

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
  sugerencias: Array<{ id: string; nombre: string; score: number }>
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

    // 1. Obtener RUC de la ferretería activa (comprador)
    const { data: ferreteria } = await supabase
      .from('ferreterias')
      .select('ruc')
      .eq('id', session.ferreteriaId)
      .single()

    const rucComprador = ferreteria?.ruc || null

    // 2. Extraer datos con IA, inyectando RUC comprador como contexto negativo
    const extraccion = await extraerCompraDeImagenes(imagenes, rucComprador)

    // 3. Filtrar RUC del proveedor
    const rucFiltrado = filtrarRucProveedor(extraccion.ruc_emisor, rucComprador)

    // 4. Reconciliación matemática de precios, cantidades e IGV
    const reconciliacion = reconciliarPreciosEImpuestos(extraccion, extraccion.items)

    // 5. Cargar catálogo de productos activos para matching local
    const { data: productosCatalog } = await supabase
      .from('productos')
      .select('id, nombre, codigo_interno, unidad, precio_base, precio_compra, stock')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('activo', true)

    // 6. Cargar alias históricos de matching
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

    // 7. Aplicar umbral de severidad de matching (>= 75%) y obtener sugerencias
    const itemsProcesados: ItemParaReconciliar[] = reconciliacion.items.map((item) => {
      return aplicarUmbralMatching(item, catalogo, alias)
    })

    // Consolidar todas las advertencias generadas en el pipeline
    const todasAdvertencias = [
      ...(rucFiltrado.advertencia ? [rucFiltrado.advertencia] : []),
      ...reconciliacion.advertencias,
      ...extraccion.advertencias
    ]

    const respuesta: RespuestaAIExtractCompras = {
      tipo_documento: reconciliacion.cabecera.tipo_documento,
      es_formal: reconciliacion.cabecera.es_formal,
      ruc_proveedor: rucFiltrado.ruc,
      razon_social_proveedor: extraccion.razon_social_emisor,
      numero_factura: extraccion.numero_factura,
      fecha_factura: extraccion.fecha_factura,
      total_bruto: reconciliacion.cabecera.total_bruto,
      igv: reconciliacion.cabecera.igv,
      total_neto: reconciliacion.cabecera.total_neto,
      items: itemsProcesados,
      advertencias: todasAdvertencias,
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
