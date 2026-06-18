import type { SupabaseClient } from '@supabase/supabase-js'

export interface EntregaInput {
  ferreteriaId: string
  pedidoId: string
  repartidorId?: string | null
  etaMinutos: number
  estado?: string
}

export class DeliveryRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Registra una nueva entrega para un pedido (despacho delivery).
   */
  async crearEntrega(input: EntregaInput) {
    const { data, error } = await this.supabase
      .from('entregas')
      .insert({
        ferreteria_id: input.ferreteriaId,
        pedido_id:     input.pedidoId,
        repartidor_id: input.repartidorId ?? null,
        eta_minutos:   input.etaMinutos,
        estado:        input.estado ?? 'pendiente',
      })
      .select()
      .single()

    if (error) throw new Error(`Error al crear entrega logística: ${error.message}`)
    return data
  }

  /**
   * Obtiene la lista de vehículos activos de una ferretería con sus velocidades.
   */
  async listarVehiculosActivos(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('vehiculos')
      .select('id, velocidad_promedio_kmh, activo')
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)
      .order('velocidad_promedio_kmh', { ascending: false })

    if (error) throw new Error(`Error al listar vehículos: ${error.message}`)
    return data ?? []
  }

  /**
   * Obtiene el total de entregas pendientes en cola de reparto para estimación de ETA.
   */
  async contarEntregasEnCola(ferreteriaId: string, excludingPedidoId?: string): Promise<number> {
    let query = this.supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('ferreteria_id', ferreteriaId)
      .eq('modalidad', 'delivery')
      .in('estado', ['confirmado', 'en_preparacion', 'enviado'])

    if (excludingPedidoId) query = query.neq('id', excludingPedidoId)

    const { count, error } = await query
    if (error) throw new Error(`Error al contar cola de reparto: ${error.message}`)
    return count ?? 0
  }

  /**
   * Obtiene información detallada de una entrega y su repartidor asignado.
   */
  async obtenerEntregaConRepartidor(ferreteriaId: string, entregaId: string) {
    const { data, error } = await this.supabase
      .from('entregas')
      .select('*, repartidores(*)')
      .eq('id', entregaId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (error) throw new Error(`Error al obtener entrega: ${error.message}`)
    return data
  }

  async listarRepartidores(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('repartidores')
      .select('id, nombre, telefono, activo')
      .eq('ferreteria_id', ferreteriaId)
      .order('nombre')
    if (error) throw error
    return data ?? []
  }

  async obtenerRepartidorActivo(ferreteriaId: string, repartidorId: string) {
    const { data, error } = await this.supabase
      .from('repartidores')
      .select('id, nombre, telefono')
      .eq('id', repartidorId)
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)
      .single()
    if (error) throw error
    return data
  }

  async asignarRepartidorAPedido(ferreteriaId: string, pedidoId: string, repartidorId: string | null) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .update({ repartidor_id: repartidorId })
      .eq('id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .select('id, repartidor_id')
      .single()
    if (error) throw error
    return data
  }

  async listarZonasDelivery(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('zonas_delivery')
      .select('id, nombre, tiempo_estimado_min')
      .eq('ferreteria_id', ferreteriaId)
      .order('nombre')
    if (error) throw error
    return data ?? []
  }

  async listarRepartidoresActivosConToken(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('repartidores')
      .select('id, nombre, telefono, token')
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)
      .not('telefono', 'is', null)
    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene entregas en curso o completadas hoy para el dashboard de delivery.
   */
  async obtenerEntregasDashboard(ferreteriaId: string, hoyStr: string) {
    const { data, error } = await this.supabase
      .from('entregas')
      .select(`
        id, estado, orden_en_ruta, eta_actual,
        distancia_km, duracion_estimada_min, duracion_real_min,
        salio_at, llego_at,
        pedidos(id, numero_pedido, nombre_cliente, direccion_entrega, total, eta_minutos, estado),
        vehiculos(id, nombre, tipo),
        repartidores(id, nombre)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .or(`estado.in.(pendiente,carga,en_ruta),and(estado.eq.entregado,llego_at.gte.${hoyStr}T00:00:00),and(estado.eq.fallida,created_at.gte.${hoyStr}T00:00:00)`)
      .order('orden_en_ruta', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene pedidos programados en un rango de fechas.
   */
  async obtenerPedidosProgramados(ferreteriaId: string, inicioHoy: string, fin14dias: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('id, numero_pedido, nombre_cliente, telefono_cliente, direccion_entrega, total, modalidad, fecha_entrega_programada, zonas_delivery(nombre)')
      .eq('ferreteria_id', ferreteriaId)
      .eq('estado', 'programado')
      .gte('fecha_entrega_programada', inicioHoy)
      .lt('fecha_entrega_programada', fin14dias)
      .order('fecha_entrega_programada', { ascending: true })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene la información de un repartidor por su token de acceso activo.
   */
  async obtenerRepartidorPorToken(token: string) {
    const { data, error } = await this.supabase
      .from('repartidores')
      .select('id, nombre, ferreteria_id, puede_registrar_deuda, pin_hash, ferreterias(nombre, modo_asignacion_delivery)')
      .eq('token', token)
      .eq('activo', true)
      .single()

    if (error) return null
    return data
  }

  /**
   * Obtiene todos los pedidos asignados a un repartidor con estado activo.
   */
  async obtenerPedidosAsignadosRepartidor(ferreteriaId: string, repartidorId: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, nombre_cliente, telefono_cliente,
        direccion_entrega, total, estado, estado_pago, notas,
        cobrado_monto, cobrado_metodo, incidencia_tipo, incidencia_desc,
        created_at, cliente_id, monto_pagado, eta_minutos, fecha_entrega_programada,
        clientes(nombre, telefono, limite_credito_monto),
        zonas_delivery(nombre),
        items_pedido(id, nombre_producto, cantidad, precio_unitario),
        entregas(id, estado, eta_actual, hora_fin_declarada, orden_en_ruta, salio_at, vehiculo_id, vehiculos(nombre, tipo))
      `)
      .eq('ferreteria_id', ferreteriaId)
      .eq('repartidor_id', repartidorId)
      .in('estado', ['confirmado', 'en_preparacion', 'enviado', 'programado'])
      .order('created_at', { ascending: true })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los cobros registrados por el repartidor el día de hoy.
   */
  async obtenerCobrosHoyRepartidor(ferreteriaId: string, repartidorId: string, hoyStr: string) {
    // Filtramos por updated_at (no created_at) porque updated_at se actualiza
    // al marcar el pedido como 'entregado', capturando la fecha real de entrega.
    // Esto soluciona el caso de pedidos creados ayer pero entregados hoy.
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('id, numero_pedido, total, cobrado_monto, cobrado_metodo, estado_pago, clientes(nombre), created_at')
      .eq('ferreteria_id', ferreteriaId)
      .eq('repartidor_id', repartidorId)
      .eq('estado', 'entregado')
      .gte('updated_at', `${hoyStr}T00:00:00`)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los pedidos del tipo delivery disponibles para auto-asignarse.
   */
  async obtenerPedidosDisponiblesReparto(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, nombre_cliente, telefono_cliente,
        direccion_entrega, total, estado, estado_pago, notas,
        cobrado_monto, cobrado_metodo, incidencia_tipo, incidencia_desc,
        created_at, fecha_entrega_programada,
        clientes(nombre, telefono),
        zonas_delivery(nombre),
        items_pedido(id, nombre_producto, cantidad, precio_unitario)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .is('repartidor_id', null)
      .eq('modalidad', 'delivery')
      .in('estado', ['confirmado', 'en_preparacion', 'programado'])
      .order('created_at', { ascending: true })

    if (error) throw error
    return data ?? []
  }

  async crearZonasDelivery(ferreteriaId: string, zonas: { nombre: string, tiempo_estimado_min: number }[]) {
    const { data, error } = await this.supabase
      .from('zonas_delivery')
      .insert(
        zonas.map((z) => ({
          ferreteria_id: ferreteriaId,
          nombre: z.nombre,
          tiempo_estimado_min: z.tiempo_estimado_min,
        }))
      )

    if (error) throw error
    return data
  }

  async crearZonaDelivery(ferreteriaId: string, nombre: string, tiempo_estimado_min: number) {
    const { data, error } = await this.supabase
      .from('zonas_delivery')
      .insert({
        ferreteria_id: ferreteriaId,
        nombre: nombre,
        tiempo_estimado_min: tiempo_estimado_min,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async actualizarZonaDelivery(ferreteriaId: string, id: string, fields: { nombre?: string, tiempo_estimado_min?: number }) {
    const { data, error } = await this.supabase
      .from('zonas_delivery')
      .update(fields)
      .eq('id', id)
      .eq('ferreteria_id', ferreteriaId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async eliminarZonaDelivery(ferreteriaId: string, id: string) {
    const { error } = await this.supabase
      .from('zonas_delivery')
      .delete()
      .eq('id', id)
      .eq('ferreteria_id', ferreteriaId)

    if (error) throw error
  }

  async obtenerTrackingEntrega(entregaId: string) {
    const { data, error } = await this.supabase
      .from('entregas')
      .select(`
        id, estado, eta_actual, distancia_km,
        pedidos(
          id, numero_pedido, nombre_cliente, telefono_cliente,
          direccion_entrega, total, estado, eta_minutos,
          cliente_lat, cliente_lng
        ),
        vehiculos(nombre, tipo, velocidad_promedio_kmh),
        repartidores(
          nombre, telefono,
          gps_ultima_lat, gps_ultima_lng, gps_actualizado_at,
          ferreterias(nombre, telefono_whatsapp)
        )
      `)
      .eq('id', entregaId)
      .single()

    if (error) throw error
    return data
  }

  async listarVehiculos(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('vehiculos')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .order('nombre')

    if (error) throw error
    return data ?? []
  }

  async crearVehiculo(ferreteriaId: string, vehiculo: {
    nombre: string
    tipo: string
    capacidad_kg: number
    capacidad_m3: number
    velocidad_promedio_kmh: number
    costo_por_km: number | null
  }) {
    const { data, error } = await this.supabase
      .from('vehiculos')
      .insert({
        ferreteria_id: ferreteriaId,
        nombre: vehiculo.nombre,
        tipo: vehiculo.tipo,
        capacidad_kg: vehiculo.capacidad_kg,
        capacidad_m3: vehiculo.capacidad_m3,
        velocidad_promedio_kmh: vehiculo.velocidad_promedio_kmh,
        costo_por_km: vehiculo.costo_por_km,
        activo: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async actualizarVehiculo(ferreteriaId: string, id: string, fields: any) {
    const { data, error } = await this.supabase
      .from('vehiculos')
      .update(fields)
      .eq('id', id)
      .eq('ferreteria_id', ferreteriaId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async contarEntregasActivasDeVehiculo(ferreteriaId: string, vehiculoId: string) {
    const { count, error } = await this.supabase
      .from('entregas')
      .select('id', { count: 'exact', head: true })
      .eq('vehiculo_id', vehiculoId)
      .eq('ferreteria_id', ferreteriaId)
      .in('estado', ['pendiente', 'carga', 'en_ruta'])

    if (error) throw error
    return count ?? 0
  }

  async eliminarVehiculo(ferreteriaId: string, id: string) {
    const { error } = await this.supabase
      .from('vehiculos')
      .delete()
      .eq('id', id)
      .eq('ferreteria_id', ferreteriaId)

    if (error) throw error
  }
}
