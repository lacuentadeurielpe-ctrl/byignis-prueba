import { SupabaseClient } from '@supabase/supabase-js'
import { VentasRepository, ItemPedidoInput, PedidoInput } from '../db/repositories/ventas'
import { ChatRepository } from '../db/repositories/chat'
import { DeliveryRepository } from '../db/repositories/logistica'
import { geocodificarDireccion, resolverGoogleApiKey } from '../delivery/geocoding'
import { crearEntrega } from '../delivery/assignment'
import { acomodarPedidoEnAgenda } from '../delivery/agenda/acomodar'
import { normalizarTelefono } from '../utils'
import { OrderStateService } from './order-state.service'

export interface ItemNuevoPedido {
  producto_id: string | null
  nombre_producto: string
  unidad: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
}

export interface PedidoPayload {
  nombre_cliente: string
  telefono_cliente: string
  modalidad: 'delivery' | 'recojo'
  direccion_entrega?: string
  zona_delivery_id?: string
  notas?: string
  items: ItemNuevoPedido[]
  fecha_entrega_programada?: string
  venta_directa?: boolean
  estado_pago?: string
  metodo_pago?: string
}

export class OrdersService {
  private ventasRepo: VentasRepository
  private chatRepo: ChatRepository
  private deliveryRepo: DeliveryRepository

  constructor(private supabase: SupabaseClient, private ferreteriaId: string, private usuarioId: string) {
    this.ventasRepo = new VentasRepository(supabase)
    this.chatRepo = new ChatRepository(supabase)
    this.deliveryRepo = new DeliveryRepository(supabase)
  }

  async crearPedido(payload: PedidoPayload) {
    if (!payload.nombre_cliente?.trim()) throw new Error('Nombre del cliente requerido')
    if (!payload.telefono_cliente?.trim()) throw new Error('Teléfono del cliente requerido')
    if (!payload.modalidad) throw new Error('Modalidad requerida')
    if (!payload.items?.length) throw new Error('Debe incluir al menos un item')
    if (payload.modalidad === 'delivery' && !payload.direccion_entrega?.trim()) {
      throw new Error('Dirección requerida para delivery')
    }

    const total = payload.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
    const costo_total = payload.items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0)

    // Validar stock si el tenant no permite venta sin stock
    await this.validarStockItems(payload.items)

    const numeroPedido = await this.ventasRepo.generarNumeroPedido(this.ferreteriaId)

    // Cliente
    let clienteId: string | null = null
    const telefonoNormalizado = normalizarTelefono(payload.telefono_cliente)
    const clienteExistente = await this.chatRepo.obtenerClientePorTelefono(this.ferreteriaId, telefonoNormalizado)

    if (clienteExistente) {
      clienteId = clienteExistente.id
      if (payload.nombre_cliente) {
        await this.supabase
          .from('clientes')
          .update({ nombre: payload.nombre_cliente.trim() })
          .eq('id', clienteId)
      }
    } else {
      const nuevoCliente = await this.chatRepo.crearCliente(this.ferreteriaId, telefonoNormalizado, payload.nombre_cliente.trim())
      clienteId = nuevoCliente.id
    }

    // El estado base es 'creado' (nuestro nuevo estado root en XState)
    // Pero como la base de datos no lo acepta, lo creamos directamente en estado 'pendiente' o 'programado'
    // O si es venta directa (POS), pasa a 'entregado'
    let estadoInicial = payload.fecha_entrega_programada ? 'programado' : 'pendiente'
    if (payload.venta_directa) {
      estadoInicial = 'entregado'
    }

    const pedido = await this.ventasRepo.crearPedido(
      this.ferreteriaId,
      {
        clienteId,
        numeroPedido,
        nombreCliente: payload.nombre_cliente.trim(),
        telefonoCliente: telefonoNormalizado,
        modalidad: payload.modalidad,
        direccionEntrega: payload.direccion_entrega?.trim() ?? null,
        zonaDeliveryId: payload.zona_delivery_id ?? null,
        estado: estadoInicial,
        total,
        costoTotal: costo_total,
        fechaEntregaProgramada: payload.fecha_entrega_programada ?? null,
        ...(payload.estado_pago ? { estadoPago: payload.estado_pago } : {}),
        ...(payload.metodo_pago ? { metodoPago: payload.metodo_pago } : {}),
      },
      payload.items.map(i => ({
        productoId: i.producto_id,
        nombreProducto: i.nombre_producto,
        unidad: i.unidad,
        cantidad: i.cantidad,
        precioOriginal: i.precio_unitario,
        precioUnitario: i.precio_unitario,
        subtotal: i.cantidad * i.precio_unitario,
        costoUnitario: i.costo_unitario
      }))
    )

    // Delivery: crear entrega + acomodar en la agenda (ventana). Se espera para
    // que la respuesta al POS/Ventas ya incluya la ventana propuesta.
    if (payload.modalidad === 'delivery') {
      const ventana = await this.iniciarLogisticaDelivery(
        pedido.id,
        payload.direccion_entrega ?? '',
        payload.fecha_entrega_programada ?? null,
      )
      if (ventana) {
        // Reflejar la ventana en el objeto devuelto (además de la BD)
        ;(pedido as Record<string, unknown>).ventana_inicio = ventana.ventanaInicio.toISOString()
        ;(pedido as Record<string, unknown>).ventana_fin = ventana.ventanaFin.toISOString()
        ;(pedido as Record<string, unknown>).ventana_confirmada = ventana.confirmada
      }
    }

    return pedido
  }

  /**
   * Crea la entrega y acomoda el pedido en la agenda del vehículo. El tiempo de
   * entrega lo define la VENTANA (declarada/encadenada por el repartidor), no un
   * ETA algorítmico. Geocodifica solo para guardar coords (best-effort).
   * Devuelve la ventana propuesta para mostrarla en la confirmación.
   */
  private async iniciarLogisticaDelivery(
    pedidoId: string,
    direccion: string,
    fechaProgramada: string | null,
  ): Promise<Awaited<ReturnType<typeof acomodarPedidoEnAgenda>>> {
    try {
      const dirEta = direccion.trim()
      // Geocodificar para guardar coords del cliente (tracking/mapas) — best-effort
      if (dirEta) {
        try {
          const { data: ferreteria } = await this.supabase
            .from('ferreterias')
            .select('lat, lng, nombre')
            .eq('id', this.ferreteriaId)
            .single()
          if (ferreteria?.lat && ferreteria?.lng) {
            const mapsApiKey = await resolverGoogleApiKey(this.supabase, this.ferreteriaId)
            const coords = await geocodificarDireccion(
              dirEta,
              ferreteria.nombre ?? 'Perú',
              { lat: ferreteria.lat, lng: ferreteria.lng, radiusKm: 80 },
              mapsApiKey,
            )
            if (coords) {
              await this.supabase
                .from('pedidos')
                .update({ cliente_lat: coords.lat, cliente_lng: coords.lng })
                .eq('id', pedidoId)
                .eq('ferreteria_id', this.ferreteriaId)
            }
          }
        } catch (e) {
          console.warn('[OrdersService] geocoding falló (continúa):', e)
        }
      }

      const entregaId = await crearEntrega({
        ferreteriaId: this.ferreteriaId,
        pedidoId,
        repartidorId: null,
        etaMinutos: null,
        prioridad: fechaProgramada ? 5 : 3,
        horaProgramadaAt: fechaProgramada ? new Date(fechaProgramada) : null,
        omitirCascadaEta: true,
        supabase: this.supabase,
      })

      return await acomodarPedidoEnAgenda({
        supabase: this.supabase,
        ferreteriaId: this.ferreteriaId,
        pedidoId,
        entregaId,
        esProgramado: !!fechaProgramada,
        fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null,
      })
    } catch (e) {
      console.error('[OrdersService] Error al iniciar logística', e)
      return null
    }
  }

  async editarPedido(pedidoId: string, payload: PedidoPayload) {
    // Validaciones
    if (!payload.nombre_cliente?.trim()) throw new Error('Nombre del cliente requerido')
    if (!payload.telefono_cliente?.trim()) throw new Error('Teléfono del cliente requerido')
    if (!payload.modalidad) throw new Error('Modalidad requerida')
    if (!payload.items?.length) throw new Error('Debe incluir al menos un item')
    if (payload.modalidad === 'delivery' && !payload.direccion_entrega?.trim()) {
      throw new Error('Dirección requerida para delivery')
    }

    const pedidoActual = await this.ventasRepo.obtenerPedidoPorId(this.ferreteriaId, pedidoId)
    if (!pedidoActual) throw new Error('Pedido no encontrado')

    // Bloquear edición si el pago ya fue confirmado (pre-requisito de boleta/factura SUNAT)
    if (pedidoActual.estado_pago === 'pagado') {
      throw new Error('No se puede editar un pedido con pago confirmado. Primero anula el comprobante SUNAT si ya fue emitido.')
    }

    const total = payload.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
    const costo_total = payload.items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0)

    let clienteId: string | null = pedidoActual.cliente_id ?? null
    const telefonoNormalizado = normalizarTelefono(payload.telefono_cliente)
    const clienteExistente = await this.chatRepo.obtenerClientePorTelefono(this.ferreteriaId, telefonoNormalizado)

    if (clienteExistente) {
      clienteId = clienteExistente.id
      await this.supabase
        .from('clientes')
        .update({ nombre: payload.nombre_cliente.trim() })
        .eq('id', clienteId)
    } else {
      const nuevoCliente = await this.chatRepo.crearCliente(this.ferreteriaId, telefonoNormalizado, payload.nombre_cliente.trim())
      if (nuevoCliente) clienteId = nuevoCliente.id
    }

    await this.ventasRepo.editarPedido(
      this.ferreteriaId,
      pedidoId,
      {
        nombre_cliente: payload.nombre_cliente.trim(),
        telefono_cliente: telefonoNormalizado,
        cliente_id: clienteId,
        modalidad: payload.modalidad,
        direccion_entrega: payload.modalidad === 'delivery' ? (payload.direccion_entrega?.trim() ?? null) : null,
        zona_delivery_id: payload.modalidad === 'delivery' && payload.zona_delivery_id ? payload.zona_delivery_id : null,
        notas: payload.notas?.trim() ?? null,
        total,
        costo_total,
      },
      payload.items
    )

    return { id: pedidoId, total, costo_total, items_count: payload.items.length }
  }

  private async validarStockItems(items: ItemNuevoPedido[]) {
    const { data: ferreteria } = await this.supabase
      .from('ferreterias')
      .select('permitir_venta_sin_stock')
      .eq('id', this.ferreteriaId)
      .single()

    // Si el tenant permite venta sin stock globalmente, no validar
    if (ferreteria?.permitir_venta_sin_stock) return

    const productIds = items
      .filter(i => i.producto_id)
      .map(i => i.producto_id as string)

    if (!productIds.length) return

    const { data: productos } = await this.supabase
      .from('productos')
      .select('id, stock, venta_sin_stock, nombre')
      .in('id', productIds)
      .eq('ferreteria_id', this.ferreteriaId)

    if (!productos) return

    const productoMap = new Map(productos.map(p => [p.id, p]))

    for (const item of items) {
      if (!item.producto_id) continue
      const prod = productoMap.get(item.producto_id)
      if (!prod) continue
      if (prod.venta_sin_stock) continue
      if ((prod.stock ?? 0) < item.cantidad) {
        throw new Error(
          `Stock insuficiente para "${prod.nombre}": disponible ${prod.stock ?? 0}, solicitado ${item.cantidad}`
        )
      }
    }
  }
}
