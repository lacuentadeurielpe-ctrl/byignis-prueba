import type { SupabaseClient } from '@supabase/supabase-js'

export interface ItemCotizacionInput {
  productoId: string | null
  nombreProducto: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  noDisponible?: boolean
  nota?: string | null
}

export interface PedidoInput {
  cotizacionId?: string
  clienteId: string | null
  numeroPedido: string
  nombreCliente: string
  telefonoCliente: string
  direccionEntrega?: string | null
  zonaDeliveryId?: string | null
  modalidad: string
  estado: string
  estadoPago?: string
  metodoPago?: string
  total: number
  costoTotal: number | null
  fechaEntregaProgramada?: string | null
}

export interface ItemPedidoInput {
  productoId: string | null
  nombreProducto: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  costoUnitario: number
}

export class VentasRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Guarda una cotización y sus ítems en la base de datos.
   */
  async guardarCotizacion(
    ferreteriaId: string,
    conversacionId: string,
    clienteId: string,
    total: number,
    requiereAprobacion: boolean,
    items: ItemCotizacionInput[]
  ) {
    const { data: cotizacion, error: errCot } = await this.supabase
      .from('cotizaciones')
      .insert({
        ferreteria_id: ferreteriaId,
        conversacion_id: conversacionId,
        cliente_id: clienteId,
        estado: requiereAprobacion ? 'pendiente_aprobacion' : 'enviada',
        total,
        requiere_aprobacion: requiereAprobacion,
      })
      .select()
      .single()

    if (errCot || !cotizacion) throw new Error(`Error al guardar cotización: ${errCot?.message}`)
    const cotId = (cotizacion as any).id

    const { error: errItems } = await this.supabase.from('items_cotizacion').insert(
      items.map((i) => ({
        cotizacion_id: cotId,
        producto_id: i.productoId ?? null,
        nombre_producto: i.nombreProducto,
        unidad: i.unidad,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
        precio_original: i.precioUnitario,
        subtotal: i.subtotal,
        no_disponible: i.noDisponible ?? false,
        nota_disponibilidad: i.nota ?? null,
      }))
    )

    if (errItems) throw new Error(`Error al registrar ítems de cotización: ${errItems.message}`)

    // Si no requiere aprobación, actualizar flujo de conversación
    if (!requiereAprobacion) {
      await this.supabase
        .from('conversaciones')
        .update({ datos_flujo: { cotizacion_id: cotId, paso: 'esperando_confirmacion' } })
        .eq('id', conversacionId)
    }

    return { id: cotId, total }
  }

  /**
   * Obtiene una cotización activa y sus productos.
   */
  async obtenerCotizacionActiva(ferreteriaId: string, cotizacionId: string) {
    const { data, error } = await this.supabase
      .from('cotizaciones')
      .select('*, items_cotizacion(*)')
      .eq('id', cotizacionId)
      .eq('ferreteria_id', ferreteriaId)
      .in('estado', ['enviada', 'aprobada'])
      .single()

    if (error) throw new Error(`Error al obtener cotización activa: ${error.message}`)
    return data
  }

  /**
   * Genera un número de correlativo de pedido.
   */
  async generarNumeroPedido(ferreteriaId: string): Promise<string> {
    const { data, error } = await this.supabase
      .rpc('generar_numero_pedido', { p_ferreteria_id: ferreteriaId })

    if (error || !data) throw new Error(`Error al generar correlativo de pedido: ${error?.message ?? 'sin datos'}`)
    return data as string
  }

  /**
   * Crea un nuevo pedido con sus ítems en el checkout.
   */
  async crearPedido(
    ferreteriaId: string,
    input: PedidoInput,
    items: ItemPedidoInput[]
  ) {
    // Guard: nunca crear un pedido "fantasma" sin ítems (BUG-017)
    if (!items || items.length === 0) {
      throw new Error('No se puede crear un pedido sin ítems — al menos un producto es requerido')
    }

    const { data: pedido, error: errPed } = await this.supabase
      .from('pedidos')
      .insert({
        ferreteria_id: ferreteriaId,
        cotizacion_id: input.cotizacionId,
        cliente_id: input.clienteId,
        numero_pedido: input.numeroPedido,
        nombre_cliente: input.nombreCliente,
        telefono_cliente: input.telefonoCliente,
        direccion_entrega: input.direccionEntrega ?? null,
        zona_delivery_id: input.zonaDeliveryId ?? null,
        modalidad: input.modalidad,
        estado: input.estado,
        estado_pago: input.estadoPago,
        metodo_pago: input.metodoPago,
        total: input.total,
        costo_total: input.costoTotal,
        // Si el pago ya está confirmado al crear (venta directa POS, pago digital previo),
        // registrar monto_pagado = total para que finanzas lo contabilice correctamente.
        monto_pagado: input.estadoPago === 'pagado' ? input.total : 0,
        fecha_entrega_programada: input.fechaEntregaProgramada ?? null,
      })
      .select()
      .single()

    if (errPed || !pedido) throw new Error(`Error al crear el pedido: ${errPed?.message}`)
    const pedidoId = (pedido as any).id

    // Insertar ítems de pedido
    const { error: errItems } = await this.supabase.from('items_pedido').insert(
      items.map((i) => ({
        pedido_id: pedidoId,
        producto_id: i.productoId,
        nombre_producto: i.nombreProducto,
        unidad: i.unidad,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
        subtotal: i.subtotal,
        costo_unitario: i.costoUnitario,
      }))
    )

    if (errItems) throw new Error(`Error al registrar ítems de pedido: ${errItems.message}`)

    // El stock se descuenta automáticamente a través del trigger 'trigger_items_pedido_stock'
    // en la tabla items_pedido, por lo tanto no necesitamos invocar un RPC manualmente.

    // Marcar la cotización como aprobada
    if (input.cotizacionId) {
      await this.supabase
        .from('cotizaciones')
        .update({ estado: 'aprobada' })
        .eq('id', input.cotizacionId)
        .eq('ferreteria_id', ferreteriaId)

      // Limpiar flujo de la conversación
      await this.supabase
        .from('conversaciones')
        .update({ datos_flujo: null })
        .eq('cliente_id', input.clienteId)
    }

    return pedido
  }

  /**
   * Obtiene pedidos recientes del cliente o un pedido específico.
   */
  async obtenerPedidos(ferreteriaId: string, clienteId: string, numeroPedido?: string) {
    let query = this.supabase
      .from('pedidos')
      .select('id, numero_pedido, estado, estado_pago, modalidad, total, created_at')
      .eq('ferreteria_id', ferreteriaId)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (numeroPedido) query = query.eq('numero_pedido', numeroPedido)

    const { data, error } = await query
    if (error) throw new Error(`Error al consultar pedidos: ${error.message}`)
    return data ?? []
  }

  /**
   * Obtiene el último pedido editable de un cliente.
   */
  async obtenerUltimoPedidoEditable(ferreteriaId: string, clienteId: string) {
    const { data } = await this.supabase
      .from('pedidos')
      .select('id, numero_pedido, total, estado, estado_pago, modalidad, created_at, modificaciones_count, nombre_cliente, direccion_entrega, items_pedido(*)')
      .eq('ferreteria_id', ferreteriaId)
      .eq('cliente_id', clienteId)
      .in('estado', ['confirmado', 'en_preparacion'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return data
  }

  async obtenerPedidosDashboard(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono, dni_ruc), zonas_delivery(nombre), items_pedido(*), comprobantes(id, tipo, numero_completo, estado, pdf_url), metodo_pago, estado_pago, pago_confirmado_por, pago_confirmado_at')
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data ?? []
  }

  async obtenerCotizacionesDashboard(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('cotizaciones')
      .select('*, clientes(nombre, telefono), items_cotizacion(*, productos(precio_compra))')
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data ?? []
  }

  async obtenerPagosDashboard(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('pagos_registrados')
      .select(`
        id, metodo, monto, moneda, numero_operacion, nombre_pagador,
        ultimos_digitos, fecha_pago, banco_origen, estado, url_captura,
        confianza_extraccion, notas, registrado_at,
        cliente:clientes(id, nombre, telefono),
        pedido:pedidos(id, numero_pedido, total)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .order('registrado_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data ?? []
  }

  async obtenerPedidoPorId(ferreteriaId: string, pedidoId: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono), zonas_delivery(nombre), items_pedido(*)')
      .eq('id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (error) throw error
    return data
  }

  async actualizarEstadoPedido(ferreteriaId: string, pedidoId: string, updates: any) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .update(updates)
      .eq('id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .select('*, clientes(nombre, telefono), items_pedido(*)')
      .single()

    if (error) throw error
    return data
  }

  async eliminarPedido(ferreteriaId: string, pedidoId: string) {
    const { error } = await this.supabase
      .from('pedidos')
      .delete()
      .eq('id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)

    if (error) throw error
  }

  async actualizarPagoPedido(ferreteriaId: string, pedidoId: string, updates: any) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .update(updates)
      .eq('id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .select('id, estado_pago, metodo_pago, pago_confirmado_por, pago_confirmado_at')
      .single()

    if (error) throw error
    return data
  }

  async editarPedido(
    ferreteriaId: string,
    pedidoId: string,
    input: {
      nombre_cliente: string
      telefono_cliente: string
      cliente_id: string | null
      modalidad: 'delivery' | 'recojo'
      direccion_entrega: string | null
      zona_delivery_id: string | null
      notas: string | null
      total: number
      costo_total: number
    },
    items: any[]
  ) {
    // 1. Update pedido
    const { error: errUpdate } = await this.supabase
      .from('pedidos')
      .update(input)
      .eq('id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
    if (errUpdate) throw errUpdate

    // 2. Delete existing items
    const { error: errDelItems } = await this.supabase
      .from('items_pedido')
      .delete()
      .eq('pedido_id', pedidoId)
    if (errDelItems) throw errDelItems

    // 3. Insert new items
    const { error: errItems } = await this.supabase
      .from('items_pedido')
      .insert(
        items.map((i) => ({
          pedido_id: pedidoId,
          producto_id: i.producto_id,
          nombre_producto: i.nombre_producto,
          unidad: i.unidad,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          costo_unitario: i.costo_unitario,
          subtotal: i.cantidad * i.precio_unitario,
        }))
      )
    if (errItems) throw errItems
  }

  async obtenerPedidosPorFerreteria(ferreteriaId: string, estado?: string | null) {
    let query = this.supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono), zonas_delivery(nombre), items_pedido(*), eta_minutos, direccion_entrega, entregas(id, estado, vehiculos(nombre, tipo))')
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (estado) query = query.eq('estado', estado)

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  }

  async vencerCreditosAntiguos(ferreteriaId: string, hoy: string) {
    const { data: creditosAVencer } = await this.supabase
      .from('creditos')
      .select('id, pedido_id')
      .eq('ferreteria_id', ferreteriaId)
      .eq('estado', 'activo')
      .lt('fecha_limite', hoy)

    if (creditosAVencer && creditosAVencer.length > 0) {
      await this.supabase
        .from('creditos')
        .update({ estado: 'vencido' })
        .in('id', creditosAVencer.map(c => c.id))

      const pedidoIds = creditosAVencer
        .filter(c => c.pedido_id)
        .map(c => c.pedido_id as string)

      if (pedidoIds.length > 0) {
        await this.supabase
          .from('pedidos')
          .update({ estado_pago: 'credito_vencido' })
          .in('id', pedidoIds)
          .eq('ferreteria_id', ferreteriaId)
          .eq('estado_pago', 'credito_activo')
      }
    }
  }

  async listarCreditosDashboard(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('creditos')
      .select(`
        *,
        clientes(id, nombre, telefono),
        pedidos(id, numero_pedido, total),
        abonos_credito(id, monto, metodo_pago, notas, registrado_por, created_at)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async crearCredito(ferreteriaId: string, input: { clienteId: string, pedidoId: string, montoTotal: number, fechaLimite: string, aprobadoPor: string, notas?: string | null }) {
    const { data, error } = await this.supabase
      .from('creditos')
      .insert({
        ferreteria_id: ferreteriaId,
        cliente_id: input.clienteId,
        pedido_id: input.pedidoId,
        monto_total: input.montoTotal,
        monto_pagado: 0,
        fecha_limite: input.fechaLimite,
        estado: 'activo',
        aprobado_por: input.aprobadoPor,
        notas: input.notas ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  /**
   * Obtiene los pedidos activos excluyendo cancelados. (Legacy)
   */
  async obtenerPedidosActivosPipeline(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('id, estado, total, nombre_cliente, numero_pedido, created_at, updated_at')
      .eq('ferreteria_id', ferreteriaId)
      .not('estado', 'in', '(cancelado)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene la cuenta de pedidos en curso por estado agrupado mediante RPC (Fase 4).
   */
  async obtenerPipelineCounts(ferreteriaId: string) {
    const { data, error } = await this.supabase.rpc('dashboard_pipeline', {
      f_id: ferreteriaId
    })

    if (error) throw error
    
    // Transformar array [{estado_pedido: 'pendiente', cantidad: 5}, ...] a un Record
    const pipeline: Record<string, number> = {}
    for (const row of (data || [])) {
      pipeline[row.estado_pedido] = Number(row.cantidad)
    }
    return pipeline
  }

  /**
   * Obtiene los últimos 5 pedidos en curso (Fase 4).
   */
  async obtenerPedidosRecientesEnCurso(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('id, nombre_cliente, numero_pedido, estado')
      .eq('ferreteria_id', ferreteriaId)
      .in('estado', ['pendiente', 'confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado'])
      .order('updated_at', { ascending: false })
      .limit(5)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los cobros pendientes del día (pedidos entregados pero sin pagar).
   */
  async obtenerCobrosPendientesHoy(ferreteriaId: string, inicioHoy: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('id, numero_pedido, nombre_cliente, total, metodo_pago')
      .eq('ferreteria_id', ferreteriaId)
      .eq('estado', 'entregado')
      .neq('estado_pago', 'pagado')
      .gte('created_at', inicioHoy)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los pedidos creados a partir de una fecha específica.
   */
  async obtenerPedidosDesdeFecha(ferreteriaId: string, fecha: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('created_at')
      .eq('ferreteria_id', ferreteriaId)
      .gte('created_at', fecha)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene las cotizaciones creadas a partir de una fecha específica.
   */
  async obtenerCotizacionesDesdeFecha(ferreteriaId: string, fecha: string) {
    const { data, error } = await this.supabase
      .from('cotizaciones')
      .select('created_at')
      .eq('ferreteria_id', ferreteriaId)
      .gte('created_at', fecha)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene ítems de cotización para calcular productos estrella.
   */
  async obtenerTopProductos30d(ferreteriaId: string, hace30: string) {
    const { data, error } = await this.supabase
      .from('items_cotizacion')
      .select('nombre_producto, cantidad, cotizaciones!inner(ferreteria_id, created_at)')
      .eq('cotizaciones.ferreteria_id', ferreteriaId)
      .gte('cotizaciones.created_at', hace30)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene pedidos dentro de un rango de fechas para reportes (Legacy, considerar usar obtenerKPIsRango).
   */
  async obtenerPedidosRango(ferreteriaId: string, inicio: string, fin: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('estado, total, costo_total')
      .eq('ferreteria_id', ferreteriaId)
      .gte('created_at', inicio)
      .lt('created_at', fin)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los KPIs de ventas para el dashboard.
   * Calcula directamente sin necesidad de una función SQL personalizada.
   */
  async obtenerKPIsRango(ferreteriaId: string, inicio: string, fin: string) {
    // 1. Obtener pedidos confirmados del rango (excluye pendiente, cancelado, programado)
    const { data: pedidos, error: pedidosError } = await this.supabase
      .from('pedidos')
      .select('id, estado, total')
      .eq('ferreteria_id', ferreteriaId)
      .not('estado', 'in', '(pendiente,cancelado,programado)')
      .gte('created_at', inicio)
      .lt('created_at', fin)

    if (pedidosError) throw pedidosError

    const pedidosList = pedidos ?? []
    if (pedidosList.length === 0) {
      return { pedidos_n: 0, entregados_n: 0, ingresos_total: 0, ganancia_total: 0 }
    }

    const pedidos_n    = pedidosList.length
    const entregados_n = pedidosList.filter((p: any) => p.estado === 'entregado').length
    const ingresos_total = pedidosList.reduce((sum: number, p: any) => sum + Number(p.total ?? 0), 0)

    // 2. Calcular COGS a partir de items_pedido + precio_compra de productos
    const pedidoIds = pedidosList.map((p: any) => p.id)
    const { data: items } = await this.supabase
      .from('items_pedido')
      .select('pedido_id, cantidad, producto_id, productos(precio_compra)')
      .in('pedido_id', pedidoIds)

    const cogs = (items ?? []).reduce((sum: number, item: any) => {
      const costo = Number(item.productos?.precio_compra ?? 0)
      return sum + Number(item.cantidad ?? 0) * costo
    }, 0)

    const ganancia_total = Math.max(0, ingresos_total - cogs)

    return { pedidos_n, entregados_n, ingresos_total, ganancia_total }
  }

  /**
   * Obtiene actividad de pedidos reciente para el feed.
   */
  async obtenerFeedPedidos(ferreteriaId: string, limite = 14) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('id, numero_pedido, nombre_cliente, estado, updated_at, total')
      .eq('ferreteria_id', ferreteriaId)
      .not('estado', 'in', '(pendiente)')
      .order('updated_at', { ascending: false })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene actividad de cotizaciones reciente para el feed.
   */
  async obtenerFeedCotizaciones(ferreteriaId: string, limite = 6) {
    const { data, error } = await this.supabase
      .from('cotizaciones')
      .select('id, estado, created_at, clientes(nombre)')
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene pagos registrados recientes para el feed.
   */
  async obtenerFeedPagos(ferreteriaId: string, limite = 5) {
    const { data, error } = await this.supabase
      .from('pagos_registrados')
      .select('id, monto, estado, registrado_at, clientes(nombre)')
      .eq('ferreteria_id', ferreteriaId)
      .order('registrado_at', { ascending: false })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }
}
