// Capa de abstracción de facturación electrónica.
// Proveedor único: SUNAT Directo (vía microservicio Greenter/Lycet).
// Añadir un nuevo proveedor = implementar ProveedorFacturacion.

export type ProveedorFacturacionNombre = 'sunat_directo'

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

export interface OpcionesReintentoEnvio {
  supabase:      any
  comprobanteId: string
  ferreteriaId:  string
}

export interface OpcionesSolicitarAnulacion {
  supabase:      any
  comprobanteId: string
  ferreteriaId:  string
  motivo:        string
  usuario:       string   // quién la solicitó (para trazabilidad)
}

export interface ResultadoAnulacion {
  ok:    boolean
  error?: string
}

// ── Interfaz que todo proveedor debe implementar ──────────────────────────────

export interface ProveedorFacturacion {
  nombre: ProveedorFacturacionNombre

  emitirBoleta(opts: OpcionesEmisionBoleta): Promise<ResultadoEmisionUnificado>
  emitirFactura(opts: OpcionesEmisionFactura): Promise<ResultadoEmisionUnificado>
  emitirNotaCredito(opts: OpcionesNotaCredito): Promise<ResultadoEmisionUnificado>

  /**
   * Reintenta el envío de un comprobante que quedó en `error_reintentable`
   * (falla de infraestructura, no de rechazo SUNAT). Reutiliza la misma serie
   * y correlativo — no reserva uno nuevo. Proveedores que resuelven todo
   * síncrono pueden omitir el método.
   */
  reintentarEnvio?(opts: OpcionesReintentoEnvio): Promise<ResultadoEmisionUnificado>

  /**
   * Marca un comprobante para anulación. NO llama a SUNAT directamente — solo
   * registra la solicitud; el envío real (RC de baja para boletas, RA/Voided
   * para facturas) lo procesa el job nocturno, agrupado por día.
   */
  solicitarAnulacion(opts: OpcionesSolicitarAnulacion): Promise<ResultadoAnulacion>
}
