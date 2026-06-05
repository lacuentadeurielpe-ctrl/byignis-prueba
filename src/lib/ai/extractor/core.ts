import { createClient } from '@/lib/supabase/server'
import { extraerCompraDeImagenes } from '@/lib/ai/compras-ai'
import { filtrarRucProveedor } from '@/lib/matching/ruc-filter'
import { reconciliarPreciosEImpuestos } from '@/lib/matching/math-reconciler'
import { aplicarUmbralMatching } from '@/lib/matching/threshold-rules'
import { ExtraccionUniversal, ItemExtraccionUniversal } from './types'

interface OpcionesExtraccion {
  ferreteriaId: string
  timezoneOffset?: number // Minutos desde UTC, provistos por el cliente
}

export async function procesarComprobanteUniversal(
  imagenes: { base64: string; mimeType: string }[],
  opciones: OpcionesExtraccion
): Promise<ExtraccionUniversal> {
  const supabase = await createClient()

  // 1. Obtener RUC del inquilino (comprador)
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('ruc')
    .eq('id', opciones.ferreteriaId)
    .single()

  const rucComprador = ferreteria?.ruc || null

  // 2. Extracción bruta mediante Gemini AI
  const extraccion = await extraerCompraDeImagenes(imagenes, rucComprador)

  // 3. Limpieza y validación de RUC
  const rucFiltrado = filtrarRucProveedor(extraccion.ruc_emisor, rucComprador)

  // 4. Reconciliación matemática
  const reconciliacion = reconciliarPreciosEImpuestos(extraccion, extraccion.items)

  // Ajuste de Timezone automático (Si el cliente envía su offset, si no, intentamos usar America/Lima (-300 min))
  // La IA suele extraer en la zona local del ticket, por lo que a menos que se transforme a UTC para DB, 
  // la fecha local es generalmente correcta. Si es ISO, la dejamos como viene.
  // Aquí la mantendremos como YYYY-MM-DD literal extraído por Gemini.

  // 5. Cargar catálogo de este negocio para matching
  const { data: productosCatalog } = await supabase
    .from('productos')
    .select('id, nombre, codigo_interno, unidad, precio_base, precio_compra, stock')
    .eq('ferreteria_id', opciones.ferreteriaId)
    .eq('activo', true)

  // 6. Cargar alias históricos
  const { data: aliasHistoricos } = await supabase
    .from('alias_productos')
    .select('alias, producto_id')
    .eq('ferreteria_id', opciones.ferreteriaId)

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

  // 7. Aplicar umbral de IA
  const itemsProcesados: ItemExtraccionUniversal[] = reconciliacion.items.map((item) => {
    return aplicarUmbralMatching(item, catalogo, alias) as ItemExtraccionUniversal
  })

  // 8. Unificar advertencias
  const advertencias = [
    ...(rucFiltrado.advertencia ? [rucFiltrado.advertencia] : []),
    ...reconciliacion.advertencias,
    ...extraccion.advertencias
  ]

  return {
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
    advertencias
  }
}
