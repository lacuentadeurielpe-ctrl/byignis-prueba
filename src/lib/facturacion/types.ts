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
  /** Sucursal emisora (resuelta por el servidor). null = local principal/series del tenant. */
  localId?:       string | null
}

export interface OpcionesEmisionFactura {
  supabase:      any
  pedidoId:      string
  ferreteriaId:  string
  clienteNombre: string
  clienteRuc:    string
  emitidoPor:    'dashboard' | 'bot'
  /** Sucursal emisora (resuelta por el servidor). null = local principal/series del tenant. */
  localId?:      string | null
}

export interface OpcionesNotaCredito {
  supabase:                any
  comprobanteReferenciaId: string
  ferreteriaId:            string
  motivoCodigo:            string   // catálogo 09 — ver catalogos-sunat.ts
  motivoDescripcion:       string
  emitidoPor:              'dashboard' | 'bot'
  /** Motivos de devolución (06/07): qué ítems del pedido original se devuelven,
   *  identificados por items_pedido.id (NO producto_id — dos líneas del mismo
   *  producto, o un ítem sin producto_id, colisionarían). */
  itemsDevueltos?:         { itemId: string; cantidad: number }[]
  /** Motivos de ajuste (04/05/08/09/10/11/12/13): monto directo, sin tocar
   *  ítems del pedido ni el stock. */
  montoAjuste?:            number
}

export interface OpcionesNotaDebito {
  supabase:                any
  comprobanteReferenciaId: string
  ferreteriaId:            string
  motivoCodigo:            string   // catálogo 10 — ver catalogos-sunat.ts
  motivoDescripcion:       string
  montoAjuste:             number   // ND siempre es un cargo adicional directo
  emitidoPor:              'dashboard' | 'bot'
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
  emitirNotaDebito(opts: OpcionesNotaDebito): Promise<ResultadoEmisionUnificado>

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
