// Capa de abstracción de facturación electrónica.
// Hoy soporta Nubefact y SUNAT Directo (vía microservicio Greenter).
// Añadir un nuevo proveedor = implementar ProveedorFacturacion.

export type ProveedorFacturacionNombre = 'nubefact' | 'sunat_directo'

// ── Resultado unificado (compatible con lo que ya usa el resto del código) ────

export interface ResultadoEmisionUnificado {
  ok:                       boolean
  comprobanteId?:           string
  numeroCompleto?:          string    // ej: 'B001-00000001'
  pdfUrl?:                  string
  xmlUrl?:                  string
  error?:                   string
  tokenInvalido?:           boolean   // credenciales inválidas
  comprobanteSecundarioId?: string    // nota de venta si hay items informales
}

// ── Opciones de emisión (agnósticas al proveedor) ─────────────────────────────

export interface OpcionesEmisionBoleta {
  supabase:       any
  pedidoId:       string
  ferreteriaId:   string
  clienteNombre:  string
  clienteDni:     string
  emitidoPor:     'dashboard' | 'bot'
}

export interface OpcionesEmisionFactura {
  supabase:      any
  pedidoId:      string
  ferreteriaId:  string
  clienteNombre: string
  clienteRuc:    string
  emitidoPor:    'dashboard' | 'bot'
}

export interface OpcionesNotaCredito {
  supabase:                any
  comprobanteReferenciaId: string
  ferreteriaId:            string
  motivoCodigo:            string
  motivoDescripcion:       string
  emitidoPor:              'dashboard' | 'bot'
  itemsDevueltos?:         { producto_id: string | null; cantidad: number }[]
}

// ── Interfaz que todo proveedor debe implementar ──────────────────────────────

export interface ProveedorFacturacion {
  nombre: ProveedorFacturacionNombre

  emitirBoleta(opts: OpcionesEmisionBoleta): Promise<ResultadoEmisionUnificado>
  emitirFactura(opts: OpcionesEmisionFactura): Promise<ResultadoEmisionUnificado>
  emitirNotaCredito(opts: OpcionesNotaCredito): Promise<ResultadoEmisionUnificado>
}
