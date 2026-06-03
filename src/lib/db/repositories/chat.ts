import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conversacion, Cliente } from '@/types/database'
import { normalizarTelefono } from '@/lib/utils'

export interface MensajeInput {
  conversacionId: string
  role: 'cliente' | 'bot' | 'dueno'
  contenido: string
  ycloudMessageId?: string
}

export class ChatRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Busca un cliente por su número de teléfono.
   */
  async obtenerClientePorTelefono(ferreteriaId: string, telefono: string): Promise<Cliente | null> {
    const telNormal = normalizarTelefono(telefono)
    const { data, error } = await this.supabase
      .from('clientes')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .eq('telefono', telNormal)
      .maybeSingle()

    if (error) throw new Error(`Error al obtener cliente: ${error.message}`)
    return data
  }

  /**
   * Crea un nuevo cliente en la base de datos.
   */
  async crearCliente(ferreteriaId: string, telefono: string, nombre?: string | null): Promise<Cliente> {
    const telNormal = normalizarTelefono(telefono)
    const { data, error } = await this.supabase
      .from('clientes')
      .insert({ ferreteria_id: ferreteriaId, telefono: telNormal, nombre: nombre ?? null })
      .select()
      .single()

    if (error) throw new Error(`Error al crear cliente: ${error.message}`)
    return data
  }

  /**
   * Actualiza el nombre del cliente si está vacío.
   */
  async actualizarNombreClienteSiVacio(clienteId: string, nombre: string): Promise<void> {
    await this.supabase
      .from('clientes')
      .update({ nombre })
      .eq('id', clienteId)
      .is('nombre', null)
  }

  /**
   * Obtiene la conversación activa más reciente de un cliente.
   */
  async obtenerConversacionReciente(ferreteriaId: string, clienteId: string): Promise<Conversacion | null> {
    const { data } = await this.supabase
      .from('conversaciones')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .eq('cliente_id', clienteId)
      .order('ultima_actividad', { ascending: false })
      .limit(1)
      .maybeSingle()

    return data
  }

  /**
   * Reabre y actualiza la actividad de una conversación existente.
   */
  async reabrirConversacion(conversacionId: string, esCerrada: boolean): Promise<void> {
    await this.supabase
      .from('conversaciones')
      .update({
        ultima_actividad: new Date().toISOString(),
        ...(esCerrada ? { estado: 'activa', bot_pausado: false } : {}),
      })
      .eq('id', conversacionId)
  }

  /**
   * Crea una nueva conversación para un cliente.
   */
  async crearConversacion(ferreteriaId: string, clienteId: string): Promise<Conversacion> {
    const { data, error } = await this.supabase
      .from('conversaciones')
      .insert({
        ferreteria_id: ferreteriaId,
        cliente_id: clienteId,
        estado: 'activa',
        bot_pausado: false,
      })
      .select()
      .single()

    if (error) throw new Error(`Error al crear conversación: ${error.message}`)
    return data
  }

  /**
   * Inserta un mensaje en el historial.
   */
  async guardarMensaje(input: MensajeInput): Promise<void> {
    const { error } = await this.supabase.from('mensajes').insert({
      conversacion_id: input.conversacionId,
      role: input.role,
      contenido: input.contenido,
      ycloud_message_id: input.ycloudMessageId ?? null,
    })

    if (error) {
      console.error('[ChatRepository] Error al guardar mensaje:', error.message)
    }
  }

  /**
   * Obtiene el historial de mensajes de una conversación.
   */
  async obtenerHistorial(conversacionId: string, limite: number): Promise<{ role: 'cliente' | 'bot' | 'dueno'; contenido: string }[]> {
    const { data } = await this.supabase
      .from('mensajes')
      .select('role, contenido')
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: false })
      .limit(limite)

    return (data ?? []).reverse() as { role: 'cliente' | 'bot' | 'dueno'; contenido: string }[]
  }

  /**
   * Reactiva el bot removiendo la pausa.
   */
  async reactivarBot(conversacionId: string): Promise<void> {
    await this.supabase
      .from('conversaciones')
      .update({ bot_pausado: false, estado: 'activa' })
      .eq('id', conversacionId)
  }

  /**
   * Pausa el bot y registra la intervención manual.
   */
  async pausarBot(conversacionId: string): Promise<void> {
    await this.supabase
      .from('conversaciones')
      .update({
        bot_pausado: true,
        estado: 'intervenida_dueno',
        dueno_activo_at: new Date().toISOString(),
      })
      .eq('id', conversacionId)
  }

  /**
   * Verifica si un mensaje ya existe para deduplicación.
   */
  async mensajeYaProcesado(ycloudMessageId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('mensajes')
      .select('id')
      .eq('ycloud_message_id', ycloudMessageId)
      .maybeSingle()

    return !!data
  }

  /**
   * Verifica si se ha enviado un mensaje de fuera de horario recientemente (últimos 60 minutos).
   */
  async yaEnvioMensajeFueraHorario(conversacionId: string): Promise<boolean> {
    const hace60min = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data } = await this.supabase
      .from('mensajes')
      .select('id')
      .eq('conversacion_id', conversacionId)
      .eq('role', 'bot')
      .gte('created_at', hace60min)
      .ilike('contenido', '%estamos cerrados%')
      .limit(1)
      .maybeSingle()

    return !!data
  }

  /**
   * Obtiene los datos del flujo de una conversación.
   */
  async obtenerDatosFlujo(conversacionId: string): Promise<any | null> {
    const { data } = await this.supabase
      .from('conversaciones')
      .select('datos_flujo')
      .eq('id', conversacionId)
      .single()

    return data?.datos_flujo ?? null
  }

  /**
   * Obtiene el perfil de un cliente.
   */
  async obtenerPerfilCliente(ferreteriaId: string, clienteId: string): Promise<any | null> {
    const { data } = await this.supabase
      .from('clientes')
      .select('perfil')
      .eq('id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    return data?.perfil ?? null
  }

  /**
   * Obtiene el resumen de contexto de una conversación.
   */
  async obtenerResumenContexto(ferreteriaId: string, conversacionId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('conversaciones')
      .select('resumen_contexto')
      .eq('id', conversacionId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    return data?.resumen_contexto ?? null
  }

  /**
   * Obtiene la lista de conversaciones filtradas por ferretería.
   */
  async obtenerConversacionesList(ferreteriaId: string, limite = 50) {
    const { data, error } = await this.supabase
      .from('conversaciones')
      .select('id, estado, bot_pausado, ultima_actividad, clientes(nombre, telefono)')
      .eq('ferreteria_id', ferreteriaId)
      .order('ultima_actividad', { ascending: false })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los últimos mensajes para un grupo de IDs de conversación.
   */
  async obtenerUltimosMensajesPorConversaciones(conversacionIds: string[]) {
    if (conversacionIds.length === 0) return []
    const { data, error } = await this.supabase
      .from('mensajes')
      .select('conversacion_id, contenido, role, created_at')
      .in('conversacion_id', conversacionIds)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene todos los mensajes de una conversación específica.
   */
  async obtenerMensajesDeConversacion(conversacionId: string, limite = 200) {
    const { data, error } = await this.supabase
      .from('mensajes')
      .select('id, role, contenido, tipo, created_at')
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }

  /**
   * Cuenta el número total de mensajes en una conversación.
   */
  async contarMensajesDeConversacion(conversacionId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('conversacion_id', conversacionId)

    if (error) throw error
    return count ?? 0
  }

  /**
   * Obtiene una conversación por ID validando la ferretería.
   */
  async obtenerConversacionPorId(ferreteriaId: string, conversacionId: string) {
    const { data, error } = await this.supabase
      .from('conversaciones')
      .select('*, clientes(nombre, telefono)')
      .eq('id', conversacionId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Cuenta conversaciones con actividad dentro de un rango de fechas.
   */
  async contarConversacionesActivasRango(ferreteriaId: string, inicio: string, fin: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('conversaciones')
      .select('*', { count: 'exact', head: true })
      .eq('ferreteria_id', ferreteriaId)
      .gte('ultima_actividad', inicio)
      .lt('ultima_actividad', fin)

    if (error) throw error
    return count ?? 0
  }

  /**
   * Cuenta las conversaciones donde el bot está pausado (intervención del dueño).
   */
  async contarConversacionesPausadas(ferreteriaId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('conversaciones')
      .select('*', { count: 'exact', head: true })
      .eq('ferreteria_id', ferreteriaId)
      .eq('bot_pausado', true)

    if (error) throw error
    return count ?? 0
  }
}
