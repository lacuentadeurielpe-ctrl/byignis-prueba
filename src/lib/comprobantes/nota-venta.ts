// Nota de Venta interna (Split Billing).
//
// Cuando un pedido mezcla productos facturables (van al comprobante SUNAT) con
// productos NO facturables (informales), se emite además una "nota de venta"
// interna que lista TODOS los ítems del pedido. Así el cajero/almacén ve todo
// lo que el cliente lleva y el total cuadra con lo cobrado en caja.
//
// Este helper es AGNÓSTICO al proveedor de facturación: lo usan tanto el flujo
// Nubefact (emitir.ts) como el SUNAT Directo (sunat-directo-adapter.ts).

export interface CrearNotaVentaOpts {
  supabase:       any
  ferreteriaId:   string
  pedidoId:       string
  todosLosItems:  any[]   // TODOS los ítems del pedido (para el ticket interno)
  clienteNombre:  string
  clienteDoc:     string
  emitidoPor:     string
}

/**
 * Crea la nota de venta interna con todos los ítems del pedido.
 * Devuelve el id del comprobante creado, o undefined si no se pudo generar.
 */
export async function crearNotaVentaInterna(opts: CrearNotaVentaOpts): Promise<string | undefined> {
  const { supabase, ferreteriaId, pedidoId, todosLosItems, clienteNombre, clienteDoc, emitidoPor } = opts

  const { data: corrDataNV } = await supabase
    .rpc('generar_numero_comprobante', {
      p_ferreteria_id: ferreteriaId,
      p_tipo:          'nota_venta',
      p_serie:         'NV01',
    })

  if (!corrDataNV) return undefined

  const { numero, numero_completo } = corrDataNV

  const subtotalNV = todosLosItems.reduce((sum: number, i: any) => sum + (i.subtotal ?? 0), 0)

  const { data: nv } = await supabase.from('comprobantes').insert({
    ferreteria_id:   ferreteriaId,
    pedido_id:       pedidoId,
    tipo:            'nota_venta',
    serie:           'NV01',
    numero,
    numero_completo,
    estado:          'emitido',
    subtotal:        subtotalNV,
    igv:             0,
    total:           subtotalNV,
    cliente_nombre:  clienteNombre || 'CLIENTE VARIOS',
    cliente_ruc_dni: clienteDoc || '',
    emitido_por:     emitidoPor,
  }).select('id').single()

  return nv?.id
}
