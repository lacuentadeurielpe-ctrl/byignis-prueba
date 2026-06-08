import { SupabaseClient } from '@supabase/supabase-js'

/**
 * EntregasRepository
 *
 * Centraliza toda la lógica de entregas/delivery.
 * Responsabilidades:
 * - CRUD de entregas
 * - Transiciones de estado
 * - Asignación de repartidores
 * - Tracking GPS
 */
export class EntregasRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Obtener entregas de una ferretería filtradas por estado
   */
  async obtenerEntregas(ferreteriaId: string, estado?: string) {
    let query = this.supabase
      .from('entregas')
      .select(`
        id, estado, asignado_at, salio_at, llego_at,
        distancia_km, duracion_estimada_min, duracion_real_min,
        direccion_entrega, instrucciones,
        gps_ultima_lat, gps_ultima_lng, gps_actualizado_at,
        pedidos(id, numero_pedido, nombre_cliente, telefono_cliente, total),
        zonas_delivery(id, nombre),
        repartidores(id, nombre, telefono),
        vehiculos_delivery(id, tipo, placa)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .order('asignado_at', { ascending: false })

    if (estado) query = query.eq('estado', estado)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  }

  /**
   * Obtener entregas sin repartidor asignado
   */
  async obtenerEntregasSinAsignar(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('entregas')
      .select(`
        id, pedido_id, zona_delivery_id, estado, direccion_entrega, asignado_at,
        pedidos(numero_pedido, nombre_cliente, telefono_cliente, total),
        zonas_delivery(nombre, tiempo_estimado_min)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .eq('estado', 'asignado')
      .is('repartidor_id', null)
      .order('asignado_at', { ascending: true })

    if (error) throw new Error(error.message)
    return data
  }

  /**
   * Asignar entrega a repartidor
   */
  async asignarRepartidor(
    entregaId: string,
    repartidorId: string,
    vehiculoId?: string
  ) {
    const { data, error } = await this.supabase
      .from('entregas')
      .update({
        repartidor_id: repartidorId,
        vehiculo_id: vehiculoId || null
      })
      .eq('id', entregaId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  /**
   * Marcar entrega como "en camino"
   */
  async marcarEnCamino(entregaId: string) {
    const { data, error } = await this.supabase
      .from('entregas')
      .update({
        estado: 'en_camino',
        salio_at: new Date().toISOString()
      })
      .eq('id', entregaId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  /**
   * Registrar ubicación GPS del repartidor
   */
  async actualizarGPS(
    entregaId: string,
    lat: number,
    lng: number
  ) {
    const { data, error } = await this.supabase
      .from('entregas')
      .update({
        gps_ultima_lat: lat,
        gps_ultima_lng: lng,
        gps_actualizado_at: new Date().toISOString()
      })
      .eq('id', entregaId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  /**
   * Marcar entrega como completada
   */
  async completarEntrega(
    entregaId: string,
    options: {
      nota?: string
      firmaUrl?: string
      fotos?: string[]
    } = {}
  ) {
    // 1. Obtener entrega para calcular duración
    const { data: entrega, error: errGet } = await this.supabase
      .from('entregas')
      .select('salio_at, pedido_id')
      .eq('id', entregaId)
      .single()

    if (errGet) throw new Error(errGet.message)

    let duracionRealMin = null
    if (entrega.salio_at) {
      const ahora = new Date()
      const salio = new Date(entrega.salio_at)
      duracionRealMin = Math.round((ahora.getTime() - salio.getTime()) / 60000)
    }

    // 2. Actualizar entrega
    const { data: entregaUpdated, error: errUpdate } = await this.supabase
      .from('entregas')
      .update({
        estado: 'entregado',
        llego_at: new Date().toISOString(),
        nota_entrega: options.nota || null,
        firma_cliente_url: options.firmaUrl || null,
        comprobante_fotos: options.fotos || [],
        duracion_real_min: duracionRealMin
      })
      .eq('id', entregaId)
      .select()
      .single()

    if (errUpdate) throw new Error(errUpdate.message)

    // 3. Actualizar pedido a entregado
    await this.supabase
      .from('pedidos')
      .update({ estado: 'entregado' })
      .eq('id', entrega.pedido_id)

    return entregaUpdated
  }

  /**
   * Cancelar entrega
   */
  async cancelarEntrega(entregaId: string, razon?: string) {
    const { data, error } = await this.supabase
      .from('entregas')
      .update({
        estado: 'cancelado',
        nota_entrega: razon || 'Entrega cancelada'
      })
      .eq('id', entregaId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  /**
   * Obtener estadísticas de entregas por zona
   */
  async obtenerEstadisticasPorZona(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('entregas')
      .select(
        `
          estado,
          zona_delivery_id,
          zonas_delivery(nombre),
          id
        `
      )
      .eq('ferreteria_id', ferreteriaId)

    if (error) throw new Error(error.message)

    // Agrupar por zona
    const stats: Record<string, any> = {}
    data.forEach((entry: any) => {
      const zonaId = entry.zona_delivery_id
      const zonaNombre = entry.zonas_delivery?.nombre || 'Sin zona'

      if (!stats[zonaId]) {
        stats[zonaId] = {
          zona_id: zonaId,
          zona_nombre: zonaNombre,
          total: 0,
          asignado: 0,
          en_camino: 0,
          entregado: 0,
          cancelado: 0
        }
      }

      stats[zonaId].total++
      stats[zonaId][entry.estado] = (stats[zonaId][entry.estado] || 0) + 1
    })

    return Object.values(stats)
  }

  /**
   * Obtener repartidores disponibles para una zona
   */
  async obtenerRepartidoresParaZona(ferreteriaId: string, zonaId: string) {
    const { data, error } = await this.supabase
      .from('repartidores')
      .select(`
        id, nombre, telefono, activo,
        vehiculos_delivery(id, tipo, placa)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)
      // TODO: Filtrar por zona de cobertura cuando esté implementado

    if (error) throw new Error(error.message)
    return data
  }
}
