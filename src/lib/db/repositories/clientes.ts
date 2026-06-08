import type { SupabaseClient } from '@supabase/supabase-js'

export class ClientesRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Obtiene todos los clientes de una ferretería con resumen de pedidos y créditos.
   */
  async obtenerClientesConResumen(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('clientes')
      .select(`
        id, nombre, telefono, dni_ruc, tipo, alias, email,
        telefono_secundario, direccion_habitual, tags, notas_internas, created_at,
        pedidos(id, total, estado, created_at),
        creditos(monto_total, monto_pagado, estado)
      `)
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los datos detallados del perfil de un cliente.
   */
  async obtenerDetalleCliente(ferreteriaId: string, clienteId: string) {
    const { data, error } = await this.supabase
      .from('clientes')
      .select(`
        id, nombre, telefono, dni_ruc, tipo, alias, email,
        telefono_secundario, direccion_habitual, tags, notas_internas, created_at
      `)
      .eq('id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Obtiene la lista de pedidos de un cliente.
   */
  async obtenerPedidosDeCliente(ferreteriaId: string, clienteId: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('id, numero_pedido, estado, estado_pago, total, modalidad, created_at, items_pedido(nombre_producto, cantidad, precio_unitario, subtotal)')
      .eq('cliente_id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene la lista de cotizaciones de un cliente.
   */
  async obtenerCotizacionesDeCliente(ferreteriaId: string, clienteId: string) {
    const { data, error } = await this.supabase
      .from('cotizaciones')
      .select('id, estado, total, created_at')
      .eq('cliente_id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene la lista de créditos de un cliente con sus abonos correspondientes.
   */
  async obtenerCreditosDeCliente(ferreteriaId: string, clienteId: string) {
    const { data, error } = await this.supabase
      .from('creditos')
      .select(`
        id, monto_total, monto_pagado, fecha_limite, estado, created_at, notas,
        pedidos(numero_pedido),
        abonos_credito(id, monto, metodo_pago, notas, created_at)
      `)
      .eq('cliente_id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Cuenta el número de clientes nuevos registrados en un rango de fechas.
   */
  async contarClientesNuevosRango(ferreteriaId: string, inicio: string, fin: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('ferreteria_id', ferreteriaId)
      .gte('created_at', inicio)
      .lt('created_at', fin)

    if (error) throw error
    return count ?? 0
  }

  /**
   * Obtiene la lista de oportunidades de CRM de un cliente.
   */
  async obtenerOportunidadesDeCliente(ferreteriaId: string, clienteId: string) {
    const { data, error } = await this.supabase
      .from('crm_oportunidades')
      .select('id, titulo, descripcion, estado, valor_estimado, probabilidad_cierre, fecha_cierre_estimada, created_at, cotizacion_id')
      .eq('cliente_id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene el feed de notas/bitácora de un cliente.
   */
  async obtenerNotasDeCliente(ferreteriaId: string, clienteId: string) {
    const { data, error } = await this.supabase
      .from('cliente_notas')
      .select('id, tipo, contenido, created_at, autor_id')
      .eq('cliente_id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }
}
