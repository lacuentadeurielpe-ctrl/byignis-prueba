export interface ItemExtraccionUniversal {
  descripcion_factura: string
  cantidad: number
  unidad_factura: string
  precio_compra_unitario: number
  subtotal: number
  
  // Matching interactivo
  accion: 'crear' | 'actualizar'
  producto_existente_id: string | null
  producto_existente_nombre: string | null
  score_match: number
  sugerencias: Array<{ id: string; nombre: string; score: number }>
}

export interface ExtraccionUniversal {
  tipo_documento: 'factura' | 'boleta' | 'nota_venta' | 'ticket' | 'desconocido'
  es_formal: boolean
  ruc_proveedor: string | null
  razon_social_proveedor: string | null
  numero_factura: string | null
  fecha_factura: string | null // YYYY-MM-DD local timezone
  total_bruto: number
  igv: number
  total_neto: number
  items: ItemExtraccionUniversal[]
  advertencias: string[]
}
